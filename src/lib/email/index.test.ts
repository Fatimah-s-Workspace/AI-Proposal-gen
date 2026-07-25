import assert from "node:assert/strict";
import test from "node:test";

import { hasResendApiKey, sendEmail } from "./index";

// These tests run without RESEND_API_KEY set (node's test runner doesn't load
// .env files), so they exercise the dev-mode fallback path - the same
// dual-mode pattern used for Gemini, Supabase Storage, and Upstash elsewhere
// in this codebase.

test("hasResendApiKey returns false when RESEND_API_KEY is not set", () => {
  assert.equal(hasResendApiKey(), false);
});

test("sendEmail falls back to a console log and reports no_api_key when unconfigured", async () => {
  const result = await sendEmail({
    to: "someone@example.com",
    subject: "Test subject",
    text: "Test body",
    html: "<p>Test body</p>",
  });

  assert.deepEqual(result, { delivered: false, reason: "no_api_key" });
});
