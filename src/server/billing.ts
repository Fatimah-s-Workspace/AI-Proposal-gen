import { prisma } from "@/server/db";
import { captureError } from "@/lib/monitoring";
import { verifyTransaction } from "@/lib/payments/paystack";
import { PRO_PLAN } from "@/lib/payments/plans";
import { sendEmail } from "@/lib/email";
import { renewalReminderEmail } from "@/lib/email/templates";
import { AUDIT_ACTIONS, logAudit } from "@/server/audit";

const REMINDER_WINDOW_DAYS = 3;

type FinalizeResult =
  | { ok: true; alreadyProcessed: boolean }
  | {
      ok: false;
      reason: "not_found" | "verification_failed" | "payment_not_successful" | "amount_mismatch";
    };

// Called from both the browser-redirect callback and the server-to-server
// webhook, whichever arrives first - both paths converge here so a
// payment is only ever applied once, regardless of which one wins the
// race or whether one of them never fires at all (e.g. the user closes
// the tab right after paying, before the redirect completes).
export async function finalizePayment(
  reference: string,
  deps?: { prismaClient?: typeof prisma; verifyTransactionFn?: typeof verifyTransaction },
): Promise<FinalizeResult> {
  const db = deps?.prismaClient ?? prisma;
  const verify = deps?.verifyTransactionFn ?? verifyTransaction;

  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment) return { ok: false, reason: "not_found" };
  if (payment.status === "success") return { ok: true, alreadyProcessed: true };

  const verification = await verify(reference);
  if (!verification.ok) return { ok: false, reason: "verification_failed" };

  if (verification.status !== "success") {
    await db.payment.update({ where: { reference }, data: { status: "failed" } });
    return { ok: false, reason: "payment_not_successful" };
  }

  // Defensive: the amount actually paid (per Paystack, the source of truth)
  // must match what we initialized the transaction with, in case the
  // request was ever tampered with client-side.
  if (verification.amountKobo !== payment.amount) {
    captureError(new Error("Paystack amount mismatch on verification"), {
      reference,
      expected: payment.amount,
      actual: verification.amountKobo,
    });
    await db.payment.update({ where: { reference }, data: { status: "failed" } });
    return { ok: false, reason: "amount_mismatch" };
  }

  const renewsAt = new Date(Date.now() + PRO_PLAN.durationDays * 24 * 60 * 60 * 1000);

  await db.$transaction([
    db.payment.update({
      where: { reference },
      data: { status: "success", paidAt: new Date() },
    }),
    db.subscription.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        plan: PRO_PLAN.id,
        status: "active",
        renewsAt,
        monthlyUploadLimit: PRO_PLAN.monthlyUploadLimit,
        monthlyProposalLimit: PRO_PLAN.monthlyProposalLimit,
      },
      update: {
        plan: PRO_PLAN.id,
        status: "active",
        renewsAt,
        monthlyUploadLimit: PRO_PLAN.monthlyUploadLimit,
        monthlyProposalLimit: PRO_PLAN.monthlyProposalLimit,
        // A fresh renewsAt means a new billing cycle - clear any reminder
        // sent for the previous one so the next cycle's reminder can fire.
        reminderSentAt: null,
      },
    }),
  ]);

  await logAudit(
    {
      userId: payment.userId,
      action: AUDIT_ACTIONS.paymentSuccess,
      entityType: "Payment",
      entityId: payment.id,
      metadata: { reference, amount: payment.amount, plan: PRO_PLAN.id },
    },
    db,
  );

  return { ok: true, alreadyProcessed: false };
}

// Sends a renewal reminder to every active Pro subscription whose renewsAt
// falls within the reminder window, once per billing cycle - guarded by
// reminderSentAt, which finalizePayment() clears on every successful
// renewal. Meant to be called from a scheduled trigger (see
// /api/cron/billing-reminders), not from anything a user's own request
// would hit, since the whole point is to reach users who haven't visited.
export async function sendRenewalReminders(deps?: {
  prismaClient?: typeof prisma;
  sendEmailFn?: typeof sendEmail;
}) {
  const db = deps?.prismaClient ?? prisma;
  const send = deps?.sendEmailFn ?? sendEmail;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const subscriptions = await db.subscription.findMany({
    where: {
      plan: PRO_PLAN.id,
      status: "active",
      renewsAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
    },
    include: { user: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let sent = 0;

  for (const subscription of subscriptions) {
    const daysRemaining = Math.ceil(
      (subscription.renewsAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    const { subject, text, html } = renewalReminderEmail(daysRemaining, `${baseUrl}/usage`);

    const result = await send({ to: subscription.user.email, subject, text, html });
    if (result.delivered) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { reminderSentAt: now },
      });
      sent += 1;
    }
  }

  return { checked: subscriptions.length, sent };
}
