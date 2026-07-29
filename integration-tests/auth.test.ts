import test from "node:test";
import assert from "node:assert/strict";
import {
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
    password: "password123",
  });

  assert.equal(response.status, 201);

  const cookie = await signIn(email, "password123");
  const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: cookie },
  });
  const session = await sessionResponse.json();
  assert.equal(session.user.email, email);
});

test("signup rejects a duplicate email", async (t) => {
  const email = uniqueEmail("dup");
  t.after(() => cleanupUser(email));

  const first = await signUp({ name: "First", companyName: "Co", email, password: "password123" });
  assert.equal(first.status, 201);

  const second = await signUp({ name: "Second", companyName: "Co", email, password: "password123" });
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
  await signUp({ name: "Forgot Test", companyName: "Co", email, password: "password123" });

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
  await signUp({ name: "Reset Test", companyName: "Co", email, password: "password123" });

  const token = await createPasswordResetToken(email);

  const resetResponse = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token, password: "newpassword456" }),
  });
  assert.equal(resetResponse.status, 200);

  // Old password no longer works.
  const oldPasswordCookie = await signIn(email, "password123");
  const oldSession = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: oldPasswordCookie },
  }).then((res) => res.json());
  assert.equal(oldSession.user, undefined);

  // New password works.
  const newPasswordCookie = await signIn(email, "newpassword456");
  const newSession = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: newPasswordCookie },
  }).then((res) => res.json());
  assert.equal(newSession.user.email, email);

  // The same token can't be reused for a second reset.
  const reuseResponse = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token, password: "yetanotherpassword789" }),
  });
  assert.equal(reuseResponse.status, 400);
});

test("reset-password rejects an invalid token", async (t) => {
  const email = uniqueEmail("badtoken");
  t.after(() => cleanupUser(email));
  await signUp({ name: "Bad Token Test", companyName: "Co", email, password: "password123" });

  const response = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: "not-a-real-token", password: "newpassword456" }),
  });

  assert.equal(response.status, 400);
});
