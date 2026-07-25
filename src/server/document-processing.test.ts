import assert from "node:assert/strict";
import test from "node:test";

import { processUploadedDocument, type DedupeState } from "./document-processing";
import { parseTenderSections } from "@/features/documents/parser";

// Force the local rule-based fallback path deterministically, regardless of
// whether a real GEMINI_API_KEY happens to be set in the environment this
// suite runs in - these tests exercise the extraction/dedup logic itself,
// not Gemini's output.
const originalGeminiKey = process.env.GEMINI_API_KEY;
test.before(() => {
  delete process.env.GEMINI_API_KEY;
});
test.after(() => {
  if (originalGeminiKey !== undefined) process.env.GEMINI_API_KEY = originalGeminiKey;
});

const project = {
  title: "Solar Mini-Grid Grant Proposal",
  clientName: "Rural Electrification Agency",
  opportunityType: "Grant",
  sector: "Energy",
  country: "Nigeria",
};

const tenderText = [
  "Eligibility Requirements",
  "Bidders must provide a valid CAC registration certificate before submission.",
  "Submission Instructions",
  "All bids must be submitted through the online portal before the stated deadline.",
].join("\n");

function createFakePrisma() {
  const state = {
    parsedSections: [] as Array<{ id: string; title: string; body: string; order: number }>,
    clauses: [] as Array<{ id: string; originalText: string }>,
    requirements: [] as Array<{
      id: string;
      title: string;
      description: string;
      evidenceNeeded: string[];
      evidenceMatches: unknown;
      status: string;
    }>,
    supportingEvidence: [] as Array<Record<string, unknown>>,
  };

  let nextId = 1;
  const makeId = (prefix: string) => `${prefix}-${nextId++}`;

  const prisma = {
    parsedSection: {
      create: async ({ data }: { data: { title: string; body: string; order: number } }) => {
        const row = { id: makeId("section"), ...data };
        state.parsedSections.push(row);
        return row;
      },
    },
    tenderClause: {
      create: async ({ data }: { data: { originalText: string } & Record<string, unknown> }) => {
        const row = { id: makeId("clause"), ...data } as { id: string; originalText: string };
        state.clauses.push(row);
        return row;
      },
    },
    requirement: {
      create: async ({
        data,
      }: {
        data: {
          title: string;
          description: string;
          evidenceNeeded: string[];
        } & Record<string, unknown>;
      }) => {
        const row = {
          id: makeId("requirement"),
          status: "in_progress",
          evidenceMatches: null,
          ...data,
        };
        state.requirements.push(row);
        return row;
      },
      findMany: async () => state.requirements,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const requirement = state.requirements.find((item) => item.id === where.id);
        if (!requirement) throw new Error("requirement not found");
        Object.assign(requirement, data);
        return requirement;
      },
    },
    supportingEvidence: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.supportingEvidence.push(data);
        return { id: makeId("evidence"), ...data };
      },
    },
  };

  return { prisma, state };
}

function freshDedupe(): DedupeState {
  return { clauseIdByKey: new Map(), seenRequirementKeys: new Set() };
}

test("processUploadedDocument extracts clauses and requirements from a tender pack", async () => {
  const { prisma, state } = createFakePrisma();
  const localSections = parseTenderSections(tenderText);

  const result = await processUploadedDocument({
    prismaClient: prisma as never,
    projectId: "project-1",
    project,
    documentId: "doc-1",
    documentVersion: 1,
    documentName: "tender.pdf",
    documentType: "tender_pack",
    extractedText: tenderText,
    localSections,
    dedupe: freshDedupe(),
  });

  assert.ok(result.clauseCount > 0, "expected at least one clause to be extracted");
  assert.ok(state.clauses.length > 0);
  assert.equal(result.duplicateClauseCount, 0);
  assert.equal(result.duplicateRequirementCount, 0);
});

test("processUploadedDocument does not extract clauses for a non-procurement document type", async () => {
  const { prisma, state } = createFakePrisma();
  const localSections = parseTenderSections(tenderText);

  const result = await processUploadedDocument({
    prismaClient: prisma as never,
    projectId: "project-1",
    project,
    documentId: "doc-1",
    documentVersion: 1,
    documentName: "notes.txt",
    documentType: "other",
    extractedText: tenderText,
    localSections,
    dedupe: freshDedupe(),
  });

  assert.equal(result.clauseCount, 0);
  assert.equal(result.requirementCount, 0);
  assert.equal(state.clauses.length, 0);
});

test("processUploadedDocument skips a clause already seen via the shared dedupe state", async () => {
  const { prisma, state } = createFakePrisma();
  const localSections = parseTenderSections(tenderText);
  const dedupe = freshDedupe();

  const first = await processUploadedDocument({
    prismaClient: prisma as never,
    projectId: "project-1",
    project,
    documentId: "doc-1",
    documentVersion: 1,
    documentName: "tender.pdf",
    documentType: "tender_pack",
    extractedText: tenderText,
    localSections,
    dedupe,
  });

  const clauseCountAfterFirst = state.clauses.length;

  // Same document content uploaded again (e.g. a duplicate re-upload) - the
  // dedupe state carries over, exactly as it does across files in one batch.
  const second = await processUploadedDocument({
    prismaClient: prisma as never,
    projectId: "project-1",
    project,
    documentId: "doc-2",
    documentVersion: 1,
    documentName: "tender-copy.pdf",
    documentType: "tender_pack",
    extractedText: tenderText,
    localSections,
    dedupe,
  });

  assert.ok(first.clauseCount > 0);
  assert.equal(second.clauseCount, 0, "every clause should be recognised as a duplicate");
  assert.ok(second.duplicateClauseCount > 0);
  assert.equal(
    state.clauses.length,
    clauseCountAfterFirst,
    "no new clause rows should be created for the duplicate document",
  );
});

test("processUploadedDocument matches evidence documents against existing requirements", async () => {
  const { prisma, state } = createFakePrisma();
  state.requirements.push({
    id: "req-1",
    title: "Tax clearance",
    description: "Provide a valid tax clearance certificate.",
    evidenceNeeded: ["Tax clearance"],
    evidenceMatches: null,
    status: "in_progress",
  });

  const result = await processUploadedDocument({
    prismaClient: prisma as never,
    projectId: "project-1",
    project,
    documentId: "doc-evidence",
    documentVersion: 1,
    documentName: "tax_clearance_certificate.pdf",
    documentType: "supporting_evidence",
    extractedText: "FIRS Tax Clearance Certificate 2026",
    localSections: [],
    dedupe: freshDedupe(),
  });

  assert.equal(result.evidenceMatchCount, 1);
  assert.equal(state.supportingEvidence.length, 1);
  assert.equal(state.requirements[0].status, "met");
});
