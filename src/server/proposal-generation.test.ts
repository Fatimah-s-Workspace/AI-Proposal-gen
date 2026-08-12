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
    // Mirrors real Prisma's atomicity: if the callback throws, every write
    // made through `tx` inside it is discarded, regardless of which
    // statement ran first - this fake previously only "rolled back" by
    // accident when the failing call happened to run before any writes.
    $transaction: async (fn) => {
      const snapshot = {
        section: { ...state.section },
        generation: state.generation ? { ...state.generation } : null,
        generatedContents: [...state.generatedContents],
      };
      try {
        return await fn(prisma);
      } catch (error) {
        state.section = snapshot.section;
        state.generation = snapshot.generation;
        state.generatedContents = snapshot.generatedContents;
        throw error;
      }
    },
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
  process.env.GEMINI_API_KEY = "test-key";
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
  // The caller uses this to decide whether to warn the user. A truthy value
  // on a genuine AI draft would cry wolf on every generation.
  assert.equal(result.fallback, null);
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
  // Recording it is not enough - the editor can only warn about what the
  // function hands back.
  assert.deepEqual(result.fallback, { reason: "no_api_key" });
});

test("rejects malformed Gemini output and keeps the section unchanged", async () => {
  process.env.GEMINI_API_KEY = "test-key";
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

test("falls back to a local draft when the Gemini quota is exhausted", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const { prisma, state } = createFakePrisma();
  const gemini = {
    models: {
      generateContent: async () => {
        throw new Error("429 RESOURCE_EXHAUSTED: Quota exceeded for model");
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
  assert.equal((state.generation as { status: string }).status, "succeeded");
  assert.equal(
    (state.generation as { provider: string }).provider,
    "gemini-fallback",
  );
  assert.equal(
    (state.generation as { metadata: { fallbackReason: string } }).metadata
      .fallbackReason,
    "quota_or_availability",
  );
  assert.deepEqual(result.fallback, { reason: "quota_or_availability" });
});

test("records Gemini failure without mutating the section", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const { prisma, state } = createFakePrisma();
  const gemini = {
    models: {
      generateContent: async () => {
        throw new Error("API key not valid. Please pass a valid API key.");
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
