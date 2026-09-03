import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { canManageMembers, canAssignRole } from "@/server/permissions";
import { updateMembershipSchema } from "@/lib/validations";
import { logAudit, AUDIT_ACTIONS } from "@/server/audit";
import { unauthorized } from "@/server/responses";

async function findMembership(membershipId: string, organizationId: string) {
  return prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { user: { select: { email: true } } },
  });
}

// An organization must always have at least one owner - otherwise nobody
// could manage billing or the org itself. Checked before any role change or
// removal that would drop the last one.
async function isLastOwner(organizationId: string, membership: { role: string }) {
  if (membership.role !== "owner") return false;
  const ownerCount = await prisma.membership.count({ where: { organizationId, role: "owner" } });
  return ownerCount <= 1;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const limit = await rateLimit(`member:role:${user.id}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const { membershipId } = await params;
  const membership = await findMembership(membershipId, user.organizationId);
  if (!membership) return Response.json({ error: "Member not found" }, { status: 404 });

  const body = await request.json();
  const parsed = updateMembershipSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid role", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!canAssignRole(user.organizationRole, membership.role, parsed.data.role)) {
    return Response.json(
      { error: "You don't have permission to assign that role" },
      { status: 403 },
    );
  }

  if (parsed.data.role !== "owner" && (await isLastOwner(user.organizationId, membership))) {
    return Response.json(
      { error: "An organization must have at least one owner" },
      { status: 400 },
    );
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
  });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.memberRoleUpdate,
    entityType: "Membership",
    entityId: membershipId,
    metadata: { email: membership.user.email, role: parsed.data.role },
  });

  return Response.json({ membership: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const limit = await rateLimit(`member:remove:${user.id}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const { membershipId } = await params;
  const membership = await findMembership(membershipId, user.organizationId);
  if (!membership) return Response.json({ error: "Member not found" }, { status: 404 });

  const isSelf = membership.userId === user.id;
  if (!isSelf) {
    if (!canManageMembers(user.organizationRole)) {
      return Response.json(
        { error: "Only owners and admins can remove members" },
        { status: 403 },
      );
    }
    if (membership.role === "owner" && user.organizationRole !== "owner") {
      return Response.json({ error: "Only an owner can remove another owner" }, { status: 403 });
    }
  }

  if (await isLastOwner(user.organizationId, membership)) {
    return Response.json(
      { error: "An organization must have at least one owner - transfer ownership first" },
      { status: 400 },
    );
  }

  await prisma.membership.delete({ where: { id: membershipId } });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.memberRemove,
    entityType: "Membership",
    entityId: membershipId,
    metadata: { email: membership.user.email },
  });

  return Response.json({ ok: true });
}
