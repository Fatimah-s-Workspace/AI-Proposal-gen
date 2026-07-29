# TenderFlow AI

[![CI](https://github.com/DaviesFatimah/AI-Proposal-gen/actions/workflows/ci.yml/badge.svg)](https://github.com/DaviesFatimah/AI-Proposal-gen/actions/workflows/ci.yml)

TenderFlow AI is a full-stack proposal workspace for teams that respond to tenders, RFPs, grants, EOIs, and RFQs. It helps Nigerian and African SMEs, consultants, NGOs, contractors, and bid teams move from an uploaded tender document to a structured compliance checklist, proposal draft, and export-ready submission.

The project is designed as a practical AI product showcase: it demonstrates authentication, project workspaces, file uploads, document parsing, tender intelligence, AI-style drafting, compliance tracking, rich text editing, usage tracking, and DOCX/PDF export.

## Who Can Use It

- SMEs and contractors preparing public-sector or private-sector bids.
- NGOs and social-impact teams responding to grants or donor RFPs.
- Consultants writing technical and financial proposals.
- Procurement or business-development teams that need a repeatable bid workflow.
- Portfolio reviewers who want to see a realistic AI-assisted business application.

## What The App Does

1. Users sign up or sign in with email and password.
2. Users create a project for a tender, RFP, grant, EOI, or RFQ.
3. Users upload PDF, DOCX, or TXT tender documents.
4. The app extracts text from the document and splits it into tender sections.
5. The tender intelligence pipeline detects clauses, requirements, risks, deadlines, statutory documents, bid security, technical requirements, financial requirements, and evidence needs.
6. The app creates a compliance checklist from the detected requirements.
7. The proposal workspace plans proposal sections from the tender context.
8. Users can generate draft proposal sections and edit them in a rich text editor.
9. Users can review mapped requirements, related clauses, compliance issues, suggestions, and version history.
10. Users export the final proposal to DOCX or PDF.

## Key Features

- Project dashboard with compliance and usage metrics.
- Tender document upload with file validation.
- PDF, DOCX, and TXT text extraction.
- Parsed tender section viewer.
- Clause extraction and plain-English clause explanations.
- Requirement checklist with priority, status, owners, and evidence needs.
- Evidence matching for supporting documents.
- Tender-based proposal section planning.
- AI-style proposal generation and rewriting.
- Rich text proposal editor with autosave.
- Compact editor tools menu for formatting and generation actions.
- Proposal section list in the workspace.
- DOCX and PDF export.
- Export history and download route.
- Local usage tracking for uploads, AI actions, exports, and mock token counts.

## Tech Stack

- Next.js App Router with TypeScript
- React and server components
- Tailwind CSS and shadcn/ui-style components
- Prisma ORM with the pg driver adapter (PostgreSQL required)
- Google Gemini (`@google/genai`) with an automatic rule-based fallback
- Auth.js / NextAuth credentials authentication
- React Hook Form and Zod validation
- React Query for client mutations and autosave
- Tiptap rich text editor
- `pdf-parse` for PDF text extraction
- `mammoth` for DOCX text extraction
- `docx` and `pdfkit` for exports

## Important Routes

- `/` - public landing page
- `/auth/sign-up` - create account
- `/auth/sign-in` - sign in
- `/dashboard` - workspace overview
- `/projects` - list all proposal projects
- `/projects/new` - create a tender/RFP/grant project
- `/projects/[projectId]` - upload documents and review extracted data
- `/projects/[projectId]/parsed-overview` - inspect parsed sections and clauses
- `/projects/[projectId]/workspace` - edit proposal sections and review AI assistant data
- `/projects/[projectId]/export` - export proposal to DOCX or PDF
- `/usage` - usage tracking and Pro plan upgrade
- `/activity` - audit log of generation, edit, export, delete, and payment actions
- `/billing/success` / `/billing/failed` - post-checkout redirect targets
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy

## Where The AI Lives

The app uses Google Gemini for tender intelligence, clause explanation, and proposal drafting, with a local rule-based provider as an automatic fallback. Gemini is enabled by setting `GEMINI_API_KEY`; without a key the app runs fully offline on the rule-based pipeline, which keeps local development and demos free.

Gemini integration files:

- `src/lib/ai/client.ts` - Gemini client setup, model selection, and quota/availability error detection.
- `src/features/ai/gemini-provider.ts` - generic JSON-schema-constrained Gemini call helper with Zod validation.
- `src/features/tender-intelligence/gemini.ts` - tender analysis (sections, clauses, requirements) and clause explanation prompts and schemas.
- `src/server/proposal-generation.ts` - Gemini proposal section drafting with fallback drafting and a full generation audit trail in `ProposalGeneration`.

Rule-based fallback and shared logic:

- `src/features/ai/mock-provider.ts` - deterministic provider functions for extraction, drafting, clause explanation, and compliance analysis.
- `src/features/ai/types.ts` - shared AI data types.
- `src/features/tender-intelligence/pipeline.ts` - rule-based clause detection, requirement extraction, evidence matching, and compliance scoring.
- `src/features/proposals/tender-proposal.ts` - builds proposal section plans and generates tender-aware draft sections.
- `src/server/tender-proposal.ts` - loads database context, syncs planned sections, and stores generated content.

AI API routes:

- `src/app/api/projects/[projectId]/ai/generate-proposal/route.ts`
- `src/app/api/projects/[projectId]/ai/draft-against-checklist/route.ts`
- `src/app/api/projects/[projectId]/ai/rewrite/route.ts`

## Fallback Behavior

The Gemini free tier has request and token quotas, so every Gemini call site degrades gracefully instead of failing the user's request:

- Document upload analysis falls back to the rule-based pipeline in `pipeline.ts`.
- Clause explanation falls back to the local clause explainer.
- Proposal section drafting falls back to a template-based draft when the key is missing, the quota is exhausted (429/RESOURCE_EXHAUSTED), or the model is unavailable (503).

Every proposal generation attempt is recorded in `ProposalGeneration` with the provider (`gemini` or `gemini-fallback`), a `fallbackReason` (`no_api_key`, `quota_or_availability`, or `gemini_error`), and the original error message, so you can always tell which drafts were AI-generated and why a fallback happened. Other Gemini errors (for example an invalid API key or malformed model output) still fail loudly so real configuration bugs are not hidden.

## Document Processing

Uploaded documents are validated by MIME type, size, and content (magic-byte sniffing rejects mislabeled or corrupted files), saved via `src/lib/storage`, then parsed:

- PDF files use `pdf-parse`.
- DOCX files use `mammoth`.
- TXT files are read directly.

Parsed text and sections are stored on `TenderDocument` and `ParsedSection`. Procurement clauses are stored as `TenderClause`. Checklist items are stored as `Requirement`.

Production improvement: add OCR for scanned PDFs, because scanned tenders may not contain machine-readable text.

### Background processing

Saving the file and creating the `TenderDocument` row happens synchronously (the upload API responds as soon as this is done, with `parsingStatus: "processing"`). The slow part - Gemini analysis, then clause/requirement extraction and project-wide dedup (`src/server/document-processing.ts`) - runs afterward via `next/server`'s `after()`, so the request doesn't wait for it and can't time out on a large tender pack or multi-file batch.

The upload UI (`src/components/projects/upload-dropzone.tsx`) polls `GET /api/projects/[projectId]/documents?ids=...` every few seconds until every uploaded document reaches a terminal `parsingStatus` (`completed` or `failed`), then shows the final clause/requirement counts. Processing continues server-side even if the user navigates away or the browser tab closes - polling only affects when the client finds out, not whether the work happens.

The upload route sets `maxDuration = 60` (Vercel Hobby's ceiling) since the deferred work still runs within the same function invocation. If batches are consistently larger, raise this on a paid Vercel plan (up to 300s on Pro) rather than relying on default limits.

## File Storage

`src/lib/storage` saves uploaded tender documents and generated exports to Supabase Storage when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, and falls back to local disk (`UPLOAD_DIR`/`EXPORT_DIR`) otherwise - the same graceful-fallback pattern used for Gemini.

**Local disk storage only works for local development.** Serverless hosts like Vercel have a read-only filesystem outside `/tmp`, and `/tmp` does not persist between requests, so uploads and exports will fail or silently disappear without cloud storage configured.

To set up Supabase Storage:

1. In your Supabase project, go to Project Settings → API and copy the Project URL and the `service_role` secret key (not the `anon` key - this uses the service role because the app authenticates via NextAuth, not Supabase Auth, so there's no user JWT to attach to storage requests).
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your environment (locally in `.env`, or in Vercel's Production environment variables).
3. Run `npm run storage:setup` once to create the required `uploads` and `exports` buckets (both private).

## Rate Limiting

`src/lib/rate-limit.ts` uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, and falls back to an in-memory counter otherwise - the same graceful-fallback pattern used for Gemini and file storage.

**The in-memory fallback only works for local development.** On serverless hosts like Vercel, each invocation can run in a fresh instance, so an in-memory counter barely persists between requests - without Upstash configured, uploads, AI generations, and every other rate-limited action are effectively unlimited in production.

To set up Upstash:

1. Create a free Redis database at [upstash.com](https://upstash.com) (or via the Vercel Marketplace integration).
2. Copy the REST URL and REST token from the database's "REST API" section.
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in your environment.

## Usage Limits

Each `Subscription` row carries `monthlyUploadLimit` and `monthlyProposalLimit` (defaults: 100 uploads, 10 AI generations). `src/server/usage.ts` sums a user's `UsageTracking` rows across all their projects for the current month and enforces these before the four actions that consume quota: document upload, and the three AI generation endpoints (`generate-proposal`, `rewrite`, `draft-against-checklist`). A blocked request gets a `402` with a message to upgrade or wait until next month.

It's a soft cap, not an exact one: the check runs *before* the action, comparing current usage against the limit, rather than trying to predict the action's exact output size (a single proposal-generation call can produce several sections at once, and the count isn't known until after it runs). So a user sitting one generation under their limit can still go slightly over in a single call; the next call is what gets blocked. Exports are tracked in the same `UsageTracking` table but have no limit field or enforcement - they're informational only, matching the existing Usage page UI (no meter is shown for exports).

## Audit Logging

Generation, edit, export, delete, and payment actions are recorded to an `AuditLog` table via `logAudit()` (`src/server/audit.ts`), visible to each user on their own `/activity` page. Logged actions: document upload/delete, requirement update/delete, proposal section edit, the three AI generation endpoints, export creation, and successful payments.

`logAudit()` is best-effort - it catches its own errors so a logging failure can never break the action it's recording - but every call site `await`s it rather than firing it and forgetting. This app deploys to Vercel, where a serverless function can be frozen or torn down right after it returns a response, so a genuinely fire-and-forget write risks silently never happening.

There's no separate `/api/audit-logs` endpoint - the `/activity` page queries `AuditLog` directly server-side (with simple page-based pagination), the same pattern already used by the Dashboard and Usage pages, rather than adding an API layer nothing else needs yet.

## Payments

Users can pay for a Pro plan (higher upload/AI-generation limits, `src/lib/payments/plans.ts`) via [Paystack](https://paystack.com), chosen because it's free to integrate - no monthly fee, only a percentage of real successful transactions - and is the standard choice for the Nigeria/Africa target market. `src/lib/payments/paystack.ts` calls Paystack's REST API directly with `fetch` rather than pulling in their SDK.

The flow:

1. `POST /api/billing/checkout` creates a `Payment` row (status `pending`, with a reference we generate ourselves) and calls Paystack's initialize-transaction endpoint, returning a checkout URL the client redirects to.
2. The user pays on Paystack's hosted page.
3. Paystack redirects the browser back to `GET /api/billing/callback`, **and** independently calls `POST /api/billing/webhook` server-to-server. Both converge on the same `finalizePayment()` (`src/server/billing.ts`), which re-verifies the transaction with Paystack (never trusts the redirect alone), checks the paid amount matches what was initialized, and is idempotent - whichever of the two arrives first applies the upgrade; the other is a no-op. This matters because a user can close their browser right after paying, before the redirect completes, and the webhook is what still finalizes the upgrade in that case.
4. On success, the user's `Subscription` is updated to the Pro plan with a 30-day `renewsAt`.

There's no recurring billing or webhook-driven renewal yet - it's a one-off 30-day payment. Expiry itself is checked lazily: `requireUser`/`requireApiUser` (`src/server/session.ts`) revert an expired Pro subscription back to Starter the next time that user's data is loaded, rather than on a schedule.

Unlike every other external service in this app, payment state is **never** faked in a dev-mode fallback: without `PAYSTACK_SECRET_KEY`, checkout returns a `503` instead of silently granting Pro access, since faking a successful payment carries a real abuse risk that faking an AI response or an email send doesn't.

To set up Paystack:

1. Create a free account at [paystack.com](https://paystack.com).
2. Copy the secret key from Settings → API Keys & Webhooks (use the test key while developing - test-mode transactions don't move real money) and set `PAYSTACK_SECRET_KEY`.
3. Add this app's `/api/billing/webhook` URL as a webhook endpoint in the same settings page.
4. Optionally set `PRO_PLAN_PRICE_NGN` (defaults to 5000) to change the price without a code change.

### Renewal reminders

Since renewal is manual, `sendRenewalReminders()` (`src/server/billing.ts`) emails any active Pro subscription renewing within 3 days, once per billing cycle (guarded by `reminderSentAt`, which `finalizePayment()` clears on every successful renewal so the next cycle's reminder can fire again). It's triggered by `GET /api/cron/billing-reminders`, scheduled daily via `vercel.json`'s `crons` config - Vercel Cron is free on the Hobby tier.

The route is protected by `CRON_SECRET`: set it as a project env var and Vercel automatically sends it back as `Authorization: Bearer <value>` on every cron invocation, which the route checks before doing anything. Without `CRON_SECRET` configured, the route returns `503` rather than running unauthenticated - the same "never silently do the sensitive thing without real configuration" rule as the rest of the payments code.

## Error Monitoring

Sentry (`@sentry/nextjs`) is wired up via `instrumentation.ts` (server/edge), `instrumentation-client.ts` (browser), and `src/app/global-error.tsx` (root-level React error boundary). Without `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` set, Sentry is explicitly disabled and everything behaves exactly as before - no build or runtime errors.

Next.js's automatic instrumentation only reports errors that throw uncaught. Several routes in this app catch their own errors and return a JSON 500 response instead of throwing, so those call `captureError()` (`src/lib/monitoring.ts`) explicitly in their catch block. Expected degraded-mode operation - like a Gemini call failing and falling back to the local rule-based provider - is deliberately *not* reported as an error, since that's a working fallback, not a failure.

To set up Sentry:

1. Create a free project at [sentry.io](https://sentry.io) (platform: Next.js).
2. Copy the DSN from Settings → Client Keys, and set both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to it.
3. Optional, for readable production stack traces: set `SENTRY_ORG`, `SENTRY_PROJECT`, and an auth token (`SENTRY_AUTH_TOKEN`) so `next build` can upload source maps.

## Password Reset & Email

`src/lib/email/index.ts` sends transactional email (password reset, welcome-on-signup) via [Brevo](https://www.brevo.com)'s REST API (plain `fetch`, no SDK dependency) when `BREVO_API_KEY` is set. Without it, `sendEmail()` logs the message to the server console instead - the same graceful-fallback pattern used for Gemini, file storage, rate limiting, and error monitoring, so the signup/reset flows work end-to-end in local dev without a Brevo account.

Brevo was chosen over Resend specifically because it doesn't require owning a domain: Resend needs DNS records (SPF/DKIM) added to a domain you control to send to real recipients, which isn't available on a $0 budget without a paid domain. Brevo's free tier (300 emails/day, no card required) only needs a single verified **sender email address** - no DNS access needed.

Password reset reuses the existing `VerificationToken` table (originally a NextAuth adapter table) rather than adding a new migration:

- `POST /api/auth/forgot-password` always returns the same generic response regardless of whether the email has an account, to prevent email enumeration. If the account exists, it deletes any existing reset tokens for that email, stores a SHA-256 hash of a new random token (so a database leak doesn't expose usable tokens directly), and emails the raw token as a link valid for 1 hour.
- `POST /api/auth/reset-password` hashes the incoming token, looks it up, checks expiry, updates the password, and deletes the token so it can't be reused.
- Pages: `/auth/forgot-password` and `/auth/reset-password`, linked from a "Forgot password?" link on the sign-in page.

To set up Brevo:

1. Create a free account at [brevo.com](https://www.brevo.com) (no credit card required).
2. Go to Settings -> Senders, Domains & Dedicated IPs -> Senders -> Add a sender, using any email address you can receive mail at (e.g. a personal Gmail). Click the verification link Brevo sends to it.
3. Go to Settings -> SMTP & API -> API Keys -> Generate a new API key, and set `BREVO_API_KEY` to it.
4. Set `EMAIL_FROM` to exactly the verified sender's email address (e.g. `TenderFlow AI <you@example.com>`) - Brevo rejects sends from an unverified address.

## Data Model

The Prisma schema lives in `prisma/schema.prisma`.

Core models:

- `User` - authenticated user.
- `Project` - one tender/proposal workspace.
- `TenderDocument` - uploaded tender or supporting evidence file.
- `ParsedSection` - extracted sections from a tender document.
- `TenderClause` - detected procurement clauses.
- `Requirement` - compliance checklist item.
- `ProposalSection` - editable proposal section.
- `GeneratedContent` - generated drafts and version history.
- `ExportHistory` - generated DOCX/PDF files.
- `UsageTracking` - monthly usage counters.
- `Payment` - Paystack checkout/payment records.
- `AuditLog` - generation, edit, export, delete, and payment activity per user.

## Database Migrations

Schema changes go through Prisma Migrate, not `prisma db push`. `db push` is still there for quick local prototyping (trying out a schema change before committing to it), but once a change is worth keeping, generate a real migration:

```bash
npm run db:migrate:dev    # local dev: creates + applies a migration, prompts for a name
npm run db:migrate:deploy # production/CI: applies any pending migrations, no prompts
npm run db:migrate:status # check which migrations are applied where
```

`prisma migrate deploy` is a manual step before deploying schema changes, not wired into `npm run build` - this app has a single production database and no separate staging DB, so auto-running migrations on every build (including preview deployments) would be a real risk rather than a convenience. Run `db:migrate:deploy` against production deliberately, only when a migration is actually ready to ship.

The migration history starts from `20260728130147_init`, a baseline of the schema as it existed at that point - both the local dev and production databases already had this schema applied via `db push` over time, so that migration was marked as already-applied (`prisma migrate resolve --applied`) rather than re-run, which would have failed against tables that already exist. Everything from here on goes through a real migration.

## Quick Start

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env
```

Point `DATABASE_URL` at a running PostgreSQL instance:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tenderflow_ai?schema=public"
```

**Use a local database for day-to-day development, not a remote/hosted one.** Developing against a remote Postgres (e.g. a hosted Supabase project) adds real network round-trip latency to every query - a page that does 3-4 queries can take multiple seconds to load purely from that latency, which looks like a caching or performance bug but isn't one. A local instance turns that into single-digit milliseconds. If port 5432 is already taken by another local Postgres install, run this one on a different port (e.g. 5433) instead of fighting over the port:

```bash
brew install postgresql@16
# if port 5432 is free, skip this and use the default port instead
sed -i '' 's/^#port = 5432/port = 5433/' /opt/homebrew/var/postgresql@16/postgresql.conf
brew services start postgresql@16
psql -h localhost -p 5433 -U "$(whoami)" -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"
psql -h localhost -p 5433 -U "$(whoami)" -d postgres -c "CREATE DATABASE tenderflow_ai OWNER postgres;"
```

Then set `DATABASE_URL="postgresql://postgres:postgres@localhost:5433/tenderflow_ai?schema=public"` (adjust the port to whatever you used).

Optionally set `GEMINI_API_KEY` to enable AI-backed analysis and drafting (the app falls back to the local rule-based provider without it).

Prepare the database:

```bash
npm run db:migrate:dev
npm run db:seed
```

Start the app:

```bash
npm run dev
```

Demo login:

- Email: `demo@tenderflow.ai`
- Password: `password123`

## Useful Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:seed
npm run db:studio
```

## Testing and CI

Tests run on Node's built-in test runner (`node --test`) via `npm test`, covering the pure business logic that has no external dependencies:

- Tender intelligence extraction, clause/requirement deduplication, and checklist scoring (`src/features/tender-intelligence/pipeline.test.ts`)
- Upload validation, including magic-byte sniffing for mislabeled files (`src/features/documents/upload.test.ts`)
- Tender section parsing (`src/features/documents/parser.test.ts`)
- Proposal section planning and compliance scoring (`src/features/proposals/tender-proposal.test.ts`)
- Proposal drafting with Gemini/local fallback (`src/server/proposal-generation.test.ts`)
- Document processing and project-wide clause/requirement dedup (`src/server/document-processing.test.ts`)
- Email templates and the Brevo/dev-console fallback (`src/lib/email/*.test.ts`)
- Paystack webhook signature verification, idempotent payment finalization, and renewal-reminder eligibility (`src/lib/payments/paystack.test.ts`, `src/server/billing.test.ts`)
- Audit log writes and their failure-tolerance (`src/server/audit.test.ts`)
- Rate limiting, usage limit enforcement, Gemini error classification, and small shared utilities

`.github/workflows/ci.yml` runs `typecheck`, `lint`, `test`, and `build` on every push and pull request against `dev`, using dummy environment values (no real database or Gemini key is needed since nothing in the suite touches either).

Not yet covered: API route handlers (auth/ownership wiring, request/response shape) and UI components — these are the natural next layer of test coverage, likely via integration tests against a real test database and/or React component tests.

## Security Notes

- Protected pages call `requireUser()`.
- API routes call `requireApiUser()`.
- Inputs are validated with Zod.
- Upload MIME type and size checks are enforced.
- API actions are rate limited (Upstash Redis in production, in-memory in local dev - see [Rate Limiting](#rate-limiting)).
- Passwords are hashed with `bcryptjs`.
- Password reset tokens are single-use, expire after 1 hour, and are stored as SHA-256 hashes (see [Password Reset & Email](#password-reset--email)). The forgot-password endpoint responds identically whether or not an account exists, to prevent email enumeration.
- File uploads and exports use Supabase Storage in production (see [File Storage](#file-storage)).
- Unhandled errors and explicitly-captured failures are reported to Sentry in production (see [Error Monitoring](#error-monitoring)).
- Generation, edit, export, delete, and payment actions are recorded per-user (see [Audit Logging](#audit-logging)).

Production improvements:

- Add antivirus/malware scanning for uploaded files.
- Add role-based access for teams.

## Exporting

Exports are generated via `src/lib/storage` (Supabase Storage in production, local disk in development).

- DOCX export uses `docx`.
- PDF export uses `pdfkit`.
- Export metadata is stored in `ExportHistory`.
- Downloads are served through `src/app/api/exports/[exportId]/download/route.ts`.

## Challenges Solved While Building

- Turning unstructured tender documents into useful structured data.
- Handling different document types and text extraction paths.
- Mapping tender clauses to requirements and proposal sections.
- Keeping generated proposal content traceable to source requirements.
- Building a rich proposal editor with autosave and version history.
- Keeping the workspace usable by moving editor tools into a compact dropdown.
- Making long local proposal section lists scroll independently.
- Tracking usage without a paid billing system.
- Supporting local development without requiring paid AI APIs.

## Production Readiness

This project is not fully production-ready yet.

Before rolling out to real users, i will complete:

- OCR for scanned PDF tenders.
- Prompt/cost observability, retries, and token budgeting for Gemini calls.
- Automated tests for API route handlers and UI components (pure business logic is covered; see [Testing and CI](#testing-and-ci)).
- A real job queue (e.g. Upstash QStash) if upload volume grows enough that background processing via `after()` within a single function invocation isn't sufficient - see [Background processing](#background-processing).
- Team workspaces and roles.
- Better export templates with branding, cover pages, headers, footers, and tables.
- Background jobs for large document parsing and AI generation.
- More robust error handling and retry flows.
- Human review workflow before final submission.

## Project Value

TenderFlow AI is useful because it reduces the time spent reading tender documents, helps teams avoid missing mandatory requirements, gives proposal writers a structured starting point, and creates a repeatable workflow from tender upload to final export.

It is also a strong AI engineering project because it combines real business workflow design with full-stack implementation, document processing, data modeling, AI-provider architecture, rich editing, and export generation.
