import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { canManageMembers } from "@/server/permissions";
import { updateCompanyProfileSchema } from "@/lib/validations";
import { logAudit, AUDIT_ACTIONS } from "@/server/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await rateLimit(`org:profile:${user.id}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const { organizationId } = await params;

  // Scoped through Membership rather than looked up by id alone, so another
  // organization's id reads as "not found" instead of being actionable.
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });
  if (!membership) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Same bar as renaming the workspace: this is shared content that shapes
  // every proposal the team generates, not a personal setting.
  if (!canManageMembers(membership.role)) {
    return Response.json(
      { error: "Only owners and admins can edit the company profile" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateCompanyProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Check the highlighted fields", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      legalName: data.legalName || null,
      registrationNumber: data.registrationNumber || null,
      foundedYear: data.foundedYear ?? null,
      teamSize: data.teamSize || null,
      profileSummary: data.profileSummary || null,
      capabilities: data.capabilities || null,
      certifications: data.certifications || null,
      pastPerformance: data.pastPerformance || null,
    },
  });

  await logAudit({
    userId: user.id,
    organizationId,
    action: AUDIT_ACTIONS.organizationProfileUpdate,
    entityType: "Organization",
    entityId: organizationId,
  });

  return Response.json({ organization: { id: organization.id } });
}
