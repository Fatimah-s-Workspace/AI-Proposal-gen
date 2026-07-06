"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ExportControls({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"docx" | "pdf" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportFile(format: "docx" | "pdf") {
    setPending(format);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Export failed.");
      setPending(null);
      return;
    }

    const payload = await response.json();
    setMessage(`${payload.export.fileName} created successfully.`);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold tracking-normal">Export proposal</h2>
        <p className="mt-1 text-sm text-muted-foreground">Generate DOCX or PDF output from the latest saved proposal sections.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => exportFile("docx")} disabled={Boolean(pending)}>
          {pending === "docx" ? <Loader2 className="animate-spin" /> : <FileText />}
          Export DOCX
        </Button>
        <Button type="button" variant="outline" onClick={() => exportFile("pdf")} disabled={Boolean(pending)}>
          {pending === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
          Export PDF
        </Button>
      </div>
      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
