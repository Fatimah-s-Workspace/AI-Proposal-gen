// Must load before @/server/db, which reads DATABASE_URL at import time.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/server/db";
import { BASE_URL, cleanupUser, signUpAndSignIn, unverifyEmail, uniqueEmail } from "./helpers";

function identifierFor(email: string) {
  return `email-verify:${email.toLowerCase()}`;
}

// Mirrors createEmailVerificationToken so a test can hold the raw value -
// only its hash is ever stored, exactly like the password-reset flow.
async function seedVerificationToken(email: string, expiresAt?: Date) {
  const identifier = identifierFor(email);
  const rawToken = randomBytes(32).toString("hex");

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: createHash("sha256").update(rawToken).digest("hex"),
      expires: expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return rawToken;
}

test("signup leaves the account unverified and stores only a hashed token", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  // Signing in requires a confirmed address now, so the state this test is
  // about has to be restored afterwards.
  await unverifyEmail(user.email);

  const record = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
  assert.equal(record?.emailVerified, null, "a fresh signup is not verified");

  const token = await prisma.verificationToken.findFirst({
    where: { identifier: identifierFor(user.email) },
  });
  assert.ok(token, "signup should mint a verification token");
  assert.match(token.token, /^[a-f0-9]{64}$/, "only the SHA-256 hash may be persisted");
});

test("a valid link confirms the address and is single-use", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  // Signing in requires a confirmed address now, so the state this test is
  // about has to be restored afterwards.
  await unverifyEmail(user.email);

  const rawToken = await seedVerificationToken(user.email);

  const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, token: rawToken }),
  });
  assert.equal(response.status, 200);

  const record = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
  assert.ok(record?.emailVerified instanceof Date, "emailVerified should be stamped");

  // Consumed on use, so a leaked link can't be replayed later.
  const leftover = await prisma.verificationToken.findFirst({
    where: { identifier: identifierFor(user.email) },
  });
  assert.equal(leftover, null);

  const replay = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, token: rawToken }),
  });
  assert.equal(replay.status, 400);
});

test("an expired link is rejected and the account stays unverified", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  // Signing in requires a confirmed address now, so the state this test is
  // about has to be restored afterwards.
  await unverifyEmail(user.email);

  const rawToken = await seedVerificationToken(user.email, new Date(Date.now() - 1000));

  const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, token: rawToken }),
  });

  assert.equal(response.status, 400);
  const record = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
  assert.equal(record?.emailVerified, null);
});

test("a token minted for one address cannot confirm another", async (t) => {
  const alice = await signUpAndSignIn();
  const bob = await signUpAndSignIn();
  t.after(() => cleanupUser(alice.email));
  t.after(() => cleanupUser(bob.email));
  await unverifyEmail(alice.email);
  await unverifyEmail(bob.email);

  const aliceToken = await seedVerificationToken(alice.email);

  // The identifier is derived from the submitted email, so Bob's address
  // plus Alice's token must not resolve to a stored row.
  const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: bob.email, token: aliceToken }),
  });

  assert.equal(response.status, 400);
  const record = await prisma.user.findUnique({ where: { email: bob.email.toLowerCase() } });
  assert.equal(record?.emailVerified, null);
});

test("verification status requires authentication and reports the live value", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  // Signing in requires a confirmed address now, so the state this test is
  // about has to be restored afterwards.
  await unverifyEmail(user.email);

  const anonymous = await fetch(`${BASE_URL}/api/auth/verify-email`);
  assert.equal(anonymous.status, 401);

  const before = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    headers: { Cookie: user.cookie },
  });
  assert.equal(before.status, 200);
  assert.equal(((await before.json()) as { emailVerified: boolean }).emailVerified, false);

  const rawToken = await seedVerificationToken(user.email);
  await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, token: rawToken }),
  });

  // Read from the database rather than the JWT, so it flips without
  // requiring the user to sign out and back in.
  const after = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    headers: { Cookie: user.cookie },
  });
  assert.equal(((await after.json()) as { emailVerified: boolean }).emailVerified, true);
});

test("resending requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/auth/verify-email/resend`, { method: "POST" });
  assert.equal(response.status, 401);
});

test("an unverified account cannot invite teammates, a verified one can", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  // Signing in requires a confirmed address now, so the state this test is
  // about has to be restored afterwards.
  await unverifyEmail(user.email);

  // Inviting sends mail to a third party in this account's name, so it's
  // gated until the address is confirmed.
  const blocked = await fetch(`${BASE_URL}/api/organization/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ email: uniqueEmail("target"), role: "member" }),
  });
  assert.equal(blocked.status, 403);

  const rawToken = await seedVerificationToken(user.email);
  await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, token: rawToken }),
  });

  const allowed = await fetch(`${BASE_URL}/api/organization/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ email: uniqueEmail("target"), role: "member" }),
  });
  assert.equal(allowed.status, 201);
});
