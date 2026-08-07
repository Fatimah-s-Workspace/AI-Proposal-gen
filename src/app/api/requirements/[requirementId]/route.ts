import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { updateRequirementSchema } from "@/lib/validations";
import { calculateChecklistScore } from "@/features/tender-intelligence/pipeline";

export async function PATCH(request: Request, { params }: { params: Promise<{ requirementId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { requirementId } = await params;
  const parsed = updateRequirementSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid requirement update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const requirement = await prisma.requirement.findFirst({
    where: {
      id: requirementId,
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
    where: { projectId: requirement.projectId },
    select: { status: true, priority: true },
  });
  const complianceScore = calculateChecklistScore(projectRequirements);

  await prisma.project.update({
    where: { id: requirement.projectId },
    data: { complianceScore },
  });

  return Response.json({ requirement: updated, complianceScore });
}
