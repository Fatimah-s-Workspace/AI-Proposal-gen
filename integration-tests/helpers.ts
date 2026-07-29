import "dotenv/config";
import { randomUUID, randomBytes, createHash } from "crypto";
import { prisma } from "@/server/db";

export const BASE_URL = process.env.INTEGRATION_BASE_URL ?? "http://localhost:3100";

function cookieHeaderFrom(setCookies: string[]) {
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.test`;
}

// The signup route rate-limits by x-forwarded-for, falling back to a fixed
// "local" bucket when the header is absent - which plain server-side fetch()
// calls never set. Without a distinct fake IP per call, every signup in
// this suite would share one bucket and trip the real production rate
// limit (8/60s) partway through the suite, exactly as many different real
// users signing up never would.
function fakeClientIp() {
  return `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
}

export async function signUp(input: {
  name: string;
  companyName: string;
  email: string;
  password: string;
  country?: string;
}) {
  return fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": fakeClientIp() },
    body: JSON.stringify({ country: "Nigeria", ...input }),
  });
}

// NextAuth v4's credentials flow requires a CSRF token minted by GET
// /api/auth/csrf (tied to a cookie from that same response), then both the
// token and that cookie are sent back with the credentials POST. The
// resulting session cookie is what makes subsequent requests authenticated.
export async function signIn(email: string, password: string): Promise<string> {
  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfCookies = csrfResponse.headers.getSetCookie();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const signInResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeaderFrom(csrfCookies),
    },
    body: new URLSearchParams({ email, password, csrfToken, json: "true" }),
    redirect: "manual",
  });

  const sessionCookies = signInResponse.headers.getSetCookie();
  return cookieHeaderFrom([...csrfCookies, ...sessionCookies]);
}

export async function signUpAndSignIn(overrides?: Partial<{ name: string; companyName: string; password: string }>) {
  const email = uniqueEmail("integration");
  const password = overrides?.password ?? "password123";

  const signUpResponse = await signUp({
    name: overrides?.name ?? "Integration Test",
    companyName: overrides?.companyName ?? "Integration Test Co",
    email,
    password,
  });

  if (!signUpResponse.ok) {
    throw new Error(`signUpAndSignIn: signup failed with ${signUpResponse.status}`);
  }

  const cookie = await signIn(email, password);
  return { email, password, cookie };
}

// Mirrors exactly what POST /api/auth/forgot-password does internally, so
// tests can get a usable raw reset token without needing to intercept a
// real email - the raw token is only ever handed to the user via the email
// link, never stored (only its SHA-256 hash is), so there's no other way
// to obtain one for testing.
export async function createPasswordResetToken(email: string) {
  const identifier = `password-reset:${email.toLowerCase()}`;
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashedToken, expires: new Date(Date.now() + 60 * 60 * 1000) },
  });

  return rawToken;
}

export async function cleanupUser(email: string) {
  await prisma.user.deleteMany({ where: { email: email.toLowerCase() } });
}
