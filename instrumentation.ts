import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors from Server Components and Route Handlers that throw
// uncaught. Routes that catch their own errors and return a JSON response
// (this app's usual pattern) need an explicit Sentry.captureException call
// instead - see src/lib/monitoring.ts.
export const onRequestError = Sentry.captureRequestError;
