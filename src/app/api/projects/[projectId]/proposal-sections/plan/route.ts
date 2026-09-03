import { buildTenderProposalAssistant } from "@/features/proposals/tender-proposal";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireApiUser } from "@/server/session";
import { unauthorized } from "@/server/responses";
import {
  loadTenderProposalContext,
  syncProposalSectionsFromTender,
} from "@/server/tender-proposal";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { projectId } = await params;
  const limit = await rateLimit(`proposal-plan:${user.id}:${projectId}`, 15, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const context = await loadTenderProposalContext(projectId, user.id);
  if (!context) return Response.json({ error: "Project not found" }, { status: 404 });
  if (!context.requirements.length && !context.clauses.length) {
    return Response.json(
      { error: "Upload and parse a tender document before generating a tender-based section plan." },
      { status: 400 },
    );
  }

  const result = await syncProposalSectionsFromTender(projectId);
  const refreshedContext = await loadTenderProposalContext(projectId, user.id);

  return Response.json({
    plan: result.plan,
    sections: result.sections,
    assistant: refreshedContext ? buildTenderProposalAssistant(refreshedContext) : null,
  });
}
