import { requireApiUser } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmailVerification } from "@/server/email-verification";
import { captureError } from "@/lib/monitoring";
import { unauthorized, serverError } from "@/server/responses";

// Signed-in only, so this resends to the address on the current account
// rather than taking one from the request body - that would turn this into
// an open relay for sending mail to arbitrary addresses.
export async function POST() {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    if (user.emailVerified) {
      return Response.json({ ok: true, alreadyVerified: true });
    }

    const limit = await rateLimit(`verify-resend:${user.id}`, 3, 10 * 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const delivery = await sendEmailVerification(user.email);

    return Response.json({
      ok: true,
      emailDelivered: delivery.delivered,
      emailFailureReason: delivery.delivered ? null : delivery.reason,
    });
  } catch (error) {
    console.error("RESEND VERIFICATION ERROR:", error);
    captureError(error, { route: "auth/verify-email/resend" });
    return serverError();
  }
}
