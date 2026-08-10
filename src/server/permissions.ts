// Role checks for the owner/admin/member set (see prisma/schema.prisma
// Membership.role). Kept as plain string comparisons rather than an enum
// since Prisma stores role as a bare String column - matches the existing
// convention for status/stage/priority fields throughout this schema.

export type OrgRole = "owner" | "admin" | "member";

// Owners and admins can invite, remove, and re-role members. A member can
// only ever manage themselves (e.g. leave), never another membership.
export function canManageMembers(role: string) {
  return role === "owner" || role === "admin";
}

// Only the owner can see/change billing or delete the organization -
// deliberately narrower than canManageMembers so an admin can grow the
// team without also being able to touch the org's payment method.
export function canManageBilling(role: string) {
  return role === "owner";
}

// Deleting a project takes its documents, requirements, clauses, drafts,
// and export history with it (all cascade), so it's restricted to owners
// and admins. Members can still create and edit projects - which is what
// the invite dialog promises them.
export function canDeleteProjects(role: string) {
  return role === "owner" || role === "admin";
}

// Same reasoning for documents: deleting one cascades to everything parsed
// out of it, and re-uploading doesn't restore the reviewed checklist state
// built on top.
export function canDeleteDocuments(role: string) {
  return role === "owner" || role === "admin";
}

// An admin can promote/demote members but not touch another owner or grant
// ownership - that's reserved for an explicit ownership-transfer flow,
// which doesn't exist yet, so it's blocked rather than half-supported.
export function canAssignRole(actingRole: string, targetRole: string, nextRole: string) {
  if (actingRole === "owner") return true;
  if (actingRole !== "admin") return false;
  return targetRole !== "owner" && nextRole !== "owner";
}
