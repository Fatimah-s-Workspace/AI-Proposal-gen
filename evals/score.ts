import { buildTextDedupeKey } from "@/features/tender-intelligence/pipeline";
import type { ExtractedRequirement } from "@/features/ai";

import type {
  DocumentScore,
  GoldenNonRequirement,
  GoldenRequirement,
  GoldenSet,
  MatchedPair,
} from "./types";

/**
 * Similarity above which two texts are considered the same requirement.
 *
 * Declared here rather than buried in the comparison so that tuning it shows
 * up as a diff. 0.5 was chosen by hand against the LMIA fixture: it joins
 * "Valid Tax Clearance Certificate (3 years)" to "Provide valid tax clearance
 * certificate" while keeping "Company Profile" and "Technical Team CVs" apart.
 */
export const MATCH_THRESHOLD = 0.5;

/**
 * Reuses the product's own normaliser so the eval and the pipeline agree on
 * what counts as "the same text". The default 120-character truncation is
 * bypassed — that limit exists for dedupe keys, not for comparison.
 */
function normalise(text: string): string {
  return buildTextDedupeKey(text, Number.MAX_SAFE_INTEGER);
}

function tokens(text: string): Set<string> {
  return new Set(normalise(text).split(" ").filter((t) => t.length > 2));
}

/**
 * Sørensen–Dice over token sets. Chosen over Jaccard because it is more
 * forgiving of one side being much shorter — golden clauses are often a bare
 * noun phrase ("Company Profile") while extractions carry a verb and object.
 */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const token of ta) if (tb.has(token)) overlap += 1;
  return (2 * overlap) / (ta.size + tb.size);
}

/** Text used to compare a prediction: its clause if present, else its title. */
function predictionText(p: ExtractedRequirement): string {
  return [p.sourceClause ?? "", p.title, p.description].filter(Boolean).join(" ");
}

/**
 * Greedy one-to-one assignment, best pairs first. One-to-one matters: without
 * it a single broad extraction ("submit all mandatory documents") would satisfy
 * every mandatory label at once and recall would be meaningless.
 */
export function matchRequirements(
  expected: GoldenRequirement[],
  predicted: ExtractedRequirement[],
): { pairs: MatchedPair[]; missed: GoldenRequirement[]; spurious: ExtractedRequirement[] } {
  const candidates: MatchedPair[] = [];

  for (const e of expected) {
    for (const p of predicted) {
      const score = Math.max(
        similarity(e.sourceClause, predictionText(p)),
        similarity(e.title, predictionText(p)),
      );
      if (score >= MATCH_THRESHOLD) candidates.push({ expected: e, predicted: p, similarity: score });
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity);

  const usedExpected = new Set<string>();
  const usedPredicted = new Set<ExtractedRequirement>();
  const pairs: MatchedPair[] = [];

  for (const c of candidates) {
    if (usedExpected.has(c.expected.id) || usedPredicted.has(c.predicted)) continue;
    usedExpected.add(c.expected.id);
    usedPredicted.add(c.predicted);
    pairs.push(c);
  }

  return {
    pairs,
    missed: expected.filter((e) => !usedExpected.has(e.id)),
    spurious: predicted.filter((p) => !usedPredicted.has(p)),
  };
}

/**
 * Hallucination check. A requirement citing a clause that is not in the
 * document is the failure mode that matters most in compliance software, and
 * it needs no labelling to detect.
 */
export function attributionHolds(
  requirement: ExtractedRequirement,
  documentText: string,
): boolean {
  const haystack = normalise(documentText);

  // Check every field that claims to carry document text. `description` holds
  // the verbatim clause body for the heuristic extractor; `sourceClause` is
  // where an LLM extractor is expected to put its quote. A requirement is
  // grounded if *any* of them is genuinely present in the document.
  //
  // Note that the heuristic extractor sets `sourceClause` to a generated label
  // ("CAC registration", "Submission checklist") rather than a quote — see
  // buildClauseTitle in pipeline.ts. Traceability there runs through
  // `sourceClauseId`, not through this string.
  for (const candidate of [requirement.description, requirement.sourceClause]) {
    if (!candidate) continue;
    const needle = normalise(candidate);
    if (!needle) continue;
    if (haystack.includes(needle)) return true;
    // A clause truncated mid-word by the extractor still counts as attributed
    // if a long enough prefix is present verbatim.
    if (needle.length > 40 && haystack.includes(needle.slice(0, 40))) return true;
  }

  return false;
}

/** Which declared non-requirement, if any, an unmatched prediction landed on. */
function boundaryFor(
  prediction: ExtractedRequirement,
  nonRequirements: GoldenNonRequirement[],
): string | null {
  let best: { text: string; score: number } | null = null;
  for (const nr of nonRequirements) {
    const score = similarity(nr.text, predictionText(prediction));
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { text: nr.text, score };
    }
  }
  return best?.text ?? null;
}

const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator;

export function scoreDocument(input: {
  slug: string;
  extractor: string;
  golden: GoldenSet;
  predicted: ExtractedRequirement[];
  documentText: string;
  latencyMs: number;
}): DocumentScore {
  const { slug, extractor, golden, predicted, documentText, latencyMs } = input;
  const { pairs, missed, spurious } = matchRequirements(golden.requirements, predicted);

  const attributed = predicted.filter((p) => attributionHolds(p, documentText));
  const categoryHits = pairs.filter((p) => p.expected.category === p.predicted.category);
  const priorityHits = pairs.filter((p) => p.expected.priority === p.predicted.priority);

  const spuriousDetail = spurious.map((p) => ({
    title: p.title,
    sourceClause: p.sourceClause,
    boundary: boundaryFor(p, golden.nonRequirements),
  }));

  return {
    slug,
    extractor,
    counts: {
      expected: golden.requirements.length,
      predicted: predicted.length,
      matched: pairs.length,
      boundaryMisses: spuriousDetail.filter((s) => s.boundary !== null).length,
    },
    recall: ratio(pairs.length, golden.requirements.length),
    precision: ratio(pairs.length, predicted.length),
    clauseAttribution: ratio(attributed.length, predicted.length),
    categoryAccuracy: ratio(categoryHits.length, pairs.length),
    priorityAccuracy: ratio(priorityHits.length, pairs.length),
    missed,
    spurious: spuriousDetail,
    unattributed: predicted
      .filter((p) => !attributionHolds(p, documentText))
      .map((p) => ({ title: p.title, sourceClause: p.sourceClause })),
    latencyMs,
  };
}
