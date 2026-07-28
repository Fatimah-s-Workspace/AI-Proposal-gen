import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { finalizePayment } from "@/server/billing";
import { captureError } from "@/lib/monitoring";

export const runtime = "nodejs";

// The authoritative confirmation path: Paystack calls this server-to-server
// once a charge succeeds, independent of whether the user's browser ever
// makes it back to /api/billing/callback (e.g. they close the tab right
// after paying). Must read the raw body for signature verification before
// any JSON parsing.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event !== "charge.success") {
    return Response.json({ received: true });
  }

  const reference = payload.data?.reference;
  if (!reference) {
    return Response.json({ received: true });
  }

  const result = await finalizePayment(reference);
  if (!result.ok && result.reason !== "not_found") {
    captureError(new Error(`Webhook finalizePayment failed: ${result.reason}`), { reference });
  }

  return Response.json({ received: true });
}
