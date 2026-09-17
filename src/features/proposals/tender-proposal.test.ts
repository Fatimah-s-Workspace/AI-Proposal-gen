import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTenderProposalAssistant,
  buildTenderProposalPlan,
  type TenderProposalContext,
} from "./tender-proposal";

function baseContext(
  overrides: Partial<TenderProposalContext> = {},
): TenderProposalContext {
  return {
    project: {
      title: "Solar Mini-Grid Grant Proposal",
      clientName: "Rural Electrification Agency",
      opportunityType: "Grant",
      sector: "Energy",
      country: "Nigeria",
      authority: "Rural Electrification Agency",
      deadline: new Date("2026-08-11"),
      budgetRange: null,
      summary: null,
    },
    documents: [],
    parsedSections: [],
    clauses: [],
    requirements: [],
    existingSections: [],
    ...overrides,
  };
}

test("buildTenderProposalPlan always includes executive summary and compliance matrix", () => {
  const plan = buildTenderProposalPlan(baseContext());
  const slugs = plan.map((section) => section.slug);
  assert.ok(slugs.includes("executive-summary"));
  assert.ok(slugs.includes("compliance-matrix"));
});

test("buildTenderProposalPlan never produces duplicate section slugs", () => {
  const plan = buildTenderProposalPlan(
    baseContext({
      requirements: [
        {
          id: "req-1",
          title: "Tax clearance",
          description: "Provide a valid tax clearance certificate.",
          category: "mandatory",
          sourceClause: "Eligibility",
          priority: "high",
          confidence: 0.9,
          evidenceNeeded: ["Tax clearance"],
          documentId: "doc-1",
        },
        {
          id: "req-2",
          title: "Pricing schedule",
          description: "Submit pricing in the buyer's format.",
          category: "financial",
          sourceClause: "Commercial",
          priority: "high",
          confidence: 0.9,
          evidenceNeeded: [],
          documentId: "doc-1",
        },
      ],
    }),
  );

  const slugs = plan.map((section) => section.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("buildTenderProposalPlan assigns sequential order starting at 1", () => {
  const plan = buildTenderProposalPlan(baseContext());
  plan.forEach((section, index) => {
    assert.equal(section.order, index + 1);
  });
});

test("buildTenderProposalPlan excludes low-relevance sections with no mapped requirements", () => {
  // A plain tender (not a grant) with no monitoring/evaluation language
  // anywhere shouldn't score high enough to include that optional section.
  const plan = buildTenderProposalPlan(
    baseContext({
      project: {
        ...baseContext().project,
        opportunityType: "Tender",
      },
    }),
  );
  const slugs = plan.map((section) => section.slug);
  assert.ok(!slugs.includes("monitoring-evaluation-and-learning"));
});

test("buildTenderProposalPlan boosts monitoring & evaluation for grant opportunities", () => {
  // The same minimal context, but as a Grant, should score the M&E section
  // high enough to include it — this is deliberate grant-specific behavior.
  const plan = buildTenderProposalPlan(baseContext());
  const slugs = plan.map((section) => section.slug);
  assert.ok(slugs.includes("monitoring-evaluation-and-learning"));
});

test("buildTenderProposalPlan includes commercial response when a financial requirement exists", () => {
  const plan = buildTenderProposalPlan(
    baseContext({
      requirements: [
        {
          id: "req-1",
          title: "Bid security",
          description: "Provide a bank guarantee as bid security.",
          category: "financial",
          sourceClause: "Commercial",
          priority: "high",
          confidence: 0.9,
          evidenceNeeded: ["Bid security"],
          documentId: "doc-1",
        },
      ],
    }),
  );

  const commercial = plan.find((section) => section.slug === "commercial-response");
  assert.ok(commercial, "expected commercial-response to be included");
  assert.ok(commercial!.requirementIds.includes("req-1"));
});

test("buildTenderProposalPlan increases word target as more requirements map to a section", () => {
  const withOne = buildTenderProposalPlan(
    baseContext({
      requirements: [
        {
          id: "req-1",
          title: "Bid security",
          description: "Provide a bank guarantee as bid security.",
          category: "financial",
          sourceClause: "Commercial",
          priority: "high",
          confidence: 0.9,
          evidenceNeeded: [],
          documentId: "doc-1",
        },
      ],
    }),
  );
  const withThree = buildTenderProposalPlan(
    baseContext({
      requirements: [
        {
          id: "req-1",
          title: "Bid security",
          description: "Provide a bank guarantee as bid security.",
          category: "financial",
          sourceClause: "Commercial",
          priority: "high",
          confidence: 0.9,
          evidenceNeeded: [],
          documentId: "doc-1",
        },
        {
          id: "req-2",
          title: "Pricing schedule",
          description: "Submit pricing in the required commercial format.",
          category: "financial",
          sourceClause: "Commercial",
          priority: "medium",
          confidence: 0.9,
          evidenceNeeded: [],
          documentId: "doc-1",
        },
        {
          id: "req-3",
          title: "Tax assumptions",
          description: "State all commercial pricing tax assumptions.",
          category: "financial",
          sourceClause: "Commercial",
          priority: "medium",
          confidence: 0.9,
          evidenceNeeded: [],
          documentId: "doc-1",
        },
      ],
    }),
  );

  const one = withOne.find((section) => section.slug === "commercial-response");
  const three = withThree.find((section) => section.slug === "commercial-response");
  assert.ok(one && three);
  assert.ok(three!.wordTarget > one!.wordTarget);
});

test("buildTenderProposalAssistant flags a section with no drafted content", () => {
  const assistant = buildTenderProposalAssistant(baseContext());
  const executiveSummary = assistant.sectionMetrics.find(
    (metric) => metric.sectionType === "executive-summary",
  );
  assert.ok(executiveSummary);
  assert.ok(
    executiveSummary!.qualityIssues.some((issue) => issue.issueType === "empty section"),
  );
});

test("buildTenderProposalAssistant reports higher coverage once content addresses a requirement", () => {
  const requirement = {
    id: "req-1",
    title: "Bid security bank guarantee",
    description: "Provide a bank guarantee as bid security before submission.",
    category: "financial" as const,
    sourceClause: "Commercial",
    priority: "high" as const,
    confidence: 0.9,
    evidenceNeeded: ["Bid security"],
    documentId: "doc-1",
  };

  const withoutContent = buildTenderProposalAssistant(
    baseContext({ requirements: [requirement] }),
  );
  const withContent = buildTenderProposalAssistant(
    baseContext({
      requirements: [requirement],
      existingSections: [
        {
          id: "section-1",
          title: "Commercial Response",
          slug: "commercial-response",
          sectionType: "commercial-response",
          order: 7,
          content:
            "<p>Our bid security bank guarantee will be provided in line with the buyer's requirements, referencing evidence for bid security.</p>",
          status: "drafting",
          wordTarget: 420,
        },
      ],
    }),
  );

  const before = withoutContent.coverage["commercial-response"] ?? 0;
  const after = withContent.coverage["commercial-response"] ?? 0;
  assert.ok(after > before);
});

test("buildTenderProposalAssistant recommends resolving unmet high-priority requirements", () => {
  const assistant = buildTenderProposalAssistant(
    baseContext({
      requirements: [
        {
          id: "req-1",
          title: "Tax clearance certificate",
          description: "Provide a valid tax clearance certificate.",
          category: "mandatory",
          sourceClause: "Eligibility",
          priority: "high",
          confidence: 0.9,
          evidenceNeeded: ["Tax clearance"],
          documentId: "doc-1",
          status: "in_progress",
        },
      ],
    }),
  );

  assert.ok(
    assistant.recommendations.some((item) => item.includes("Tax clearance certificate")),
  );
});

// Coverage used to be a substring check against the requirement's own title,
// so this section - which answers the requirement properly and never repeats
// its wording - scored zero.
test("buildTenderProposalAssistant credits a section that answers a requirement in its own words", () => {
  const requirement = {
    id: "req-1",
    title: "ISO 27001 certification",
    description: "The bidder shall hold current ISO 27001 certification.",
    category: "mandatory" as const,
    sourceClause: "Eligibility",
    priority: "high" as const,
    confidence: 0.9,
    evidenceNeeded: ["Certificate of registration"],
    documentId: "doc-1",
  };

  function coverageFor(content: string) {
    const assistant = buildTenderProposalAssistant(
      baseContext({
        requirements: [requirement],
        existingSections: [
          {
            id: "section-1",
            title: "Eligibility and statutory compliance",
            slug: "eligibility-and-statutory-compliance",
            sectionType: "eligibility-and-statutory-compliance",
            order: 2,
            content,
            status: "drafting",
            wordTarget: 420,
          },
        ],
      }),
    );
    return assistant.coverage["eligibility-and-statutory-compliance"] ?? 0;
  }

  const written = coverageFor(
    "<p>Our information security management system has been certified to ISO 27001 since 2021, certificate number IS 712345.</p>",
  );
  const silent = coverageFor(
    "<p>We will mobilise a delivery team within two weeks of contract award.</p>",
  );

  assert.ok(written > 0, "a proper answer must count as covered");
  assert.ok(
    written > silent,
    "a section that addresses the requirement must outscore one that ignores it",
  );
});
