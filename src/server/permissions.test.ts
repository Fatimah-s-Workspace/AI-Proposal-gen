import assert from "node:assert/strict";
import test from "node:test";

import { canAssignRole, canManageBilling, canManageMembers } from "./permissions";

test("owners and admins can manage members, plain members cannot", () => {
  assert.equal(canManageMembers("owner"), true);
  assert.equal(canManageMembers("admin"), true);
  assert.equal(canManageMembers("member"), false);
});

test("only owners can manage billing", () => {
  assert.equal(canManageBilling("owner"), true);
  assert.equal(canManageBilling("admin"), false);
  assert.equal(canManageBilling("member"), false);
});

test("an owner can assign any role, including granting ownership", () => {
  assert.equal(canAssignRole("owner", "member", "admin"), true);
  assert.equal(canAssignRole("owner", "admin", "owner"), true);
  assert.equal(canAssignRole("owner", "owner", "member"), true);
});

test("an admin can re-role members but cannot touch an owner or grant ownership", () => {
  assert.equal(canAssignRole("admin", "member", "admin"), true);
  assert.equal(canAssignRole("admin", "admin", "member"), true);

  // Would let an admin demote the person who owns billing.
  assert.equal(canAssignRole("admin", "owner", "member"), false);
  // Would let an admin quietly promote themselves past their own ceiling.
  assert.equal(canAssignRole("admin", "member", "owner"), false);
});

test("a plain member cannot assign roles at all", () => {
  assert.equal(canAssignRole("member", "member", "admin"), false);
  assert.equal(canAssignRole("member", "member", "member"), false);
});

test("an unknown role is treated as unprivileged", () => {
  assert.equal(canManageMembers("viewer"), false);
  assert.equal(canManageBilling("viewer"), false);
  assert.equal(canAssignRole("viewer", "member", "member"), false);
});
