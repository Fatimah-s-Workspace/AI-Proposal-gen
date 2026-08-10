import { buildTenderProposalAssistant } from "@/features/proposals/tender-proposal";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { loadTenderProposalContext } from "@/server/tender-proposal";
import { checkUsageLimit, incrementUsage, usageLimitResponse } from "@/server/usage";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = await rateLimit(
    `ai:draft-checklist:${user.id}:${projectId}`,
    20,
    60_000,
  );
  if (!limit.allowed) return rateLimitResponse();

  const usageLimit = await checkUsageLimit(user, "aiGenerations");
  if (!usageLimit.allowed) return usageLimitResponse("aiGenerations");

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

  await incrementUsage(user.organizationId, projectId, {
    aiGenerations: 1,
    tokensUsed: Math.ceil(JSON.stringify(result).length / 4),
  });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.proposalDraftAssistant,
    entityType: "Project",
    entityId: projectId,
    metadata: { sectionsCount: result.sectionPlan.length },
  });

  return Response.json(result);
}
