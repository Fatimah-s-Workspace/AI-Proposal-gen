import { z } from "zod";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { explainTenderClause } from "@/features/tender-intelligence/pipeline";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const createClauseSchema = z.object({
  originalText: z.string().min(1),
  documentId: z.string().cuid(),
  parsedSectionId: z.string().cuid().optional().nullable(),
  title: z.string().optional().nullable(),
  clauseType: z.string().optional().nullable(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const clauses = await prisma.tenderClause.findMany({
    where: { projectId },
    orderBy: [{ importance: "asc" }, { createdAt: "desc" }],
    include: {
      document: { select: { originalName: true, documentType: true, version: true } },
      parsedSection: { select: { title: true, order: true } },
      _count: { select: { requirements: true } },
    },
  });

  return Response.json({ clauses });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const limit = await rateLimit(`clause:create:${user.id}:${projectId}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const parsed = createClauseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid clause", issues: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const explanation = explainTenderClause({
    originalText: parsed.data.originalText,
    clauseType: parsed.data.clauseType,
  });

  const clause = await prisma.tenderClause.create({
    data: {
      projectId,
      documentId: parsed.data.documentId,
      parsedSectionId: parsed.data.parsedSectionId || null,
      title: parsed.data.title || parsed.data.originalText.slice(0, 90),
      originalText: parsed.data.originalText,
      clauseType: parsed.data.clauseType || "manual",
      importance: explanation.riskLevel,
      riskLevel: explanation.riskLevel,
      confidence: 0.7,
      explanation: explanation.plainEnglish,
      actionsRequired: [explanation.action],
      metadata: { source: "manual_review" },
    },
  });

  return Response.json({ clause }, { status: 201 });
}
