import { exportProposal } from "@/features/export/exporters";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { exportProposalSchema } from "@/lib/validations";
import { incrementUsage } from "@/server/usage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";
import { unauthorized } from "@/server/responses";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { projectId } = await params;
  const limit = await rateLimit(`export:${user.id}:${projectId}`, 10, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const body = await request.json();
  const parsed = exportProposalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid export format", issues: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    include: {
      proposalSections: {
        orderBy: { order: "asc" }
      },
      // Drives the cover sheet. Selected rather than included whole so an
      // export can't start carrying billing or slug data into a file that
      // gets sent to a buyer.
      organization: {
        select: { name: true, legalName: true, registrationNumber: true }
      }
    }
  });

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const exported = await exportProposal(project, parsed.data.format);
  const history = await prisma.exportHistory.create({
    data: {
      projectId,
      userId: user.id,
      format: parsed.data.format,
      fileName: exported.fileName,
      filePath: exported.filePath,
      status: "completed"
    }
  });

  await incrementUsage(user.organizationId, projectId, {
    exports: 1
  });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.exportCreate,
    entityType: "ExportHistory",
    entityId: history.id,
    metadata: { projectId, format: parsed.data.format },
  });

  return Response.json({ export: history });
}
