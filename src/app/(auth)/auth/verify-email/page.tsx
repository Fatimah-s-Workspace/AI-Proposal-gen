import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmailView } from "@/components/auth/verify-email-view";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-soft sm:p-8">
        <Suspense>
          <VerifyEmailView />
        </Suspense>
      </div>
    </main>
  );
}
