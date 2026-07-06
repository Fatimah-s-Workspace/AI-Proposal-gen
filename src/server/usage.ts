import { prisma } from "@/server/db";

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
