import { z } from "zod";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { explainTenderClause } from "@/features/tender-intelligence/pipeline";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { explainClauseWithGemini } from "@/features/tender-intelligence/gemini";

const updateClauseSchema = z.object({
  title: z.string().min(1).optional().nullable(),
  explanation: z.string().optional().nullable(),
  clauseType: z.string().optional().nullable(),
  importance: z.enum(["high", "medium", "low"]).optional(),
  riskLevel: z.enum(["high", "medium", "low"]).optional(),
  actionsRequired: z.array(z.string()).optional(),
  actionCompletions: z.array(z.boolean()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; clauseId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, clauseId } = await params;
  const limit = await rateLimit(`clause:explain:${user.id}:${clauseId}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const clause = await prisma.tenderClause.findFirst({
    where: {
      id: clauseId,
      projectId,
      project: { userId: user.id },
    },
    include: {
      project: { select: { title: true } },
    },
  });

  if (!clause) return Response.json({ error: "Clause not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const clauseText =
    typeof body.clauseText === "string" ? body.clauseText : clause.originalText;
  const clauseType =
    typeof body.clauseType === "string" ? body.clauseType : clause.clauseType;
  const geminiExplanation = await explainClauseWithGemini({
    clauseText,
    clauseType,
    projectTitle: clause.project.title,
  }).catch((error) => {
    console.error("Gemini clause explanation failed", error);
    return null;
  });
  const localExplanation = geminiExplanation
    ? null
    : explainTenderClause({
        originalText: clauseText,
        clauseType,
      });
  const actionsRequired = geminiExplanation?.actionsRequired.length
    ? geminiExplanation.actionsRequired
    : [geminiExplanation?.action ?? localExplanation?.action].filter(
        (item): item is string => Boolean(item),
      );

  const updatedClause = await prisma.tenderClause.update({
    where: { id: clauseId },
    data: {
      explanation: geminiExplanation?.plainEnglish ?? localExplanation?.plainEnglish,
      riskLevel: geminiExplanation?.riskLevel ?? localExplanation?.riskLevel,
      importance: geminiExplanation?.riskLevel ?? localExplanation?.riskLevel,
      clauseType: geminiExplanation?.clauseType ?? clause.clauseType,
      actionsRequired,
      confidence: Math.max(
        clause.confidence ?? 0,
        geminiExplanation?.confidence ?? 0.82,
      ),
      metadata: {
        ...normaliseMetadata(clause.metadata),
        explanationProvider: geminiExplanation?.provider ?? "local",
        explanationModel: geminiExplanation?.model ?? null,
      },
    },
  });

  return Response.json({ clause: updatedClause });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; clauseId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, clauseId } = await params;
  const limit = await rateLimit(`clause:update:${user.id}:${clauseId}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const parsed = updateClauseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid clause update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const clause = await prisma.tenderClause.findFirst({
    where: {
      id: clauseId,
      projectId,
      project: { userId: user.id },
    },
  });

  if (!clause) return Response.json({ error: "Clause not found" }, { status: 404 });

  const { actionCompletions, ...data } = parsed.data;
  const metadata =
    actionCompletions === undefined
      ? undefined
      : {
          ...normaliseMetadata(clause.metadata),
          actionCompletions,
        };

  const updatedClause = await prisma.tenderClause.update({
    where: { id: clauseId },
    data: {
      ...data,
      ...(metadata ? { metadata } : {}),
    },
  });

  return Response.json({ clause: updatedClause });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; clauseId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, clauseId } = await params;
  const clause = await prisma.tenderClause.findFirst({
    where: {
      id: clauseId,
      projectId,
      project: { userId: user.id },
    },
  });

  if (!clause) return Response.json({ error: "Clause not found" }, { status: 404 });

  await prisma.tenderClause.delete({ where: { id: clauseId } });
  return Response.json({ ok: true });
}

function normaliseMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
