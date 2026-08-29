/**
 * Who has to confirm their email before they can sign in.
 *
 * Lives apart from auth.ts because that module pulls in NextAuth and cannot
 * be imported by a plain node test - and this is exactly the rule that needs
 * pinning, since getting it wrong locks real people out of real accounts.
 */

/**
 * Accounts created from this moment on must confirm their email. Anything
 * older is let through unverified.
 *
 * The cutoff exists so turning this on does not lock out people already using
 * the app - including any account whose verification email was lost to the
 * Brevo endpoint bug, who would otherwise be shut out of an account they have
 * used for weeks with no way back in.
 *
 * Set EMAIL_VERIFICATION_REQUIRED_AFTER to an ISO date to move it.
 */
type Env = Record<string, string | undefined>;

export function verificationCutoff(env: Env = process.env): Date {
  const configured = env.EMAIL_VERIFICATION_REQUIRED_AFTER;
  if (configured) {
    const parsed = new Date(configured);
    // A typo in the variable must not silently become an Invalid Date, which
    // compares false against everything and would quietly disable the rule.
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return DEFAULT_CUTOFF;
}

const DEFAULT_CUTOFF = new Date("2026-08-28T00:00:00.000Z");

/** Whether this account is new enough to be held to the verification rule. */
export function requiresVerifiedEmail(
  user: { createdAt: Date; emailVerified: Date | null },
  env: Env = process.env,
): boolean {
  if (user.emailVerified) return false;
  return user.createdAt >= verificationCutoff(env);
}
