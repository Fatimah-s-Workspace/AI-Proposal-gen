import { extractRequirementsFromTender } from "@/features/ai";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { incrementUsage } from "@/server/usage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { ParsedSection } from "@/features/ai";

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = rateLimit(`ai:extract:${user.id}:${projectId}`, 15, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  const document = project.documents[0];
  if (!document?.extractedText) {
    return Response.json({ error: "Upload a document before extracting requirements." }, { status: 400 });
  }

  const requirements = await extractRequirementsFromTender({
    project,
    text: document.extractedText,
    sections: Array.isArray(document.sections) ? (document.sections as ParsedSection[]) : []
  });

  await prisma.requirement.createMany({
    data: requirements.map((requirement) => ({
      projectId,
      documentId: document.id,
      title: requirement.title,
      description: requirement.description,
      category: requirement.category,
      sourceClause: requirement.sourceClause,
      priority: requirement.priority,
      evidenceNeeded: requirement.evidenceNeeded
    }))
  });

  await incrementUsage(user.id, projectId, {
    aiGenerations: 1,
    tokensUsed: Math.ceil(document.extractedText.length / 5)
  });

  return Response.json({ requirements });
}
