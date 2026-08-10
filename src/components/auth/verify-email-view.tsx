"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "checking" | "verified" | "failed";

function FailureState({ message }: { message: string | null }) {
  return (
    <>
      <div className="flex size-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-normal">
        Couldn&apos;t confirm your email
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Sign in and use the banner at the top of the app to send yourself a fresh link.
      </p>
      <Button asChild variant="outline" className="mt-6 w-full">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </>
  );
}

export function VerifyEmailView() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  // React Strict Mode runs effects twice in development; the token is
  // single-use, so the second run would report a bogus failure.
  const attempted = useRef(false);

  const token = searchParams.get("token");
  const email = searchParams.get("email");
  // Derived during render rather than set from the effect - whether the
  // link carries both params is knowable without doing any work.
  const linkIsComplete = Boolean(token && email);

  useEffect(() => {
    if (!linkIsComplete) return;
    if (attempted.current) return;
    attempted.current = true;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setStatus("failed");
          setError(payload.error || "Could not confirm your email address.");
          return;
        }
        setStatus("verified");
      })
      .catch(() => {
        setStatus("failed");
        setError("Could not reach the server. Check your connection and try the link again.");
      });
  }, [linkIsComplete, token, email]);

  if (!linkIsComplete) {
    return (
      <FailureState message="This confirmation link is incomplete. Use the link from your email." />
    );
  }

  if (status === "checking") {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Confirming your email address…
      </div>
    );
  }

  if (status === "verified") {
    return (
      <>
        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CheckCircle2 className="size-5" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal">Email confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks - your address is confirmed and your account is fully set up.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </>
    );
  }

  return <FailureState message={error} />;
}
