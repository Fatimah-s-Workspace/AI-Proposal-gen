/**
 * What the app says when something goes right, goes wrong, or needs care.
 *
 * Collected here rather than written at each call site so the voice stays
 * consistent, and so the rules below are applied once instead of being
 * re-decided every time someone adds a message.
 *
 * The rules:
 *
 * 1. Never leak internals. Stack traces, database constraint names and
 *    provider error codes go to the logs, never to a person. "CredentialsSignin"
 *    is not a sentence.
 * 2. Never confirm whether an account exists. Sign-in, password reset and
 *    signup all have to read the same whether or not the address is
 *    registered, or the form becomes a membership oracle.
 * 3. Say what happened and what to do next. "Invalid input" tells someone
 *    they failed without telling them how to succeed.
 * 4. Don't blame the reader. "You entered it wrong" and anything with an
 *    exclamation mark reads as scolding; a plain statement does not.
 * 5. Don't over-apologise either. One clear sentence beats "We're so sorry,
 *    something went terribly wrong."
 */

/* ------------------------------------------------------------------ auth ---
   The security-sensitive surface, where wording is not only tone but the
   difference between disclosing an account and not. */

export const authMessages = {
  /**
   * Deliberately identical for "no such account" and "wrong password". The
   * two must be indistinguishable, or the form tells an attacker which
   * addresses are worth attacking.
   */
  invalidCredentials:
    "That email and password combination doesn't match an account. Check them and try again.",

  tooManyAttempts:
    "Too many sign-in attempts. Please wait a minute and try again.",

  emailNotVerified:
    "Confirm your email address before signing in. Check your inbox for the link, or send yourself a new one.",

  /**
   * Sent whether or not the address has an account, for the same reason as
   * invalidCredentials. Phrased so it is not a lie in either case.
   */
  resetLinkSent:
    "If that address has an account, a reset link is on its way. It's valid for one hour.",

  resetLinkInvalid:
    "This reset link is invalid or has expired. Request a new one and we'll send a fresh link.",

  verificationLinkInvalid:
    "This confirmation link is no longer valid. Request a new one from your account settings.",

  verificationSent: "Confirmation email sent. Check your inbox.",

  /**
   * Sent whether or not the address has an unconfirmed account, for the same
   * reason as resetLinkSent. True in either case.
   */
  verificationRequested:
    "If that address has an account waiting to be confirmed, a new link is on its way.",

  passwordUpdated: "Password updated. You can sign in with it now.",

  /**
   * Shown after any signup attempt, including one for an address that already
   * has an account - signup cannot distinguish the two out loud without
   * becoming a membership oracle. True either way: one address gets a
   * confirmation link, the other gets a notice that it is already registered.
   */
  signupSubmitted:
    "Check your inbox. We've sent an email to that address with what to do next.",

  signedOut: "You've been signed out.",
} as const;

/* ---------------------------------------------------------------- generic ---
   Fallbacks. Specific beats generic every time, but a vague message that
   stays calm beats a stack trace. */

export const genericMessages = {
  unexpected: "Something went wrong on our side. Please try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
  rateLimited: "That's a lot of requests in a short time. Please wait a moment and try again.",
  notFound: "We couldn't find that. It may have been deleted, or the link may be out of date.",
  forbidden: "You don't have access to this. Ask a workspace owner or admin if you need it.",
  sessionExpired: "Your session has expired. Sign in again to continue.",
  unsavedChanges: "You have unsaved changes. Save or discard them before leaving.",
} as const;

/**
 * NextAuth reports credential failures as a short machine code, and the
 * sign-in form was rendering that code straight to the user - people were
 * being shown the literal text "CredentialsSignin".
 *
 * Codes NextAuth generates are mapped here; anything it throws from
 * `authorize` arrives as the thrown message and is passed through, which is
 * how the throttle and verification notices reach the user intact.
 */
const NEXT_AUTH_CODES: Record<string, string> = {
  CredentialsSignin: authMessages.invalidCredentials,
  SessionRequired: genericMessages.sessionExpired,
  AccessDenied: genericMessages.forbidden,
  Configuration: genericMessages.unexpected,
  Verification: authMessages.verificationLinkInvalid,
  Default: genericMessages.unexpected,
};

/** Turns whatever NextAuth handed back into something worth reading. */
export function signInErrorMessage(raw: string | null | undefined): string {
  if (!raw) return authMessages.invalidCredentials;
  if (NEXT_AUTH_CODES[raw]) return NEXT_AUTH_CODES[raw];

  // A message thrown from authorize() comes through verbatim. Anything that
  // still looks like a bare code - one CamelCase word, no spaces - is not
  // something to show a person.
  if (/^[A-Za-z]+$/.test(raw)) return genericMessages.unexpected;
  return raw;
}

/**
 * Pulls a usable message out of a failed fetch.
 *
 * Prefers the API's own wording, since routes phrase their own failures best,
 * and falls back rather than surfacing whatever a proxy or crash produced.
 */
export async function apiErrorMessage(
  response: Response,
  fallback: string = genericMessages.unexpected,
): Promise<string> {
  if (response.status === 429) return genericMessages.rateLimited;
  if (response.status === 403) return genericMessages.forbidden;
  if (response.status === 404) return genericMessages.notFound;
  if (response.status === 401) return genericMessages.sessionExpired;

  try {
    const body = await response.json();
    const message = body?.error ?? body?.message;
    return typeof message === "string" && message.trim() ? message : fallback;
  } catch {
    // Not JSON: an HTML error page from a proxy, or an empty body.
    return fallback;
  }
}
