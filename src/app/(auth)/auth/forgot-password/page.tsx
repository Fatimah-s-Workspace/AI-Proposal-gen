import { Logo } from "@/components/brand/logo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-svh bg-background">
      <div className="grid min-h-svh lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden border-r bg-slate-950 text-white lg:block">
          <div className="flex h-full flex-col justify-between p-10">
            <Logo tone="onDark" markClassName="size-9" />
            <div className="space-y-6">
              <p className="max-w-md text-4xl font-semibold leading-tight tracking-normal">
                Turn tender packs into compliant proposal drafts without losing the trail of evidence.
              </p>
              <div className="grid max-w-lg grid-cols-3 gap-3 text-sm text-slate-300">
                <div className="border-t border-white/20 pt-3">Requirements</div>
                <div className="border-t border-white/20 pt-3">Clauses</div>
                <div className="border-t border-white/20 pt-3">Exports</div>
              </div>
            </div>
            <p className="text-sm text-slate-400">Built for SMEs, NGOs, consultants, and contractors across Africa.</p>
          </div>
        </section>
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-2">
              <p className="text-sm font-medium text-primary">TenderFlow AI</p>
              <h1 className="text-3xl font-semibold tracking-normal">Forgot password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
            </div>
            <ForgotPasswordForm />
          </div>
        </section>
      </div>
    </main>
  );
}
