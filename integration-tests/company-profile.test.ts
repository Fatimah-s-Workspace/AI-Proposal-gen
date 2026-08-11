// Must load before @/server/db, which reads DATABASE_URL at import time.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/server/db";
import {
  BASE_URL,
  cleanupUser,
  createInviteToken,
  getOrganizationFor,
  signUpAndSignIn,
} from "./helpers";

const profile = {
  legalName: "Acme Engineering Services Limited",
  registrationNumber: "RC 1234567",
  foundedYear: 2014,
  teamSize: "45 permanent staff",
  profileSummary: "A Kano-based renewable energy contractor.",
  capabilities: "Solar mini-grid design and installation.",
  certifications: "ISO 9001:2015",
  pastPerformance: "2024 - Kano State Ministry of Health, NGN 180m",
};

function patch(organizationId: string, cookie: string, body: unknown) {
  return fetch(`${BASE_URL}/api/organization/${organizationId}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

test("editing the company profile requires authentication", async () => {
  const response = await fetch(
    `${BASE_URL}/api/organization/whatever/profile`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    },
  );

  assert.equal(response.status, 401);
});

test("an owner can save the profile, and every field survives", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  const org = await getOrganizationFor(user.email);

  const response = await patch(org.organizationId, user.cookie, profile);
  assert.equal(response.status, 200);

  const stored = await prisma.organization.findUnique({
    where: { id: org.organizationId },
  });
  assert.ok(stored);
  for (const [field, value] of Object.entries(profile)) {
    assert.equal(
      stored[field as keyof typeof stored],
      value,
      `${field} did not survive the round trip`,
    );
  }
});

test("clearing a field nulls it rather than storing an empty string", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  const org = await getOrganizationFor(user.email);

  await patch(org.organizationId, user.cookie, profile);
  // What the form sends when the boxes are emptied: "" for text, null for
  // the year. Storing "" would make the prompt emit a labelled blank line.
  await patch(org.organizationId, user.cookie, {
    ...profile,
    certifications: "",
    pastPerformance: "",
    foundedYear: null,
  });

  const stored = await prisma.organization.findUnique({
    where: { id: org.organizationId },
  });
  assert.equal(stored?.certifications, null);
  assert.equal(stored?.pastPerformance, null);
  assert.equal(stored?.foundedYear, null);
  assert.equal(stored?.legalName, profile.legalName, "untouched fields stay");
});

test("a future founding year is rejected", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));
  const org = await getOrganizationFor(user.email);

  const response = await patch(org.organizationId, user.cookie, {
    ...profile,
    foundedYear: new Date().getFullYear() + 5,
  });

  assert.equal(response.status, 400);
});

test("a plain member cannot edit the profile, an admin can", async (t) => {
  const owner = await signUpAndSignIn();
  const member = await signUpAndSignIn();
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(member.email));

  const org = await getOrganizationFor(owner.email);
  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: member.email,
    invitedByUserId: org.userId,
    role: "member",
  });
  await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: member.cookie },
    body: JSON.stringify({ token: rawToken }),
  });

  // The profile shapes every proposal the team generates, so it sits behind
  // the same bar as renaming the workspace rather than being open to all.
  const asMember = await patch(org.organizationId, member.cookie, profile);
  assert.equal(asMember.status, 403);

  const memberUser = await prisma.user.findUnique({
    where: { email: member.email.toLowerCase() },
  });
  await prisma.membership.update({
    where: {
      userId_organizationId: {
        userId: memberUser!.id,
        organizationId: org.organizationId,
      },
    },
    data: { role: "admin" },
  });

  const asAdmin = await patch(org.organizationId, member.cookie, profile);
  assert.equal(asAdmin.status, 200);
});

test("a workspace you don't belong to reads as not found", async (t) => {
  const outsider = await signUpAndSignIn();
  const other = await signUpAndSignIn();
  t.after(() => cleanupUser(outsider.email));
  t.after(() => cleanupUser(other.email));

  const org = await getOrganizationFor(other.email);
  const response = await patch(org.organizationId, outsider.cookie, profile);

  // Not 403: whether that workspace exists isn't an outsider's to learn.
  assert.equal(response.status, 404);
});
