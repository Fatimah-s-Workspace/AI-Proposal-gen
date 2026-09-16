/**
 * Splitting a long tender pack into pieces the model can actually read.
 *
 * The previous behaviour was a single `text.slice(0, 45000)`. That is roughly
 * 16 pages, and Nigerian public tender packs routinely run 60-120 - so on a
 * real document the model saw between 13% and 27% of it, silently, and the
 * requirements on later pages were never extracted at all. For a product whose
 * whole promise is "you will not miss a requirement", that is the one failure
 * that cannot ship.
 *
 * Splitting is done here rather than inline so the rules that matter - every
 * character reaches some chunk, consecutive chunks overlap, the work is
 * bounded - can be tested without calling an API.
 */

export type TextChunk = {
  /** The text handed to the model. */
  text: string;
  /** 0-based position in the sequence, used to keep results in document order. */
  index: number;
  /** Where this chunk starts in the original text. */
  startOffset: number;
};

export type ChunkedDocument = {
  chunks: TextChunk[];
  /** Characters actually covered by at least one chunk. */
  analysedChars: number;
  totalChars: number;
  /** False when the cap below stopped us before the end of the document. */
  complete: boolean;
};

export type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
  maxChunks?: number;
};

/**
 * Defaults.
 *
 * `chunkSize` stays at the old 45,000 because it was a working request size -
 * the bug was never the size, it was that there was only ever one of them.
 *
 * `overlap` exists because a requirement that straddles a boundary would
 * otherwise be cut in half and recognised by neither side. 2,000 characters is
 * comfortably longer than any single clause.
 *
 * `maxChunks` bounds cost and time. Each chunk is a paid API call, so an
 * enormous or malformed document must not be able to run up an unbounded bill.
 * 12 chunks covers roughly 190 pages, past any tender pack seen so far - and
 * when it is hit, `complete` says so rather than the caller assuming coverage.
 */
const DEFAULTS = {
  chunkSize: 45_000,
  overlap: 2_000,
  maxChunks: 12,
} as const;

/** Boundaries to prefer when cutting, best first. */
const BOUNDARIES = ["\n\n", "\n", ". "] as const;

export function chunkDocumentText(
  text: string,
  options: ChunkOptions = {},
): ChunkedDocument {
  const chunkSize = Math.max(1_000, options.chunkSize ?? DEFAULTS.chunkSize);
  const maxChunks = Math.max(1, options.maxChunks ?? DEFAULTS.maxChunks);
  // Overlap must stay well under the chunk size, or a chunk could end up
  // starting before the previous one did and the loop would never advance.
  const overlap = Math.min(
    Math.max(0, options.overlap ?? DEFAULTS.overlap),
    Math.floor(chunkSize / 2),
  );

  const totalChars = text.length;

  if (totalChars === 0) {
    return { chunks: [], analysedChars: 0, totalChars: 0, complete: true };
  }

  if (totalChars <= chunkSize) {
    return {
      chunks: [{ text, index: 0, startOffset: 0 }],
      analysedChars: totalChars,
      totalChars,
      complete: true,
    };
  }

  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < totalChars && chunks.length < maxChunks) {
    const hardEnd = Math.min(cursor + chunkSize, totalChars);
    const end = hardEnd === totalChars ? totalChars : findBreakPoint(text, cursor, hardEnd);

    chunks.push({
      text: text.slice(cursor, end),
      index: chunks.length,
      startOffset: cursor,
    });

    if (end >= totalChars) break;

    // Step back by the overlap, but never far enough to stall: without the
    // max() a pathological break point could put the next cursor at or before
    // this one and spin forever.
    cursor = Math.max(cursor + 1, end - overlap);
  }

  const covered = chunks.length ? chunks[chunks.length - 1].startOffset + chunks[chunks.length - 1].text.length : 0;

  return {
    chunks,
    analysedChars: covered,
    totalChars,
    complete: covered >= totalChars,
  };
}

/**
 * Finds somewhere sensible to cut, searching backwards from the hard limit.
 *
 * Only the last quarter of the chunk is considered: cutting mid-sentence is
 * mildly bad, but cutting a 45,000-character chunk down to 12,000 because that
 * is where the nearest blank line happened to be is much worse - it would
 * multiply the number of paid requests for no benefit.
 */
function findBreakPoint(text: string, start: number, hardEnd: number): number {
  const window = Math.floor((hardEnd - start) / 4);
  const earliest = hardEnd - window;

  for (const boundary of BOUNDARIES) {
    const found = text.lastIndexOf(boundary, hardEnd);
    if (found > earliest) return found + boundary.length;
  }

  return hardEnd;
}

/** A human-readable note when a document was too large to analyse in full. */
export function coverageNote(coverage: Pick<ChunkedDocument, "analysedChars" | "totalChars" | "complete">) {
  if (coverage.complete) return null;
  const percent = Math.round((coverage.analysedChars / Math.max(coverage.totalChars, 1)) * 100);
  return `This document is unusually large. The first ${percent}% was analysed (${coverage.analysedChars.toLocaleString()} of ${coverage.totalChars.toLocaleString()} characters). Split it into separate uploads to have all of it analysed.`;
}
