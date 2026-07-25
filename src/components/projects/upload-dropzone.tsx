"use client";

import { FileUp, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TruncatedText } from "@/components/ui/truncated-text";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  projectId: string;
  onUploadComplete?: () => void;
}

const documentTypes = [
  { value: "tender_pack", label: "Tender Pack" },
  { value: "addendum", label: "Addendum" },
  { value: "clarification", label: "Clarification" },
  { value: "revision", label: "Revision" },
  { value: "supporting_evidence", label: "Supporting Evidence" },
  { value: "other", label: "Other" },
];

type UploadResultDocument = {
  id: string;
  originalName: string;
};

type StatusDocument = {
  id: string;
  originalName: string;
  parsingStatus: string;
  parsingError: string | null;
  clauseCount: number;
  requirementCount: number;
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // ~2 minutes

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function UploadDropzone({
  projectId,
  onUploadComplete,
}: UploadDropzoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopPollingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("tender_pack");
  const [isPrimary, setIsPrimary] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  useEffect(() => {
    return () => {
      stopPollingRef.current = true;
    };
  }, []);

  async function upload() {
    if (!selectedFiles.length) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    stopPollingRef.current = false;
    setPhase("uploading");
    setError(null);
    setNotice(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("documentType", documentType);
    formData.append("isPrimary", isPrimary.toString());
    if (revisionNotes) formData.append("revisionNotes", revisionNotes);

    let response: Response;
    try {
      response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchError) {
      abortControllerRef.current = null;
      setPhase("idle");
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        setNotice("Upload cancelled. Your selected files were kept.");
      } else {
        setError("Upload failed. Check your connection and try again.");
      }
      return;
    }

    const result = await response.json();
    abortControllerRef.current = null;

    if (!response.ok) {
      setError(result.error || "Upload failed.");
      setPhase("idle");
      return;
    }

    const uploadedDocuments = Array.isArray(result.documents)
      ? (result.documents as UploadResultDocument[])
      : [];

    setSelectedFiles([]);
    setRevisionNotes("");
    setIsPrimary(false);
    onUploadComplete?.();
    router.refresh();

    if (!result.processing || !uploadedDocuments.length) {
      setNotice(`Uploaded ${uploadedDocuments.length} document(s).`);
      setPhase("idle");
      return;
    }

    setPhase("processing");
    setNotice(
      `Uploaded ${uploadedDocuments.length} document(s) - analysing in the background…`,
    );
    await pollUntilDone(uploadedDocuments.map((document) => document.id));
  }

  async function pollUntilDone(documentIds: string[]) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      await sleep(POLL_INTERVAL_MS);
      if (stopPollingRef.current) return;

      let statusResponse: Response;
      try {
        statusResponse = await fetch(
          `/api/projects/${projectId}/documents?ids=${documentIds.join(",")}`,
        );
      } catch {
        continue; // transient network hiccup - just try again next tick
      }
      if (stopPollingRef.current) return;
      if (!statusResponse.ok) continue;

      const data = (await statusResponse.json()) as { documents?: StatusDocument[] };
      const documents = data.documents ?? [];
      const stillProcessing = documents.some((doc) => doc.parsingStatus === "processing");

      if (!stillProcessing) {
        finalizeNotice(documents);
        setPhase("idle");
        router.refresh();
        return;
      }
    }

    setNotice(
      "Still analysing in the background. This is taking longer than usual - refresh the page shortly to see the results.",
    );
    setPhase("idle");
    router.refresh();
  }

  function finalizeNotice(documents: StatusDocument[]) {
    const failed = documents.filter((doc) => doc.parsingStatus === "failed");
    const totalClauses = documents.reduce((sum, doc) => sum + doc.clauseCount, 0);
    const totalRequirements = documents.reduce(
      (sum, doc) => sum + doc.requirementCount,
      0,
    );

    if (failed.length) {
      setError(
        `${failed.length} document(s) failed to process: ${failed
          .map((doc) => doc.originalName)
          .join(", ")}. ${failed[0].parsingError ?? ""}`.trim(),
      );
      return;
    }

    if (totalClauses === 0 && totalRequirements === 0) {
      setNotice(
        `Processed ${documents.length} document(s), but no new clauses or requirements were found — they may already exist in this project, or try selecting "Tender Pack" as the document type.`,
      );
      return;
    }

    setNotice(
      `Processed ${documents.length} document(s): ${totalClauses} clauses and ${totalRequirements} requirements added.`,
    );
  }

  function cancelUpload() {
    if (phase === "uploading") {
      abortControllerRef.current?.abort();
      return;
    }
    // Processing already runs server-side regardless of this client; there's
    // nothing to cancel, just stop watching for it.
    stopPollingRef.current = true;
    setPhase("idle");
    setNotice("Still analysing in the background - refresh the page later to see the results.");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (phase !== "idle") return;
    addFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function addFiles(files: File[]) {
    if (!files.length || phase !== "idle") return;
    setNotice(null);
    setSelectedFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index: number) {
    if (phase !== "idle") return;
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const busy = phase !== "idle";
  const hasFiles = selectedFiles.length > 0;
  const canUpload = hasFiles && !busy;
  const needsRevisionNotes =
    documentType === "addendum" || documentType === "revision";

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          hasFiles && "border-primary/50",
          busy && "pointer-events-none opacity-60",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={busy}
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleFileChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Upload tender documents"
        />
        <UploadCloud className="size-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">
            {hasFiles
              ? `${selectedFiles.length} file(s) ready`
              : "Drop tender files or click to browse"}
          </span>
          <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
            PDF, DOCX, TXT · max 15MB each
          </span>
        </p>
      </div>

      {hasFiles && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted py-1 pl-2 pr-1 text-xs"
              >
                <FileUp className="size-3 shrink-0 text-muted-foreground" />
                <TruncatedText text={file.name} className="max-w-56" />
                <span className="shrink-0 text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </span>
                {!busy && (
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="rounded p-0.5 hover:bg-background"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Select
              value={documentType}
              onValueChange={setDocumentType}
              disabled={busy}
            >
              <SelectTrigger
                className="h-8 w-44 text-xs"
                aria-label="Document type"
              >
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {documentType === "tender_pack" && (
              <Label
                htmlFor="is-primary"
                className={cn(
                  "flex cursor-pointer items-center gap-2 text-xs font-normal",
                  (selectedFiles.length > 1 || busy) && "text-muted-foreground",
                )}
              >
                <Checkbox
                  id="is-primary"
                  checked={isPrimary}
                  onCheckedChange={(checked) =>
                    setIsPrimary(checked as boolean)
                  }
                  disabled={selectedFiles.length > 1 || busy}
                />
                Primary tender pack
              </Label>
            )}

            {needsRevisionNotes && (
              <Input
                value={revisionNotes}
                onChange={(event) => setRevisionNotes(event.target.value)}
                placeholder="What changed?"
                className="h-8 w-52 text-xs"
                aria-label="Revision notes"
                disabled={busy}
              />
            )}

            {busy ? (
              <div className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {phase === "uploading" ? "Uploading…" : "Analysing…"}
                </span>
                <Button onClick={cancelUpload} variant="outline" size="sm">
                  <XCircle className="mr-2 size-4" />
                  {phase === "uploading" ? "Stop upload" : "Stop watching"}
                </Button>
              </div>
            ) : (
              <Button
                onClick={upload}
                disabled={!canUpload}
                size="sm"
                className="ml-auto"
              >
                Upload {selectedFiles.length} document
                {selectedFiles.length !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          {notice}
        </div>
      )}
    </div>
  );
}
