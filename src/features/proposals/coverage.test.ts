import assert from "node:assert/strict";
import test from "node:test";

import { assessRequirementCoverage, summariseCoverage } from "./coverage";

// The whole point of the change. The old check asked whether the section
// contained the requirement's title verbatim, so it scored a bidder who
// pasted the tender's own wording and failed one who answered it properly.
test("a proper answer counts as covered, without copying the requirement", () => {
  const requirement = { title: "ISO 27001 certification" };

  const answered = assessRequirementCoverage(
    "Our information security management system has been certified to ISO 27001 since 2021, certificate number IS 712345.",
    requirement,
  );
  assert.equal(answered.level, "strong");

  const pasted = assessRequirementCoverage("ISO 27001 certification", requirement);
  assert.equal(pasted.level, "strong", "copying still counts - it is just no longer the only thing that does");
});

test("short codes are not thrown away", () => {
  // The old filter kept only words longer than five characters, which dropped
  // "ISO", "NDPR", "VAT" and even "27001" - the terms that identify a
  // requirement more precisely than any of the words around them.
  const ndpr = assessRequirementCoverage(
    "All personal data is processed in line with the NDPR.",
    { title: "NDPR compliance" },
  );
  assert.equal(ndpr.level, "strong");

  const iso = assessRequirementCoverage(
    "We hold ISO 27001.",
    { title: "ISO 27001" },
  );
  assert.equal(iso.level, "strong");
});

test("a section that never mentions the subject is missing, not weak", () => {
  const assessment = assessRequirementCoverage(
    "We will mobilise a project team within two weeks of award and hold fortnightly steering meetings.",
    { title: "Marine hull insurance cover" },
  );

  assert.equal(assessment.level, "missing");
  assert.ok(assessment.missingTerms.includes("marine"));
  assert.ok(assessment.missingTerms.includes("hull"));
});

test("the assessment says which words the draft never uses", () => {
  const assessment = assessRequirementCoverage(
    "We are certified to ISO 27001.",
    { title: "ISO 27001 certification and annual surveillance audit" },
  );

  assert.ok(assessment.matchedTerms.includes("iso"));
  assert.ok(assessment.matchedTerms.includes("27001"));
  assert.ok(assessment.missingTerms.includes("surveillance"));
  assert.ok(assessment.missingTerms.includes("audit"));
});

test("naming the evidence a requirement asks for counts, but counts for less", () => {
  const requirement = {
    title: "Statutory pension remittances",
    evidenceNeeded: ["PENCOM compliance certificate"],
  };

  const viaEvidence = assessRequirementCoverage(
    "A current PENCOM compliance certificate is attached at annex C.",
    requirement,
  );
  assert.notEqual(viaEvidence.level, "missing");

  const viaTitle = assessRequirementCoverage(
    "Statutory pension remittances are current and filed monthly.",
    requirement,
  );
  assert.equal(viaTitle.level, "strong");
  assert.ok(
    viaTitle.score > viaEvidence.score,
    "answering the requirement beats naming the paperwork",
  );
});

test("a long evidence list does not dilute the one item the draft names", () => {
  const assessment = assessRequirementCoverage(
    "A current PENCOM compliance certificate is attached.",
    {
      title: "Statutory compliance",
      evidenceNeeded: [
        "PENCOM compliance certificate",
        "NSITF remittance schedule",
        "ITF contribution receipt",
        "audited financial statements for three years",
      ],
    },
  );

  assert.notEqual(assessment.level, "missing");
});

// "The bidder shall provide the required documents" is all boilerplate. The
// old code would report it missing and send a writer to fix a section that
// may already cover it.
test("a requirement with nothing distinctive in it is not reported as missing", () => {
  const assessment = assessRequirementCoverage(
    "Our response addresses every point raised.",
    // The phrasing a real extraction produces, not one tuned to pass: the
    // first version of this test used "the requirements", which is already a
    // stopword, and so proved nothing about "required".
    { title: "The bidder shall provide the required documents" },
  );

  assert.equal(assessment.level, "unassessable");
  assert.equal(assessment.score, 0);
});

test("a requirement's category cannot inflate its coverage", () => {
  // The old term list included the category, so a draft containing the word
  // "mandatory" scored a hit towards every mandatory requirement.
  const assessment = assessRequirementCoverage(
    "This is a mandatory part of our submission and is mandatory throughout.",
    { title: "Marine hull insurance" },
  );

  assert.equal(assessment.level, "missing");
});

test("summarise leaves unassessable requirements out of the percentage", () => {
  const summary = summariseCoverage([
    { level: "strong", score: 1, matchedTerms: [], missingTerms: [] },
    { level: "missing", score: 0, matchedTerms: [], missingTerms: [] },
    { level: "unassessable", score: 0, matchedTerms: [], missingTerms: [] },
  ]);

  assert.deepEqual(
    { strong: summary.strong, weak: summary.weak, missing: summary.missing, unassessable: summary.unassessable },
    { strong: 1, weak: 0, missing: 1, unassessable: 1 },
  );
  // One of two assessable requirements is strong, so 50 - not 33.
  assert.equal(summary.coverage, 50);
});

test("a section with nothing assessable reports zero rather than dividing by nothing", () => {
  const summary = summariseCoverage([
    { level: "unassessable", score: 0, matchedTerms: [], missingTerms: [] },
  ]);

  assert.equal(summary.coverage, 0);
  assert.equal(summary.unassessable, 1);
});

test("no requirements at all is zero, not a crash", () => {
  assert.equal(summariseCoverage([]).coverage, 0);
});

// Measured against the implementation this replaced, on the same inputs:
//   a real answer, in the bidder's own words ....... was "missing", now strong
//   the tender's wording pasted in ................. was "strong", still strong
//   waffle containing the word "mandatory" ......... was "weak",    now missing
// The old check rewarded copying and penalised writing, which is backwards
// from how the section is actually marked.
test("a well-written answer outscores a paste of the requirement, not the reverse", () => {
  const requirement = {
    title: "ISO 27001 certification",
    evidenceNeeded: ["Certificate of registration"],
  };

  const written = assessRequirementCoverage(
    "Our information security management system has been certified to ISO 27001 since 2021. The certificate, number IS 712345, is issued by BSI and renewed annually.",
    requirement,
  );
  const pasted = assessRequirementCoverage("ISO 27001 certification.", requirement);
  const waffle = assessRequirementCoverage(
    "We confirm this is a mandatory part of our submission and all mandatory elements are addressed.",
    requirement,
  );

  assert.equal(written.level, "strong", "the answer an evaluator would credit");
  assert.equal(pasted.level, "strong", "copying is not punished, it is just no longer special");
  assert.equal(waffle.level, "missing", "saying 'mandatory' is not evidence of anything");
});
