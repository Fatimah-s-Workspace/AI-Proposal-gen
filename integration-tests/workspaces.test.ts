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

function cookiesFrom(base: string, response: Response) {
  const set = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return set ? `${base}; ${set}` : base;
}

test("creating a workspace requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/organization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Nope" }),
  });

  assert.equal(response.status, 401);
});

test("creating a workspace makes it active and fully provisioned", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const response = await fetch(`${BASE_URL}/api/organization`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ name: "Second Workspace" }),
  });

  assert.equal(response.status, 201);
  const { organizationId } = (await response.json()) as { organizationId: string };

  // Must match what signup provisions, or the new workspace would have no
  // plan limits and no usage bucket to count against.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { memberships: true, subscription: true, usageTracking: true },
  });

  assert.ok(organization);
  assert.equal(organization.name, "Second Workspace");
  assert.equal(organization.memberships.length, 1);
  assert.equal(organization.memberships[0].role, "owner");
  assert.ok(organization.subscription, "should provision a subscription");
  assert.equal(organization.subscription.plan, "starter");
  assert.equal(organization.usageTracking.length, 1);

  // The response sets the active-workspace cookie, so the caller lands in
  // the workspace they just made rather than the previous one.
  const cookie = cookiesFrom(user.cookie, response);
  const listResponse = await fetch(`${BASE_URL}/api/organization/list`, {
    headers: { Cookie: cookie },
  });
  const { activeOrganizationId } = (await listResponse.json()) as {
    activeOrganizationId: string;
  };
  assert.equal(activeOrganizationId, organizationId);
});

test("a workspace name is validated", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const response = await fetch(`${BASE_URL}/api/organization`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ name: "x" }),
  });

  assert.equal(response.status, 400);
});

test("an owner can rename their workspace", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const org = await getOrganizationFor(user.email);
  const response = await fetch(`${BASE_URL}/api/organization/${org.organizationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ name: "Renamed Workspace" }),
  });

  assert.equal(response.status, 200);

  const updated = await prisma.organization.findUnique({
    where: { id: org.organizationId },
  });
  assert.equal(updated?.name, "Renamed Workspace");
});

test("a member cannot rename the workspace", async (t) => {
  const owner = await signUpAndSignIn();
  const invitee = await signUpAndSignIn();
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const org = await getOrganizationFor(owner.email);
  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: invitee.email,
    invitedByUserId: org.userId,
    role: "member",
  });
  await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ token: rawToken }),
  });

  const response = await fetch(`${BASE_URL}/api/organization/${org.organizationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ name: "Hijacked" }),
  });

  assert.equal(response.status, 403);
});

test("renaming a workspace you don't belong to reads as not found", async (t) => {
  const alice = await signUpAndSignIn();
  const bob = await signUpAndSignIn();
  t.after(() => cleanupUser(alice.email));
  t.after(() => cleanupUser(bob.email));

  const bobOrg = await getOrganizationFor(bob.email);
  const response = await fetch(`${BASE_URL}/api/organization/${bobOrg.organizationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: alice.cookie },
    body: JSON.stringify({ name: "Not Yours" }),
  });

  assert.equal(response.status, 404);

  const untouched = await prisma.organization.findUnique({
    where: { id: bobOrg.organizationId },
  });
  assert.notEqual(untouched?.name, "Not Yours");
});

test("your only workspace cannot be deleted", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const org = await getOrganizationFor(user.email);
  const response = await fetch(`${BASE_URL}/api/organization/${org.organizationId}`, {
    method: "DELETE",
    headers: { Cookie: user.cookie },
  });

  // Deleting it would leave the account with nowhere to land.
  assert.equal(response.status, 400);

  const stillThere = await prisma.organization.findUnique({
    where: { id: org.organizationId },
  });
  assert.ok(stillThere);
});

test("an owner can delete a second workspace, and its projects go with it", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const created = await fetch(`${BASE_URL}/api/organization`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ name: "Disposable" }),
  });
  const { organizationId } = (await created.json()) as { organizationId: string };

  const project = await prisma.project.create({
    data: { organizationId, title: "Doomed", clientName: "Doomed Client" },
  });

  const response = await fetch(`${BASE_URL}/api/organization/${organizationId}`, {
    method: "DELETE",
    headers: { Cookie: cookiesFrom(user.cookie, created) },
  });

  assert.equal(response.status, 200);
  assert.equal(await prisma.organization.findUnique({ where: { id: organizationId } }), null);
  assert.equal(await prisma.project.findUnique({ where: { id: project.id } }), null);
});

test("an admin cannot delete the workspace - that stays with the owner", async (t) => {
  const owner = await signUpAndSignIn();
  const invitee = await signUpAndSignIn();
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const org = await getOrganizationFor(owner.email);
  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: invitee.email,
    invitedByUserId: org.userId,
    role: "admin",
  });
  await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ token: rawToken }),
  });

  const response = await fetch(`${BASE_URL}/api/organization/${org.organizationId}`, {
    method: "DELETE",
    headers: { Cookie: invitee.cookie },
  });

  assert.equal(response.status, 403);

  const stillThere = await prisma.organization.findUnique({
    where: { id: org.organizationId },
  });
  assert.ok(stillThere, "an admin must not be able to destroy the workspace");
});
