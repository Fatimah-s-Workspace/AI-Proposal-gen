import assert from "node:assert/strict";
import test from "node:test";

import type {
  TenderProposalContext,
  TenderProposalSectionPlan,
} from "@/features/proposals/tender-proposal";
import { buildProposalPrompt } from "./proposal-generation";

const sectionPlan: TenderProposalSectionPlan = {
  title: "Executive Summary",
  slug: "executive-summary",
  sectionType: "executive_summary",
  order: 1,
  wordTarget: 400,
  importance: "high",
  prompt: "Draft the executive summary.",
  rationale: "Sets out the offer.",
  requirementIds: [],
  clauseIds: [],
  sourceDocumentIds: [],
  sourceSectionTitles: [],
};

function contextWith(
  project: Partial<TenderProposalContext["project"]>,
): TenderProposalContext {
  return {
    project: {
      title: "Solar Mini-Grid",
      clientName: "Rural Electrification Agency",
      opportunityType: "Grant",
      sector: "Energy",
      country: "Nigeria",
      ...project,
    },
    documents: [],
    parsedSections: [],
    clauses: [],
    requirements: [],
  };
}

// Every one of these is something a user typed into the project form. A field
// that never reaches the prompt is worse than a missing feature - the form
// promises it matters, and the output silently ignores it.
test("every populated project field reaches the prompt", () => {
  const prompt = buildProposalPrompt(
    contextWith({
      authority: "Bureau of Public Procurement",
      budgetRange: "NGN 25m - 50m",
      summary: "Phase two of a rural electrification programme.",
      referenceNumber: "REA/RFP/2026/014",
      evaluationCriteria: "Technical 70%, Price 30%",
      winThemes: "Existing depot in the state.",
      contractDuration: "24 months from Q1 2027",
      incumbent: "Held by an incumbent since 2022",
      deadline: new Date("2026-09-30T00:00:00.000Z"),
    }),
    sectionPlan,
  );

  for (const expected of [
    "Rural Electrification Agency",
    "Solar Mini-Grid",
    "REA/RFP/2026/014",
    "Energy",
    "Nigeria",
    "Bureau of Public Procurement",
    "NGN 25m - 50m",
    "24 months from Q1 2027",
    "2026-09-30",
    "Phase two of a rural electrification programme.",
    "Technical 70%, Price 30%",
    "Existing depot in the state.",
    "Held by an incumbent since 2022",
  ]) {
    assert.ok(prompt.includes(expected), `prompt is missing "${expected}"`);
  }
});

test("blank fields produce no line at all", () => {
  const prompt = buildProposalPrompt(
    contextWith({ authority: "", budgetRange: null, winThemes: "   " }),
    sectionPlan,
  );

  // A prompt padded with "Budget: not specified" teaches the model that
  // blanks are normal and invites it to leave its own.
  for (const absent of ["Budget:", "Procuring authority:", "Win themes"]) {
    assert.ok(!prompt.includes(absent), `prompt should not include "${absent}"`);
  }
});

test("the two fields that steer the draft carry an instruction, not just a label", () => {
  const prompt = buildProposalPrompt(
    contextWith({
      evaluationCriteria: "Technical 70%, Price 30%",
      winThemes: "Local engineering team already certified.",
    }),
    sectionPlan,
  );

  assert.match(prompt, /address these explicitly and in proportion to their weight/);
  assert.match(prompt, /Win themes to carry through the writing/);
});

test("a non-English submission language is instructed, English is left implicit", () => {
  const french = buildProposalPrompt(
    contextWith({ submissionLanguage: "French" }),
    sectionPlan,
  );
  assert.match(french, /Write the section in French\./);

  // The model already writes English by default; saying so spends prompt
  // budget on a no-op.
  const english = buildProposalPrompt(
    contextWith({ submissionLanguage: "English" }),
    sectionPlan,
  );
  assert.ok(!english.includes("Write the section in"));
});
