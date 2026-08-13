import assert from "node:assert/strict";
import test from "node:test";

import { hasBrevoApiKey, sendEmail } from "./index";

// These tests run without BREVO_API_KEY set (node's test runner doesn't load
// .env files), so they exercise the dev-mode fallback path - the same
// dual-mode pattern used for Gemini, Supabase Storage, and Upstash elsewhere
// in this codebase.

test("hasBrevoApiKey returns false when BREVO_API_KEY is not set", () => {
  assert.equal(hasBrevoApiKey(), false);
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

// Brevo's send route is /v3/smtp/email, singular. This app shipped the plural
// for its entire life, and the plural is not a Brevo route at all - the
// gateway answers 404 {"error":"HTTP route not found"}, which reads like a
// network or proxy problem rather than a wrong URL. Every welcome,
// verification, password-reset, invite and reminder email failed on it, and
// the misleading error sent the investigation to the sandbox twice before
// anyone compared the two URLs. Worth pinning.
test("sendEmail posts to Brevo's real send endpoint", async () => {
  const originalKey = process.env.BREVO_API_KEY;
  const originalFetch = globalThis.fetch;
  let calledUrl = "";

  process.env.BREVO_API_KEY = "test-key";
  globalThis.fetch = (async (url: string | URL | Request) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ messageId: "<test>" }), { status: 201 });
  }) as typeof fetch;

  try {
    const result = await sendEmail({
      to: "someone@example.test",
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });

    assert.equal(calledUrl, "https://api.brevo.com/v3/smtp/email");
    assert.ok(
      !calledUrl.endsWith("/emails"),
      "the plural route 404s - see the comment above this test",
    );
    // 201 is Brevo's success status here, not 200, so an ok-check that only
    // accepted 200 would report a delivered mail as failed.
    assert.deepEqual(result, { delivered: true });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = originalKey;
  }
});
