import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { canManageMembers } from "@/server/permissions";
import { logAudit, AUDIT_ACTIONS } from "@/server/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMembers(user.organizationRole)) {
    return Response.json({ error: "Only owners and admins can revoke invites" }, { status: 403 });
  }

  const { inviteId } = await params;
  const invite = await prisma.organizationInvite.findFirst({
    where: { id: inviteId, organizationId: user.organizationId },
  });
  if (!invite) return Response.json({ error: "Invite not found" }, { status: 404 });

  await prisma.organizationInvite.delete({ where: { id: inviteId } });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.memberInviteRevoke,
    entityType: "OrganizationInvite",
    entityId: inviteId,
    metadata: { email: invite.email },
  });

  return Response.json({ ok: true });
}
