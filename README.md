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
- Prisma ORM
- SQLite for local development and PostgreSQL-compatible schema for production
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
- `/projects/[projectId]/ai-tools` - clause explanation and proposal generation tools
- `/projects/[projectId]/export` - export proposal to DOCX or PDF
- `/usage` - usage tracking

## Where The AI Lives

The current project uses local mocked AI and rule-based tender intelligence. It does not yet call a paid hosted AI model. This makes the app easy to run locally and safe for demos.

Main AI and intelligence files:

- `src/features/ai/mock-provider.ts` - mocked provider functions for extraction, drafting, clause explanation, and compliance analysis.
- `src/features/ai/types.ts` - shared AI data types.
- `src/features/ai/proposal-generation.ts` - prompt templates and mock proposal section generation service.
- `src/features/ai/clause-explanation.ts` - mock clause explanation service.
- `src/features/ai/draft-against-checklist.ts` - maps requirements to proposal sections and reviews coverage.
- `src/features/tender-intelligence/pipeline.ts` - rule-based clause detection, requirement extraction, evidence matching, and compliance scoring.
- `src/features/proposals/tender-proposal.ts` - builds proposal section plans and generates tender-aware draft sections.
- `src/server/tender-proposal.ts` - loads database context, syncs planned sections, and stores generated content.

AI API routes:

- `src/app/api/projects/[projectId]/ai/extract-requirements/route.ts`
- `src/app/api/projects/[projectId]/ai/generate-proposal/route.ts`
- `src/app/api/projects/[projectId]/ai/draft-against-checklist/route.ts`
- `src/app/api/projects/[projectId]/ai/rewrite/route.ts`

## How To Add Proper AI

The cleanest upgrade is to keep the current function contracts and replace the mock provider with a real provider selected by environment variable.

Suggested implementation:

1. Add an environment variable:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key
```

2. Create a real provider file, for example:

```text
src/features/ai/openai-provider.ts
```

3. Implement the same operations currently exposed by `src/features/ai/mock-provider.ts`:

- `extractRequirementsFromTender`
- `explainClauses`
- `generateProposalDraft`
- `analyseCompliance`

4. Add a provider selector in `src/features/ai/index.ts` so the app can switch between `mock` and `openai`.

5. Use structured JSON outputs for requirements, clauses, compliance gaps, evidence needs, and proposal sections.

6. Add prompt logging, retry handling, token limits, safety checks, and model cost tracking before production rollout.

7. Keep human review in the workflow because tender submissions are high-stakes documents.

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

For local SQLite, keep:

```bash
DATABASE_URL="file:./dev.db"
```

Prepare the database:

```bash
npm run db:push:sqlite
npm run db:seed:sqlite
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
npm run build
npm run db:push:sqlite
npm run db:seed:sqlite
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

- Real AI provider integration.
- OCR for scanned PDF tenders.
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
