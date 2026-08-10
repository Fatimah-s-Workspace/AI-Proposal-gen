import type { Metadata } from "next";
import { WorkspaceSettings } from "@/components/organization/workspace-settings";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { canManageBilling, canManageMembers } from "@/server/permissions";

export const metadata: Metadata = { title: "Workspace settings" };
export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  const user = await requireUser();

  const [memberCount, projectCount, membershipCount] = await Promise.all([
    prisma.membership.count({ where: { organizationId: user.organizationId } }),
    prisma.project.count({ where: { organizationId: user.organizationId } }),
    prisma.membership.count({ where: { userId: user.id } }),
  ]);

  return (
    <WorkspaceSettings
      organizationId={user.organizationId}
      name={user.organization.name}
      canRename={canManageMembers(user.organizationRole)}
      canDelete={canManageBilling(user.organizationRole)}
      isOnlyWorkspace={membershipCount <= 1}
      memberCount={memberCount}
      projectCount={projectCount}
    />
  );
}
