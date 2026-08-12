import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { requireApiUser, ACTIVE_ORG_COOKIE } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { canManageBilling, canManageMembers } from "@/server/permissions";
import { updateOrganizationSchema } from "@/lib/validations";
import { deleteStoredFile } from "@/lib/storage";
import { logAudit, AUDIT_ACTIONS } from "@/server/audit";
import { captureError } from "@/lib/monitoring";

// Scoped through Membership rather than looked up by id alone, so another
// organization's id reads as "not found" instead of being actionable.
async function findMembership(userId: string, organizationId: string) {
  return prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: true },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await rateLimit(`org:rename:${user.id}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const { organizationId } = await params;
  const membership = await findMembership(user.id, organizationId);
  if (!membership) return Response.json({ error: "Workspace not found" }, { status: 404 });

  if (!canManageMembers(membership.role)) {
    return Response.json(
      { error: "Only owners and admins can rename a workspace" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a workspace name", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // The slug isn't user-facing or routable, so renaming deliberately leaves
  // it alone - changing it would churn a unique value for no visible gain.
  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: { name: parsed.data.name },
  });

  await logAudit({
    userId: user.id,
    organizationId,
    action: AUDIT_ACTIONS.organizationRename,
    entityType: "Organization",
    entityId: organizationId,
    metadata: { name: parsed.data.name },
  });

  return Response.json({ organization: { id: organization.id, name: organization.name } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Destroys every project, document and export in the workspace, so this is an
    // hourly cap rather than a per-minute one - matching account deletion.
    const limit = await rateLimit(`org:delete:${user.id}`, 5, 60 * 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const { organizationId } = await params;
    const membership = await findMembership(user.id, organizationId);
    if (!membership) return Response.json({ error: "Workspace not found" }, { status: 404 });

    // Deleting destroys every project, document, and export in the
    // workspace for everyone in it - narrower than renaming on purpose.
    if (!canManageBilling(membership.role)) {
      return Response.json(
        { error: "Only the workspace owner can delete it" },
        { status: 403 },
      );
    }

    const membershipCount = await prisma.membership.count({ where: { userId: user.id } });
    if (membershipCount <= 1) {
      return Response.json(
        { error: "You can't delete your only workspace - create another one first." },
        { status: 400 },
      );
    }

    // Rows cascade, but the uploaded and exported files live in object
    // storage and would be orphaned there, so clear them first.
    const projects = await prisma.project.findMany({
      where: { organizationId },
      include: { documents: true, exports: true },
    });

    await Promise.all(
      projects.flatMap((project) => [
        ...project.documents.map((document) =>
          deleteStoredFile("uploads", document.storagePath),
        ),
        ...project.exports.map((record) => deleteStoredFile("exports", record.filePath)),
      ]),
    );

    await prisma.organization.delete({ where: { id: organizationId } });

    // The cookie still points at a workspace that no longer exists.
    // fetchMembership tolerates that, but clearing it avoids a pointless
    // lookup on the next request.
    const jar = await cookies();
    if (jar.get(ACTIVE_ORG_COOKIE)?.value === organizationId) {
      jar.delete(ACTIVE_ORG_COOKIE);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("ORGANIZATION DELETE ERROR:", error);
    captureError(error, { route: "organization/delete" });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
