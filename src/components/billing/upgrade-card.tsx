"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function UpgradeCard({
  priceNgn,
  uploadLimit,
  proposalLimit,
}: {
  priceNgn: number;
  uploadLimit: number;
  proposalLimit: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.authorizationUrl) {
        setError(data.error || "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.authorizationUrl;
    } catch {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Upgrade to Pro
          </CardTitle>
          <CardDescription>
            {uploadLimit} uploads and {proposalLimit} AI generations per month.
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">
            &#8358;{priceNgn.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">per month</p>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        <Button onClick={handleUpgrade} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Upgrade now
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Paid securely via Paystack. Access runs for 30 days from payment.
        </p>
      </CardContent>
    </Card>
  );
}
