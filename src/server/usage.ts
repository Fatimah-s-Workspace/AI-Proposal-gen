import { prisma } from "@/server/db";

const DEFAULT_UPLOAD_LIMIT = 100;
const DEFAULT_PROPOSAL_LIMIT = 10;

type LimitedMetric = "uploads" | "aiGenerations";

export async function getCurrentPeriodUsage(userId: string, prismaClient?: typeof prisma) {
  const db = prismaClient ?? prisma;
  const period = new Date().toISOString().slice(0, 7);
  const rows = await db.usageTracking.findMany({ where: { userId, period } });

  return rows.reduce(
    (acc, row) => ({
      uploads: acc.uploads + row.uploads,
      aiGenerations: acc.aiGenerations + row.aiGenerations,
      exports: acc.exports + row.exports,
    }),
    { uploads: 0, aiGenerations: 0, exports: 0 },
  );
}

// Soft cap: blocks a new action once the user has already reached their
// limit, rather than trying to predict whether a single call (e.g. a
// proposal generation that can produce several sections at once) will push
// them over it - the exact output size isn't known until after the call
// runs, so a hard pre-check on projected usage isn't reliable.
export async function checkUsageLimit(
  user: { id: string; subscription: { monthlyUploadLimit: number; monthlyProposalLimit: number } | null },
  metric: LimitedMetric,
  prismaClient?: typeof prisma,
) {
  const usage = await getCurrentPeriodUsage(user.id, prismaClient);
  const limit =
    metric === "uploads"
      ? (user.subscription?.monthlyUploadLimit ?? DEFAULT_UPLOAD_LIMIT)
      : (user.subscription?.monthlyProposalLimit ?? DEFAULT_PROPOSAL_LIMIT);

  return { allowed: usage[metric] < limit, current: usage[metric], limit };
}

export function usageLimitResponse(metric: LimitedMetric) {
  const message =
    metric === "uploads"
      ? "You've reached your monthly document upload limit. Upgrade your plan or wait until next month to upload more."
      : "You've reached your monthly AI generation limit. Upgrade your plan or wait until next month to generate more.";

  return Response.json({ error: message }, { status: 402 });
}

export async function incrementUsage(
  userId: string,
  projectId: string,
  increment: Partial<{
    uploads: number;
    aiGenerations: number;
    exports: number;
    tokensUsed: number;
  }>,
) {
  const period = new Date().toISOString().slice(0, 7);

  return prisma.usageTracking.upsert({
    where: {
      userId_projectId_period: {
        userId,
        projectId,
        period,
      },
    },
    create: {
      userId,
      projectId,
      period,
      uploads: increment.uploads ?? 0,
      aiGenerations: increment.aiGenerations ?? 0,
      exports: increment.exports ?? 0,
      tokensUsed: increment.tokensUsed ?? 0,
    },
    update: {
      uploads: { increment: increment.uploads ?? 0 },
      aiGenerations: { increment: increment.aiGenerations ?? 0 },
      exports: { increment: increment.exports ?? 0 },
      tokensUsed: { increment: increment.tokensUsed ?? 0 },
    },
  });
}
