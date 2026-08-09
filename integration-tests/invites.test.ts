// Must load before @/server/db, which reads DATABASE_URL at import time to
// build the Prisma client - ES module bodies evaluate in import order, so
// without this the client is constructed against an undefined URL.
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { prisma } from "@/server/db";
import {
  BASE_URL,
  cleanupUser,
  createInviteToken,
  getOrganizationFor,
  signUpAndSignIn,
  uniqueEmail,
} from "./helpers";

test("creating an invite requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/organization/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "someone@example.test", role: "member" }),
  });

  assert.equal(response.status, 401);
});

test("accepting an invite requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "whatever" }),
  });

  assert.equal(response.status, 401);
});

test("an owner can invite, and the raw token is never persisted", async (t) => {
  const { email, cookie } = await signUpAndSignIn();
  const inviteeEmail = uniqueEmail("invitee");
  t.after(() => cleanupUser(email));

  const response = await fetch(`${BASE_URL}/api/organization/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ email: inviteeEmail, role: "member" }),
  });

  assert.equal(response.status, 201);

  const invite = await prisma.organizationInvite.findFirst({
    where: { email: inviteeEmail.toLowerCase() },
  });
  assert.ok(invite, "invite row should exist");

  // A DB leak must not hand out usable invite links, so what's stored has
  // to be a SHA-256 hash - 64 hex chars, and never the raw emailed value.
  assert.match(invite.token, /^[a-f0-9]{64}$/);
  assert.ok(invite.expires > new Date());
});

test("inviting someone who is already a member is rejected", async (t) => {
  const { email, cookie } = await signUpAndSignIn();
  t.after(() => cleanupUser(email));

  const response = await fetch(`${BASE_URL}/api/organization/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ email, role: "member" }),
  });

  assert.equal(response.status, 409);
});

test("an invite cannot be redeemed by a different email than it was sent to", async (t) => {
  const inviter = await signUpAndSignIn();
  const outsider = await signUpAndSignIn();
  t.after(() => cleanupUser(inviter.email));
  t.after(() => cleanupUser(outsider.email));

  const org = await getOrganizationFor(inviter.email);
  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: uniqueEmail("intended"),
    invitedByUserId: org.userId,
  });

  // The outsider holds a perfectly valid, unexpired token - the only thing
  // stopping them is the email check. This is the whole security boundary
  // for a link that gets emailed around and can be forwarded.
  const response = await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: outsider.cookie },
    body: JSON.stringify({ token: rawToken }),
  });

  assert.equal(response.status, 403);

  const membership = await prisma.membership.findFirst({
    where: { organizationId: org.organizationId, user: { email: outsider.email.toLowerCase() } },
  });
  assert.equal(membership, null, "outsider must not have gained membership");
});

test("the invited user can accept, and the token is single-use", async (t) => {
  const inviter = await signUpAndSignIn();
  const invitee = await signUpAndSignIn();
  t.after(() => cleanupUser(inviter.email));
  t.after(() => cleanupUser(invitee.email));

  const org = await getOrganizationFor(inviter.email);
  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: invitee.email,
    invitedByUserId: org.userId,
    role: "admin",
  });

  const accept = await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ token: rawToken }),
  });

  assert.equal(accept.status, 200);

  const membership = await prisma.membership.findFirst({
    where: { organizationId: org.organizationId, user: { email: invitee.email.toLowerCase() } },
  });
  assert.ok(membership, "invitee should now be a member");
  assert.equal(membership.role, "admin", "the invited role should be honoured");

  // Consumed in the same transaction that granted access, so replaying the
  // link can't re-add someone who was later removed.
  const hashed = createHash("sha256").update(rawToken).digest("hex");
  const leftover = await prisma.organizationInvite.findUnique({ where: { token: hashed } });
  assert.equal(leftover, null, "invite should be deleted after use");

  const replay = await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ token: rawToken }),
  });
  assert.equal(replay.status, 404);
});

test("an expired invite is rejected", async (t) => {
  const inviter = await signUpAndSignIn();
  const invitee = await signUpAndSignIn();
  t.after(() => cleanupUser(inviter.email));
  t.after(() => cleanupUser(invitee.email));

  const org = await getOrganizationFor(inviter.email);
  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: invitee.email,
    invitedByUserId: org.userId,
    expiresAt: new Date(Date.now() - 1000),
  });

  const response = await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ token: rawToken }),
  });

  assert.equal(response.status, 410);
});

test("a plain member cannot invite or view invites", async (t) => {
  const inviter = await signUpAndSignIn();
  const invitee = await signUpAndSignIn();
  t.after(() => cleanupUser(inviter.email));
  t.after(() => cleanupUser(invitee.email));

  const org = await getOrganizationFor(inviter.email);
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

  // The invitee's newest membership is now the inviter's org as a plain
  // member, which is what requireApiUser resolves as their active org.
  const create = await fetch(`${BASE_URL}/api/organization/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ email: uniqueEmail("nope"), role: "member" }),
  });
  assert.equal(create.status, 403);

  const list = await fetch(`${BASE_URL}/api/organization/invites`, {
    headers: { Cookie: invitee.cookie },
  });
  assert.equal(list.status, 403);
});

test("the last owner cannot be removed or demoted", async (t) => {
  const { email, cookie } = await signUpAndSignIn();
  t.after(() => cleanupUser(email));

  const org = await getOrganizationFor(email);
  const membership = await prisma.membership.findFirst({
    where: { organizationId: org.organizationId, userId: org.userId },
  });
  assert.ok(membership);

  const demote = await fetch(`${BASE_URL}/api/organization/members/${membership.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ role: "member" }),
  });
  assert.equal(demote.status, 400);

  const remove = await fetch(`${BASE_URL}/api/organization/members/${membership.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  assert.equal(remove.status, 400);

  const stillOwner = await prisma.membership.findUnique({ where: { id: membership.id } });
  assert.equal(stillOwner?.role, "owner");
});

test("a member of another organization cannot be managed across the tenant boundary", async (t) => {
  const alice = await signUpAndSignIn();
  const bob = await signUpAndSignIn();
  t.after(() => cleanupUser(alice.email));
  t.after(() => cleanupUser(bob.email));

  const bobOrg = await getOrganizationFor(bob.email);
  const bobMembership = await prisma.membership.findFirst({
    where: { organizationId: bobOrg.organizationId, userId: bobOrg.userId },
  });
  assert.ok(bobMembership);

  // Alice is an owner - but of her own org, not Bob's. Scoping is by
  // organizationId, so this must read as "not found", never as authorized.
  const response = await fetch(`${BASE_URL}/api/organization/members/${bobMembership.id}`, {
    method: "DELETE",
    headers: { Cookie: alice.cookie },
  });

  assert.equal(response.status, 404);

  const untouched = await prisma.membership.findUnique({ where: { id: bobMembership.id } });
  assert.ok(untouched, "Bob's membership must be untouched");
});
