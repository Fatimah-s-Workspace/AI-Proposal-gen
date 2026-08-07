import assert from "node:assert/strict";
import test from "node:test";

import { finalizePayment, sendRenewalReminders } from "./billing";
import { PRO_PLAN } from "@/lib/payments/plans";
import type { prisma } from "@/server/db";
import type { verifyTransaction } from "@/lib/payments/paystack";
import type { sendEmail } from "@/lib/email";

function createFakePrisma(initialPayment: { id?: string; reference: string; organizationId: string; initiatedByUserId: string; amount: number; status: string }) {
  const payments = new Map([[initialPayment.reference, { id: "payment-1", ...initialPayment }]]);
  const subscriptions = new Map<string, Record<string, unknown>>();
  const auditLogs: Record<string, unknown>[] = [];

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
        where: { organizationId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = subscriptions.get(where.organizationId);
        const row = existing ? { ...existing, ...update } : { ...create };
        subscriptions.set(where.organizationId, row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `audit-${auditLogs.length + 1}`, ...data };
        auditLogs.push(row);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  return { db: db as unknown as typeof prisma, payments, subscriptions, auditLogs };
}

function fakeVerify(result: Awaited<ReturnType<typeof verifyTransaction>>) {
  return (async () => result) as typeof verifyTransaction;
}

test("finalizePayment returns not_found for an unknown reference", async () => {
  const { db } = createFakePrisma({ reference: "tf_known", organizationId: "org-1", initiatedByUserId: "user-1", amount: 500000, status: "pending" });

  const result = await finalizePayment("tf_missing", { prismaClient: db, verifyTransactionFn: fakeVerify({ ok: false, reason: "request_failed" }) });

  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("finalizePayment is idempotent for an already-successful payment", async () => {
  const { db } = createFakePrisma({ reference: "tf_done", organizationId: "org-1", initiatedByUserId: "user-1", amount: 500000, status: "success" });

  const result = await finalizePayment("tf_done", { prismaClient: db, verifyTransactionFn: fakeVerify({ ok: false, reason: "request_failed" }) });

  assert.deepEqual(result, { ok: true, alreadyProcessed: true });
});

test("finalizePayment activates the pro plan on a verified successful payment", async () => {
  const { db, subscriptions, auditLogs } = createFakePrisma({
    reference: "tf_success",
    organizationId: "org-1",
    initiatedByUserId: "user-1",
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
  const subscription = subscriptions.get("org-1");
  assert.equal(subscription?.plan, PRO_PLAN.id);
  assert.equal(subscription?.status, "active");
  assert.equal(subscription?.monthlyUploadLimit, PRO_PLAN.monthlyUploadLimit);

  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "payment.success");
});

test("finalizePayment marks the payment failed when Paystack reports it wasn't successful", async () => {
  const { db, payments } = createFakePrisma({
    reference: "tf_abandoned",
    organizationId: "org-1",
    initiatedByUserId: "user-1",
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
    organizationId: "org-1",
    initiatedByUserId: "user-1",
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

type FakeSubscription = {
  id: string;
  plan: string;
  status: string;
  renewsAt: Date | null;
  reminderSentAt: Date | null;
  organization: { memberships: Array<{ role: string; user: { email: string } }> };
};

function ownerOrg(email: string) {
  return { memberships: [{ role: "owner", user: { email } }] };
}

function createReminderFakePrisma(subscriptions: FakeSubscription[]) {
  const rows = new Map(subscriptions.map((s) => [s.id, { ...s }]));

  const db = {
    subscription: {
      findMany: async ({ where }: { where: { plan: string; status: string; renewsAt: { gte: Date; lte: Date }; reminderSentAt: null } }) =>
        [...rows.values()].filter(
          (row) =>
            row.plan === where.plan &&
            row.status === where.status &&
            row.reminderSentAt === null &&
            row.renewsAt !== null &&
            row.renewsAt >= where.renewsAt.gte &&
            row.renewsAt <= where.renewsAt.lte,
        ),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = rows.get(where.id)!;
        const updated = { ...existing, ...data };
        rows.set(where.id, updated as FakeSubscription);
        return updated;
      },
    },
  };

  return { db: db as unknown as typeof prisma, rows };
}

function fakeSendEmail(delivered: boolean) {
  return (async () => (delivered ? { delivered: true } : { delivered: false, reason: "send_failed" })) as typeof sendEmail;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

test("sendRenewalReminders emails a pro subscription renewing within the reminder window", async () => {
  const { db, rows } = createReminderFakePrisma([
    {
      id: "sub-1",
      plan: PRO_PLAN.id,
      status: "active",
      renewsAt: daysFromNow(2),
      reminderSentAt: null,
      organization: ownerOrg("user@example.com"),
    },
  ]);

  const result = await sendRenewalReminders({ prismaClient: db, sendEmailFn: fakeSendEmail(true) });

  assert.deepEqual(result, { checked: 1, sent: 1 });
  assert.ok(rows.get("sub-1")?.reminderSentAt instanceof Date);
});

test("sendRenewalReminders skips a subscription outside the reminder window", async () => {
  const { db } = createReminderFakePrisma([
    {
      id: "sub-far",
      plan: PRO_PLAN.id,
      status: "active",
      renewsAt: daysFromNow(20),
      reminderSentAt: null,
      organization: ownerOrg("user@example.com"),
    },
  ]);

  const result = await sendRenewalReminders({ prismaClient: db, sendEmailFn: fakeSendEmail(true) });

  assert.deepEqual(result, { checked: 0, sent: 0 });
});

test("sendRenewalReminders skips a subscription that already got its reminder this cycle", async () => {
  const { db } = createReminderFakePrisma([
    {
      id: "sub-already",
      plan: PRO_PLAN.id,
      status: "active",
      renewsAt: daysFromNow(1),
      reminderSentAt: new Date(),
      organization: ownerOrg("user@example.com"),
    },
  ]);

  const result = await sendRenewalReminders({ prismaClient: db, sendEmailFn: fakeSendEmail(true) });

  assert.deepEqual(result, { checked: 0, sent: 0 });
});

test("sendRenewalReminders does not mark reminderSentAt when the email fails to send", async () => {
  const { db, rows } = createReminderFakePrisma([
    {
      id: "sub-fail",
      plan: PRO_PLAN.id,
      status: "active",
      renewsAt: daysFromNow(1),
      reminderSentAt: null,
      organization: ownerOrg("user@example.com"),
    },
  ]);

  const result = await sendRenewalReminders({ prismaClient: db, sendEmailFn: fakeSendEmail(false) });

  assert.deepEqual(result, { checked: 1, sent: 0 });
  assert.equal(rows.get("sub-fail")?.reminderSentAt, null);
});
