"use client";

import { useState } from "react";
import { CheckCircle2, Edit2, Trash2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditRequirementForm } from "@/components/projects/edit-requirement-form";

type Requirement = {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
  sourceClause: string | null;
  priority: string;
  status: string;
  owner: string | null;
  reviewNotes?: string | null;
};

type ExtractedRequirementsTableProps = {
  requirements: Requirement[];
  projectId: string;
  onEdit?: (requirement: Requirement) => void;
  onStatusChange?: (requirementId: string, newStatus: string) => void;
};

const statusOptions = ["met", "in_progress", "blocked", "waiver"];
const priorityColors = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

const statusIcons = {
  met: CheckCircle2,
  in_progress: Clock,
  blocked: AlertCircle,
  waiver: CheckCircle2,
};

export function ExtractedRequirementsTable({
  requirements,
  projectId,
  onEdit,
  onStatusChange,
}: ExtractedRequirementsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] =
    useState<Requirement | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/requirements/${deletingId}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        window.location.reload();
      } else {
        console.error("Failed to delete requirement");
      }
    } catch (error) {
      console.error("Error deleting requirement:", error);
    } finally {
      setIsConfirmOpen(false);
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (
    requirementId: string,
    newStatus: string,
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/requirements/${requirementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (response.ok) {
        onStatusChange?.(requirementId, newStatus);
        window.location.reload();
      } else {
        console.error("Failed to update requirement status");
      }
    } catch (error) {
      console.error("Error updating requirement:", error);
    }
  };

  return (
    <>
      {editingRequirement ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Edit requirement</CardTitle>
          </CardHeader>
          <CardContent>
            <EditRequirementForm
              requirement={editingRequirement}
              projectId={projectId}
              onCancel={() => setEditingRequirement(null)}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Requirement</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requirements.map((req) => {
              const StatusIcon =
                statusIcons[req.status as keyof typeof statusIcons];
              return (
                <TableRow key={req.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{req.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {req.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{req.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        priorityColors[
                          req.priority as keyof typeof priorityColors
                        ] || "secondary"
                      }
                    >
                      {req.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${req.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {Math.round(req.confidence * 100)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {StatusIcon && (
                        <StatusIcon className="size-4 text-muted-foreground" />
                      )}
                      <select
                        value={req.status}
                        onChange={(e) =>
                          handleStatusChange(req.id, e.target.value)
                        }
                        className="text-xs border rounded px-2 py-1"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() +
                              status.slice(1).replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {req.sourceClause ? (
                      <span className="line-clamp-1">{req.sourceClause}</span>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onEdit ? onEdit(req) : setEditingRequirement(req)
                        }
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(req.id);
                          setIsConfirmOpen(true);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {requirements.map((req) => {
          const StatusIcon =
            statusIcons[req.status as keyof typeof statusIcons];
          return (
            <div key={req.id} className="rounded-lg border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-6">{req.title}</p>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {req.description}
                  </p>
                </div>
                <Badge
                  variant={
                    priorityColors[
                      req.priority as keyof typeof priorityColors
                    ] || "secondary"
                  }
                >
                  {req.priority}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{req.category}</Badge>
                <Badge variant="secondary">
                  {Math.round(req.confidence * 100)}% confidence
                </Badge>
                <Badge variant="outline" className="gap-1">
                  {StatusIcon ? <StatusIcon className="size-3" /> : null}
                  {req.status.replace("_", " ")}
                </Badge>
              </div>

              {req.sourceClause ? (
                <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                  Source: {req.sourceClause}
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <select
                  value={req.status}
                  onChange={(e) => handleStatusChange(req.id, e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() +
                        status.slice(1).replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onEdit ? onEdit(req) : setEditingRequirement(req)
                  }
                >
                  <Edit2 className="size-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="col-span-2 text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeletingId(req.id);
                    setIsConfirmOpen(true);
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete requirement
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Requirement"
        description="Are you sure you want to delete this requirement? This action cannot be undone."
        confirmText="Delete"
      />
    </>
  );
}
