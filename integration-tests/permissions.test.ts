// Must load before @/server/db, which reads DATABASE_URL at import time to
// build the Prisma client - ES module bodies evaluate in import order.
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

// Sets up an owner plus a second user who has accepted an invite into the
// owner's organization with the given role. The invitee's newest membership
// is that organization, so it's what requireApiUser resolves as active.
async function orgWithMember(role: "admin" | "member") {
  const owner = await signUpAndSignIn();
  const invitee = await signUpAndSignIn();
  const org = await getOrganizationFor(owner.email);

  const rawToken = await createInviteToken({
    organizationId: org.organizationId,
    email: invitee.email,
    invitedByUserId: org.userId,
    role,
  });

  const accept = await fetch(`${BASE_URL}/api/organization/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ token: rawToken }),
  });
  assert.equal(accept.status, 200, "invite should be accepted");

  const project = await prisma.project.create({
    data: {
      organizationId: org.organizationId,
      title: "Permissions Fixture",
      clientName: "Fixture Client",
    },
  });

  return { owner, invitee, org, project };
}

test("a member cannot delete a project, an owner can", async (t) => {
  const { owner, invitee, project } = await orgWithMember("member");
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const asMember = await fetch(`${BASE_URL}/api/projects/${project.id}`, {
    method: "DELETE",
    headers: { Cookie: invitee.cookie },
  });
  assert.equal(asMember.status, 403);

  const stillThere = await prisma.project.findUnique({ where: { id: project.id } });
  assert.ok(stillThere, "the project must survive a member's delete attempt");

  const asOwner = await fetch(`${BASE_URL}/api/projects/${project.id}`, {
    method: "DELETE",
    headers: { Cookie: owner.cookie },
  });
  assert.equal(asOwner.status, 200);

  const gone = await prisma.project.findUnique({ where: { id: project.id } });
  assert.equal(gone, null);
});

test("an admin can delete a project", async (t) => {
  const { owner, invitee, project } = await orgWithMember("admin");
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const response = await fetch(`${BASE_URL}/api/projects/${project.id}`, {
    method: "DELETE",
    headers: { Cookie: invitee.cookie },
  });
  assert.equal(response.status, 200);
});

test("a member cannot bulk-delete documents", async (t) => {
  const { owner, invitee, project } = await orgWithMember("member");
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const response = await fetch(`${BASE_URL}/api/projects/${project.id}/documents`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ documentIds: ["whatever"] }),
  });

  assert.equal(response.status, 403);
});

test("a member cannot start a checkout that would bill the organization", async (t) => {
  const { owner, invitee } = await orgWithMember("member");
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const response = await fetch(`${BASE_URL}/api/billing/checkout`, {
    method: "POST",
    headers: { Cookie: invitee.cookie },
  });

  assert.equal(response.status, 403);
});

test("an admin cannot start a checkout either - billing is owner-only", async (t) => {
  const { owner, invitee } = await orgWithMember("admin");
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const response = await fetch(`${BASE_URL}/api/billing/checkout`, {
    method: "POST",
    headers: { Cookie: invitee.cookie },
  });

  assert.equal(response.status, 403);
});

test("switching to an organization the user doesn't belong to is rejected", async (t) => {
  const alice = await signUpAndSignIn();
  const bob = await signUpAndSignIn();
  t.after(() => cleanupUser(alice.email));
  t.after(() => cleanupUser(bob.email));

  const bobOrg = await getOrganizationFor(bob.email);

  // The active-org cookie is what later requests trust, so setting it must
  // be gated on real membership - otherwise this is a tenant escape.
  const response = await fetch(`${BASE_URL}/api/organization/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: alice.cookie },
    body: JSON.stringify({ organizationId: bobOrg.organizationId }),
  });

  assert.equal(response.status, 404);
});

test("a user can switch back to their own workspace after joining a team", async (t) => {
  const { owner, invitee } = await orgWithMember("member");
  t.after(() => cleanupUser(owner.email));
  t.after(() => cleanupUser(invitee.email));

  const listResponse = await fetch(`${BASE_URL}/api/organization/list`, {
    headers: { Cookie: invitee.cookie },
  });
  assert.equal(listResponse.status, 200);

  const { organizations, activeOrganizationId } = (await listResponse.json()) as {
    organizations: Array<{ organizationId: string; role: string }>;
    activeOrganizationId: string;
  };

  assert.equal(organizations.length, 2, "invitee belongs to their own org plus the team");

  // Their personal workspace is the one they own; accepting the invite made
  // the team active, which is exactly why a way back is needed.
  const personal = organizations.find((organization) => organization.role === "owner");
  assert.ok(personal);
  assert.notEqual(activeOrganizationId, personal.organizationId);

  const switchResponse = await fetch(`${BASE_URL}/api/organization/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
    body: JSON.stringify({ organizationId: personal.organizationId }),
  });
  assert.equal(switchResponse.status, 200);

  const cookie = `${invitee.cookie}; ${switchResponse.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")}`;

  const afterSwitch = await fetch(`${BASE_URL}/api/organization/list`, {
    headers: { Cookie: cookie },
  });
  const after = (await afterSwitch.json()) as { activeOrganizationId: string };

  assert.equal(after.activeOrganizationId, personal.organizationId);
});
