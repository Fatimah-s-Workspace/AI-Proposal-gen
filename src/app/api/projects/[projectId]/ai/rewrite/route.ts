import { requireApiUser } from "@/server/session";
import { checkUsageLimit, incrementUsage, usageLimitResponse } from "@/server/usage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { captureError } from "@/lib/monitoring";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = await rateLimit(`ai:rewrite:${user.id}:${projectId}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const usageLimit = await checkUsageLimit(user, "aiGenerations");
  if (!usageLimit.allowed) return usageLimitResponse("aiGenerations");

  const body = await request.json().catch(() => ({}));
  const { content, instruction } = body;

  if (!content || !instruction) {
    return Response.json(
      { error: "Content and instruction are required" },
      { status: 400 },
    );
  }

  try {
    // Mock rewrite functionality
    let rewritten = content;

    switch (instruction) {
      case "Make this more formal and professional":
        rewritten = content
          .replace(/\bI\b/g, "we")
          .replace(/\bwe are\b/g, "our organization is")
          .replace(/\bwe have\b/g, "our company possesses")
          .replace(/\bgood\b/g, "excellent")
          .replace(/\bgreat\b/g, "exceptional");
        break;
      case "Make this more concise and direct":
        // Simple mock - remove some words
        rewritten = content
          .replace(/\s+/g, " ")
          .replace(/\b(the|and|or|but|so|because|although|however)\b\s*/gi, "")
          .trim();
        break;
      case "Add more specific details and examples":
        rewritten =
          content +
          " For example, our previous project in a similar sector demonstrated our capability to deliver within tight deadlines while maintaining the highest quality standards.";
        break;
      default:
        rewritten = content;
    }

    await incrementUsage(user.organizationId, projectId, {
      aiGenerations: 1,
      tokensUsed: Math.ceil((content.length + rewritten.length) / 4),
    });

    await logAudit({
      userId: user.id,
    organizationId: user.organizationId,
      action: AUDIT_ACTIONS.proposalRewrite,
      entityType: "Project",
      entityId: projectId,
      metadata: { instruction },
    });

    return Response.json({ rewritten });
  } catch (error) {
    console.error("Rewrite error:", error);
    captureError(error, { route: "ai/rewrite", projectId });
    return Response.json(
      { error: "Failed to rewrite content" },
      { status: 500 },
    );
  }
}
