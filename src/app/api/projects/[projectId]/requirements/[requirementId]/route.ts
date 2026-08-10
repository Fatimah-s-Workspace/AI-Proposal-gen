import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { updateRequirementSchema } from "@/lib/validations";
import { calculateChecklistScore } from "@/features/tender-intelligence/pipeline";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; requirementId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, requirementId } = await params;
  const limit = await rateLimit(`requirement:update:${user.id}:${requirementId}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const parsed = updateRequirementSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid requirement update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const requirement = await prisma.requirement.findFirst({
    where: {
      id: requirementId,
      projectId,
      project: { organizationId: user.organizationId },
    },
  });

  if (!requirement) return Response.json({ error: "Requirement not found" }, { status: 404 });

  const updated = await prisma.requirement.update({
    where: { id: requirementId },
    data: {
      ...parsed.data,
      owner: parsed.data.owner || null,
      reviewNotes: parsed.data.reviewNotes || null,
    },
  });

  const projectRequirements = await prisma.requirement.findMany({
    where: { projectId },
    select: { status: true, priority: true },
  });
  const complianceScore = calculateChecklistScore(projectRequirements);

  await prisma.project.update({
    where: { id: projectId },
    data: { complianceScore },
  });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.requirementUpdate,
    entityType: "Requirement",
    entityId: requirementId,
    metadata: { projectId, fields: Object.keys(parsed.data) },
  });

  return Response.json({ requirement: updated, complianceScore });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; requirementId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, requirementId } = await params;
  const limit = await rateLimit(`requirement:delete:${user.id}:${requirementId}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const requirement = await prisma.requirement.findFirst({
    where: {
      id: requirementId,
      projectId,
      project: { organizationId: user.organizationId },
    },
  });

  if (!requirement) return Response.json({ error: "Requirement not found" }, { status: 404 });

  await prisma.requirement.delete({ where: { id: requirementId } });

  const projectRequirements = await prisma.requirement.findMany({
    where: { projectId },
    select: { status: true, priority: true },
  });
  const complianceScore = calculateChecklistScore(projectRequirements);
  await prisma.project.update({
    where: { id: projectId },
    data: { complianceScore },
  });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.requirementDelete,
    entityType: "Requirement",
    entityId: requirementId,
    metadata: { projectId, title: requirement.title },
  });

  return Response.json({ ok: true, complianceScore });
}
