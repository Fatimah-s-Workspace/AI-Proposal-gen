import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_ACTIONS, logAudit } from "./audit";
import type { prisma } from "@/server/db";

function createFakePrisma() {
  const rows: Record<string, unknown>[] = [];
  const db = {
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `audit-${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      },
    },
  };
  return { db: db as unknown as typeof prisma, rows };
}

test("logAudit writes a row with the given action, entity, and metadata", async () => {
  const { db, rows } = createFakePrisma();

  await logAudit(
    {
      userId: "user-1",
      action: AUDIT_ACTIONS.exportCreate,
      entityType: "ExportHistory",
      entityId: "export-1",
      metadata: { format: "pdf" },
    },
    db,
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, "user-1");
  assert.equal(rows[0].action, "export.create");
  assert.deepEqual(rows[0].metadata, { format: "pdf" });
});

test("logAudit never throws even when the write itself fails", async () => {
  const db = {
    auditLog: {
      create: async () => {
        throw new Error("connection refused");
      },
    },
  } as unknown as typeof prisma;

  await assert.doesNotReject(
    logAudit({ userId: "user-1", action: AUDIT_ACTIONS.documentUpload }, db),
  );
});
