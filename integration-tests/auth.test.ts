// Must load before @/server/db, which reads DATABASE_URL at import time.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/server/db";
import {
  attemptSignIn,
  markEmailVerified,
  BASE_URL,
  cleanupUser,
  createPasswordResetToken,
  signIn,
  signUp,
  uniqueEmail,
} from "./helpers";

test("signup creates an account and signs in with the same credentials", async (t) => {
  const email = uniqueEmail("signup");
  t.after(() => cleanupUser(email));

  const response = await signUp({
    name: "New User",
    companyName: "New Co",
    email,
    password: "Integration!Pass1",
  });

  assert.equal(response.status, 201);

  // Signup no longer grants a session. New accounts have to confirm their
  // address first, so the refusal here is the feature, not a failure.
  const beforeConfirming = await attemptSignIn(email, "Integration!Pass1");
  assert.equal(
    beforeConfirming.signedIn,
    false,
    "an unconfirmed account should not be able to sign in",
  );

  await markEmailVerified(email);

  const cookie = await signIn(email, "Integration!Pass1");
  const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: cookie },
  });
  const session = await sessionResponse.json();
  assert.equal(session.user.email, email);
});

test("signup rejects a duplicate email", async (t) => {
  const email = uniqueEmail("dup");
  t.after(() => cleanupUser(email));

  const first = await signUp({ name: "First", companyName: "Co", email, password: "Integration!Pass1" });
  assert.equal(first.status, 201);

  const second = await signUp({ name: "Second", companyName: "Co", email, password: "Integration!Pass1" });
  assert.equal(second.status, 409);
});

test("signup rejects invalid input", async () => {
  const response = await signUp({
    name: "A",
    companyName: "",
    email: "not-an-email",
    password: "short",
  });

  assert.equal(response.status, 400);
});

test("forgot-password returns the same generic response for an existing and a non-existent email", async (t) => {
  const email = uniqueEmail("forgot");
  t.after(() => cleanupUser(email));
  await signUp({ name: "Forgot Test", companyName: "Co", email, password: "Integration!Pass1" });

  const existing = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const nonExistent = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: uniqueEmail("never-signed-up") }),
  });

  assert.equal(existing.status, 200);
  assert.equal(nonExistent.status, 200);
  assert.deepEqual(await existing.json(), await nonExistent.json());
});

test("reset-password updates the password with a valid token, and the token is single-use", async (t) => {
  const email = uniqueEmail("reset");
  t.after(() => cleanupUser(email));
  await signUp({ name: "Reset Test", companyName: "Co", email, password: "Integration!Pass1" });
  await markEmailVerified(email);

  const token = await createPasswordResetToken(email);

  const resetResponse = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token, password: "Rotated!Pass2" }),
  });
  assert.equal(resetResponse.status, 200);

  // Old password no longer works. attemptSignIn rather than signIn: a refusal
  // is the expected result here, not an error.
  const oldPassword = await attemptSignIn(email, "Integration!Pass1");
  assert.equal(oldPassword.signedIn, false);

  // New password works.
  const newPasswordCookie = await signIn(email, "Rotated!Pass2");
  const newSession = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: newPasswordCookie },
  }).then((res) => res.json());
  assert.equal(newSession.user.email, email);

  // The same token can't be reused for a second reset.
  const reuseResponse = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token, password: "Another!Pass3" }),
  });
  assert.equal(reuseResponse.status, 400);
});

test("reset-password rejects an invalid token", async (t) => {
  const email = uniqueEmail("badtoken");
  t.after(() => cleanupUser(email));
  await signUp({ name: "Bad Token Test", companyName: "Co", email, password: "Integration!Pass1" });

  const response = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: "not-a-real-token", password: "Rotated!Pass2" }),
  });

  assert.equal(response.status, 400);
});

// Clearing hashedPassword is how an account gets locked without deleting it
// or disturbing the rows it owns - it is what the seeded demo account in
// production now relies on, after its credentials were published on the
// public sign-in page. Nothing else guards that mechanism.
test("an account with no password hash cannot sign in at all", async (t) => {
  const email = uniqueEmail("locked");
  const password = "Integration!Pass1";

  const signUpResponse = await signUp({
    name: "Locked Account",
    companyName: "Locked Co",
    email,
    password,
  });
  assert.equal(signUpResponse.ok, true);
  t.after(() => cleanupUser(email));
  await markEmailVerified(email);

  // The password works before the lock, so a pass afterwards can't be a
  // false negative from some unrelated signup failure.
  const before = await signIn(email, password);
  assert.match(before, /next-auth\.session-token|__Secure-next-auth/);

  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { hashedPassword: null },
  });

  const after = await attemptSignIn(email, password);
  assert.equal(after.signedIn, false, "a locked account must not receive a session cookie");
});
