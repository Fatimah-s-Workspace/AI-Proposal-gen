import type { Metadata } from "next";
import { TeamManager } from "@/components/organization/team-manager";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { canManageMembers } from "@/server/permissions";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const user = await requireUser();
  const canManage = canManageMembers(user.organizationRole);

  const [memberships, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    // Members can't see (or act on) pending invites, so don't fetch them.
    canManage
      ? prisma.organizationInvite.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, expires: true },
        })
      : Promise.resolve([]),
  ]);

  const members = memberships.map((membership) => ({
    id: membership.id,
    role: membership.role,
    userId: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
  }));

  return (
    <div className="pb-8">
      <TeamManager
        organizationName={user.organization.name}
        members={members}
        invites={invites.map((invite) => ({
          ...invite,
          expires: invite.expires.toISOString(),
        }))}
        currentUserId={user.id}
        currentRole={user.organizationRole}
        canManage={canManage}
      />
    </div>
  );
}
