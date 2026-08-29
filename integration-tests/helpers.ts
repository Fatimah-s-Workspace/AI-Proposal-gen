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
/**
 * Attempts a sign-in and reports what came back, without judging it.
 *
 * For the tests that are *about* sign-in being refused - a rotated password,
 * an account whose hash was cleared, an unconfirmed address. `signIn` below
 * is the one to use everywhere else.
 */
export async function attemptSignIn(
  email: string,
  password: string,
): Promise<{ cookies: string; signedIn: boolean }> {
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
  const cookies = cookieHeaderFrom([...csrfCookies, ...sessionCookies]);

  // Matched on the suffix: NextAuth prefixes the cookie with "__Secure-" over
  // https, so pinning the plain name would pass locally and fail the moment
  // these run against a deployed origin.
  return { cookies, signedIn: cookies.includes("session-token") };
}

/**
 * Signs in, and fails loudly if it did not work.
 *
 * NextAuth answers a refused sign-in with a redirect and no session cookie.
 * The helper used to hand that back regardless, so a refusal surfaced much
 * later as a 401 from whatever the test did next - when the email
 * verification gate landed, one root cause appeared as 43 unrelated-looking
 * failures, none of which mentioned sign-in.
 */
export async function signIn(email: string, password: string): Promise<string> {
  const { cookies, signedIn } = await attemptSignIn(email, password);
  if (!signedIn) {
    throw new Error(`signIn: no session cookie was set for ${email}`);
  }
  return cookies;
}

// Signup deliberately leaves an account unverified, and inviting teammates
// is gated on a confirmed address. Tests that exercise inviting need to get
// past that gate without going through a real email round-trip.
export async function markEmailVerified(email: string) {
  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { emailVerified: new Date() },
  });
}

/**
 * Clears a confirmed address again.
 *
 * signUpAndSignIn has to confirm the address to obtain a session at all, so
 * tests about the unverified state get there by signing in first and then
 * undoing it. The session survives because it is a JWT minted at sign-in;
 * routes that care read emailVerified live from the database, which is the
 * behaviour under test.
 */
export async function unverifyEmail(email: string) {
  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { emailVerified: null },
  });
}

export async function signUpAndSignIn(overrides?: Partial<{ name: string; companyName: string; password: string }>) {
  const email = uniqueEmail("integration");
  const password = overrides?.password ?? "Integration!Pass1";

  const signUpResponse = await signUp({
    name: overrides?.name ?? "Integration Test",
    companyName: overrides?.companyName ?? "Integration Test Co",
    email,
    password,
  });

  if (!signUpResponse.ok) {
    const detail = await signUpResponse.text().catch(() => "");
    throw new Error(
      `signUpAndSignIn: signup failed with ${signUpResponse.status} ${detail}`,
    );
  }

  // Accounts created now fall after the verification cutoff, so they cannot
  // sign in until the address is confirmed. Standing in for the click on the
  // emailed link, which is the one step of the real flow a test cannot make.
  await markEmailVerified(email);

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

// Same reasoning as createPasswordResetToken: the raw invite token only
// ever reaches the user through the emailed link (the DB stores its SHA-256
// hash), so a test can't read one back out of an invite created through the
// real API. This mirrors what POST /api/organization/invites does so tests
// can exercise the accept flow with a usable raw token.
export async function createInviteToken(input: {
  organizationId: string;
  email: string;
  invitedByUserId: string;
  role?: string;
  expiresAt?: Date;
}) {
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  await prisma.organizationInvite.create({
    data: {
      organizationId: input.organizationId,
      email: input.email.toLowerCase(),
      role: input.role ?? "member",
      token: hashedToken,
      invitedByUserId: input.invitedByUserId,
      expires: input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return rawToken;
}

export async function getOrganizationFor(email: string) {
  const membership = await prisma.membership.findFirst({
    where: { user: { email: email.toLowerCase() } },
    orderBy: { createdAt: "desc" },
    include: { organization: true, user: true },
  });
  if (!membership) throw new Error(`getOrganizationFor: no membership for ${email}`);
  return {
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    userId: membership.userId,
    role: membership.role,
  };
}

export async function cleanupUser(email: string) {
  // Deleting the User cascades to their Memberships but leaves behind the
  // Organizations they owned (an Organization has no userId), so collect
  // them first and remove any that end up with no members.
  const normalized = email.toLowerCase();
  const orgIds = (
    await prisma.membership.findMany({
      where: { user: { email: normalized } },
      select: { organizationId: true },
    })
  ).map((membership) => membership.organizationId);

  await prisma.user.deleteMany({ where: { email: normalized } });

  for (const organizationId of orgIds) {
    const remaining = await prisma.membership.count({ where: { organizationId } });
    if (remaining === 0) {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
  }
}
