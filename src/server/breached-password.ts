import { createHash } from "node:crypto";

/**
 * Rejecting passwords that already appear in public breach corpora.
 *
 * This is the check that makes the composition rules worth anything.
 * "P@ssw0rd1" satisfies every rule this app enforces - lower, upper, digit,
 * symbol, eight characters - and appears in breach data millions of times, so
 * it is among the first things any credential-stuffing list tries.
 *
 * Uses the Have I Been Pwned range API, which is free and needs no key. The
 * password never leaves this server: it is hashed with SHA-1, only the first
 * five hex characters of the digest are sent, and the service returns every
 * suffix sharing that prefix - hundreds of them - for us to match locally. It
 * cannot tell which of them we asked about, or whether any matched.
 *
 * SHA-1 here is not protecting anything. It is the digest the API indexes on,
 * and it never touches a stored password; bcrypt does the actual hashing.
 */

const RANGE_URL = "https://api.pwnedpasswords.com/range";
const TIMEOUT_MS = 2500;

export type BreachCheck =
  | { status: "ok" }
  | { status: "breached"; count: number }
  | { status: "unavailable" };

/**
 * @returns "breached" with the sighting count, "ok" if the password is not in
 * the corpus, or "unavailable" if the service could not be reached.
 *
 * Callers should treat "unavailable" as a pass. A signup that fails because a
 * third party is having an outage is a worse outcome than a weak password
 * getting through: the user cannot fix it, cannot understand it, and simply
 * leaves.
 */
/**
 * Whether the breach check should run at all.
 *
 * The integration suite signs up dozens of accounts against a real server, so
 * without this every run makes dozens of live calls to a third party - slow,
 * flaky, and rude. Following the same shape as demoCredentials: the
 * environment check is the one that matters, so setting the variable in
 * production by mistake still leaves the check running. A safety control that
 * can only be switched on, never off.
 */
export function breachCheckEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV === "production") return true;
  return env.DISABLE_BREACH_CHECK !== "1";
}

export async function checkPasswordBreached(
  password: string,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<BreachCheck> {
  // Reported as unavailable rather than ok, so callers take the same
  // fail-open branch they already take during an outage.
  if (!breachCheckEnabled(env)) return { status: "unavailable" };

  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    // Bounded: this sits in the signup path, and a hanging third party must
    // not hold the request open.
    const response = await fetchImpl(`${RANGE_URL}/${prefix}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Asks the API to pad the response with random entries, so the size
        // of the reply cannot be used to narrow down the prefix requested.
        "Add-Padding": "true",
        "User-Agent": "TenderFlow-AI",
      },
    });

    if (!response.ok) return { status: "unavailable" };

    const body = await response.text();

    for (const line of body.split("\n")) {
      const [candidate, rawCount] = line.trim().split(":");
      if (candidate !== suffix) continue;

      const count = Number(rawCount);
      // Padded entries are returned with a count of 0 and are not real hits.
      if (!Number.isFinite(count) || count <= 0) return { status: "ok" };
      return { status: "breached", count };
    }

    return { status: "ok" };
  } catch {
    return { status: "unavailable" };
  }
}

/** The message shown when a password is refused for being in breach data. */
export function breachedPasswordMessage(count: number) {
  return `This password has appeared in ${count.toLocaleString()} known data breaches. Choose a different one.`;
}
