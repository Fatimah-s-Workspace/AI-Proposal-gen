import { randomUUID } from "crypto";
import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { canManageBilling } from "@/server/permissions";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { hasPaystackKey, initializeTransaction } from "@/lib/payments/paystack";
import { PRO_PLAN } from "@/lib/payments/plans";
import { captureError } from "@/lib/monitoring";
import { unauthorized } from "@/server/responses";

export async function POST() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  // The subscription covers the whole organization, so anyone who could
  // start a checkout would be committing the org's money - keep that with
  // the owner rather than every member.
  if (!canManageBilling(user.organizationRole)) {
    return Response.json(
      { error: "Only the organization owner can manage billing" },
      { status: 403 },
    );
  }

  const limit = await rateLimit(`billing:checkout:${user.id}`, 5, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  if (!hasPaystackKey()) {
    return Response.json(
      { error: "Payments aren't configured yet. Try again shortly or contact support." },
      { status: 503 },
    );
  }

  if (user.subscription?.plan === PRO_PLAN.id) {
    return Response.json({ error: "You're already on the Pro plan." }, { status: 400 });
  }

  const reference = `tf_${randomUUID()}`;
  const amountKobo = PRO_PLAN.priceNgn * 100;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await prisma.payment.create({
    data: {
      organizationId: user.organizationId,
      initiatedByUserId: user.id,
      reference,
      amount: amountKobo,
      currency: "NGN",
      plan: PRO_PLAN.id,
      status: "pending",
    },
  });

  const result = await initializeTransaction({
    email: user.email,
    amountKobo,
    reference,
    callbackUrl: `${baseUrl}/api/billing/callback`,
    metadata: { userId: user.id, plan: PRO_PLAN.id },
  });

  if (!result.ok) {
    await prisma.payment.update({ where: { reference }, data: { status: "failed" } });
    captureError(new Error(`Paystack checkout initialization failed: ${result.reason}`), {
      userId: user.id,
      reference,
    });
    return Response.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }

  return Response.json({ authorizationUrl: result.authorizationUrl });
}
