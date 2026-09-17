import assert from "node:assert/strict";
import test from "node:test";

import type {
  TenderProposalContext,
  TenderProposalSectionPlan,
} from "@/features/proposals/tender-proposal";
import {
  buildProposalPrompt,
  selectLibraryEntriesForPrompt,
} from "./proposal-generation";

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
  bidder?: TenderProposalContext["bidder"],
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
    bidder,
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

// The company profile is set once and reused across every project, so a
// break here degrades every proposal in the workspace at once rather than
// one visibly wrong draft.
test("the company profile reaches the prompt", () => {
  const prompt = buildProposalPrompt(
    contextWith(
      {},
      {
        name: "Acme workspace",
        legalName: "Acme Engineering Services Limited",
        registrationNumber: "RC 1234567",
        foundedYear: 2014,
        teamSize: "45 permanent staff",
        profileSummary: "A Kano-based renewable energy contractor.",
        capabilities: "Solar mini-grid design and installation.",
        certifications: "ISO 9001:2015",
        pastPerformance: "2024 - Kano State Ministry of Health, NGN 180m",
      },
    ),
    sectionPlan,
  );

  for (const expected of [
    "Acme Engineering Services Limited",
    "RC 1234567",
    "Operating since: 2014",
    "45 permanent staff",
    "A Kano-based renewable energy contractor.",
    "Solar mini-grid design and installation.",
    "ISO 9001:2015",
    "2024 - Kano State Ministry of Health, NGN 180m",
  ]) {
    assert.ok(prompt.includes(expected), `prompt is missing "${expected}"`);
  }
});

test("the workspace name stands in when no legal name is set", () => {
  const prompt = buildProposalPrompt(
    contextWith({}, { name: "Acme workspace" }),
    sectionPlan,
  );

  assert.match(prompt, /Bidding as: Acme workspace/);
});

// An invented certification or contract in a submitted tender is a
// disqualification, not a typo - so the guard has to be present either way,
// worded for what the model actually has to work with.
test("the model is told not to invent credentials, with or without a profile", () => {
  const withProfile = buildProposalPrompt(
    contextWith({}, { name: "Acme", pastPerformance: "2024 - a contract" }),
    sectionPlan,
  );
  assert.match(withProfile, /Use only the bidder details above/);
  assert.match(withProfile, /Do not invent certifications, contracts/);

  const withoutProfile = buildProposalPrompt(contextWith({}), sectionPlan);
  assert.match(withoutProfile, /No bidder profile has been provided/);
  assert.match(withoutProfile, /leave clearly marked placeholders/);
  // The "details above" wording would point at nothing here.
  assert.ok(!withoutProfile.includes("Use only the bidder details above"));
});

test("an empty profile is treated as no profile at all", () => {
  const prompt = buildProposalPrompt(
    contextWith({}, { name: "", capabilities: "", pastPerformance: null }),
    sectionPlan,
  );

  assert.match(prompt, /No bidder profile has been provided/);
});

test("approved library answers reach the model, fenced and attributed", () => {
  const prompt = buildProposalPrompt(
    contextWith({}, { name: "Acme" }),
    sectionPlan,
    "formal",
    undefined,
    [
      {
        id: "lib-1",
        title: "ISO 27001 certification statement",
        content: "Certified to ISO 27001:2022 by BSI, certificate IS 712345.",
      },
    ],
  );

  assert.match(prompt, /APPROVED ANSWER 1: ISO 27001 certification statement/);
  assert.match(prompt, /END APPROVED ANSWER 1/);
  assert.match(prompt, /certificate IS 712345/);
  // Reusing the wording is the instruction; paraphrasing is how a
  // certificate number quietly changes.
  assert.match(prompt, /Reuse its wording/);
  assert.match(prompt, /already been reviewed and signed off by the bidder/);
});

test("an empty library leaves the prompt exactly as it was", () => {
  const context = contextWith({}, { name: "Acme" });
  const withoutLibrary = buildProposalPrompt(context, sectionPlan);
  const withEmptyLibrary = buildProposalPrompt(context, sectionPlan, "formal", undefined, []);

  assert.equal(withEmptyLibrary, withoutLibrary);
  assert.ok(!withoutLibrary.includes("APPROVED ANSWER"));
});

// Tender text is written by whoever produced the uploaded document; library
// text is the bidder's own. Only one of those may carry instructions, so the
// prompt has to keep them visibly apart.
test("library content is labelled as the bidder's own, not mixed into tender context", () => {
  const prompt = buildProposalPrompt(
    contextWith({}, { name: "Acme" }),
    sectionPlan,
    "formal",
    undefined,
    [{ id: "lib-1", title: "Safety record", content: "Zero lost-time incidents since 2021." }],
  );

  const libraryAt = prompt.indexOf("APPROVED ANSWER 1");
  const requirementsAt = prompt.indexOf("Requirements:");

  assert.ok(libraryAt > -1 && requirementsAt > -1);
  assert.ok(
    libraryAt > requirementsAt,
    "the bidder's own approved text comes after the tender material it answers",
  );
});

// The guard and the library are both statements about what the bidder may
// claim. If the guard names only the profile, an approved answer carrying a
// certificate number reads to the model as an invention to be dropped.
test("the anti-invention guard counts the library as an approved source", () => {
  const context = contextWith({}, { name: "Acme", certifications: "ISO 9001:2015" });
  const library = [
    { id: "lib-1", title: "ISO 27001", content: "Certified to ISO 27001:2022, certificate IS 712345." },
  ];

  const withLibrary = buildProposalPrompt(context, sectionPlan, "formal", undefined, library);
  assert.match(withLibrary, /and the approved library content below/);
  assert.ok(
    !withLibrary.includes("Do not invent certifications, contracts, staff numbers, or dates beyond what is given above"),
    "the profile is no longer the only permitted source",
  );

  const withoutLibrary = buildProposalPrompt(context, sectionPlan);
  assert.ok(!withoutLibrary.includes("approved library content below"));
});

test("with no profile but a library, the model is pointed at the library rather than told to write nothing", () => {
  const prompt = buildProposalPrompt(
    contextWith({}),
    sectionPlan,
    "formal",
    undefined,
    [{ id: "lib-1", title: "Safety record", content: "Zero lost-time incidents since 2021." }],
  );

  assert.match(prompt, /Use only the approved library content below/);
  assert.ok(
    !prompt.includes("Do not state any specific experience, credentials, or past contracts"),
    "that instruction would discard the bidder's own approved evidence",
  );
});

// Three 20,000-character answers would attach roughly fifteen thousand tokens
// to every section of every proposal - a bill the bidder never agreed to.
test("the prompt carries only as much approved text as its budget allows", () => {
  const big = (id: string, size: number) => ({
    id,
    title: `Answer ${id}`,
    content: "x".repeat(size),
  });

  const result = selectLibraryEntriesForPrompt([big("a", 8000), big("b", 8000), big("c", 100)], 12_000);

  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["a", "c"],
    "entries are taken in rank order while they fit, and a later small one still fits",
  );
  assert.equal(result.omitted, 1);
});

test("an entry larger than the whole budget is dropped, never trimmed", () => {
  const result = selectLibraryEntriesForPrompt(
    [{ id: "huge", title: "Huge", content: "x".repeat(50_000) }],
    12_000,
  );

  assert.deepEqual(result.entries, [], "half an approved statement is worse than none");
  assert.equal(result.omitted, 1);
});

test("an oversized answer does not reach the prompt", () => {
  const prompt = buildProposalPrompt(
    contextWith({}, { name: "Acme" }),
    sectionPlan,
    "formal",
    undefined,
    [{ id: "huge", title: "Huge answer", content: "x".repeat(50_000) }],
  );

  assert.ok(!prompt.includes("APPROVED ANSWER"), "nothing fitted, so no library block");
  assert.ok(!prompt.includes("approved library content below"));
  assert.ok(prompt.length < 5_000, "the prompt stays a normal size");
});
