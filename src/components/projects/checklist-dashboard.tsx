"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TruncatedText } from "@/components/ui/truncated-text";
import { EditRequirementForm } from "@/components/projects/edit-requirement-form";

type ChecklistRequirement = {
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
  evidenceNeeded?: unknown;
  evidenceMatches?: unknown;
};

const statuses = ["met", "in_progress", "blocked", "waiver"] as const;

export function ChecklistDashboard({
  requirements,
  projectId,
}: {
  requirements: ChecklistRequirement[];
  projectId: string;
}) {
  const [editing, setEditing] = useState<ChecklistRequirement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const metrics = useMemo(() => {
    const total = Math.max(requirements.length, 1);
    return {
      total: requirements.length,
      met: requirements.filter((item) => item.status === "met").length,
      inProgress: requirements.filter((item) => item.status === "in_progress").length,
      blocked: requirements.filter((item) => item.status === "blocked").length,
      waiver: requirements.filter((item) => item.status === "waiver").length,
      coverage: Math.round((requirements.filter((item) => item.status === "met" || item.status === "waiver").length / total) * 100),
    };
  }, [requirements]);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/requirements/${deletingId}`,
        { method: "DELETE" },
      );
      if (response.ok) window.location.reload();
    } finally {
      setIsConfirmOpen(false);
      setDeletingId(null);
    }
  };

  if (!requirements.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Upload a primary tender pack or addendum to generate checklist items from extracted requirements.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="Total" value={metrics.total} />
        <Metric label="Met" value={metrics.met} />
        <Metric label="In progress" value={metrics.inProgress} />
        <Metric label="Blocked" value={metrics.blocked} />
        <Metric label="Waiver" value={metrics.waiver} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Checklist coverage
            <span className="text-sm font-medium text-muted-foreground">{metrics.coverage}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={metrics.coverage} />
        </CardContent>
      </Card>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit checklist item</CardTitle>
          </CardHeader>
          <CardContent>
            <EditRequirementForm requirement={editing} projectId={projectId} onCancel={() => setEditing(null)} />
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {requirements.map((requirement) => (
          <div key={requirement.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusIcon status={requirement.status} />
                  <TruncatedText as="span" text={requirement.title} className="font-medium" />
                  <Badge variant={requirement.priority === "high" ? "warning" : "secondary"}>{requirement.priority}</Badge>
                  <Badge variant="outline">{requirement.category}</Badge>
                  <span className="text-xs text-muted-foreground">{Math.round(requirement.confidence * 100)}% confidence</span>
                </div>
                <TruncatedText
                  as="p"
                  text={requirement.description}
                  lines={3}
                  tooltipMaxChars={500}
                  className="mt-2 text-sm leading-6 text-muted-foreground"
                />
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <TruncatedText
                    as="p"
                    text={`Source: ${requirement.sourceClause || "Tender clause"}`}
                    tooltipMaxChars={400}
                  />
                  <p>Owner: {requirement.owner || "Unassigned"}</p>
                  <p>Evidence needed: {normaliseList(requirement.evidenceNeeded).join(", ") || "Not specified"}</p>
                  <p>Detected evidence: {normaliseEvidence(requirement.evidenceMatches)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {statuses.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={requirement.status === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateStatus(projectId, requirement.id, status)}
                  >
                    {status.replace("_", " ")}
                  </Button>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(requirement)}>
                  <Pencil />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeletingId(requirement.id);
                    setIsConfirmOpen(true);
                  }}
                >
                  <Trash2 />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete requirement"
        description="Are you sure you want to delete this requirement? This action cannot be undone."
        confirmText="Delete"
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "met" || status === "waiver") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "blocked") return <CircleAlert className="size-4 text-destructive" />;
  return <CircleDashed className="size-4 text-amber-600" />;
}

async function updateStatus(projectId: string, requirementId: string, status: string) {
  const response = await fetch(`/api/projects/${projectId}/requirements/${requirementId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (response.ok) window.location.reload();
}

function normaliseList(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

function normaliseEvidence(value: unknown) {
  if (!Array.isArray(value) || !value.length) return "None detected yet";
  return value
    .map((item) => {
      if (item && typeof item === "object" && "fileName" in item) {
        return String((item as { fileName: unknown }).fileName);
      }
      return String(item);
    })
    .join(", ");
}
