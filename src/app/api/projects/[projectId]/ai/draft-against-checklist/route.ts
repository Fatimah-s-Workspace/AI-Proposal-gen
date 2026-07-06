import { buildTenderProposalAssistant } from "@/features/proposals/tender-proposal";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { loadTenderProposalContext } from "@/server/tender-proposal";
import { incrementUsage } from "@/server/usage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = rateLimit(
    `ai:draft-checklist:${user.id}:${projectId}`,
    20,
    60_000,
  );
  if (!limit.allowed) return rateLimitResponse();

  const context = await loadTenderProposalContext(projectId, user.id);
  if (!context) return Response.json({ error: "Project not found" }, { status: 404 });

  const result = buildTenderProposalAssistant(context);

  await prisma.generatedContent.create({
    data: {
      projectId,
      provider: "local",
      contentType: "proposal_assistant_analysis",
      output: JSON.stringify(result),
      metadata: {
        requirementsCount: context.requirements.length,
        clausesCount: context.clauses.length,
        sectionsCount: result.sectionPlan.length,
      },
    },
  });

  await incrementUsage(user.id, projectId, {
    aiGenerations: 1,
    tokensUsed: Math.ceil(JSON.stringify(result).length / 4),
  });

  return Response.json(result);
}
