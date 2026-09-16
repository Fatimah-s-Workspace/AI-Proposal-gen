import assert from "node:assert/strict";
import test from "node:test";

import { chunkDocumentText, coverageNote } from "./chunking";

/** Text with realistic paragraph structure, long enough to need splitting. */
function longDocument(paragraphs: number, perParagraph = 900) {
  return Array.from(
    { length: paragraphs },
    (_, i) => `Clause ${i + 1}. ${"x".repeat(perParagraph)}`,
  ).join("\n\n");
}

test("a short document is one chunk, unchanged", () => {
  const text = "The bidder shall submit a tax clearance certificate.";
  const result = chunkDocumentText(text);

  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].text, text);
  assert.equal(result.complete, true);
});

test("an empty document produces no chunks and does not crash", () => {
  assert.deepEqual(chunkDocumentText(""), {
    chunks: [],
    analysedChars: 0,
    totalChars: 0,
    complete: true,
  });
});

test("every character of a long document reaches at least one chunk", () => {
  // The whole point of the fix. A requirement on the last page must be in the
  // text some chunk actually sends.
  const text = longDocument(200);
  const { chunks, complete } = chunkDocumentText(text);

  assert.ok(chunks.length > 1, "a 180k-character document should split");
  assert.equal(complete, true);

  const reassembled = chunks.reduce((covered, chunk) => {
    assert.ok(
      chunk.startOffset <= covered,
      `gap before chunk ${chunk.index}: starts at ${chunk.startOffset}, covered to ${covered}`,
    );
    return Math.max(covered, chunk.startOffset + chunk.text.length);
  }, 0);

  assert.equal(reassembled, text.length, "chunks must cover the document end to end");
});

test("the last clause in a long document appears in a chunk", () => {
  // The regression stated plainly: this is the text that used to be dropped.
  const text = longDocument(200);
  const marker = "Clause 200.";
  const { chunks } = chunkDocumentText(text);

  assert.ok(
    chunks.some((chunk) => chunk.text.includes(marker)),
    "the final clause was not in any chunk - this is the original bug",
  );
});

test("consecutive chunks overlap, so a clause on a boundary survives", () => {
  const text = longDocument(200);
  const { chunks } = chunkDocumentText(text, { overlap: 2_000 });

  for (let i = 1; i < chunks.length; i += 1) {
    const previousEnd = chunks[i - 1].startOffset + chunks[i - 1].text.length;
    const overlap = previousEnd - chunks[i].startOffset;
    assert.ok(overlap > 0, `chunk ${i} does not overlap the one before it`);
  }
});

test("chunks are capped, and the cap is reported rather than hidden", () => {
  const text = longDocument(4_000); // far past any real tender
  const result = chunkDocumentText(text, { maxChunks: 3 });

  assert.equal(result.chunks.length, 3);
  assert.equal(result.complete, false, "hitting the cap must not look like full coverage");
  assert.ok(result.analysedChars < result.totalChars);
});

test("it prefers to cut at a paragraph break rather than mid-sentence", () => {
  const text = longDocument(200);
  const { chunks } = chunkDocumentText(text);

  // Not every cut can land on a boundary, but most should.
  const cleanCuts = chunks
    .slice(0, -1)
    .filter((chunk) => /\n\n$|\n$|\.\s$/.test(chunk.text)).length;

  assert.ok(
    cleanCuts >= chunks.length - 2,
    `only ${cleanCuts} of ${chunks.length - 1} cuts landed on a boundary`,
  );
});

test("a break point is never allowed to make chunks tiny", () => {
  // A document whose only blank line sits right after the start must not
  // produce a 20-character chunk and 200 paid requests.
  const text = "Intro.\n\n" + "y".repeat(120_000);
  const { chunks } = chunkDocumentText(text, { chunkSize: 10_000 });

  for (const chunk of chunks.slice(0, -1)) {
    assert.ok(
      chunk.text.length >= 7_000,
      `chunk ${chunk.index} was only ${chunk.text.length} characters`,
    );
  }
});

test("text with no boundaries at all still chunks and still terminates", () => {
  const text = "z".repeat(200_000);
  const { chunks, complete } = chunkDocumentText(text, { chunkSize: 20_000 });

  assert.ok(chunks.length > 1);
  assert.equal(complete, true);
});

test("an overlap larger than the chunk cannot stall the loop", () => {
  // Guards the one way this function could hang the whole upload pipeline.
  const result = chunkDocumentText(longDocument(50), {
    chunkSize: 5_000,
    overlap: 99_000,
  });

  assert.ok(result.chunks.length > 1);
  assert.ok(result.chunks.length <= 12);
});

test("the coverage note is silent on full coverage and specific otherwise", () => {
  assert.equal(coverageNote({ analysedChars: 100, totalChars: 100, complete: true }), null);

  const note = coverageNote({ analysedChars: 45_000, totalChars: 336_000, complete: false });
  assert.match(note!, /13%/);
  assert.match(note!, /45,000 of 336,000/);
});
