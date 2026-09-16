import type { ExtractedRequirement, ParsedSection } from "@/features/ai";
import {
  buildTextDedupeKey,
  detectEvidenceMatchesForRequirements,
  explainTenderClause,
  extractRequirementsFromClauses,
  extractTenderClausesFromSections,
  mergeEvidenceMatches,
} from "@/features/tender-intelligence/pipeline";
import { analyseTenderDocumentWithGemini } from "@/features/tender-intelligence/gemini";
import { coverageNote } from "@/features/tender-intelligence/chunking";
import { prisma } from "@/server/db";

export const procurementDocumentTypes = new Set([
  "tender_pack",
  "addendum",
  "clarification",
  "revision",
]);
export const evidenceDocumentTypes = new Set(["supporting_evidence", "evidence"]);

type ProjectContext = {
  title: string;
  clientName: string;
  opportunityType: string;
  sector: string;
  country: string;
  authority?: string | null;
  deadline?: Date | null;
  summary?: string | null;
};

// Shared across every document in an upload batch so that a clause or
// requirement introduced by one file in the batch is correctly recognised
// as a duplicate when a later file in the same batch repeats it - matches
// the dedup behavior when re-uploading against the project's existing data.
export type DedupeState = {
  clauseIdByKey: Map<string, string>;
  seenRequirementKeys: Set<string>;
};

export type ProcessDocumentInput = {
  prismaClient?: typeof prisma;
  projectId: string;
  project: ProjectContext;
  documentId: string;
  documentVersion: number;
  documentName: string;
  documentType: string;
  extractedText: string;
  localSections: ParsedSection[];
  dedupe: DedupeState;
};

export type ProcessDocumentResult = {
  sections: ParsedSection[];
  parsedSectionCount: number;
  clauseCount: number;
  requirementCount: number;
  duplicateClauseCount: number;
  duplicateRequirementCount: number;
  evidenceMatchCount: number;
  aiProvider: string;
  aiModel: string | null;
  /** Set when the document could not be analysed in full. */
  analysisNotice: string | null;
};

/**
 * Runs the slow part of document intake - Gemini analysis, clause and
 * requirement extraction with project-wide dedup, and evidence matching -
 * for a single already-saved document. Designed to run inside next/server's
 * after() so the upload request can respond immediately instead of making
 * the client wait out the whole pipeline (and risk a function timeout on a
 * large tender pack).
 *
 * Does not touch TenderDocument.parsingStatus - the caller is responsible
 * for marking the document completed or failed based on whether this
 * throws, since a single document's failure shouldn't be conflated with
 * the data this function successfully produced for other documents in the
 * same batch.
 */
/**
 * Combines two extractions, preferring the first when both describe the same
 * thing. Keyed on the fingerprint the rest of the app uses, so "the same
 * clause" means one thing everywhere.
 */
export function mergeExtractions<T extends { originalText: string }>(
  preferred: T[],
  additional: T[],
): T[] {
  const seen = new Set(preferred.map((item) => buildTextDedupeKey(item.originalText, 120)));
  const merged = [...preferred];

  for (const item of additional) {
    const key = buildTextDedupeKey(item.originalText, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function mergeRequirements<T extends { title: string; description: string }>(
  preferred: T[],
  additional: T[],
): T[] {
  const keyOf = (item: T) => buildTextDedupeKey(`${item.title} ${item.description}`, 160);
  const seen = new Set(preferred.map(keyOf));
  const merged = [...preferred];

  for (const item of additional) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export async function processUploadedDocument(
  input: ProcessDocumentInput,
): Promise<ProcessDocumentResult> {
  const db = input.prismaClient ?? prisma;
  const {
    projectId,
    project,
    documentId,
    documentVersion,
    documentName,
    documentType,
    extractedText,
    localSections,
    dedupe,
  } = input;

  const aiIntelligence = procurementDocumentTypes.has(documentType)
    ? await analyseTenderDocumentWithGemini({
        project,
        documentName,
        documentType,
        text: extractedText,
        localSections,
      }).catch((error) => {
        console.error("Gemini tender intelligence failed", error);
        return null;
      })
    : null;

  // Returned rather than written here. This function deliberately does not
  // touch TenderDocument - the caller owns parsingStatus and writes this
  // alongside it, so a document is never left marked complete with a stale
  // coverage warning from a previous run.
  const analysisNotice = aiIntelligence?.coverage
    ? coverageNote(aiIntelligence.coverage)
    : null;

  const sections = aiIntelligence?.sections.length
    ? aiIntelligence.sections
    : localSections;

  const createdSections = [];
  for (const section of sections) {
    createdSections.push(
      await db.parsedSection.create({
        data: {
          projectId,
          documentId,
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
  let duplicateClauseCount = 0;
  let duplicateRequirementCount = 0;

  if (procurementDocumentTypes.has(documentType)) {
    // AI results are added to the rule-based ones, not swapped for them.
    //
    // This used to be a straight either/or: any clauses from Gemini replaced
    // the local extraction entirely. Combined with the old single-slice
    // truncation that was actively harmful - the model saw the first 16 pages,
    // returned a handful of clauses, and the full-document regex pass that had
    // read all 120 pages was thrown away. A large document came out *worse*
    // when the AI worked than when it failed.
    //
    // Chunking fixes the coverage; merging fixes the rest. The two extractors
    // miss different things - the model reads context, the regex never gets
    // bored - and the dedupe below means agreeing on a clause costs nothing.
    let extractedClauses = mergeExtractions(
      aiIntelligence?.clauses ?? [],
      extractTenderClausesFromSections(sections),
    );

    // If no sections were found or no clauses extracted, try extracting from the entire document
    if (sections.length === 0 || extractedClauses.length === 0) {
      const fullDocumentSection: ParsedSection = {
        title: "Full Document",
        body: extractedText,
        order: 1,
      };
      extractedClauses = extractTenderClausesFromSections([fullDocumentSection]);
    }

    const createdClauses: Array<{
      extraction: (typeof extractedClauses)[number];
      row: { id: string; title: string | null; originalText: string };
    }> = [];

    for (const clause of extractedClauses) {
      const dedupeKey = buildTextDedupeKey(clause.originalText, 120);
      const existingClauseId = dedupe.clauseIdByKey.get(dedupeKey);

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
      const row = await db.tenderClause.create({
        data: {
          projectId,
          documentId,
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
            version: documentVersion,
            aiProvider: aiIntelligence?.provider ?? "local",
            aiModel: aiIntelligence?.model ?? null,
          },
        },
      });
      dedupe.clauseIdByKey.set(dedupeKey, row.id);
      createdClauses.push({ extraction: clause, row });
    }

    createdClauseCount = createdClauses.length - duplicateClauseCount;
    // Same merge, for the same reason: a requirement the model did not notice
    // is still a requirement the bidder can be disqualified for missing.
    const candidateRequirements = mergeRequirements(
      (aiIntelligence?.requirements ?? []).map((requirement) => ({
        ...requirement,
        sourceClauseId: matchRequirementToClauseId(requirement, createdClauses),
      })),
      extractRequirementsFromClauses(
        createdClauses.map(({ extraction, row }) => ({
          ...extraction,
          id: row.id,
        })),
      ),
    );

    for (const requirement of candidateRequirements) {
      const dedupeKey = buildTextDedupeKey(
        `${requirement.title} ${requirement.description}`,
        160,
      );
      if (dedupe.seenRequirementKeys.has(dedupeKey)) {
        duplicateRequirementCount += 1;
        continue;
      }
      dedupe.seenRequirementKeys.add(dedupeKey);

      await db.requirement.create({
        data: {
          projectId,
          documentId,
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
    const requirements = await db.requirement.findMany({
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
        id: documentId,
        originalName: documentName,
        extractedText,
      },
    });

    for (const { requirementId, match } of matches) {
      const requirement = requirements.find((item) => item.id === requirementId);
      if (!requirement) continue;
      await db.supportingEvidence.create({
        data: {
          projectId,
          documentId,
          requirementId,
          detectedType: match.detectedType,
          confidence: match.confidence,
          status: match.confidence >= 0.82 ? "matched" : "possible_match",
          notes: match.reason,
        },
      });
      await db.requirement.update({
        where: { id: requirementId },
        data: {
          evidenceMatches: mergeEvidenceMatches(requirement.evidenceMatches, match),
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

  return {
    sections,
    parsedSectionCount: createdSections.length,
    clauseCount: createdClauseCount,
    requirementCount: createdRequirementCount,
    duplicateClauseCount,
    duplicateRequirementCount,
    evidenceMatchCount: detectedEvidenceCount,
    aiProvider: aiIntelligence?.provider ?? "local",
    aiModel: aiIntelligence?.model ?? null,
    analysisNotice,
  };
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
      clauseText.includes(source.slice(0, 80)) || source.includes(clauseText.slice(0, 80))
    );
  });

  return match?.row.id;
}
