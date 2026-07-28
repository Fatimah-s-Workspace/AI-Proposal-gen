import { prisma } from "@/server/db";
import { captureError } from "@/lib/monitoring";
import { verifyTransaction } from "@/lib/payments/paystack";
import { PRO_PLAN } from "@/lib/payments/plans";

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
      },
    }),
  ]);

  return { ok: true, alreadyProcessed: false };
}
