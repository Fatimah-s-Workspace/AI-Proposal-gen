"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  Star,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Document = {
  id: string;
  originalName: string;
  size: number;
  status: string;
  parsingStatus: string | null;
  parsingError: string | null;
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
  onMarkPrimary,
}: DocumentsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(documents.length / pageSize));
  const visibleDocuments = documents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

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
        // Refresh the page or update state
        window.location.reload();
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
        window.location.reload();
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
      <TooltipProvider>
        <div className="hidden md:block overflow-x-auto rounded-md border">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
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
                <TableRow key={document.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      {document.isPrimary && (
                        <Star className="size-4 text-yellow-500 fill-current" />
                      )}
                      {document.parentId && (
                        <GitBranch className="size-4 text-blue-500" />
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium line-clamp-1 break-words">
                            {document.originalName}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px] break-words">
                          {document.originalName}
                          {document.revisionNotes && (
                            <div className="mt-2 text-xs">
                              <strong>Revision notes:</strong>{" "}
                              {document.revisionNotes}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
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
                        document.status === "uploaded" ? "secondary" : "outline"
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-destructive line-clamp-1">
                            {document.parsingError}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px] break-words">
                          {document.parsingError}
                        </TooltipContent>
                      </Tooltip>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openConfirm(document.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-3 md:hidden">
          {visibleDocuments.map((document) => (
            <div
              key={document.id}
              className="rounded-xl border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary shrink-0" />

                    <p className="truncate font-medium">
                      {document.originalName}
                    </p>

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

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openConfirm(document.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
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
    </>
  );
}
