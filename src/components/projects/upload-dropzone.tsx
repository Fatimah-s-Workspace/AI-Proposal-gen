"use client";

import { FileUp, Loader2, UploadCloud, X, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

    // Show processing results
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
      setError(null); // Clear any previous error
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
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Document Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="document-type">Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-primary"
                checked={isPrimary}
                onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
                disabled={selectedFiles.length > 1}
              />
              <Label
                htmlFor="is-primary"
                className={cn(
                  selectedFiles.length > 1 && "text-muted-foreground",
                )}
              >
                Mark as Primary Tender Pack
                {selectedFiles.length > 1 && " (disabled for multiple files)"}
              </Label>
            </div>
          </div>

          {/* Revision Options */}
          {(documentType === "addendum" || documentType === "revision") && (
            <div className="space-y-2">
              <Label htmlFor="revision-notes">Revision Notes (Optional)</Label>
              <Textarea
                id="revision-notes"
                placeholder="Describe what changed in this revision..."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* File Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg p-6 transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25",
              selectedFiles.length > 0 && "border-primary/50 bg-primary/5",
            )}
            onDragOver={(e) => {
              e.preventDefault();
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
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="text-center">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : "Drop PDF or DOCX files here, or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PDF, DOCX, and TXT • Max 15MB each
                </p>
              </div>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <FileUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(1)}MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={upload}
            disabled={!canUpload}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading {selectedFiles.length} file(s)...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Upload {selectedFiles.length || ""} Document
                {selectedFiles.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// return (
//   <div
//     onDragOver={(event) => {
//       event.preventDefault();
//       setDragging(true);
//     }}
//     onDragLeave={() => setDragging(false)}
//     onDrop={handleDrop}
//     className={cn(
//       "rounded-lg border border-dashed bg-card p-6 transition-colors",
//       dragging && "border-primary bg-primary/5",
//     )}
//   >
//     <input
//       ref={inputRef}
//       type="file"
//       className="hidden"
//       accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
//       onChange={handleFileChange}
//     />
//     <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
//       <div className="flex gap-4">
//         <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
//           <UploadCloud className="size-6" />
//         </div>
//         <div>
//           <h2 className="font-semibold tracking-normal">
//             Upload tender pack
//           </h2>
//           <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
//             PDF and DOCX files are extracted locally, parsed into sections,
//             then analysed with mocked AI services.
//           </p>
//           {error ? (
//             <p className="mt-2 text-sm text-destructive">{error}</p>
//           ) : null}
//         </div>
//       </div>
//       <Button
//         type="button"
//         onClick={() => inputRef.current?.click()}
//         disabled={uploading}
//       >
//         {uploading ? <Loader2 className="animate-spin" /> : <FileUp />}
//         {uploading ? "Processing" : "Choose file"}
//       </Button>
//     </div>
//   </div>
// );
