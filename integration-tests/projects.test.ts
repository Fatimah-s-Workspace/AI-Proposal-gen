// Must load before @/server/db, which reads DATABASE_URL at import time.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/server/db";
import { BASE_URL, cleanupUser, signUpAndSignIn } from "./helpers";

// The bid-shaping fields exist to reach the proposal prompt. If the API drops
// one on the way in, the form still looks like it worked and the field is
// silently never used again - so the round trip is what's worth testing.
const bidContext = {
  referenceNumber: "REA/RFP/2026/014",
  evaluationCriteria: "Technical 70%\nPrice 30%",
  winThemes: "Existing depot in the state.",
  contractDuration: "24 months from Q1 2027",
  incumbent: "Held since 2022 by another supplier",
  submissionLanguage: "French",
};

test("creating a project keeps every bid-context field", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const response = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({
      title: "Solar Mini-Grid",
      clientName: "Rural Electrification Agency",
      ...bidContext,
    }),
  });

  assert.equal(response.status, 201);
  const { project } = (await response.json()) as { project: { id: string } };

  const stored = await prisma.project.findUnique({ where: { id: project.id } });
  assert.ok(stored);
  for (const [field, value] of Object.entries(bidContext)) {
    assert.equal(
      stored[field as keyof typeof stored],
      value,
      `${field} did not survive the round trip`,
    );
  }
});

test("a project created without them is still valid, with blanks left null", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const response = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ title: "Bare", clientName: "Someone" }),
  });

  assert.equal(response.status, 201);
  const { project } = (await response.json()) as { project: { id: string } };

  const stored = await prisma.project.findUnique({ where: { id: project.id } });
  assert.equal(stored?.referenceNumber, null);
  assert.equal(stored?.evaluationCriteria, null);
  assert.equal(stored?.winThemes, null);
  // Language has a default rather than a null, since drafts always need one.
  assert.equal(stored?.submissionLanguage, "English");
});

test("editing a project updates the bid context, and clearing a field nulls it", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const created = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({
      title: "Editable",
      clientName: "Client",
      ...bidContext,
    }),
  });
  const { project } = (await created.json()) as { project: { id: string } };

  const updated = await fetch(`${BASE_URL}/api/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({
      title: "Editable",
      clientName: "Client",
      winThemes: "Rewritten after the site visit.",
      // Emptied in the form, which arrives as "" rather than as an omission.
      evaluationCriteria: "",
      submissionLanguage: "English",
    }),
  });

  assert.equal(updated.status, 200);

  const stored = await prisma.project.findUnique({ where: { id: project.id } });
  assert.equal(stored?.winThemes, "Rewritten after the site visit.");
  assert.equal(stored?.evaluationCriteria, null);
  assert.equal(stored?.submissionLanguage, "English");
});
