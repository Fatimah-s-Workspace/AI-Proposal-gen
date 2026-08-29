/**
 * Password rules, in one place, so signup and reset cannot disagree about
 * what counts as acceptable.
 */

/**
 * The cost factor for every password this app hashes.
 *
 * Shared rather than written at each call site because it also has to match
 * the placeholder hash used for unknown accounts at sign-in: if that one is
 * cheaper, an unknown email resolves measurably faster than a real one and
 * the response time tells an attacker which addresses are registered.
 */
export const BCRYPT_COST = 12;

/**
 * bcrypt hashes at most 72 bytes and silently discards the rest, so two long
 * passwords sharing a 72-byte prefix are the same password as far as sign-in
 * is concerned. Rejecting the input is honest; truncating it quietly is not.
 *
 * Counted in bytes, not characters: one emoji or accented letter can take
 * four bytes, so a 40-character password can exceed the limit.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * Compared against at sign-in when no account matches, purely to burn the
 * same time a real comparison would, so response time does not reveal which
 * addresses are registered.
 *
 * A valid cost-12 hash of a random string, so nobody can sign in with it. It
 * must stay well-formed and cost-matched to BCRYPT_COST: bcrypt rejects a
 * malformed hash immediately without doing the work, and a cheaper one
 * finishes sooner - either way the timing gap reopens. Pinned by tests in
 * password-policy.test.ts.
 */
export const UNKNOWN_ACCOUNT_HASH =
  "$2b$12$6B6n5Ngta1DUxpBYBa9CkOgCVNO0O4hmlY3TBzocFTcDej3k6rmoS";


export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "lower", label: "A lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "upper", label: "An uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "number", label: "A number", test: (v: string) => /\d/.test(v) },
  {
    id: "symbol",
    label: "A symbol",
    // Anything that is not a letter, digit or space. Written as a negated
    // class rather than a list so unusual but legitimate symbols from a
    // password manager are not rejected for being off the list.
    test: (v: string) => /[^A-Za-z0-9\s]/.test(v),
  },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

/** Which rules a candidate password currently satisfies. */
export function checkPasswordRules(value: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(value),
  }));
}

export function passwordByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

/** The first unmet rule, or null when the password satisfies all of them. */
export function firstPasswordProblem(value: string): string | null {
  if (passwordByteLength(value) > MAX_PASSWORD_BYTES) {
    return `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer`;
  }
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : null;
}
