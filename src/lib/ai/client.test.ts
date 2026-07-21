import assert from "node:assert/strict";
import test from "node:test";

import { isGeminiQuotaOrAvailabilityError } from "./client";

test("isGeminiQuotaOrAvailabilityError matches a 429 quota error", () => {
  assert.equal(
    isGeminiQuotaOrAvailabilityError(new Error("429 RESOURCE_EXHAUSTED: quota exceeded")),
    true,
  );
});

test("isGeminiQuotaOrAvailabilityError matches a 503 unavailable error", () => {
  assert.equal(
    isGeminiQuotaOrAvailabilityError(new Error("503 UNAVAILABLE: model overloaded")),
    true,
  );
});

test("isGeminiQuotaOrAvailabilityError matches informal rate-limit wording", () => {
  assert.equal(
    isGeminiQuotaOrAvailabilityError(new Error("You have hit the rate limit, try again later")),
    true,
  );
});

test("isGeminiQuotaOrAvailabilityError does not match an unrelated error", () => {
  assert.equal(
    isGeminiQuotaOrAvailabilityError(new Error("Invalid API key. Please pass a valid API key.")),
    false,
  );
});

test("isGeminiQuotaOrAvailabilityError handles non-Error values", () => {
  assert.equal(isGeminiQuotaOrAvailabilityError("429 quota exceeded"), true);
  assert.equal(isGeminiQuotaOrAvailabilityError({ weird: "object" }), false);
});
