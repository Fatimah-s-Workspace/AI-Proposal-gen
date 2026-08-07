import { withSentryConfig } from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

// script-src needs 'unsafe-eval' in dev for webpack HMR/React Refresh
// (source-mapped hot updates use eval); the production bundle doesn't need
// it. 'unsafe-inline' on both is Next's own hydration bootstrap script -
// removing it requires per-request nonces via middleware, a fuller-strength
// CSP left for a follow-up pass. connect-src allows Sentry's ingest API
// (browser-side error/trace reporting, see instrumentation-client.ts) -
// harmless to include even when SENTRY_DSN is unset, since nothing calls it.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  },
  // Browsers only honor this over HTTPS, so it's a no-op (not a risk) in
  // local dev over plain http://localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  }
];

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
  },
  experimental: {
    // Next 15+ defaults the client Router Cache's dynamic stale time to 0,
    // meaning every dashboard/projects/etc. page refetches from the server
    // even navigating right back with nothing changed. Restoring a short
    // stale window lets recently-visited pages render instantly from cache;
    // pages that mutate data already force a full reload after saving, so
    // this doesn't risk showing stale data after an edit.
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
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
