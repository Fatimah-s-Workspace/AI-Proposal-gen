import type { Metadata } from "next";
import { AccountSettings } from "@/components/settings/account-settings";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Account settings" };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireUser();

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        select: {
          name: true,
          _count: { select: { memberships: true, projects: true } },
          memberships: { where: { role: "owner" }, select: { id: true } },
        },
      },
    },
  });

  // Mirrors the classification DELETE /api/account enforces, so the page can
  // say up front what deleting would do rather than surfacing it as an error
  // after the user has already committed to it.
  const workspaces = memberships.map((membership) => {
    const memberCount = membership.organization._count.memberships;
    const ownerCount = membership.organization.memberships.length;

    const outcome =
      memberCount === 1
        ? ("deleted" as const)
        : membership.role === "owner" && ownerCount === 1
          ? ("blocked" as const)
          : ("left" as const);

    return {
      name: membership.organization.name,
      outcome,
      projectCount: membership.organization._count.projects,
    };
  });

  return (
    <AccountSettings
      name={user.name}
      email={user.email}
      emailVerified={Boolean(user.emailVerified)}
      workspaces={workspaces}
    />
  );
}
