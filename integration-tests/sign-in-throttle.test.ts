// Must load before @/server/db, which reads DATABASE_URL at import time.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, cleanupUser, signUpAndSignIn } from "./helpers";

// Drives the credentials callback directly rather than the signIn helper,
// because the helper returns a cookie header and discards the body - and the
// body is where NextAuth reports why a sign-in failed.
async function attempt(email: string, password: string) {
  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfCookies = csrfResponse.headers.getSetCookie();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies.map((cookie) => cookie.split(";")[0]).join("; "),
    },
    body: new URLSearchParams({ email, password, csrfToken, json: "true" }),
    redirect: "manual",
  });

  return decodeURIComponent(await response.text());
}

function isThrottled(body: string) {
  return body.includes("Too many sign-in attempts");
}

// One account for the whole file. Signing up per test would trip the
// signup limiter (which is IP-keyed, unlike this one) and turn a real
// failure here into a confusing one over there.
let account: Awaited<ReturnType<typeof signUpAndSignIn>>;

test("sign-in throttling", async (t) => {
  account = await signUpAndSignIn();
  t.after(() => cleanupUser(account.email));

  // Without this an attacker gets unlimited guesses at a known address.
  // Signup and password reset were already capped; the password check itself
  // was not.
  await t.test("wrong passwords stop being answered", async () => {
    let throttledAt = 0;

    for (let i = 1; i <= 12 && throttledAt === 0; i += 1) {
      if (isThrottled(await attempt(account.email, "not-the-password"))) {
        throttledAt = i;
      }
    }

    assert.ok(throttledAt > 0, "never throttled across 12 wrong passwords");
    // Failing closed on the first slip would lock out anyone who mistypes.
    assert.ok(
      throttledAt > 3,
      `throttled after only ${throttledAt} attempts - too harsh for a typo`,
    );
  });

  await t.test("the message names the real reason", async () => {
    // "Invalid email or password" would be actively misleading: the password
    // may well be right, and the user would keep retrying and keep extending
    // their own lockout. This runs while the account above is still
    // throttled, which is exactly the state being described.
    assert.ok(
      isThrottled(await attempt(account.email, account.password)),
      "a throttled account should say so rather than blame the password",
    );
  });
});

// The limit is keyed on the account and nothing else. Under carrier-grade
// NAT - normal on the mobile networks these users are on - an IP-keyed limit
// would let one targeted account lock out thousands of strangers.
test("throttling one account leaves others alone", async (t) => {
  const bystander = await signUpAndSignIn();
  t.after(() => cleanupUser(bystander.email));

  assert.ok(
    !isThrottled(await attempt(bystander.email, bystander.password)),
    "a bystander was throttled by another account's failed attempts",
  );
});
