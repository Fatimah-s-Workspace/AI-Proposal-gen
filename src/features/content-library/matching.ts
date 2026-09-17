/**
 * Picking which saved answers are worth showing for a given proposal section.
 *
 * This is deliberately ordinary text matching rather than embeddings. A
 * bidder's library is tens to low hundreds of entries, not millions, and an
 * embedding call would add a per-search cost and a network dependency to a
 * feature whose whole promise is that it is instant. If the library grows past
 * the point where word overlap works, that is a good problem and a different
 * implementation.
 *
 * The bar is not "find everything related". It is "never show something
 * irrelevant", because a library that suggests the wrong answer twice is a
 * library nobody reads a third time.
 */

import {
  containment,
  tokenSet,
} from "@/lib/text-overlap";

export interface LibraryCandidate {
  id: string;
  title: string;
  content: string;
  sectionType?: string | null;
  tags?: string[] | null;
}

export interface SectionNeed {
  title: string;
  sectionType?: string | null;
  requirements?: Array<{ title: string; description?: string | null }>;
}

export interface LibraryMatch<T extends LibraryCandidate> {
  entry: T;
  score: number;
  /** Which tokens drove the match, so the UI can say why rather than just asserting relevance. */
  sharedTerms: string[];
  sectionTypeMatched: boolean;
}

export interface MatchOptions {
  /** Below this, an entry is not worth a user's attention or a place in the prompt. */
  minScore?: number;
  limit?: number;
}

const DEFAULTS = { minScore: 0.22, limit: 3 } as const;

// Weights. Title and tags are what a person deliberately wrote to label the
// entry, so they carry most of the signal; the body is corroboration, not
// evidence on its own - a long answer mentions many things in passing.
const TITLE_WEIGHT = 0.5;
const TAG_WEIGHT = 0.3;
const CONTENT_WEIGHT = 0.2;
// Section type multiplies the evidence rather than adding to it. As a bonus
// added to the score it was a back door: an entry filed under the right type
// cleared the threshold on the bonus alone, so a marine insurance requirement
// was answered with a health and safety policy that shared no words with it at
// all. Filing is a hint about relevance, never a substitute for it.
const SECTION_TYPE_MULTIPLIER = 1.6;
// An entry a person explicitly filed under a different section type is a
// deliberate statement that it does not belong here. Overlapping words are
// halved rather than ignored, because the filing can be stale.
const SECTION_TYPE_CONFLICT_MULTIPLIER = 0.5;

function normaliseType(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  return cleaned || null;
}

/**
 * The separate things a section has to answer.
 *
 * A requirement's title and its full text are both kept: the title is the
 * discriminating part, and a long description would otherwise dilute it with
 * boilerplate about schedules and monthly reports.
 */
function needAspects(need: SectionNeed): Array<Set<string>> {
  const aspects: Array<Set<string>> = [];

  const title = tokenSet(need.title);
  if (title.size > 0) aspects.push(title);

  for (const requirement of need.requirements ?? []) {
    const requirementTitle = tokenSet(requirement.title);
    if (requirementTitle.size > 0) aspects.push(requirementTitle);

    if (requirement.description) {
      const full = tokenSet(`${requirement.title} ${requirement.description}`);
      if (full.size > 0) aspects.push(full);
    }
  }

  return aspects;
}

/**
 * Rank saved answers against what a section needs.
 *
 * Returns only entries that clear `minScore`, highest first. Ties break on
 * title then id so the same library and the same section always produce the
 * same order - a suggestion list that reshuffles between page loads reads as
 * broken even when every entry in it is fine.
 */
export function matchLibraryEntries<T extends LibraryCandidate>(
  entries: readonly T[],
  need: SectionNeed,
  options: MatchOptions = {},
): Array<LibraryMatch<T>> {
  const minScore = options.minScore ?? DEFAULTS.minScore;
  const limit = options.limit ?? DEFAULTS.limit;

  const aspects = needAspects(need);
  const needType = normaliseType(need.sectionType);

  // With nothing meaningful to match on, every score would come from the
  // section type alone and the library would suggest its whole contents.
  // Better to suggest nothing and let the user search.
  if (aspects.length === 0) return [];

  const matches: Array<LibraryMatch<T>> = [];

  for (const entry of entries) {
    const titleTokens = tokenSet(entry.title);
    const tagTokens = tokenSet((entry.tags ?? []).join(" "));
    const contentTokens = tokenSet(entry.content);

    const entryType = normaliseType(entry.sectionType);
    const sectionTypeMatched = Boolean(needType && entryType === needType);
    const sectionTypeConflict = Boolean(
      needType && entryType && entryType !== needType,
    );

    // Scored against each aspect separately, keeping the best. Pooling every
    // requirement into one token set made the denominator grow with the size
    // of the tender: a section with three requirements already scored every
    // entry below the threshold, and a real 60-page pack has dozens. An entry
    // that fully answers one requirement is exactly what the library is for,
    // and it should not be buried by the twenty-nine it says nothing about.
    let textScore = 0;
    let bestAspect: Set<string> | null = null;
    for (const aspect of aspects) {
      const aspectScore =
        TITLE_WEIGHT * containment(aspect, titleTokens) +
        TAG_WEIGHT * containment(aspect, tagTokens) +
        CONTENT_WEIGHT * containment(aspect, contentTokens);
      if (aspectScore > textScore) {
        textScore = aspectScore;
        bestAspect = aspect;
      }
    }

    // No shared vocabulary at all means there is nothing to recommend, whatever
    // the entry is filed under.
    if (textScore <= 0) continue;

    // Not clamped to 1. Capping the top of the range made every strong match
    // score exactly 1.000, so the best three entries in a library tied and
    // fell back to alphabetical order - throwing away the ranking this
    // function exists to produce.
    let score = textScore;
    if (sectionTypeMatched) score *= SECTION_TYPE_MULTIPLIER;
    if (sectionTypeConflict) score *= SECTION_TYPE_CONFLICT_MULTIPLIER;

    if (score < minScore) continue;

    const haystack = new Set<string>();
    for (const token of titleTokens) haystack.add(token);
    for (const token of tagTokens) haystack.add(token);
    for (const token of contentTokens) haystack.add(token);

    const sharedTerms: string[] = [];
    for (const token of bestAspect ?? []) {
      if (haystack.has(token)) sharedTerms.push(token);
    }
    sharedTerms.sort();

    matches.push({ entry, score, sharedTerms, sectionTypeMatched });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byTitle = a.entry.title.localeCompare(b.entry.title);
    if (byTitle !== 0) return byTitle;
    return a.entry.id.localeCompare(b.entry.id);
  });

  return matches.slice(0, limit);
}

/** One line a person can read to understand why an entry was suggested. */
export function describeMatch(match: LibraryMatch<LibraryCandidate>): string {
  const parts: string[] = [];
  if (match.sectionTypeMatched) parts.push("same section type");
  if (match.sharedTerms.length > 0) {
    parts.push(`mentions ${match.sharedTerms.slice(0, 4).join(", ")}`);
  }
  if (parts.length === 0) return "loosely related";
  return parts.join(" · ");
}
