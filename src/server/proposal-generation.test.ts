import assert from "node:assert/strict";
import test from "node:test";

import { generateProposalSectionDraft } from "./proposal-generation";

type FakePrisma = {
  $transaction: (fn: (tx: FakePrisma) => Promise<unknown>) => Promise<unknown>;
  proposalSection: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  proposalGeneration: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  generatedContent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

function createFakePrisma() {
  const state = {
    section: {
      id: "section-1",
      projectId: "project-1",
      content: "existing draft",
      status: "drafting",
      version: 1,
      generatedAt: null as Date | null,
    },
    generation: null as Record<string, unknown> | null,
    generatedContents: [] as Array<Record<string, unknown>>,
  };

  const prisma: FakePrisma = {
    $transaction: async (fn) => fn(prisma),
    proposalSection: {
      findUnique: async () => state.section,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.section = { ...state.section, ...data };
        return state.section;
      },
    },
    proposalGeneration: {
      create: async (args: { data: Record<string, unknown> }) => {
        state.generation = { id: "gen-1", ...args.data };
        return state.generation;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.generation = { ...(state.generation ?? {}), ...data };
        return state.generation;
      },
    },
    generatedContent: {
      create: async (args: { data: Record<string, unknown> }) => {
        const record = {
          id: `g-${state.generatedContents.length + 1}`,
          ...args.data,
        };
        state.generatedContents.push(record);
        return record;
      },
    },
  };

  return { prisma, state };
}

test("generates and persists a proposal section draft", async () => {
  const { prisma, state } = createFakePrisma();
  const gemini = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          title: "Executive Summary",
          content: "A polished executive summary.",
        }),
      }),
    },
  };

  const result = await generateProposalSectionDraft({
    projectId: "project-1",
    sectionId: "section-1",
    userId: "user-1",
    context: {
      project: {
        title: "Roads",
        clientName: "City",
        opportunityType: "Tender",
        sector: "Infrastructure",
        country: "Nigeria",
      },
      documents: [],
      parsedSections: [],
      clauses: [],
      requirements: [],
    },
    sectionPlan: {
      title: "Executive Summary",
      slug: "executive-summary",
      sectionType: "executive-summary",
      order: 1,
      wordTarget: 350,
      importance: "high",
      prompt: "Draft the executive summary.",
      rationale: "Needed for evaluation.",
      requirementIds: [],
      clauseIds: [],
      sourceDocumentIds: [],
      sourceSectionTitles: [],
    },
    prismaClient: prisma as never,
    geminiClient: gemini as never,
  });

  assert.equal(result.section.content, "A polished executive summary.");
  assert.equal((state.generation as { status: string }).status, "succeeded");
  assert.equal(state.generatedContents.length, 1);
  assert.equal(state.section.content, "A polished executive summary.");
});

test("falls back to a local draft when Gemini is unavailable", async () => {
  delete process.env.GEMINI_API_KEY;
  const { prisma, state } = createFakePrisma();
  const gemini = {
    models: {
      generateContent: async () => {
        throw new Error("missing credentials");
      },
    },
  };

  const result = await generateProposalSectionDraft({
    projectId: "project-1",
    sectionId: "section-1",
    userId: "user-1",
    context: {
      project: {
        title: "Roads",
        clientName: "City",
        opportunityType: "Tender",
        sector: "Infrastructure",
        country: "Nigeria",
      },
      documents: [],
      parsedSections: [],
      clauses: [],
      requirements: [],
    },
    sectionPlan: {
      title: "Executive Summary",
      slug: "executive-summary",
      sectionType: "executive-summary",
      order: 1,
      wordTarget: 350,
      importance: "high",
      prompt: "Draft the executive summary.",
      rationale: "Needed for evaluation.",
      requirementIds: [],
      clauseIds: [],
      sourceDocumentIds: [],
      sourceSectionTitles: [],
    },
    prismaClient: prisma as never,
    geminiClient: gemini as never,
  });

  assert.match(result.section.content ?? "", /We understand/);
  assert.equal(state.section.content, result.section.content);
  assert.equal((state.generation as { status: string }).status, "succeeded");
  assert.equal(
    (state.generation as { provider: string }).provider,
    "gemini-fallback",
  );
});

test("rejects malformed Gemini output and keeps the section unchanged", async () => {
  const { prisma, state } = createFakePrisma();
  const gemini = {
    models: {
      generateContent: async () => ({ text: "not-json" }),
    },
  };

  await assert.rejects(
    generateProposalSectionDraft({
      projectId: "project-1",
      sectionId: "section-1",
      userId: "user-1",
      context: {
        project: {
          title: "Roads",
          clientName: "City",
          opportunityType: "Tender",
          sector: "Infrastructure",
          country: "Nigeria",
        },
        documents: [],
        parsedSections: [],
        clauses: [],
        requirements: [],
      },
      sectionPlan: {
        title: "Executive Summary",
        slug: "executive-summary",
        sectionType: "executive-summary",
        order: 1,
        wordTarget: 350,
        importance: "high",
        prompt: "Draft the executive summary.",
        rationale: "Needed for evaluation.",
        requirementIds: [],
        clauseIds: [],
        sourceDocumentIds: [],
        sourceSectionTitles: [],
      },
      prismaClient: prisma as never,
      geminiClient: gemini as never,
    }),
    /invalid/i,
  );

  assert.equal(state.section.content, "existing draft");
  assert.equal((state.generation as { status: string }).status, "failed");
});

test("rejects when the proposal section does not exist", async () => {
  const { prisma } = createFakePrisma();
  (prisma.proposalSection.findUnique as (args: unknown) => Promise<unknown>) =
    async () => null;

  await assert.rejects(
    generateProposalSectionDraft({
      projectId: "project-1",
      sectionId: "missing-section",
      userId: "user-1",
      context: {
        project: {
          title: "Roads",
          clientName: "City",
          opportunityType: "Tender",
          sector: "Infrastructure",
          country: "Nigeria",
        },
        documents: [],
        parsedSections: [],
        clauses: [],
        requirements: [],
      },
      sectionPlan: {
        title: "Executive Summary",
        slug: "executive-summary",
        sectionType: "executive-summary",
        order: 1,
        wordTarget: 350,
        importance: "high",
        prompt: "Draft the executive summary.",
        rationale: "Needed for evaluation.",
        requirementIds: [],
        clauseIds: [],
        sourceDocumentIds: [],
        sourceSectionTitles: [],
      },
      prismaClient: prisma as never,
      geminiClient: {
        models: { generateContent: async () => ({ text: "{}" }) },
      } as never,
    }),
    /not found/i,
  );
});

test("records Gemini failure without mutating the section", async () => {
  const { prisma, state } = createFakePrisma();
  const gemini = {
    models: {
      generateContent: async () => {
        throw new Error("upstream unavailable");
      },
    },
  };

  await assert.rejects(
    generateProposalSectionDraft({
      projectId: "project-1",
      sectionId: "section-1",
      userId: "user-1",
      context: {
        project: {
          title: "Roads",
          clientName: "City",
          opportunityType: "Tender",
          sector: "Infrastructure",
          country: "Nigeria",
        },
        documents: [],
        parsedSections: [],
        clauses: [],
        requirements: [],
      },
      sectionPlan: {
        title: "Executive Summary",
        slug: "executive-summary",
        sectionType: "executive-summary",
        order: 1,
        wordTarget: 350,
        importance: "high",
        prompt: "Draft the executive summary.",
        rationale: "Needed for evaluation.",
        requirementIds: [],
        clauseIds: [],
        sourceDocumentIds: [],
        sourceSectionTitles: [],
      },
      prismaClient: prisma as never,
      geminiClient: gemini as never,
    }),
    /gemini/i,
  );

  assert.equal(state.section.content, "existing draft");
  assert.equal((state.generation as { status: string }).status, "failed");
});

test("rolls back section updates if persistence fails mid-flight", async () => {
  const { prisma, state } = createFakePrisma();
  (prisma.proposalSection.update as (args: unknown) => Promise<unknown>) =
    async () => {
      throw new Error("update failed");
    };

  const gemini = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          title: "Executive Summary",
          content: "A polished executive summary.",
        }),
      }),
    },
  };

  await assert.rejects(
    generateProposalSectionDraft({
      projectId: "project-1",
      sectionId: "section-1",
      userId: "user-1",
      context: {
        project: {
          title: "Roads",
          clientName: "City",
          opportunityType: "Tender",
          sector: "Infrastructure",
          country: "Nigeria",
        },
        documents: [],
        parsedSections: [],
        clauses: [],
        requirements: [],
      },
      sectionPlan: {
        title: "Executive Summary",
        slug: "executive-summary",
        sectionType: "executive-summary",
        order: 1,
        wordTarget: 350,
        importance: "high",
        prompt: "Draft the executive summary.",
        rationale: "Needed for evaluation.",
        requirementIds: [],
        clauseIds: [],
        sourceDocumentIds: [],
        sourceSectionTitles: [],
      },
      prismaClient: prisma as never,
      geminiClient: gemini as never,
    }),
    /update failed/i,
  );

  assert.equal(state.section.content, "existing draft");
  assert.equal(state.generatedContents.length, 0);
});
