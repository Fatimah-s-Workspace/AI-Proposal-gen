import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { statusAfterEdit } from "@/features/proposals/review";
import { updateProposalSectionSchema } from "@/lib/validations";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";
import { unauthorized } from "@/server/responses";

export async function PATCH(request: Request, { params }: { params: Promise<{ sectionId: string }> }) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  // The editor autosaves on a 900ms debounce, so sustained typing can legitimately
  // reach ~60 requests a minute. Set well clear of that: a limit tuned for a
  // normal write endpoint would cut off someone mid-paragraph.
  const limit = await rateLimit(`section:save:${user.id}`, 150, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const { sectionId } = await params;
  const body = await request.json();
  const parsed = updateProposalSectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid proposal section", issues: parsed.error.flatten() }, { status: 400 });
  }

  const section = await prisma.proposalSection.findFirst({
    where: {
      id: sectionId,
      project: {
        organizationId: user.organizationId
      }
    }
  });

  if (!section) return Response.json({ error: "Section not found" }, { status: 404 });

  const previousVersion = await prisma.generatedContent.count({
    where: {
      projectId: section.projectId,
      sectionId
    }
  });

  // Derived from what the section already is, never taken from the request.
  // Editing approved text means the approved text no longer exists, so that
  // returns to drafting - but a reviewer's "needs work" stands until someone
  // acts on it, rather than being cleared by the writer doing the work.
  const nextStatus = statusAfterEdit(section.status);

  const updated = await prisma.proposalSection.update({
    where: { id: sectionId },
    data: {
      content: parsed.data.content,
      status: nextStatus,
      generatedContents: {
        create: {
          projectId: section.projectId,
          contentType: "manual_edit",
          provider: "local",
          output: parsed.data.content,
          version: previousVersion + 1
        }
      }
    },
    include: {
      generatedContents: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  });

  await logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: AUDIT_ACTIONS.proposalSectionEdit,
    entityType: "ProposalSection",
    entityId: sectionId,
    metadata: { projectId: section.projectId, status: nextStatus },
  });

  return Response.json(updated);
}
