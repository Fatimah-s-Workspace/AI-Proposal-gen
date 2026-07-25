import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

export async function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  if (hasUpstashConfig()) {
    const result = await getLimiter(limit, windowMs).limit(key);
    return { allowed: result.success, remaining: result.remaining };
  }

  return rateLimitInMemory(key, limit, windowMs);
}

export function rateLimitResponse() {
  return Response.json(
    {
      error: "Too many requests. Please wait a moment before trying again."
    },
    { status: 429 }
  );
}
