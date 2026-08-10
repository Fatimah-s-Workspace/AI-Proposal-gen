import { createHash } from "crypto";
import { prisma } from "@/server/db";
import { verifyEmailSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireApiUser } from "@/server/session";
import { verificationIdentifierFor } from "@/server/email-verification";
import { captureError } from "@/lib/monitoring";

// Read live rather than from the session: emailVerified is stored on the
// JWT nowhere on purpose, since a token minted before confirming would keep
// reporting "unverified" until the user signed out and back in.
export async function GET() {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json({
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
  });
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limit = await rateLimit(`verify-email:${ip}`, 10, 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid verification request" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const identifier = verificationIdentifierFor(email);
    const hashedToken = createHash("sha256").update(parsed.data.token).digest("hex");

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier, token: hashedToken } },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return Response.json(
        { error: "This confirmation link is invalid or has expired. Request a new one." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Shouldn't happen (the token was minted for this address), but don't
      // leave a live token behind if the account is gone.
      await prisma.verificationToken.deleteMany({ where: { identifier } });
      return Response.json({ error: "This confirmation link is no longer valid." }, { status: 400 });
    }

    // Already-confirmed is a success from the user's point of view - they
    // clicked a link to confirm and their address is confirmed.
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      });
    }

    await prisma.verificationToken.deleteMany({ where: { identifier } });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("VERIFY EMAIL ERROR:", error);
    captureError(error, { route: "auth/verify-email" });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
