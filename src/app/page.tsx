import {
  ArrowRight,
  Building2,
  FileCheck2,
  FileOutput,
  FileSearch,
  FolderKanban,
  HandHeart,
  Handshake,
  LibraryBig,
  ListChecks,
  ScrollText,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: FileSearch,
    title: "Tender intelligence",
    description:
      "Upload a tender pack and get parsed sections, detected clauses, deadlines, and statutory requirements in minutes.",
  },
  {
    icon: ListChecks,
    title: "Compliance checklist",
    description:
      "Every mandatory requirement becomes a tracked checklist item with priority, owner, status, and evidence needs.",
  },
  {
    icon: ScrollText,
    title: "Plain-English clauses",
    description:
      "Procurement clauses are explained in practical business English with the risk level and the action you must take.",
  },
  {
    icon: Sparkles,
    title: "AI proposal drafting",
    description:
      "Generate tender-aware draft sections mapped to requirements, then refine them in a rich editor with autosave and version history.",
  },
  {
    icon: LibraryBig,
    title: "Evidence matching",
    description:
      "Upload CAC certificates, tax clearance, and references — TenderFlow matches them to the requirements they satisfy.",
  },
  {
    icon: FileOutput,
    title: "Export-ready output",
    description:
      "Export the assembled proposal to DOCX or PDF with a full export history for every submission.",
  },
];

const steps = [
  {
    title: "Create a project",
    description:
      "Capture the opportunity: buyer, sector, deadline, and opportunity type — tender, RFP, grant, EOI, or RFQ.",
  },
  {
    title: "Upload the tender pack",
    description:
      "PDF, DOCX, or TXT. The intelligence pipeline extracts sections, clauses, and requirements automatically.",
  },
  {
    title: "Review the checklist",
    description:
      "Work through requirements, read clause explanations, attach evidence, and watch the compliance score climb.",
  },
  {
    title: "Draft and export",
    description:
      "Generate draft sections, edit with full version history, and export a submission-ready DOCX or PDF.",
  },
];

const audiences = [
  {
    icon: Building2,
    title: "SMEs & contractors",
    description: "Public and private sector bids without a dedicated bid team.",
  },
  {
    icon: HandHeart,
    title: "NGOs & impact teams",
    description: "Grant applications and donor RFPs with strict compliance.",
  },
  {
    icon: Handshake,
    title: "Consultants",
    description: "Technical and financial proposals, delivered faster.",
  },
  {
    icon: FolderKanban,
    title: "BD & procurement teams",
    description: "A repeatable workflow from tender receipt to submission.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-svh bg-background">
      <section className="border-b bg-slate-950 text-white">
        <div className="mx-auto flex min-h-[78svh] max-w-7xl flex-col justify-between px-6 py-8">
          <nav className="flex items-center justify-between">
            <div className="text-lg font-semibold">TenderFlow AI</div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
              <Button
                asChild
                className="bg-white text-slate-950 hover:bg-white/90"
              >
                <Link href="/auth/sign-up">Start</Link>
              </Button>
            </div>
          </nav>
          <div className="grid gap-10 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div className="space-y-7">
              <p className="text-sm font-medium text-emerald-300">
                Nigeria and Africa procurement workspace
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-normal md:text-7xl">
                TenderFlow AI
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-300">
                Upload tender, RFP, or grant documents and turn them into
                requirements, clause notes, proposal drafts, and export-ready
                submissions.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground"
              >
                <Link href="/auth/sign-in">
                  Open workspace
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="grid gap-3 md:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-3 rounded-md bg-white p-4 text-slate-950">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FolderKanban className="size-4 text-primary" />
                    Active opportunity
                  </div>
                  <div>
                    <p className="text-xl font-semibold tracking-normal">
                      Solar mini-grid grant
                    </p>
                    <p className="text-sm text-slate-500">
                      Federal programme, Nigeria
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-t pt-3">
                      <span>Compliance</span>
                      <span className="font-semibold">72%</span>
                    </div>
                    <div className="flex justify-between border-t pt-3">
                      <span>Requirements</span>
                      <span className="font-semibold">18</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-md bg-slate-900 p-4">
                  <div className="flex items-center gap-2 text-sm text-emerald-300">
                    <Sparkles className="size-4" />
                    AI draft
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-4/5 rounded bg-white/80" />
                    <div className="h-3 w-full rounded bg-white/50" />
                    <div className="h-3 w-11/12 rounded bg-white/50" />
                    <div className="h-3 w-3/5 rounded bg-white/50" />
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-white/10 p-3 text-sm text-slate-200">
                    <FileCheck2 className="size-4 text-amber-300" />
                    CAC, tax, bid validity, and submission rules extracted.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">
              Everything a bid team needs
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
              From tender pack to submission, in one workspace
            </h2>
            <p className="mt-3 text-muted-foreground">
              TenderFlow AI keeps the trail of evidence intact: every draft
              paragraph traces back to the requirement and clause that demanded
              it.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border bg-card p-6 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
              Four steps to a compliant proposal
            </h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="relative rounded-lg border bg-card p-6 shadow-sm"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-medium text-primary">Who it is for</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
                Built for teams that answer tenders without a big bid office
              </h2>
              <p className="mt-3 text-muted-foreground">
                Whether you respond to one tender a quarter or ten a month,
                TenderFlow AI gives you the same structured workflow: nothing
                mandatory gets missed, and every submission starts from a
                stronger draft.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/auth/sign-up">
                    <UploadCloud className="size-4" />
                    Upload your first tender
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/sign-in">Sign in</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {audiences.map((audience) => (
                <div
                  key={audience.title}
                  className="rounded-lg border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <audience.icon className="size-4" />
                    </div>
                    <h3 className="font-semibold">{audience.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {audience.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row">
          <p className="font-medium text-foreground">TenderFlow AI</p>
          <p>
            Built for SMEs, NGOs, consultants, and contractors across Africa.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/auth/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
