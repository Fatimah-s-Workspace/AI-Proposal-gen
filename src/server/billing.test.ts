import assert from "node:assert/strict";
import test from "node:test";

import { finalizePayment } from "./billing";
import { PRO_PLAN } from "@/lib/payments/plans";
import type { prisma } from "@/server/db";
import type { verifyTransaction } from "@/lib/payments/paystack";

function createFakePrisma(initialPayment: { reference: string; userId: string; amount: number; status: string }) {
  const payments = new Map([[initialPayment.reference, { ...initialPayment }]]);
  const subscriptions = new Map<string, Record<string, unknown>>();

  const db = {
    payment: {
      findUnique: async ({ where }: { where: { reference: string } }) =>
        payments.get(where.reference) ?? null,
      update: async ({ where, data }: { where: { reference: string }; data: Record<string, unknown> }) => {
        const existing = payments.get(where.reference)!;
        const updated = { ...existing, ...data };
        payments.set(where.reference, updated);
        return updated;
      },
    },
    subscription: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = subscriptions.get(where.userId);
        const row = existing ? { ...existing, ...update } : { ...create };
        subscriptions.set(where.userId, row);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  return { db: db as unknown as typeof prisma, payments, subscriptions };
}

function fakeVerify(result: Awaited<ReturnType<typeof verifyTransaction>>) {
  return (async () => result) as typeof verifyTransaction;
}

test("finalizePayment returns not_found for an unknown reference", async () => {
  const { db } = createFakePrisma({ reference: "tf_known", userId: "user-1", amount: 500000, status: "pending" });

  const result = await finalizePayment("tf_missing", { prismaClient: db, verifyTransactionFn: fakeVerify({ ok: false, reason: "request_failed" }) });

  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("finalizePayment is idempotent for an already-successful payment", async () => {
  const { db } = createFakePrisma({ reference: "tf_done", userId: "user-1", amount: 500000, status: "success" });

  const result = await finalizePayment("tf_done", { prismaClient: db, verifyTransactionFn: fakeVerify({ ok: false, reason: "request_failed" }) });

  assert.deepEqual(result, { ok: true, alreadyProcessed: true });
});

test("finalizePayment activates the pro plan on a verified successful payment", async () => {
  const { db, subscriptions } = createFakePrisma({
    reference: "tf_success",
    userId: "user-1",
    amount: PRO_PLAN.priceNgn * 100,
    status: "pending",
  });

  const result = await finalizePayment("tf_success", {
    prismaClient: db,
    verifyTransactionFn: fakeVerify({
      ok: true,
      status: "success",
      amountKobo: PRO_PLAN.priceNgn * 100,
      currency: "NGN",
      reference: "tf_success",
      paidAt: new Date().toISOString(),
    }),
  });

  assert.deepEqual(result, { ok: true, alreadyProcessed: false });
  const subscription = subscriptions.get("user-1");
  assert.equal(subscription?.plan, PRO_PLAN.id);
  assert.equal(subscription?.status, "active");
  assert.equal(subscription?.monthlyUploadLimit, PRO_PLAN.monthlyUploadLimit);
});

test("finalizePayment marks the payment failed when Paystack reports it wasn't successful", async () => {
  const { db, payments } = createFakePrisma({
    reference: "tf_abandoned",
    userId: "user-1",
    amount: PRO_PLAN.priceNgn * 100,
    status: "pending",
  });

  const result = await finalizePayment("tf_abandoned", {
    prismaClient: db,
    verifyTransactionFn: fakeVerify({
      ok: true,
      status: "abandoned",
      amountKobo: PRO_PLAN.priceNgn * 100,
      currency: "NGN",
      reference: "tf_abandoned",
      paidAt: null,
    }),
  });

  assert.deepEqual(result, { ok: false, reason: "payment_not_successful" });
  assert.equal(payments.get("tf_abandoned")?.status, "failed");
});

test("finalizePayment rejects a mismatched paid amount", async () => {
  const { db, payments } = createFakePrisma({
    reference: "tf_tampered",
    userId: "user-1",
    amount: PRO_PLAN.priceNgn * 100,
    status: "pending",
  });

  const result = await finalizePayment("tf_tampered", {
    prismaClient: db,
    verifyTransactionFn: fakeVerify({
      ok: true,
      status: "success",
      amountKobo: 100,
      currency: "NGN",
      reference: "tf_tampered",
      paidAt: new Date().toISOString(),
    }),
  });

  assert.deepEqual(result, { ok: false, reason: "amount_mismatch" });
  assert.equal(payments.get("tf_tampered")?.status, "failed");
});
