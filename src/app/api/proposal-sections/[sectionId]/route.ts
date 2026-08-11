import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { updateProposalSectionSchema } from "@/lib/validations";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ sectionId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

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

  const updated = await prisma.proposalSection.update({
    where: { id: sectionId },
    data: {
      content: parsed.data.content,
      status: parsed.data.status,
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
    metadata: { projectId: section.projectId, status: parsed.data.status },
  });

  return Response.json(updated);
}
