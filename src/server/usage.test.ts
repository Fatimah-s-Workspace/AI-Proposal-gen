import assert from "node:assert/strict";
import test from "node:test";

import { checkUsageLimit, getCurrentPeriodUsage } from "./usage";
import type { prisma } from "@/server/db";

function fakePrisma(rows: Array<{ uploads: number; aiGenerations: number; exports: number }>) {
  return {
    usageTracking: {
      findMany: async () => rows,
    },
  } as unknown as typeof prisma;
}

test("getCurrentPeriodUsage sums usage across every project row for the period", async () => {
  const db = fakePrisma([
    { uploads: 3, aiGenerations: 1, exports: 0 },
    { uploads: 2, aiGenerations: 4, exports: 1 },
  ]);

  const usage = await getCurrentPeriodUsage("org-1", db);

  assert.deepEqual(usage, { uploads: 5, aiGenerations: 5, exports: 1 });
});

test("checkUsageLimit allows the action while under the plan limit", async () => {
  const db = fakePrisma([{ uploads: 4, aiGenerations: 0, exports: 0 }]);
  const organization = {
    organizationId: "org-1",
    subscription: { monthlyUploadLimit: 5, monthlyProposalLimit: 10 },
  };

  const result = await checkUsageLimit(organization, "uploads", db);

  assert.deepEqual(result, { allowed: true, current: 4, limit: 5 });
});

test("checkUsageLimit blocks the action once usage has reached the plan limit", async () => {
  const db = fakePrisma([{ uploads: 5, aiGenerations: 0, exports: 0 }]);
  const organization = {
    organizationId: "org-1",
    subscription: { monthlyUploadLimit: 5, monthlyProposalLimit: 10 },
  };

  const result = await checkUsageLimit(organization, "uploads", db);

  assert.deepEqual(result, { allowed: false, current: 5, limit: 5 });
});

test("checkUsageLimit falls back to default limits when the organization has no subscription row", async () => {
  const db = fakePrisma([{ uploads: 0, aiGenerations: 10, exports: 0 }]);
  const organization = { organizationId: "org-1", subscription: null };

  const result = await checkUsageLimit(organization, "aiGenerations", db);

  assert.deepEqual(result, { allowed: false, current: 10, limit: 10 });
});
