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
- `/usage` - usage tracking

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

## Error Monitoring

Sentry (`@sentry/nextjs`) is wired up via `instrumentation.ts` (server/edge), `instrumentation-client.ts` (browser), and `src/app/global-error.tsx` (root-level React error boundary). Without `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` set, Sentry is explicitly disabled and everything behaves exactly as before - no build or runtime errors.

Next.js's automatic instrumentation only reports errors that throw uncaught. Several routes in this app catch their own errors and return a JSON 500 response instead of throwing, so those call `captureError()` (`src/lib/monitoring.ts`) explicitly in their catch block. Expected degraded-mode operation - like a Gemini call failing and falling back to the local rule-based provider - is deliberately *not* reported as an error, since that's a working fallback, not a failure.

To set up Sentry:

1. Create a free project at [sentry.io](https://sentry.io) (platform: Next.js).
2. Copy the DSN from Settings → Client Keys, and set both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to it.
3. Optional, for readable production stack traces: set `SENTRY_ORG`, `SENTRY_PROJECT`, and an auth token (`SENTRY_AUTH_TOKEN`) so `next build` can upload source maps.

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

Optionally set `GEMINI_API_KEY` to enable AI-backed analysis and drafting (the app falls back to the local rule-based provider without it).

Prepare the database:

```bash
npm run db:push
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
npm run db:push
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
- Rate limiting, Gemini error classification, and small shared utilities

`.github/workflows/ci.yml` runs `typecheck`, `lint`, `test`, and `build` on every push and pull request against `dev`, using dummy environment values (no real database or Gemini key is needed since nothing in the suite touches either).

Not yet covered: API route handlers (auth/ownership wiring, request/response shape) and UI components — these are the natural next layer of test coverage, likely via integration tests against a real test database and/or React component tests.

## Security Notes

- Protected pages call `requireUser()`.
- API routes call `requireApiUser()`.
- Inputs are validated with Zod.
- Upload MIME type and size checks are enforced.
- API actions are rate limited (Upstash Redis in production, in-memory in local dev - see [Rate Limiting](#rate-limiting)).
- Passwords are hashed with `bcryptjs`.
- File uploads and exports use Supabase Storage in production (see [File Storage](#file-storage)).
- Unhandled errors and explicitly-captured failures are reported to Sentry in production (see [Error Monitoring](#error-monitoring)).

Production improvements:

- Add antivirus/malware scanning for uploaded files.
- Add audit logs for generation, edits, exports, and downloads.
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
- Background/async processing for uploads - parsing, Gemini analysis, and checklist generation all happen synchronously in one request, risking a timeout on large tender packs.
- Password reset and transactional email (welcome, verification).
- Usage limit enforcement (limits are displayed but not yet blocked at the API level).
- Terms of Service and Privacy Policy pages.
- Payment integration (e.g. Paystack or Flutterwave) for paid plans.
- Payment/billing integration (e.g. Paystack or Flutterwave for the target market).
- Team workspaces and roles.
- Better export templates with branding, cover pages, headers, footers, and tables.
- Billing/subscription enforcement.
- Background jobs for large document parsing and AI generation.
- More robust error handling and retry flows.
- Human review workflow before final submission.

## Project Value

TenderFlow AI is useful because it reduces the time spent reading tender documents, helps teams avoid missing mandatory requirements, gives proposal writers a structured starting point, and creates a repeatable workflow from tender upload to final export.

It is also a strong AI engineering project because it combines real business workflow design with full-stack implementation, document processing, data modeling, AI-provider architecture, rich editing, and export generation.
