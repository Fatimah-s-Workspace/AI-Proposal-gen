"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const updateRequirementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.enum(["mandatory", "technical", "financial", "submission", "legal", "experience", "optional"]),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["met", "in_progress", "blocked", "waiver"]),
  sourceClause: z.string().optional(),
  owner: z.string().optional(),
  reviewNotes: z.string().optional(),
});

type FormInput = z.input<typeof updateRequirementSchema>;
type FormValues = z.output<typeof updateRequirementSchema>;

interface EditRequirementFormProps {
  requirement: {
    id: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    status?: string;
    sourceClause: string | null;
    owner: string | null;
    reviewNotes?: string | null;
  };
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditRequirementForm({ requirement, projectId, onSuccess, onCancel }: EditRequirementFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(updateRequirementSchema),
    defaultValues: {
      title: requirement.title,
      description: requirement.description,
      category: requirement.category as FormInput["category"],
      priority: requirement.priority as FormInput["priority"],
      status: (requirement.status as FormInput["status"]) || "in_progress",
      sourceClause: requirement.sourceClause || "",
      owner: requirement.owner || "",
      reviewNotes: requirement.reviewNotes || "",
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/requirements/${requirement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Could not update requirement.");
        return;
      }

      // Refresh the server-rendered list, then let the parent close the
      // modal - the old full reload was doing both implicitly.
      router.refresh();
      onSuccess?.();
    } catch {
      setError("An error occurred while updating the requirement.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Requirement title</Label>
        <Input id="title" placeholder="e.g., Proof of registration" {...form.register("title")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" placeholder="Detailed requirement text" {...form.register("description")} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select id="category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("category")}>
            <option value="mandatory">Mandatory</option>
            <option value="technical">Technical</option>
            <option value="financial">Financial</option>
            <option value="submission">Submission</option>
            <option value="legal">Legal</option>
            <option value="experience">Experience</option>
            <option value="optional">Optional</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("priority")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("status")}>
            <option value="met">Met</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="waiver">Waiver</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceClause">Source clause</Label>
        <Input id="sourceClause" placeholder="Clause text or section reference" {...form.register("sourceClause")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="owner">Owner</Label>
        <Input id="owner" placeholder="Assigned team member" {...form.register("owner")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reviewNotes">Review notes</Label>
        <Textarea id="reviewNotes" placeholder="Evidence gap, waiver rationale, or reviewer note" {...form.register("reviewNotes")} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
