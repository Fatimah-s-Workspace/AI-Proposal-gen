import * as Sentry from "@sentry/nextjs";

/**
 * Reports an error to Sentry with extra context. Use this in routes that
 * catch their own errors and return a JSON response - Next.js's automatic
 * instrumentation (instrumentation.ts's onRequestError) only captures errors
 * that throw uncaught, so a route that catches an error and returns a 500
 * response needs to report it explicitly or it's invisible in Sentry.
 *
 * A no-op when SENTRY_DSN isn't configured (Sentry.captureException on an
 * uninitialized/disabled client is a safe no-op).
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
