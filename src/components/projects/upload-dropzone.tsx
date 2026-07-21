"use client";

import { FileUp, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
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
  clauseCount?: number;
  requirementCount?: number;
};

export function UploadDropzone({
  projectId,
  onUploadComplete,
}: UploadDropzoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("tender_pack");
  const [isPrimary, setIsPrimary] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  async function upload() {
    if (!selectedFiles.length) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUploading(true);
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
      setUploading(false);
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
      setUploading(false);
      return;
    }

    const processedDocuments = Array.isArray(result.documents)
      ? (result.documents as UploadResultDocument[])
      : [];
    const totalClauses = processedDocuments.reduce(
      (sum, doc) => sum + (doc.clauseCount || 0),
      0,
    );
    const totalRequirements = processedDocuments.reduce(
      (sum, doc) => sum + (doc.requirementCount || 0),
      0,
    );

    if (totalClauses === 0 && totalRequirements === 0) {
      setError(
        `Documents uploaded but no clauses were extracted. The document may not contain procurement language, or try selecting "Tender Pack" as the document type.`,
      );
    } else {
      setNotice(
        `Processed ${processedDocuments.length} document(s): ${totalClauses} clauses and ${totalRequirements} requirements extracted.`,
      );
    }

    setUploading(false);
    setSelectedFiles([]);
    setRevisionNotes("");
    setIsPrimary(false);
    onUploadComplete?.();
    router.refresh();
  }

  function cancelUpload() {
    abortControllerRef.current?.abort();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
    addFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function addFiles(files: File[]) {
    if (!files.length || uploading) return;
    setNotice(null);
    setSelectedFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index: number) {
    if (uploading) return;
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const hasFiles = selectedFiles.length > 0;
  const canUpload = hasFiles && !uploading;
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
          uploading && "pointer-events-none opacity-60",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={uploading}
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
                <span className="max-w-56 truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </span>
                {!uploading && (
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
              disabled={uploading}
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
                  (selectedFiles.length > 1 || uploading) &&
                    "text-muted-foreground",
                )}
              >
                <Checkbox
                  id="is-primary"
                  checked={isPrimary}
                  onCheckedChange={(checked) =>
                    setIsPrimary(checked as boolean)
                  }
                  disabled={selectedFiles.length > 1 || uploading}
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
                disabled={uploading}
              />
            )}

            {uploading ? (
              <div className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Uploading & analysing…
                </span>
                <Button onClick={cancelUpload} variant="outline" size="sm">
                  <XCircle className="mr-2 size-4" />
                  Stop upload
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
