"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { apiErrorMessage, authMessages, genericMessages } from "@/lib/messages";

/**
 * Offers a fresh confirmation link to someone the sign-in gate just turned
 * away.
 *
 * Shown only after that specific failure rather than sitting on the form
 * permanently: an unprompted "resend confirmation" button invites everyone to
 * press it, including the majority who confirmed months ago.
 */
export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setError(await apiErrorMessage(response));
        setState("failed");
        return;
      }

      setState("sent");
    } catch (cause) {
      console.error("Resend verification failed", cause);
      setError(genericMessages.network);
      setState("failed");
    }
  }

  if (state === "sent") {
    return (
      <Feedback tone="success" title="Check your inbox">
        {authMessages.verificationRequested}
      </Feedback>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={send}
        // Without an address there is nothing to send to; the gate always
        // fires after one has been typed, so this is a guard, not a case.
        disabled={state === "sending" || !email}
      >
        {state === "sending" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <MailCheck />
        )}
        Send a new confirmation link
      </Button>
    </div>
  );
}
