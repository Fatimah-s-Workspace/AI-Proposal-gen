import { exportProposal } from "@/features/export/exporters";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { exportProposalSchema } from "@/lib/validations";
import { incrementUsage } from "@/server/usage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = await rateLimit(`export:${user.id}:${projectId}`, 10, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const body = await request.json();
  const parsed = exportProposalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid export format", issues: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      proposalSections: {
        orderBy: { order: "asc" }
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

  await incrementUsage(user.id, projectId, {
    exports: 1
  });

  return Response.json({ export: history });
}
