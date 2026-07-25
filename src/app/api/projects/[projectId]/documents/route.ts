import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { incrementUsage } from "@/server/usage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { deleteStoredFile } from "@/lib/storage";
import { captureError } from "@/lib/monitoring";
import {
  extractTextFromBuffer,
  parseTenderSections,
} from "@/features/documents/parser";
import { saveUploadedFile, validateUpload } from "@/features/documents/upload";
import {
  buildTextDedupeKey,
  calculateChecklistScore,
} from "@/features/tender-intelligence/pipeline";
import { syncProposalSectionsFromTender } from "@/server/tender-proposal";
import {
  processUploadedDocument,
  procurementDocumentTypes,
  type DedupeState,
} from "@/server/document-processing";

export const runtime = "nodejs";
// The heavy part of processing (Gemini calls, per-clause/requirement DB
// writes) runs after the response via after(), but it still runs within
// this same function invocation - raise the ceiling above the platform
// default so a multi-file batch has room to finish. Vercel Hobby allows up
// to 60s; Pro/Enterprise can go higher if batches are consistently larger.
export const maxDuration = 60;

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

// Lets the client poll for completion after the fast upload response, since
// processing continues in the background (see the POST handler below).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const ids = new URL(request.url).searchParams.get("ids");
  if (!ids) {
    return Response.json({ error: "Missing ids query parameter" }, { status: 400 });
  }

  const documents = await prisma.tenderDocument.findMany({
    where: {
      id: { in: ids.split(",").filter(Boolean).slice(0, 100) },
      projectId,
      project: { userId: user.id },
    },
    select: {
      id: true,
      originalName: true,
      parsingStatus: true,
      parsingError: true,
      _count: { select: { parsedSections: true, clauses: true, requirements: true } },
    },
  });

  return Response.json({
    documents: documents.map((document) => ({
      id: document.id,
      originalName: document.originalName,
      parsingStatus: document.parsingStatus,
      parsingError: document.parsingError,
      parsedSectionCount: document._count.parsedSections,
      clauseCount: document._count.clauses,
      requirementCount: document._count.requirements,
    })),
  });
}

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
  const limit = await rateLimit(`upload:${user.id}:${projectId}`, 10, 60_000);
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

  const existingPrimaryId = await getPrimaryTenderId(projectId);

  // Phase 1 (synchronous): save each file and create its TenderDocument row
  // as "processing". This is the only part the client waits for - the slow
  // part (Gemini analysis, clause/requirement extraction) is deferred to
  // after() below so a large or multi-file batch can't time out the request.
  const pending: Array<{
    documentId: string;
    documentVersion: number;
    documentName: string;
    extractedText: string;
    localSections: ReturnType<typeof parseTenderSections>;
  }> = [];
  const uploaded = [];

  for (const file of files) {
    const saved = await saveUploadedFile(file, projectId);
    const extractedText = await extractTextFromBuffer(
      saved.buffer,
      file.type,
      file.name,
    );
    const localSections = parseTenderSections(extractedText);

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
        sections: localSections,
        status: "uploaded",
        parsingStatus: procurementDocumentTypes.has(documentType) || evidenceDocumentTypes.has(documentType)
          ? "processing"
          : "completed",
        parsingError: null,
        parsedAt: procurementDocumentTypes.has(documentType) || evidenceDocumentTypes.has(documentType)
          ? null
          : new Date(),
      },
    });

    if (procurementDocumentTypes.has(documentType) || evidenceDocumentTypes.has(documentType)) {
      pending.push({
        documentId: document.id,
        documentVersion: document.version,
        documentName: file.name,
        extractedText,
        localSections,
      });
    }

    uploaded.push(document);
  }

  await incrementUsage(user.id, projectId, { uploads: files.length });

  if (pending.length) {
    after(() =>
      finishProcessingBatch({
        projectId,
        project,
        userId: user.id,
        documentType,
        pending,
      }),
    );
  }

  return Response.json({
    message: pending.length
      ? `${uploaded.length} document(s) uploaded - analysis is running in the background.`
      : `${uploaded.length} document(s) uploaded.`,
    documents: uploaded,
    processing: pending.length > 0,
  });
}

async function finishProcessingBatch(input: {
  projectId: string;
  project: NonNullable<Awaited<ReturnType<typeof prisma.project.findFirst>>>;
  userId: string;
  documentType: string;
  pending: Array<{
    documentId: string;
    documentVersion: number;
    documentName: string;
    extractedText: string;
    localSections: ReturnType<typeof parseTenderSections>;
  }>;
}) {
  const { projectId, project, userId, documentType, pending } = input;

  // Seed dedup keys from clauses/requirements already in the project so
  // re-uploading the same tender pack (or an addendum that repeats text
  // from the main pack) does not create duplicate checklist items. Shared
  // across every document in this batch, so duplicates within the batch
  // itself are also caught, not just duplicates against pre-existing data.
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
  const dedupe: DedupeState = {
    clauseIdByKey: new Map(
      existingClauses.map((clause) => [
        buildTextDedupeKey(clause.originalText, 120),
        clause.id,
      ]),
    ),
    seenRequirementKeys: new Set(
      existingRequirements.map((requirement) =>
        buildTextDedupeKey(`${requirement.title} ${requirement.description}`, 160),
      ),
    ),
  };

  let totalAiGenerations = 0;
  let totalTokens = 0;

  for (const item of pending) {
    try {
      const result = await processUploadedDocument({
        projectId,
        project,
        documentId: item.documentId,
        documentVersion: item.documentVersion,
        documentName: item.documentName,
        documentType,
        extractedText: item.extractedText,
        localSections: item.localSections,
        dedupe,
      });

      await prisma.tenderDocument.update({
        where: { id: item.documentId },
        data: {
          sections: result.sections,
          status: "processed",
          parsingStatus: "completed",
          parsedAt: new Date(),
        },
      });

      totalAiGenerations += result.clauseCount + result.requirementCount;
      totalTokens += Math.ceil(item.extractedText.length / 4);
    } catch (error) {
      console.error("Document processing failed", error);
      captureError(error, { route: "documents:processing", documentId: item.documentId });

      await prisma.tenderDocument
        .update({
          where: { id: item.documentId },
          data: {
            parsingStatus: "failed",
            parsingError:
              error instanceof Error ? error.message : "Processing failed unexpectedly.",
          },
        })
        .catch(() => {});
    }
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
    await syncProposalSectionsFromTender(projectId).catch((error) => {
      console.error("Proposal section sync failed", error);
      captureError(error, { route: "documents:processing", projectId });
    });
  }

  if (totalAiGenerations || totalTokens) {
    await incrementUsage(userId, projectId, {
      aiGenerations: totalAiGenerations,
      tokensUsed: totalTokens,
    });
  }
}
