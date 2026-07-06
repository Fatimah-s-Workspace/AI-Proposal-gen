import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section className="space-y-6">
            <p className="text-sm font-medium text-primary">TenderFlow AI</p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-normal">
              Build compliant tenders, RFPs, and grant proposals with local context.
            </h1>
            <p className="max-w-lg text-muted-foreground">
              Upload the pack, extract what matters, draft the response, and keep every requirement visible until export.
            </p>
          </section>
          <section className="rounded-lg border bg-card p-6 shadow-soft">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-normal">Create account</h2>
              <p className="text-sm text-muted-foreground">Start with mocked AI locally. Paid providers can be added later.</p>
            </div>
            <SignUpForm />
          </section>
        </div>
      </div>
    </main>
  );
}
