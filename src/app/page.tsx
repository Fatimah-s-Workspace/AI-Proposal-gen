import { ArrowRight, FileCheck2, FolderKanban, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
                    Mock AI draft
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
    </main>
  );
}
