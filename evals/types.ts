import type { ExtractedRequirement } from "@/features/ai";

/**
 * The shape of a hand-labelled fixture. One directory per document under
 * evals/fixtures/<slug>/ holding document.pdf, expected.json and notes.md.
 */
export type GoldenRequirement = {
  /** Stable slug, so a re-label can be diffed against the previous one. */
  id: string;
  title: string;
  category: ExtractedRequirement["category"];
  priority: ExtractedRequirement["priority"];
  /**
   * Verbatim text from the document. Also the string the matcher compares
   * against, so it must be copied exactly rather than paraphrased.
   */
  sourceClause: string;
  evidenceNeeded: string[];
};

/**
 * Text deliberately NOT counted as a requirement. Recording these makes the
 * boundary explicit: a future re-labeller does not have to re-derive it, and
 * the report can show how much of the precision loss sits on a judgement call
 * rather than on a genuine extraction error.
 */
export type GoldenNonRequirement = {
  text: string;
  reason: string;
};

export type GoldenSet = {
  document: string;
  source: string;
  labelledOn: string;
  requirements: GoldenRequirement[];
  nonRequirements: GoldenNonRequirement[];
};

export type MatchedPair = {
  expected: GoldenRequirement;
  predicted: ExtractedRequirement;
  similarity: number;
};

export type DocumentScore = {
  slug: string;
  extractor: string;
  counts: {
    expected: number;
    predicted: number;
    matched: number;
    /** Unmatched predictions that hit a declared nonRequirement. */
    boundaryMisses: number;
  };
  recall: number;
  precision: number;
  /** Fraction of predictions whose sourceClause appears in the document. */
  clauseAttribution: number;
  /** Agreement on category / priority, over matched pairs only. */
  categoryAccuracy: number;
  priorityAccuracy: number;
  missed: GoldenRequirement[];
  spurious: Array<{ title: string; sourceClause: string | null; boundary: string | null }>;
  unattributed: Array<{ title: string; sourceClause: string | null }>;
  latencyMs: number;
};
