import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Explicitly disabled rather than left to infer from a missing DSN, so
  // intent is obvious to anyone reading this file.
  enabled: Boolean(process.env.SENTRY_DSN?.trim()),
  tracesSampleRate: 0.1,
});
