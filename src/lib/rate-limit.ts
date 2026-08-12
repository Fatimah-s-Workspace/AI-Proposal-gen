import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { captureError } from "@/lib/monitoring";

// In-memory fallback for local dev (no new setup required, matching the
// Gemini/local-fallback and storage/local-fallback patterns used elsewhere).
// On serverless platforms (Vercel), each invocation can run in a fresh
// instance, so this in-memory Map barely persists between requests - it is
// NOT a real rate limit in production. Configure UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN to get an actual, shared, persistent limiter.
type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function rateLimitInMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count)
  };
}

function hasUpstashConfig() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

let redis: Redis | null = null;

function getRedis() {
  if (!hasUpstashConfig()) return null;
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// A Ratelimit instance is bound to a fixed (limit, window) pair, but this
// app calls rateLimit() with many different pairs across routes, so cache
// one instance per pair instead of constructing a new one on every request.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number) {
  const cacheKey = `${limit}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: getRedis()!,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: "tenderflow-ratelimit",
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// Both of these are once-per-process: these paths run on every limited
// request, and a warning repeated a thousand times a minute is noise nobody
// reads rather than a signal anybody acts on.
let warnedMissingConfig = false;
let warnedUpstashFailure = false;

function warnOnce(alreadyWarned: boolean, message: string, context: Record<string, unknown>) {
  if (alreadyWarned) return true;
  console.error(`[rate-limit] ${message}`);
  captureError(new Error(message), { area: "rate-limit", ...context });
  return true;
}

export async function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  if (!hasUpstashConfig()) {
    // The in-memory limiter is a local-dev convenience. On Vercel each
    // invocation can land in a fresh instance, so the Map is usually empty
    // and the limit never actually binds - the sign-in throttle in
    // @/lib/auth included. Silence here means shipping with the protection
    // switched off and no way to notice.
    if (process.env.NODE_ENV === "production") {
      warnedMissingConfig = warnOnce(
        warnedMissingConfig,
        "UPSTASH_REDIS_REST_URL/TOKEN are not set - rate limiting is in-memory and does not work across serverless instances.",
        { degraded: true },
      );
    }
    return rateLimitInMemory(key, limit, windowMs);
  }

  try {
    const result = await getLimiter(limit, windowMs).limit(key);
    return { allowed: result.success, remaining: result.remaining };
  } catch (error) {
    // Upstash being unreachable shouldn't turn every limited route into a
    // 500 - that converts a rate-limiting blip into an outage. Degrade to
    // the in-memory limiter, which is weak but not nothing, and make sure
    // the degradation is visible rather than inferred from a support ticket.
    warnedUpstashFailure = warnOnce(
      warnedUpstashFailure,
      "Upstash rate limiter failed - falling back to the in-memory limiter.",
      { degraded: true, cause: error instanceof Error ? error.message : String(error) },
    );
    return rateLimitInMemory(key, limit, windowMs);
  }
}

export function rateLimitResponse() {
  return Response.json(
    {
      error: "Too many requests. Please wait a moment before trying again."
    },
    { status: 429 }
  );
}
