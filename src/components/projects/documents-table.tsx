"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  StickyNote,
  Trash2,
  Star,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/ui/truncated-text";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Document = {
  id: string;
  originalName: string;
  size: number;
  status: string;
  parsingStatus: string | null;
  parsingError: string | null;
  analysisNotice?: string | null;
  parsedAt: Date | null;
  documentType: string;
  isPrimary: boolean;
  version: number;
  parentId?: string | null;
  revisionNotes?: string | null;
  createdAt: Date;
};

type DocumentsTableProps = {
  documents: Document[];
  projectId: string;
  canDelete?: boolean;
  onMarkPrimary?: (documentId: string) => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function DocumentsTable({
  documents,
  projectId,
  canDelete = true,
  onMarkPrimary,
}: DocumentsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(documents.length / pageSize));
  const visibleDocuments = documents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const allVisibleSelected =
    visibleDocuments.length > 0 &&
    visibleDocuments.every((document) => selectedIds.has(document.id));

  const toggleSelected = (documentId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(documentId);
      else next.delete(documentId);
      return next;
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const document of visibleDocuments) {
        if (checked) next.add(document.id);
        else next.delete(document.id);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/documents/${deletingId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        router.refresh();
      } else {
        console.error("Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    } finally {
      setIsConfirmOpen(false);
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setIsBulkDeleting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [...selectedIds] }),
      });

      if (response.ok) {
        setSelectedIds(new Set());
        router.refresh();
      } else {
        console.error("Failed to delete documents");
      }
    } catch (error) {
      console.error("Error deleting documents:", error);
    } finally {
      setIsBulkDeleting(false);
      setIsBulkConfirmOpen(false);
    }
  };

  const handleMarkPrimary = async (documentId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/documents/${documentId}/primary`,
        {
          method: "PATCH",
        },
      );

      if (response.ok) {
        onMarkPrimary?.(documentId);
        router.refresh();
      } else {
        console.error("Failed to mark document as primary");
      }
    } catch (error) {
      console.error("Error marking document as primary:", error);
    }
  };

  const openConfirm = (id: string) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels = {
      tender_pack: "Tender Pack",
      addendum: "Addendum",
      clarification: "Clarification",
      revision: "Revision",
      other: "Other",
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <>
      {canDelete && selectedIds.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-sm">
            {selectedIds.size} document{selectedIds.size !== 1 ? "s" : ""}{" "}
            selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsBulkConfirmOpen(true)}
              aria-label="Delete selected"
            >
              <Trash2 className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete selected</span>
            </Button>
          </div>
        </div>
      )}
      <TooltipProvider>
        <div className="hidden rounded-md border md:block">
          <div className="max-h-[420px] overflow-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-[1] bg-background shadow-sm">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) =>
                        toggleSelectAllVisible(checked as boolean)
                      }
                      aria-label="Select all documents on this page"
                      disabled={!canDelete}
                    />
                  </TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Parsing</TableHead>
                  <TableHead>Parsed at</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDocuments.map((document) => (
                  <TableRow
                    key={document.id}
                    data-state={
                      selectedIds.has(document.id) ? "selected" : undefined
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(document.id)}
                        onCheckedChange={(checked) =>
                          toggleSelected(document.id, checked as boolean)
                        }
                        aria-label={`Select ${document.originalName}`}
                        disabled={!canDelete}
                      />
                    </TableCell>
                    <TableCell className="max-w-64">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-primary" />
                        {document.isPrimary && (
                          <Star className="size-4 shrink-0 text-yellow-500 fill-current" />
                        )}
                        {document.parentId && (
                          <GitBranch className="size-4 shrink-0 text-blue-500" />
                        )}
                        <TruncatedText
                          text={document.originalName}
                          className="min-w-0 flex-1 font-medium"
                        />
                        {document.revisionNotes && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <StickyNote className="size-3.5 shrink-0 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px] break-words">
                              <strong>Revision notes:</strong>{" "}
                              {document.revisionNotes}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(document.size)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getDocumentTypeLabel(document.documentType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">v{document.version}</span>
                      {document.parentId && (
                        <span className="text-xs text-muted-foreground block">
                          Revision
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          document.status === "uploaded"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {document.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          document.parsingStatus === "completed"
                            ? "default"
                            : document.parsingStatus === "failed"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {document.parsingStatus ?? "pending"}
                      </Badge>
                      {document.parsingError ? (
                        <TruncatedText
                          as="p"
                          text={document.parsingError}
                          className="text-xs text-destructive"
                        />
                      ) : null}
                      {/* Amber, not red: the document parsed and is usable,
                          but part of it was not analysed. Showing this in the
                          failure colour would be as misleading as hiding it. */}
                      {document.analysisNotice ? (
                        <TruncatedText
                          as="p"
                          text={document.analysisNotice}
                          className="text-xs text-amber-700 dark:text-amber-400"
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(document.parsedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!document.isPrimary &&
                          document.documentType === "tender_pack" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkPrimary(document.id)}
                                  className="text-yellow-600 hover:text-yellow-700"
                                >
                                  <Star className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Mark as Primary Tender Pack
                              </TooltipContent>
                            </Tooltip>
                          )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openConfirm(document.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1 md:hidden">
          {visibleDocuments.map((document) => (
            <div
              key={document.id}
              className="rounded-xl border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(document.id)}
                      onCheckedChange={(checked) =>
                        toggleSelected(document.id, checked as boolean)
                      }
                      aria-label={`Select ${document.originalName}`}
                      disabled={!canDelete}
                      className="shrink-0"
                    />
                    <FileText className="size-4 text-primary shrink-0" />

                    <TruncatedText
                      text={document.originalName}
                      className="min-w-0 flex-1 font-medium"
                    />

                    {document.isPrimary && (
                      <Star className="size-4 fill-current text-yellow-500 shrink-0" />
                    )}
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBytes(document.size)}
                  </p>
                </div>

                <Badge variant="outline">
                  {getDocumentTypeLabel(document.documentType)}
                </Badge>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Badge
                  variant={
                    document.parsingStatus === "completed"
                      ? "default"
                      : document.parsingStatus === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {document.parsingStatus ?? "pending"}
                </Badge>

                <div className="flex items-center gap-2">
                  {!document.isPrimary &&
                    document.documentType === "tender_pack" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMarkPrimary(document.id)}
                      >
                        <Star className="size-4" />
                      </Button>
                    )}

                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openConfirm(document.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {pageCount > 1 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((page) => Math.min(pageCount, page + 1))
                }
                disabled={currentPage === pageCount}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </TooltipProvider>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
      />
      <ConfirmDialog
        isOpen={isBulkConfirmOpen}
        onClose={() => setIsBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete selected documents"
        description={`Are you sure you want to delete ${selectedIds.size} document${
          selectedIds.size !== 1 ? "s" : ""
        }? This will also remove their parsed sections and requirements. This action cannot be undone.`}
        confirmText={isBulkDeleting ? "Deleting…" : "Delete selected"}
        confirmDisabled={isBulkDeleting}
      />
    </>
  );
}
