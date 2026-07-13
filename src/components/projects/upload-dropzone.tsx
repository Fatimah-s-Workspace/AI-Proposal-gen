"use client";

import { FileUp, Loader2, Plus, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("tender_pack");
  const [isPrimary, setIsPrimary] = useState(false);
  const [parentId] = useState<string>("");
  const [revisionNotes, setRevisionNotes] = useState("");

  async function upload() {
    if (!selectedFiles.length) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("documentType", documentType);
    formData.append("isPrimary", isPrimary.toString());
    if (parentId) formData.append("parentId", parentId);
    if (revisionNotes) formData.append("revisionNotes", revisionNotes);

    const response = await fetch(`/api/projects/${projectId}/documents`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

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
      setError(null);
    }

    setUploading(false);
    setSelectedFiles([]);
    setRevisionNotes("");
    onUploadComplete?.();
    router.refresh();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    setSelectedFiles((prev) => [...prev, ...files]);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    event.target.value = "";
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const canUpload = selectedFiles.length > 0 && !uploading;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3">
            <div
              className={cn(
                "relative rounded-md border border-dashed p-4 transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25",
                selectedFiles.length > 0 && "border-primary/50 bg-primary/5",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />

              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <UploadCloud className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected`
                      : "Drop tender files or click to browse"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, DOCX, or TXT. Max 15MB each.
                  </p>
                </div>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs text-muted-foreground">
                    Selected files
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFiles([])}
                    className="h-7 px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
                <div className="max-h-28 space-y-2 overflow-y-auto pr-1">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <FileUp className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">{file.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="size-7 shrink-0"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="space-y-2">
              <Label htmlFor="document-type" className="text-xs">
                Document type
              </Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger id="document-type" className="h-9">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label
              htmlFor="is-primary"
              className={cn(
                "flex items-start gap-2 rounded-md border bg-background p-2 text-sm",
                selectedFiles.length > 1 && "text-muted-foreground",
              )}
            >
              <Checkbox
                id="is-primary"
                checked={isPrimary}
                onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
                disabled={selectedFiles.length > 1}
                className="mt-0.5"
              />
              <span>
                Mark as primary tender pack
                {selectedFiles.length > 1 && (
                  <span className="block text-xs text-muted-foreground">
                    Available for single-file uploads only.
                  </span>
                )}
              </span>
            </label>

            {(documentType === "addendum" || documentType === "revision") && (
              <div className="space-y-2">
                <Label htmlFor="revision-notes" className="text-xs">
                  Revision notes
                </Label>
                <Textarea
                  id="revision-notes"
                  placeholder="What changed?"
                  value={revisionNotes}
                  onChange={(event) => setRevisionNotes(event.target.value)}
                  rows={2}
                  className="min-h-16"
                />
              </div>
            )}

            <Button onClick={upload} disabled={!canUpload} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  Upload {selectedFiles.length || ""} document
                  {selectedFiles.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
