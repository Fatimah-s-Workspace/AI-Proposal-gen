"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Requirement = {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceClause?: string | null;
  priority: string;
  status: string;
  owner?: string | null;
};

const statuses = ["met", "in_progress", "blocked", "waiver"] as const;

export function RequirementChecklist({ requirements }: { requirements: Requirement[] }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(() => new Map(requirements.map((req) => [req.id, req.status])));
  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/requirements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error("Could not update requirement");
      return response.json();
    },
    onSuccess: () => router.refresh()
  });

  function updateStatus(id: string, status: string) {
    setOptimistic((current) => new Map(current).set(id, status));
    mutation.mutate({ id, status });
  }

  if (!requirements.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="font-medium">No requirements extracted yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Upload a PDF or DOCX tender document to populate the checklist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requirements.map((requirement) => {
        const status = optimistic.get(requirement.id) ?? requirement.status;
        return (
          <div key={requirement.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusIcon status={status} />
                  <h3 className="font-medium tracking-normal">{requirement.title}</h3>
                  <Badge variant={requirement.priority === "high" ? "warning" : "secondary"}>{requirement.priority}</Badge>
                  <Badge variant="outline">{requirement.category}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{requirement.description}</p>
                {requirement.sourceClause ? (
                  <p className="mt-2 text-xs text-muted-foreground">Source: {requirement.sourceClause}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {statuses.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={status === option ? "default" : "outline"}
                    size="sm"
                    className="capitalize"
                    onClick={() => updateStatus(requirement.id, option)}
                  >
                    {option.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "met") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "blocked") return <CircleAlert className="size-4 text-destructive" />;
  return <CircleDashed className={cn("size-4", status === "in_progress" ? "text-amber-600" : "text-muted-foreground")} />;
}
