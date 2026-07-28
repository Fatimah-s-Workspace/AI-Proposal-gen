import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

import { hasPaystackKey, verifyWebhookSignature } from "./paystack";

// These tests run without PAYSTACK_SECRET_KEY set (node's test runner
// doesn't load .env files), matching the same dual-mode pattern used for
// every other external service in this codebase.

test("hasPaystackKey returns false when PAYSTACK_SECRET_KEY is not set", () => {
  assert.equal(hasPaystackKey(), false);
});

test("verifyWebhookSignature returns false when no key is configured", () => {
  assert.equal(verifyWebhookSignature("{}", "any-signature"), false);
});

test("verifyWebhookSignature returns false when no signature header is present", () => {
  assert.equal(verifyWebhookSignature("{}", null), false);
});

test("verifyWebhookSignature accepts a correctly signed body", async (t) => {
  process.env.PAYSTACK_SECRET_KEY = "test-secret-key";
  t.after(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "tf_123" } });
  const signature = createHmac("sha512", "test-secret-key").update(rawBody).digest("hex");

  assert.equal(verifyWebhookSignature(rawBody, signature), true);
});

test("verifyWebhookSignature rejects a tampered body", async (t) => {
  process.env.PAYSTACK_SECRET_KEY = "test-secret-key";
  t.after(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  const signature = createHmac("sha512", "test-secret-key")
    .update(JSON.stringify({ event: "charge.success", data: { reference: "tf_123" } }))
    .digest("hex");

  const tamperedBody = JSON.stringify({ event: "charge.success", data: { reference: "tf_999" } });

  assert.equal(verifyWebhookSignature(tamperedBody, signature), false);
});

test("verifyWebhookSignature rejects a signature from the wrong key", async (t) => {
  process.env.PAYSTACK_SECRET_KEY = "test-secret-key";
  t.after(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "tf_123" } });
  const wrongSignature = createHmac("sha512", "a-different-key").update(rawBody).digest("hex");

  assert.equal(verifyWebhookSignature(rawBody, wrongSignature), false);
});
