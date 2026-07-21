import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTextDedupeKey,
  calculateChecklistScore,
  detectEvidenceMatchesForRequirements,
  explainTenderClause,
  extractRequirementsFromClauses,
  extractTenderClausesFromSections,
  mergeEvidenceMatches,
} from "./pipeline";
import type { ParsedSection, TenderClauseExtraction } from "@/features/ai";

test("buildTextDedupeKey normalises case, whitespace, and punctuation", () => {
  const a = buildTextDedupeKey("Provide  CAC   Certificate!!");
  const b = buildTextDedupeKey("provide cac certificate");
  assert.equal(a, b);
});

test("buildTextDedupeKey treats differently worded text as distinct", () => {
  const a = buildTextDedupeKey("Provide CAC certificate");
  const b = buildTextDedupeKey("Provide tax clearance certificate");
  assert.notEqual(a, b);
});

test("buildTextDedupeKey truncates to the requested length", () => {
  const long = "a".repeat(500);
  const key = buildTextDedupeKey(long, 50);
  assert.equal(key.length, 50);
});

test("extractTenderClausesFromSections deduplicates identical clauses within a batch", () => {
  const sections: ParsedSection[] = [
    {
      title: "Eligibility",
      body: "Bidders must provide a valid CAC registration certificate.\nBidders must provide a valid CAC registration certificate.",
      order: 1,
    },
  ];

  const clauses = extractTenderClausesFromSections(sections);
  const keys = clauses.map((clause) => buildTextDedupeKey(clause.originalText, 120));
  const uniqueKeys = new Set(keys);
  assert.equal(keys.length, uniqueKeys.size, "duplicate clause text should be deduplicated");
});

test("extractTenderClausesFromSections ignores fragments below the minimum length", () => {
  // Candidates shorter than 12 characters are filtered out before the
  // directive-language check even runs.
  const sections: ParsedSection[] = [
    {
      title: "Overview",
      body: "Hi.\nOk.\nNote.",
      order: 1,
    },
  ];

  const clauses = extractTenderClausesFromSections(sections);
  assert.equal(clauses.length, 0);
});

test("extractTenderClausesFromSections flags high-risk deadline language", () => {
  const sections: ParsedSection[] = [
    {
      title: "Submission",
      body: "Bids must be submitted before the deadline. Late submissions will be disqualified.",
      order: 1,
    },
  ];

  const clauses = extractTenderClausesFromSections(sections);
  assert.ok(clauses.length > 0);
  assert.ok(clauses.some((clause) => clause.riskLevel === "high"));
});

test("extractRequirementsFromClauses only converts directive clauses", () => {
  const clauses: Array<TenderClauseExtraction & { id?: string }> = [
    {
      title: "CAC",
      originalText: "Bidders must submit a valid CAC registration certificate.",
      clauseType: "eligibility",
      importance: "high",
      riskLevel: "high",
      confidence: 0.9,
      actionsRequired: [],
      parsedSectionOrder: 1,
      id: "clause-1",
    },
    {
      title: "Background",
      originalText: "The agency was established many years ago for rural development purposes.",
      clauseType: "instruction",
      importance: "low",
      riskLevel: "low",
      confidence: 0.5,
      actionsRequired: [],
      parsedSectionOrder: 1,
      id: "clause-2",
    },
  ];

  const requirements = extractRequirementsFromClauses(clauses);
  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].sourceClauseId, "clause-1");
  assert.equal(requirements[0].category, "mandatory");
});

test("extractRequirementsFromClauses clamps confidence into a sane range", () => {
  const clauses: Array<TenderClauseExtraction & { id?: string }> = [
    {
      title: "Bid security",
      originalText: "Bidders must provide bid security in the form of a bank guarantee.",
      clauseType: "financial",
      importance: "high",
      riskLevel: "high",
      confidence: 0.99,
      actionsRequired: [],
      parsedSectionOrder: 1,
    },
  ];

  const requirements = extractRequirementsFromClauses(clauses);
  assert.equal(requirements.length, 1);
  assert.ok(requirements[0].confidence <= 0.98);
  assert.ok(requirements[0].confidence >= 0.55);
});

test("calculateChecklistScore returns 0 for an empty checklist", () => {
  assert.equal(calculateChecklistScore([]), 0);
});

test("calculateChecklistScore returns 100 when every requirement is met", () => {
  const score = calculateChecklistScore([
    { status: "met", priority: "high" },
    { status: "met", priority: "medium" },
    { status: "met", priority: "low" },
  ]);
  assert.equal(score, 100);
});

test("calculateChecklistScore treats a waiver as partial, not full, credit", () => {
  const allMet = calculateChecklistScore([{ status: "met", priority: "medium" }]);
  const waived = calculateChecklistScore([{ status: "waiver", priority: "medium" }]);
  assert.ok(waived < allMet);
});

test("calculateChecklistScore weighs high-priority items more heavily", () => {
  const highBlocked = calculateChecklistScore([
    { status: "blocked", priority: "high" },
    { status: "met", priority: "low" },
  ]);
  const lowBlocked = calculateChecklistScore([
    { status: "met", priority: "high" },
    { status: "blocked", priority: "low" },
  ]);
  assert.ok(lowBlocked > highBlocked);
});

test("detectEvidenceMatchesForRequirements matches an uploaded evidence document", () => {
  const matches = detectEvidenceMatchesForRequirements({
    requirements: [
      {
        id: "req-1",
        title: "Tax clearance",
        description: "Provide a valid tax clearance certificate.",
        evidenceNeeded: ["Tax clearance"],
      },
    ],
    evidenceDocument: {
      id: "doc-1",
      originalName: "tax_clearance_certificate.pdf",
      extractedText: "FIRS Tax Clearance Certificate 2026",
    },
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].requirementId, "req-1");
  assert.equal(matches[0].match.detectedType, "Tax clearance");
});

test("detectEvidenceMatchesForRequirements finds nothing when evidence type is unrelated", () => {
  const matches = detectEvidenceMatchesForRequirements({
    requirements: [
      {
        id: "req-1",
        title: "Tax clearance",
        description: "Provide a valid tax clearance certificate.",
        evidenceNeeded: ["Tax clearance"],
      },
    ],
    evidenceDocument: {
      id: "doc-1",
      originalName: "random_photo.pdf",
      extractedText: "a scenic photo of the project site",
    },
  });

  assert.equal(matches.length, 0);
});

test("mergeEvidenceMatches replaces a prior match from the same document", () => {
  const existing = [
    { documentId: "doc-1", fileName: "old.pdf", detectedType: "Tax clearance", confidence: 0.7, reason: "old" },
  ];
  const incoming = {
    documentId: "doc-1",
    fileName: "new.pdf",
    detectedType: "Tax clearance",
    confidence: 0.9,
    reason: "new",
  };

  const merged = mergeEvidenceMatches(existing, incoming);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].fileName, "new.pdf");
});

test("mergeEvidenceMatches appends a match from a different document", () => {
  const existing = [
    { documentId: "doc-1", fileName: "a.pdf", detectedType: "Tax clearance", confidence: 0.7, reason: "a" },
  ];
  const incoming = {
    documentId: "doc-2",
    fileName: "b.pdf",
    detectedType: "CAC registration",
    confidence: 0.9,
    reason: "b",
  };

  const merged = mergeEvidenceMatches(existing, incoming);
  assert.equal(merged.length, 2);
});

test("explainTenderClause treats deadline language as high risk", () => {
  const explanation = explainTenderClause({
    originalText: "Bids received after the deadline will be rejected.",
  });
  assert.equal(explanation.riskLevel, "high");
  assert.ok(explanation.plainEnglish.length > 0);
  assert.ok(explanation.action.length > 0);
});
