import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "mammoth",
    "pdfkit",
    "bcryptjs",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
    "better-sqlite3",
    "pg"
  ],
  typedRoutes: true,
  turbopack: {
    root: process.cwd()
  }
};

// Safe to apply unconditionally: without SENTRY_AUTH_TOKEN/ORG/PROJECT set,
// this just skips the source-map upload step (silent: true suppresses the
// warning noise in CI/local builds where Sentry isn't configured).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: false
});
