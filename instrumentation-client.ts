import * as Sentry from "@sentry/nextjs";

// Client-side DSN is intentionally NEXT_PUBLIC_ (bundled into browser JS).
// A Sentry DSN is not a secret - it can only be used to submit events, not
// read them - so this is safe to expose the same way analytics keys are.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()),
  tracesSampleRate: 0.1,
});

// Required so Sentry can trace client-side route transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
