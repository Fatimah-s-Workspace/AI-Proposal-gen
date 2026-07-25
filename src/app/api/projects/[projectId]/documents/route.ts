import { z } from "zod";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { incrementUsage } from "@/server/usage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { deleteStoredFile } from "@/lib/storage";
import {
  extractTextFromBuffer,
  parseTenderSections,
} from "@/features/documents/parser";
import { saveUploadedFile, validateUpload } from "@/features/documents/upload";
import type { ExtractedRequirement, ParsedSection } from "@/features/ai";
import {
  buildTextDedupeKey,
  calculateChecklistScore,
  detectEvidenceMatchesForRequirements,
  explainTenderClause,
  extractRequirementsFromClauses,
  extractTenderClausesFromSections,
  mergeEvidenceMatches,
} from "@/features/tender-intelligence/pipeline";
import { syncProposalSectionsFromTender } from "@/server/tender-proposal";
import { analyseTenderDocumentWithGemini } from "@/features/tender-intelligence/gemini";

export const runtime = "nodejs";

const bulkDeleteSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1).max(100),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid delete request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const documents = await prisma.tenderDocument.findMany({
    where: {
      id: { in: parsed.data.documentIds },
      projectId,
      project: { userId: user.id },
    },
    select: { id: true, storagePath: true },
  });

  if (!documents.length) {
    return Response.json({ error: "No matching documents found" }, { status: 404 });
  }

  await Promise.all(
    documents.map((document) => deleteStoredFile("uploads", document.storagePath)),
  );

  const { count } = await prisma.tenderDocument.deleteMany({
    where: { id: { in: documents.map((document) => document.id) } },
  });

  return Response.json({ deleted: count });
}

const procurementDocumentTypes = new Set([
  "tender_pack",
  "addendum",
  "clarification",
  "revision",
]);
const evidenceDocumentTypes = new Set(["supporting_evidence", "evidence"]);

async function getNextVersion(projectId: string, parentId?: string | null) {
  if (!parentId) return 1;
  const latestRevision = await prisma.tenderDocument.findFirst({
    where: { projectId, parentId },
    orderBy: { version: "desc" },
  });
  return (latestRevision?.version ?? 1) + 1;
}

async function getPrimaryTenderId(projectId: string) {
  const primary = await prisma.tenderDocument.findFirst({
    where: {
      projectId,
      documentType: "tender_pack",
      isPrimary: true,
    },
    select: { id: true },
  });
  return primary?.id ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = rateLimit(`upload:${user.id}:${projectId}`, 10, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: user.id,
    },
  });

  if (!project)
    return Response.json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const multiFiles = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);
  const legacyFile = formData.get("file");
  const files = multiFiles.length
    ? multiFiles
    : legacyFile instanceof File
      ? [legacyFile]
      : [];
  const documentType = String(formData.get("documentType") || "tender_pack");
  const requestedPrimary = formData.get("isPrimary") === "true";
  const requestedParentId = formData.get("parentId")
    ? String(formData.get("parentId"))
    : null;
  const revisionNotes = formData.get("revisionNotes")
    ? String(formData.get("revisionNotes"))
    : null;

  if (!files.length) {
    return Response.json(
      { error: "Upload at least one PDF, DOCX, or TXT file." },
      { status: 400 },
    );
  }

  for (const file of files) {
    const validationError = await validateUpload(file);
    if (validationError)
      return Response.json({ error: validationError }, { status: 400 });
  }

  const uploaded = [];
  const existingPrimaryId = await getPrimaryTenderId(projectId);

  // Seed dedup keys from clauses/requirements already in the project so
  // re-uploading the same tender pack (or an addendum that repeats text
  // from the main pack) does not create duplicate checklist items.
  const [existingClauses, existingRequirements] = await Promise.all([
    prisma.tenderClause.findMany({
      where: { projectId },
      select: { id: true, originalText: true },
    }),
    prisma.requirement.findMany({
      where: { projectId },
      select: { title: true, description: true },
    }),
  ]);
  const clauseIdByKey = new Map<string, string>(
    existingClauses.map((clause) => [
      buildTextDedupeKey(clause.originalText, 120),
      clause.id,
    ]),
  );
  const seenRequirementKeys = new Set(
    existingRequirements.map((requirement) =>
      buildTextDedupeKey(`${requirement.title} ${requirement.description}`, 160),
    ),
  );
  let duplicateClauseCount = 0;
  let duplicateRequirementCount = 0;

  for (const file of files) {
    const saved = await saveUploadedFile(file, projectId);
    const extractedText = await extractTextFromBuffer(
      saved.buffer,
      file.type,
      file.name,
    );
    const localSections = parseTenderSections(extractedText);
    const aiIntelligence = procurementDocumentTypes.has(documentType)
      ? await analyseTenderDocumentWithGemini({
          project,
          documentName: file.name,
          documentType,
          text: extractedText,
          localSections,
        }).catch((error) => {
          console.error("Gemini tender intelligence failed", error);
          return null;
        })
      : null;
    const sections = aiIntelligence?.sections.length
      ? aiIntelligence.sections
      : localSections;
    const shouldBecomePrimary =
      documentType === "tender_pack" &&
      files.length === 1 &&
      (requestedPrimary || !existingPrimaryId);
    const parentId =
      requestedParentId ||
      (documentType === "addendum" || documentType === "revision"
        ? existingPrimaryId
        : null);

    if (shouldBecomePrimary) {
      await prisma.tenderDocument.updateMany({
        where: { projectId, documentType: "tender_pack", isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const document = await prisma.tenderDocument.create({
      data: {
        projectId,
        filename: saved.filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath: saved.storagePath,
        documentType,
        isPrimary: shouldBecomePrimary,
        parentId,
        revisionNotes,
        version: await getNextVersion(projectId, parentId),
        extractedText,
        sections,
        status: "processed",
        parsingStatus: "completed",
        parsingError: null,
        parsedAt: new Date(),
      },
    });

    const createdSections = [];
    for (const section of sections) {
      createdSections.push(
        await prisma.parsedSection.create({
          data: {
            projectId,
            documentId: document.id,
            title: section.title,
            body: section.body,
            order: section.order,
          },
        }),
      );
    }

    let createdClauseCount = 0;
    let createdRequirementCount = 0;
    let detectedEvidenceCount = 0;

    if (procurementDocumentTypes.has(documentType)) {
      let extractedClauses = aiIntelligence?.clauses.length
        ? aiIntelligence.clauses
        : extractTenderClausesFromSections(sections);

      // If no sections were found or no clauses extracted, try extracting from the entire document
      if (sections.length === 0 || extractedClauses.length === 0) {
        const fullDocumentSection: ParsedSection = {
          title: "Full Document",
          body: extractedText,
          order: 1,
        };
        extractedClauses = extractTenderClausesFromSections([
          fullDocumentSection,
        ]);
      }

      const createdClauses: Array<{
        extraction: (typeof extractedClauses)[number];
        row: { id: string; title: string | null; originalText: string };
      }> = [];

      for (const clause of extractedClauses) {
        const dedupeKey = buildTextDedupeKey(clause.originalText, 120);
        const existingClauseId = clauseIdByKey.get(dedupeKey);

        if (existingClauseId) {
          duplicateClauseCount += 1;
          createdClauses.push({
            extraction: clause,
            row: {
              id: existingClauseId,
              title: clause.title,
              originalText: clause.originalText,
            },
          });
          continue;
        }

        const explanation = explainTenderClause(clause);
        const section = createdSections.find(
          (item) => item.order === clause.parsedSectionOrder,
        );
        const row = await prisma.tenderClause.create({
          data: {
            projectId,
            documentId: document.id,
            parsedSectionId: section?.id,
            title: clause.title,
            originalText: clause.originalText,
            clauseType: clause.clauseType,
            importance: clause.importance,
            riskLevel: clause.riskLevel,
            confidence: clause.confidence,
            explanation: explanation.plainEnglish,
            actionsRequired: clause.actionsRequired,
            metadata: {
              sourceSection: section?.title ?? null,
              documentType,
              version: document.version,
              aiProvider: aiIntelligence?.provider ?? "local",
              aiModel: aiIntelligence?.model ?? null,
            },
          },
        });
        clauseIdByKey.set(dedupeKey, row.id);
        createdClauses.push({ extraction: clause, row });
      }

      createdClauseCount = createdClauses.length - duplicateClauseCount;
      const candidateRequirements = aiIntelligence?.requirements.length
        ? aiIntelligence.requirements.map((requirement) => ({
            ...requirement,
            sourceClauseId: matchRequirementToClauseId(
              requirement,
              createdClauses,
            ),
          }))
        : extractRequirementsFromClauses(
            createdClauses.map(({ extraction, row }) => ({
              ...extraction,
              id: row.id,
            })),
          );

      for (const requirement of candidateRequirements) {
        const dedupeKey = buildTextDedupeKey(
          `${requirement.title} ${requirement.description}`,
          160,
        );
        if (seenRequirementKeys.has(dedupeKey)) {
          duplicateRequirementCount += 1;
          continue;
        }
        seenRequirementKeys.add(dedupeKey);

        await prisma.requirement.create({
          data: {
            projectId,
            documentId: document.id,
            sourceClauseId: requirement.sourceClauseId,
            title: requirement.title,
            description: requirement.description,
            category: requirement.category,
            sourceClause: requirement.sourceClause,
            priority: requirement.priority,
            confidence: requirement.confidence,
            evidenceNeeded: requirement.evidenceNeeded,
            status: "in_progress",
          },
        });
        createdRequirementCount += 1;
      }
    }

    if (evidenceDocumentTypes.has(documentType)) {
      const requirements = await prisma.requirement.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          description: true,
          evidenceNeeded: true,
          evidenceMatches: true,
          status: true,
        },
      });
      const matches = detectEvidenceMatchesForRequirements({
        requirements,
        evidenceDocument: {
          id: document.id,
          originalName: document.originalName,
          extractedText,
        },
      });

      for (const { requirementId, match } of matches) {
        const requirement = requirements.find(
          (item) => item.id === requirementId,
        );
        if (!requirement) continue;
        await prisma.supportingEvidence.create({
          data: {
            projectId,
            documentId: document.id,
            requirementId,
            detectedType: match.detectedType,
            confidence: match.confidence,
            status: match.confidence >= 0.82 ? "matched" : "possible_match",
            notes: match.reason,
          },
        });
        await prisma.requirement.update({
          where: { id: requirementId },
          data: {
            evidenceMatches: mergeEvidenceMatches(
              requirement.evidenceMatches,
              match,
            ),
            status:
              match.confidence >= 0.82
                ? "met"
                : requirement.status === "blocked"
                  ? "blocked"
                  : "in_progress",
          },
        });
        detectedEvidenceCount += 1;
      }
    }

    uploaded.push({
      ...document,
      parsedSectionCount: createdSections.length,
      clauseCount: createdClauseCount,
      requirementCount: createdRequirementCount,
      evidenceMatchCount: detectedEvidenceCount,
    });
  }

  const projectRequirements = await prisma.requirement.findMany({
    where: { projectId },
    select: { status: true, priority: true },
  });
  const complianceScore = calculateChecklistScore(projectRequirements);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "active",
      stage: projectRequirements.length ? "analysis" : "intake",
      complianceScore,
    },
  });

  if (projectRequirements.length) {
    await syncProposalSectionsFromTender(projectId);
  }

  await incrementUsage(user.id, projectId, {
    uploads: files.length,
    aiGenerations: uploaded.reduce(
      (total, document) =>
        total + document.clauseCount + document.requirementCount,
      0,
    ),
    tokensUsed: uploaded.reduce(
      (total, document) =>
        total + Math.ceil((document.extractedText?.length ?? 0) / 4),
      0,
    ),
  });

  return Response.json({
    message: `${uploaded.length} document(s) processed`,
    documents: uploaded,
    duplicateClauseCount,
    duplicateRequirementCount,
    complianceScore,
  });
}


function matchRequirementToClauseId(
  requirement: ExtractedRequirement,
  clauses: Array<{ row: { id: string; title: string | null; originalText: string } }>,
) {
  const source = `${requirement.sourceClause ?? ""} ${requirement.description}`
    .toLowerCase()
    .replace(/\W+/g, " ")
    .trim();
  if (!source) return undefined;

  const match = clauses.find(({ row }) => {
    const clauseText = `${row.title ?? ""} ${row.originalText}`
      .toLowerCase()
      .replace(/\W+/g, " ");
    return (
      clauseText.includes(source.slice(0, 80)) ||
      source.includes(clauseText.slice(0, 80))
    );
  });

  return match?.row.id;
}
