# TenderFlow AI

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

Uploaded documents are validated by MIME type and size, saved locally under `UPLOAD_DIR`, then parsed:

- PDF files use `pdf-parse`.
- DOCX files use `mammoth`.
- TXT files are read directly.

Parsed text and sections are stored on `TenderDocument` and `ParsedSection`. Procurement clauses are stored as `TenderClause`. Checklist items are stored as `Requirement`.

Production improvement: add OCR for scanned PDFs, because scanned tenders may not contain machine-readable text.

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

## Security Notes

- Protected pages call `requireUser()`.
- API routes call `requireApiUser()`.
- Inputs are validated with Zod.
- Upload MIME type and size checks are enforced.
- API actions include local rate limiting.
- Passwords are hashed with `bcryptjs`.

Production improvements:

- Replace local file storage with S3, Cloudflare R2, Supabase Storage, or another object store.
- Replace in-memory rate limiting with Redis or another persistent limiter.
- Add antivirus/malware scanning for uploaded files.
- Add audit logs for generation, edits, exports, and downloads.
- Add role-based access for teams.

## Exporting

Exports are generated locally into `EXPORT_DIR`.

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
- Automated tests for parsing, extraction, API permissions, and exports.
- Cloud file storage.
- Persistent rate limiting.
- Team workspaces and roles.
- Better export templates with branding, cover pages, headers, footers, and tables.
- Billing/subscription enforcement.
- Background jobs for large document parsing and AI generation.
- More robust error handling and retry flows.
- Human review workflow before final submission.

## Project Value

TenderFlow AI is useful because it reduces the time spent reading tender documents, helps teams avoid missing mandatory requirements, gives proposal writers a structured starting point, and creates a repeatable workflow from tender upload to final export.

It is also a strong AI engineering project because it combines real business workflow design with full-stack implementation, document processing, data modeling, AI-provider architecture, rich editing, and export generation.
