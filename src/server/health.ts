import { prisma } from "@/server/db";

/**
 * What "is it working?" actually means for this app.
 *
 * Checking that the homepage returns 200 proves almost nothing: Next will
 * happily serve a cached page while the database is unreachable and every
 * signup is failing. These checks exercise the things a user's first minute
 * actually depends on.
 *
 * The distinction between "down" and "degraded" is the useful part. Gemini
 * being unavailable is degraded - the rule-based pipeline still produces a
 * full checklist. The database being unreachable is down. Paging someone at
 * 3am for the first is how people learn to ignore pages.
 */

export type CheckStatus = "ok" | "degraded" | "down";

export type Check = {
  name: string;
  status: CheckStatus;
  detail: string;
};

export type HealthReport = {
  status: CheckStatus;
  checkedAt: string;
  checks: Check[];
};

type Env = Record<string, string | undefined>;

const configured = (value: string | undefined) => Boolean(value?.trim());

/**
 * Whether missing configuration is a real problem.
 *
 * In development almost everything has a local fallback and absence is normal.
 * In production the same absence means uploads vanish on redeploy and
 * verification emails are never sent, so it is reported.
 */
function severityForMissingConfig(env: Env, ifProduction: CheckStatus): CheckStatus {
  return env.NODE_ENV === "production" ? ifProduction : "ok";
}

export async function checkDatabase(db: typeof prisma = prisma): Promise<Check> {
  try {
    // A real round trip. Holding a client object proves nothing about whether
    // the server on the other end is answering.
    await db.$queryRawUnsafe("SELECT 1");
    return { name: "database", status: "ok", detail: "reachable" };
  } catch (error) {
    return {
      name: "database",
      status: "down",
      detail: error instanceof Error ? error.message.slice(0, 200) : "unreachable",
    };
  }
}

export function checkEmail(env: Env = process.env): Check {
  if (configured(env.BREVO_API_KEY)) {
    return { name: "email", status: "ok", detail: "configured" };
  }
  return {
    name: "email",
    // New accounts must confirm by email before they can sign in, so without
    // this signup is not degraded, it is broken.
    status: severityForMissingConfig(env, "down"),
    detail: "BREVO_API_KEY is not set - no email can be delivered",
  };
}

export function checkStorage(env: Env = process.env): Check {
  if (configured(env.SUPABASE_URL) && configured(env.SUPABASE_SERVICE_ROLE_KEY)) {
    return { name: "storage", status: "ok", detail: "configured" };
  }
  return {
    name: "storage",
    // The local-disk fallback works, but serverless filesystems are ephemeral,
    // so uploads silently disappear on the next deploy.
    status: severityForMissingConfig(env, "down"),
    detail: "Supabase is not configured - uploads fall back to ephemeral local disk",
  };
}

export function checkRateLimiting(env: Env = process.env): Check {
  if (configured(env.UPSTASH_REDIS_REST_URL) && configured(env.UPSTASH_REDIS_REST_TOKEN)) {
    return { name: "rate-limiting", status: "ok", detail: "configured" };
  }
  return {
    name: "rate-limiting",
    // The in-memory limiter still runs, but each serverless invocation may get
    // a fresh instance, so the sign-in throttle barely binds. Weakened, not
    // absent.
    status: severityForMissingConfig(env, "degraded"),
    detail: "Upstash is not configured - limits are per-instance and do not bind",
  };
}

export function checkAi(env: Env = process.env): Check {
  if (configured(env.GEMINI_API_KEY)) {
    return { name: "ai", status: "ok", detail: "configured" };
  }
  return {
    name: "ai",
    // Genuinely degraded: the rule-based pipeline produces a complete
    // checklist without it. Worse results, not no results.
    status: severityForMissingConfig(env, "degraded"),
    detail: "GEMINI_API_KEY is not set - analysis falls back to rule-based extraction",
  };
}

export function checkBilling(env: Env = process.env): Check {
  if (configured(env.PAYSTACK_SECRET_KEY)) {
    return { name: "billing", status: "ok", detail: "configured" };
  }
  return {
    name: "billing",
    status: severityForMissingConfig(env, "down"),
    detail: "PAYSTACK_SECRET_KEY is not set - no payment can be taken",
  };
}

/** The worst status wins: one thing being down makes the system down. */
export function worstStatus(checks: Check[]): CheckStatus {
  if (checks.some((check) => check.status === "down")) return "down";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "ok";
}

export async function runHealthChecks(
  env: Env = process.env,
  db: typeof prisma = prisma,
): Promise<HealthReport> {
  const checks = [
    await checkDatabase(db),
    checkEmail(env),
    checkStorage(env),
    checkRateLimiting(env),
    checkAi(env),
    checkBilling(env),
  ];

  return {
    status: worstStatus(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

/** A one-line summary for an alert subject or a log line. */
export function summarise(report: HealthReport) {
  const bad = report.checks.filter((check) => check.status !== "ok");
  if (bad.length === 0) return "All systems healthy";
  return bad.map((check) => `${check.name}: ${check.status}`).join(", ");
}
