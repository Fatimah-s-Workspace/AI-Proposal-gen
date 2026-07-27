import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPageShell({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold">
            TenderFlow AI
          </Link>
          <Link href="/auth/sign-in" className="text-sm font-medium text-primary">
            Sign in
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective {effectiveDate}
        </p>

        <div className="mt-8 space-y-8">{children}</div>
      </article>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <p>TenderFlow AI</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-normal">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
