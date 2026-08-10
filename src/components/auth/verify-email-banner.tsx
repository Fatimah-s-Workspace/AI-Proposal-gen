"use client";

import { Loader2, MailWarning, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Self-fetching, matching the other app-shell components - the layout is a
// client component, so it can't resolve this server-side.
export function VerifyEmailBanner() {
  const [email, setEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/verify-email")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setEmail(data.email ?? null);
        setVerified(Boolean(data.emailVerified));
      })
      .catch(() => {});
  }, []);

  // Defaults to verified so the banner never flashes on for a confirmed
  // account while the status request is still in flight.
  if (verified || dismissed || !email) return null;

  async function resend() {
    setSending(true);
    setResult(null);

    try {
      const response = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResult(payload.error || "Could not send the email. Try again shortly.");
      } else if (payload.emailDelivered === false) {
        // Don't claim it was sent when the provider rejected it - that's
        // what leaves someone waiting on a mail that never arrives.
        setResult("We couldn't send the email right now. Try again in a few minutes.");
      } else {
        setResult(`Confirmation link sent to ${email}.`);
      }
    } catch {
      setResult("Could not reach the server. Check your connection.");
    }
    setSending(false);
  }

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Confirm your email address</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a link to {email}. Confirming it lets you invite teammates.
          </p>
          {result ? <p className="mt-2 text-sm">{result}</p> : null}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={resend}
            disabled={sending}
          >
            {sending ? <Loader2 className="animate-spin" /> : null}
            Resend link
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
