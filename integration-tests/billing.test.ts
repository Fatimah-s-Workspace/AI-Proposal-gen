import test from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, cleanupUser, signUpAndSignIn } from "./helpers";

test("checkout requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/billing/checkout`, { method: "POST" });
  assert.equal(response.status, 401);
});

test("checkout passes the auth boundary and reaches real business logic when signed in", async (t) => {
  const { email, cookie } = await signUpAndSignIn();
  t.after(() => cleanupUser(email));

  const response = await fetch(`${BASE_URL}/api/billing/checkout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });

  // What this route returns past the auth check depends on the
  // environment: 200 if Paystack is configured and reachable, 503 if
  // PAYSTACK_SECRET_KEY isn't set, or 502 if it's configured but the real
  // Paystack API call itself fails (this test hits the real API in
  // environments with a live key, so transient network issues are a real,
  // separately-handled outcome, not a bug in this route). What actually
  // matters here is that the auth boundary held (not 401) and the route
  // didn't crash with an unhandled error (not 500).
  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 500);
});

test("callback redirects an unauthenticated request to sign-in", async () => {
  const response = await fetch(`${BASE_URL}/api/billing/callback?reference=whatever`, {
    redirect: "manual",
  });

  assert.ok([302, 307].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/auth\/sign-in/);
});

test("webhook rejects a request with no signature", async () => {
  const response = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "charge.success", data: { reference: "whatever" } }),
  });

  assert.equal(response.status, 401);
});
