import test from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, cleanupUser, signUpAndSignIn } from "./helpers";

const FAKE_PROJECT_ID = "cnonexistentprojectid00000000";

test("document upload requires authentication", async () => {
  const form = new FormData();
  form.append("files", new Blob(["hello"], { type: "text/plain" }), "test.txt");

  const response = await fetch(`${BASE_URL}/api/projects/${FAKE_PROJECT_ID}/documents`, {
    method: "POST",
    body: form,
  });

  assert.equal(response.status, 401);
});

test("document upload returns 404 for a project the user doesn't own", async (t) => {
  const { email, cookie } = await signUpAndSignIn();
  t.after(() => cleanupUser(email));

  const form = new FormData();
  form.append("files", new Blob(["hello"], { type: "text/plain" }), "test.txt");

  const response = await fetch(`${BASE_URL}/api/projects/${FAKE_PROJECT_ID}/documents`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });

  assert.equal(response.status, 404);
});

test("document status polling requires authentication", async () => {
  const response = await fetch(
    `${BASE_URL}/api/projects/${FAKE_PROJECT_ID}/documents?ids=some-id`,
  );
  assert.equal(response.status, 401);
});

test("document bulk delete requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/projects/${FAKE_PROJECT_ID}/documents`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds: ["some-id"] }),
  });
  assert.equal(response.status, 401);
});
