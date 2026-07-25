import assert from "node:assert/strict";
import test from "node:test";

import { rateLimit } from "./rate-limit";

// These tests run without UPSTASH_REDIS_REST_URL/TOKEN set, so they exercise
// the in-memory fallback path used in local dev and whenever Upstash isn't
// configured. rateLimit() is async regardless of which path is taken, since
// the Upstash-backed path makes a real network call.

test("rateLimit allows requests under the limit", async () => {
  const key = `test-under-${Math.random()}`;
  const first = await rateLimit(key, 3, 60_000);
  const second = await rateLimit(key, 3, 60_000);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
});

test("rateLimit blocks requests once the limit is exceeded", async () => {
  const key = `test-over-${Math.random()}`;
  await rateLimit(key, 2, 60_000);
  await rateLimit(key, 2, 60_000);
  const third = await rateLimit(key, 2, 60_000);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test("rateLimit tracks independent buckets per key", async () => {
  const keyA = `test-a-${Math.random()}`;
  const keyB = `test-b-${Math.random()}`;
  await rateLimit(keyA, 1, 60_000);
  const blockedA = await rateLimit(keyA, 1, 60_000);
  const allowedB = await rateLimit(keyB, 1, 60_000);
  assert.equal(blockedA.allowed, false);
  assert.equal(allowedB.allowed, true);
});

test("rateLimit resets the count after the window expires", async () => {
  const key = `test-reset-${Math.random()}`;
  await rateLimit(key, 1, 10);
  const blocked = await rateLimit(key, 1, 10);
  assert.equal(blocked.allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 20));

  const afterReset = await rateLimit(key, 1, 10);
  assert.equal(afterReset.allowed, true);
});

test("rateLimit defaults to a 30/60s limit when not specified", async () => {
  const key = `test-defaults-${Math.random()}`;
  const result = await rateLimit(key);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 29);
});

test("rateLimitResponse returns a 429 status", async () => {
  const { rateLimitResponse } = await import("./rate-limit");
  const response = rateLimitResponse();
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.match(body.error, /too many requests/i);
});
