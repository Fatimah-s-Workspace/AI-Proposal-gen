import { prisma } from "@/server/db";
import { forgotPasswordSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmailVerification } from "@/server/email-verification";
import { captureError } from "@/lib/monitoring";
import { authMessages } from "@/lib/messages";
import { serverError } from "@/server/responses";

/**
 * Sends a fresh confirmation link to someone who cannot sign in yet.
 *
 * The signed-in resend endpoint next door cannot serve this case: accounts
 * created after the verification cutoff are refused at sign-in, so the person
 * who most needs a new link is exactly the person who cannot obtain a session
 * to ask for one. Without this route a signup whose email never arrived - and
 * they did not arrive at all while the Brevo endpoint was wrong - is locked
 * out permanently, which is a worse failure than any this gate prevents.
 *
 * Being unauthenticated, it is written to give nothing away:
 *
 * - The response is identical whether or not the address has an account, so
 *   it cannot be used to test which emails are registered.
 * - Mail only ever goes to an address that already signed up and has not yet
 *   confirmed, so it cannot be pointed at a stranger. That is what keeps it
 *   from being an open relay.
 * - Rate limited per address as well as per IP, so it cannot be used to bomb
 *   one person's inbox from many sources.
 */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const byIp = await rateLimit(`verify-request-ip:${ip}`, 5, 60_000);
    if (!byIp.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Enter a valid email", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = parsed.data.email;

    // Identical in every branch below. Built once so a later edit cannot
    // accidentally make one path distinguishable from another.
    const genericResponse = Response.json({
      ok: true,
      message: authMessages.verificationRequested,
    });

    // Keyed on the address and checked before the lookup, so someone cannot
    // repeatedly mail a person they know signed up. Returns the same generic
    // response rather than a 429: a rate-limit reply here would itself
    // confirm the address is worth limiting.
    const byEmail = await rateLimit(`verify-request-email:${email}`, 3, 10 * 60_000);
    if (!byEmail.allowed) return genericResponse;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, emailVerified: true },
    });

    if (!user || user.emailVerified) return genericResponse;

    await sendEmailVerification(user.email);

    return genericResponse;
  } catch (error) {
    console.error("VERIFY EMAIL REQUEST ERROR:", error);
    captureError(error, { route: "auth/verify-email/request" });
    return serverError();
  }
}
