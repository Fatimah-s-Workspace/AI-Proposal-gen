import assert from "node:assert/strict";
import test from "node:test";

import { ocrUnavailableMessage } from "./ocr";

/*
 * The transcription call itself needs a live model and a key, so it is
 * verified against the real API rather than here. What is pinned here is the
 * behaviour that must hold when it is *not* available - which is the path most
 * users on a free tier will actually hit, and the one that used to leave them
 * with an empty checklist and no explanation.
 */

test("an oversized scan tells the user what to do about it", () => {
  const message = ocrUnavailableMessage("too_large");
  assert.match(message, /scanned/i);
  assert.match(message, /8MB/, "the user needs the actual limit to act on it");
  assert.match(message, /split/i);
});

test("an unreadable scan explains why the checklist is empty", () => {
  for (const reason of ["no_api_key", "failed"] as const) {
    const message = ocrUnavailableMessage(reason);
    assert.match(message, /scanned/i);
    assert.match(message, /text-based PDF or DOCX|OCR/i, "must offer a way forward");
  }
});

test("no failure message blames the reader or shouts", () => {
  for (const reason of ["no_api_key", "too_large", "failed"] as const) {
    const message = ocrUnavailableMessage(reason);
    assert.ok(!message.includes("!"), message);
    assert.ok(!/\byou (failed|must not)\b/i.test(message), message);
  }
});
