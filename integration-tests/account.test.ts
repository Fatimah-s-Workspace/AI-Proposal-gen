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

async function joinOrg(
  ownerEmail: string,
  invitee: { email: string; cookie: string },
  role: "admin" | "member" | "owner",
) {
  const org = await getOrganizationFor(ownerEmail);
  // "owner" can't be issued through the invite schema, so accept as a member
  // and promote directly - the point here is the resulting membership, not
  // the invite path (covered in invites.test.ts).
  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: invitee.email,
    invitedByUserId: org.userId,
    role: role === "owner" ? "admin" : role,
  });
  const accept = await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ token: rawToken }),
  });
  assert.equal(accept.status, 200);

  if (role === "owner") {
    const inviteeUser = await prisma.user.findUnique({
      where: { email: invitee.email.toLowerCase() },
    });
    await prisma.membership.update({
      where: {
        userId_organizationId: {
          userId: inviteeUser!.id,
          organizationId: org.organizationId,
        },
      },
      data: { role: "owner" },
    });
  }

  return org;
}

test("deleting an account requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "whoever@example.test" }),
  });

  assert.equal(response.status, 401);
});

test("the confirmation email must match the account", async (t) => {
  const user = await signUpAndSignIn();
  t.after(() => cleanupUser(user.email));

  const response = await fetch(`${BASE_URL}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ email: "not-my-address@example.test" }),
  });

  assert.equal(response.status, 400);

  const stillThere = await prisma.user.findUnique({
    where: { email: user.email.toLowerCase() },
  });
  assert.ok(stillThere, "a mismatched confirmation must not delete anything");
});

test("a solo user's account and their workspace both go", async (t) => {
  const user = await signUpAndSignIn();
  const org = await getOrganizationFor(user.email);
  t.after(() => cleanupUser(user.email));

  const project = await prisma.project.create({
    data: { organizationId: org.organizationId, title: "Solo", clientName: "Solo Client" },
  });

  const response = await fetch(`${BASE_URL}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ email: user.email }),
  });

  assert.equal(response.status, 200);
  assert.equal(await prisma.user.findUnique({ where: { id: org.userId } }), null);
  // Nobody else could reach this workspace, so leaving it behind would be an
  // unreachable row plus orphaned files.
  assert.equal(
    await prisma.organization.findUnique({ where: { id: org.organizationId } }),
    null,
  );
  assert.equal(await prisma.project.findUnique({ where: { id: project.id } }), null);
});

test("the sole owner of a shared workspace is blocked until ownership moves", async (t) => {
  const owner = await signUpAndSignIn();
  const member = await signUpAndSignIn();
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(member.email));

  const org = await joinOrg(owner.email, member, "member");

  const blocked = await fetch(`${BASE_URL}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: owner.cookie },
    body: JSON.stringify({ email: owner.email }),
  });

  assert.equal(blocked.status, 409);
  const payload = (await blocked.json()) as { workspaces: string[] };
  assert.ok(payload.workspaces.length > 0, "should name the blocking workspace");

  // Deleting would have stranded the remaining member in a workspace with
  // nobody able to manage billing or the team.
  assert.ok(await prisma.user.findUnique({ where: { id: org.userId } }));
  assert.ok(await prisma.organization.findUnique({ where: { id: org.organizationId } }));

  // Promote the other member, and the block lifts.
  const memberUser = await prisma.user.findUnique({
    where: { email: member.email.toLowerCase() },
  });
  await prisma.membership.update({
    where: {
      userId_organizationId: { userId: memberUser!.id, organizationId: org.organizationId },
    },
    data: { role: "owner" },
  });

  const allowed = await fetch(`${BASE_URL}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: owner.cookie },
    body: JSON.stringify({ email: owner.email }),
  });

  assert.equal(allowed.status, 200);
  assert.equal(await prisma.user.findUnique({ where: { id: org.userId } }), null);
  // The workspace has another owner, so it and its work survive.
  assert.ok(await prisma.organization.findUnique({ where: { id: org.organizationId } }));
});

test("leaving a co-owned workspace doesn't take the workspace with you", async (t) => {
  const owner = await signUpAndSignIn();
  const second = await signUpAndSignIn();
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(second.email));

  const org = await joinOrg(owner.email, second, "owner");
  const project = await prisma.project.create({
    data: { organizationId: org.organizationId, title: "Shared", clientName: "Shared Client" },
  });

  const response = await fetch(`${BASE_URL}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: second.cookie },
    body: JSON.stringify({ email: second.email }),
  });

  assert.equal(response.status, 200);

  const survivingOrg = await prisma.organization.findUnique({
    where: { id: org.organizationId },
    include: { memberships: true },
  });
  assert.ok(survivingOrg);
  assert.equal(survivingOrg.memberships.length, 1, "only the remaining owner is left");
  assert.ok(await prisma.project.findUnique({ where: { id: project.id } }));
});
