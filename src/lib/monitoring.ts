import * as Sentry from "@sentry/nextjs";

/**
 * Reports an error to Sentry with extra context. Use this in routes that
 * catch their own errors and return a JSON response - Next.js's automatic
 * instrumentation (instrumentation.ts's onRequestError) only captures errors
 * that throw uncaught, so a route that catches an error and returns a 500
 * response needs to report it explicitly or it's invisible in Sentry.
 *
 * A no-op when SENTRY_DSN isn't configured (Sentry.captureException on an
 * uninitialized/disabled client is a safe no-op). Also swallows any error
 * from Sentry itself (e.g. running outside the Next.js runtime, such as in
 * the unit test suite, where @sentry/nextjs isn't fully initialized) -
 * error reporting must never be able to crash the code path it's meant to
 * be safely observing.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Intentionally ignored - see doc comment above.
  }
}
