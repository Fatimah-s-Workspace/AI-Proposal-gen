import assert from "node:assert/strict";
import test from "node:test";

import { mergeExtractions, mergeRequirements } from "./document-processing";

/*
 * The second half of the truncation bug.
 *
 * Extraction used to be either/or: any clauses returned by Gemini replaced the
 * rule-based extraction entirely. Combined with the old single 45,000-character
 * slice, a 120-page pack had the model read 13% of it, return a few clauses,
 * and the full-document regex pass - which had read all of it - discarded. The
 * document came out worse when the AI worked than when it failed.
 */

const clause = (originalText: string) => ({ originalText });

test("a clause the AI missed is kept, not discarded", () => {
  const fromAi = [clause("The bidder shall submit a tax clearance certificate.")];
  const fromRules = [
    clause("The bidder shall submit a tax clearance certificate."),
    clause("Bid security of 2% of the bid price must be attached."),
  ];

  const merged = mergeExtractions(fromAi, fromRules);

  assert.equal(merged.length, 2, "the clause only the rules found must survive");
  assert.ok(merged.some((c) => c.originalText.includes("Bid security")));
});

test("a clause both found appears once, with the AI version preferred", () => {
  const fromAi = [clause("Bidders MUST attach audited accounts for three years.")];
  // Same clause, different whitespace and punctuation - the fingerprint should
  // treat these as one.
  const fromRules = [clause("Bidders  MUST  attach audited accounts for three years!")];

  const merged = mergeExtractions(fromAi, fromRules);

  assert.equal(merged.length, 1);
  assert.equal(merged[0], fromAi[0], "the AI version should win on a tie");
});

test("when the AI returns nothing, the rule-based extraction is used in full", () => {
  // The old fallback path, which must keep working.
  const fromRules = [clause("Deadline is 3pm Friday."), clause("Submit three references.")];
  assert.deepEqual(mergeExtractions([], fromRules), fromRules);
});

test("when the rules return nothing, the AI extraction is kept in full", () => {
  const fromAi = [clause("Provide a signed conflict of interest declaration.")];
  assert.deepEqual(mergeExtractions(fromAi, []), fromAi);
});

test("order is preserved, with AI clauses first", () => {
  const fromAi = [clause("A requirement.")];
  const fromRules = [clause("B requirement."), clause("C requirement.")];

  const merged = mergeExtractions(fromAi, fromRules);
  assert.deepEqual(
    merged.map((c) => c.originalText),
    ["A requirement.", "B requirement.", "C requirement."],
  );
});

const requirement = (title: string, description: string) => ({ title, description });

test("requirements merge on title and description together", () => {
  const fromAi = [requirement("Tax clearance", "Attach a current tax clearance certificate.")];
  const fromRules = [
    requirement("Tax clearance", "Attach a current tax clearance certificate."),
    requirement("Bid security", "Attach a bank guarantee for 2% of the bid price."),
  ];

  const merged = mergeRequirements(fromAi, fromRules);

  assert.equal(merged.length, 2);
  assert.ok(merged.some((r) => r.title === "Bid security"));
});

test("two requirements sharing a title but not a description both survive", () => {
  // Procurement documents reuse headings constantly. Keying on the title alone
  // would silently drop the second obligation.
  const merged = mergeRequirements(
    [requirement("Declaration", "Sign the anti-corruption declaration.")],
    [requirement("Declaration", "Sign the conflict of interest declaration.")],
  );

  assert.equal(merged.length, 2);
});
