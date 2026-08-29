import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/server/db";
import { resetPasswordSchema } from "@/lib/validations";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { captureError } from "@/lib/monitoring";
import {
  checkPasswordBreached,
  breachedPasswordMessage,
} from "@/server/breached-password";

function identifierFor(email: string) {
  return `password-reset:${email}`;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limit = await rateLimit(`reset-password:${ip}`, 8, 60_000);
    if (!limit.allowed) return rateLimitResponse();

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid reset request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = parsed.data.email;

    // A reset is the moment an account is most likely to be handed a password
    // the user has reused elsewhere, so it gets the same check as signup.
    const breach = await checkPasswordBreached(parsed.data.password);
    if (breach.status === "breached") {
      return Response.json(
        { error: breachedPasswordMessage(breach.count) },
        { status: 400 },
      );
    }

    const identifier = identifierFor(email);
    const hashedToken = createHash("sha256").update(parsed.data.token).digest("hex");

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier, token: hashedToken } },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return Response.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const hashedPassword = await hash(parsed.data.password, 12);

    await prisma.user.update({
      where: { email },
      data: { hashedPassword },
    });

    await prisma.verificationToken.deleteMany({ where: { identifier } });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    captureError(error, { route: "auth/reset-password" });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
