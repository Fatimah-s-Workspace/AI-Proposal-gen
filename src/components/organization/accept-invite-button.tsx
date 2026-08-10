"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/organization/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "Could not accept this invite.");
        setPending(false);
        return;
      }

      // The new membership becomes the active organization, so send them to
      // the dashboard with a full refresh to pick up the new server session.
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not accept this invite. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={accept} disabled={pending} className="w-full" size="lg">
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        Accept invite
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
