import {
  tokenSet,
  tokenize,
  weightedContainment,
  weightedTokens,
} from "@/lib/text-overlap";

/**
 * Whether a draft actually addresses a requirement.
 *
 * The previous implementation asked whether the section contained the
 * requirement's title as a literal substring. That measures copying, not
 * covering: a bidder who pasted "Bidder must hold current ISO 27001
 * certification" into their proposal scored full marks, and one who wrote
 * "our ISMS has been certified to ISO 27001 since 2021" scored nothing. It
 * rewarded the one behaviour an evaluator marks down.
 *
 * This asks a different question: how much of the requirement's distinctive
 * vocabulary appears in the draft. It is still only word overlap - it cannot
 * tell "we hold ISO 27001" from "we do not hold ISO 27001", and it should
 * never be presented as if it could. What it can do is tell a writer which
 * requirements their section never mentions at all, which is the failure that
 * actually loses bids.
 */

export type CoverageLevel = "strong" | "weak" | "missing" | "unassessable";

export interface CoverageRequirement {
  title: string;
  evidenceNeeded?: readonly string[] | null;
}

export interface CoverageAssessment {
  level: CoverageLevel;
  /** Fraction of the requirement's distinctive words present in the draft. */
  score: number;
  matchedTerms: string[];
  /** The distinctive words the draft never uses - what to write about next. */
  missingTerms: string[];
}

// Most of a requirement's distinctive vocabulary present: the section is
// clearly about this. Some of it: the subject is raised but thinly.
const STRONG_THRESHOLD = 0.6;
const WEAK_THRESHOLD = 0.3;

// Evidence is corroboration. Naming the certificate a requirement asks for is
// real signal, but it is weaker than addressing the requirement itself, and a
// requirement's evidence list is often generic ("certificate", "letter").
const EVIDENCE_WEIGHT = 0.8;

export function assessRequirementCoverage(
  content: string,
  requirement: CoverageRequirement,
): CoverageAssessment {
  const titleTokens = tokenize(requirement.title);

  // Nothing distinctive to look for. A requirement extracted as "The bidder
  // shall provide the required documents" is all boilerplate: reporting it as
  // missing would send a writer to fix a section that may already cover it,
  // and reporting it as covered would be a guess. Neither is honest.
  if (titleTokens.length === 0) {
    return { level: "unassessable", score: 0, matchedTerms: [], missingTerms: [] };
  }

  const contentTokens = tokenSet(content);
  const titleSet = new Set(titleTokens);

  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];
  for (const token of titleSet) {
    if (contentTokens.has(token)) matchedTerms.push(token);
    else missingTerms.push(token);
  }
  matchedTerms.sort();
  missingTerms.sort();

  // Weighted, so a draft that names the standard but skips the tender's own
  // filler word is not marked down for it.
  const titleScore = weightedContainment(weightedTokens(requirement.title), contentTokens);

  // Each piece of evidence is scored on its own rather than pooled, so a long
  // evidence list cannot dilute the one item the draft does name.
  let evidenceScore = 0;
  for (const evidence of requirement.evidenceNeeded ?? []) {
    if (tokenize(evidence).length === 0) continue;
    evidenceScore = Math.max(
      evidenceScore,
      weightedContainment(weightedTokens(evidence), contentTokens),
    );
  }

  const score = Math.max(titleScore, EVIDENCE_WEIGHT * evidenceScore);

  const level: CoverageLevel =
    score >= STRONG_THRESHOLD ? "strong" : score >= WEAK_THRESHOLD ? "weak" : "missing";

  return { level, score, matchedTerms, missingTerms };
}

export interface CoverageSummary {
  strong: number;
  weak: number;
  missing: number;
  /** Requirements too generic to judge. Excluded from the percentage. */
  unassessable: number;
  /** 0-100, over the requirements that could actually be assessed. */
  coverage: number;
}

export function summariseCoverage(
  assessments: readonly CoverageAssessment[],
): CoverageSummary {
  let strong = 0;
  let weak = 0;
  let missing = 0;
  let unassessable = 0;

  for (const assessment of assessments) {
    if (assessment.level === "strong") strong += 1;
    else if (assessment.level === "weak") weak += 1;
    else if (assessment.level === "missing") missing += 1;
    else unassessable += 1;
  }

  // Requirements that cannot be judged are left out of the denominator rather
  // than counted as covered or as missing. Counting them either way would
  // move a number the bidder reads as fact, on the strength of a guess.
  const assessable = strong + weak + missing;
  const coverage =
    assessable === 0 ? 0 : Math.round(((strong + weak * 0.45) / assessable) * 100);

  return { strong, weak, missing, unassessable, coverage };
}
