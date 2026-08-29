import { randomBytes, createHash } from "crypto";
import { prisma } from "@/server/db";
import { forgotPasswordSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail } from "@/lib/email/templates";
import { captureError } from "@/lib/monitoring";
import { serverError } from "@/server/responses";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function identifierFor(email: string) {
  return `password-reset:${email}`;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limit = await rateLimit(`forgot-password:${ip}`, 5, 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Enter a valid email", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();

    // Always respond with the same generic message so this endpoint can't be
    // used to enumerate which emails have accounts.
    const genericResponse = Response.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.hashedPassword) {
      return genericResponse;
    }

    const identifier = identifierFor(email);
    await prisma.verificationToken.deleteMany({ where: { identifier } });

    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");

    await prisma.verificationToken.create({
      data: {
        identifier,
        token: hashedToken,
        expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    const { subject, text, html } = resetPasswordEmail(resetUrl);
    await sendEmail({ to: email, subject, text, html });

    return genericResponse;
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    captureError(error, { route: "auth/forgot-password" });
    return serverError();
  }
}
