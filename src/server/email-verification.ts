import { randomBytes, createHash } from "crypto";
import { prisma } from "@/server/db";
import { sendEmail } from "@/lib/email";
import { verifyEmailEmail } from "@/lib/email/templates";

// Longer than the 1-hour password-reset window: this arrives during signup
// and people routinely confirm the next morning, whereas a reset is
// something you asked for and act on immediately.
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function verificationIdentifierFor(email: string) {
  return `email-verify:${email.toLowerCase()}`;
}

// Same shape as the password-reset flow: a random token goes out in the
// emailed link and only its SHA-256 hash is stored, so a database leak
// can't be replayed into confirmed addresses.
export async function createEmailVerificationToken(email: string) {
  const identifier = verificationIdentifierFor(email);

  // One live token per address - re-sending invalidates the previous link.
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashedToken,
      expires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

export function verificationUrlFor(email: string, rawToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;
}

// Returns the delivery result so callers can tell the user when the mail
// didn't actually go out, rather than claiming it did.
export async function sendEmailVerification(email: string) {
  const rawToken = await createEmailVerificationToken(email);
  const { subject, text, html } = verifyEmailEmail(verificationUrlFor(email, rawToken));
  return sendEmail({ to: email, subject, text, html });
}
