import assert from "node:assert/strict";
import test from "node:test";

import { rateLimit } from "./rate-limit";

test("rateLimit allows requests under the limit", () => {
  const key = `test-under-${Math.random()}`;
  const first = rateLimit(key, 3, 60_000);
  const second = rateLimit(key, 3, 60_000);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
});

test("rateLimit blocks requests once the limit is exceeded", () => {
  const key = `test-over-${Math.random()}`;
  rateLimit(key, 2, 60_000);
  rateLimit(key, 2, 60_000);
  const third = rateLimit(key, 2, 60_000);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test("rateLimit tracks independent buckets per key", () => {
  const keyA = `test-a-${Math.random()}`;
  const keyB = `test-b-${Math.random()}`;
  rateLimit(keyA, 1, 60_000);
  const blockedA = rateLimit(keyA, 1, 60_000);
  const allowedB = rateLimit(keyB, 1, 60_000);
  assert.equal(blockedA.allowed, false);
  assert.equal(allowedB.allowed, true);
});

test("rateLimit resets the count after the window expires", async () => {
  const key = `test-reset-${Math.random()}`;
  rateLimit(key, 1, 10);
  const blocked = rateLimit(key, 1, 10);
  assert.equal(blocked.allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 20));

  const afterReset = rateLimit(key, 1, 10);
  assert.equal(afterReset.allowed, true);
});

test("rateLimitResponse returns a 429 status", async () => {
  const { rateLimitResponse } = await import("./rate-limit");
  const response = rateLimitResponse();
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.match(body.error, /too many requests/i);
});
