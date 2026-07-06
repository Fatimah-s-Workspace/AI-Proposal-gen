import { analyseCompliance } from "@/features/ai";
import { generateProposalSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { generateTenderSectionsForProject } from "@/server/tender-proposal";
import { incrementUsage } from "@/server/usage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = rateLimit(`ai:proposal:${user.id}:${projectId}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = generateProposalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid generation request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      requirements: true,
      clauses: true,
    },
  });

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (!project.requirements.length && !project.clauses.length) {
    return Response.json(
      { error: "Upload and parse a tender document before generating proposal sections." },
      { status: 400 },
    );
  }

  const result = await generateTenderSectionsForProject({
    projectId,
    userId: user.id,
    sectionId: parsed.data.sectionId,
    tone: parsed.data.tone,
    customPrompt: parsed.data.customPrompt,
  });

  const compliance = await analyseCompliance({
    requirements: project.requirements.map((requirement) => ({
      title: requirement.title,
      priority: requirement.priority,
      status: requirement.status,
    })),
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      stage: "drafting",
      complianceScore: compliance.score,
    },
  });

  await incrementUsage(user.id, projectId, {
    aiGenerations: Math.max(result.sections.length, 1),
    tokensUsed: result.sections.reduce(
      (total, section) => total + Math.ceil((section.content?.length ?? 0) / 4),
      0,
    ),
  });

  return Response.json({
    sections: result.sections,
    assistant: result.assistant,
    compliance,
  });
}
