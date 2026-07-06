"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Loader2, Save } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProjectSchema } from "@/lib/validations";
import { useApp } from "@/providers/app-provider";

type FormInput = z.input<typeof createProjectSchema>;
type FormValues = z.output<typeof createProjectSchema>;
const opportunityTypes = ["Tender", "RFP", "Grant", "EOI", "RFQ"] as const;

interface EditProjectFormProps {
  project: {
    id: string;
    title: string;
    clientName: string;
    opportunityType: string;
    sector: string;
    country: string;
    authority: string | null;
    deadline: string | null;
    budgetRange: string;
    summary: string;
  };
}

export function EditProjectForm({ project }: EditProjectFormProps) {
  const router = useRouter();
  const { refreshProjects } = useApp();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: project.title,
      clientName: project.clientName,
      opportunityType: opportunityTypes.includes(
        project.opportunityType as (typeof opportunityTypes)[number],
      )
        ? (project.opportunityType as FormInput["opportunityType"])
        : "Tender",
      sector: project.sector,
      country: project.country,
      authority: project.authority ?? "",
      deadline: project.deadline
        ? new Date(project.deadline).toISOString().split("T")[0]
        : "",
      budgetRange: project.budgetRange,
      summary: project.summary,
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Could not update project.");
      return;
    }

    await refreshProjects(); // Refresh the projects list in the sidebar
    router.push(`/projects/${project.id}` as Route);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Project title</Label>
          <Input
            id="title"
            placeholder="Lagos health supply RFP"
            {...form.register("title")}
          />
          {form.formState.errors.title ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.title.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientName">Issuer / client</Label>
          <Input
            id="clientName"
            placeholder="Federal Ministry, NGO, buyer"
            {...form.register("clientName")}
          />
          {form.formState.errors.clientName ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.clientName.message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="opportunityType">Type</Label>
          <select
            id="opportunityType"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...form.register("opportunityType")}
          >
            <option>Tender</option>
            <option>RFP</option>
            <option>Grant</option>
            <option>EOI</option>
            <option>RFQ</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sector">Sector</Label>
          <Input
            id="sector"
            placeholder="Energy, health, ICT"
            {...form.register("sector")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...form.register("country")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deadline" className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            Deadline
          </Label>
          <Input id="deadline" type="date" {...form.register("deadline")} />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="authority">Procurement authority</Label>
          <Input
            id="authority"
            placeholder="BPP, donor agency, state ministry"
            {...form.register("authority")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budgetRange">Budget range</Label>
          <Input
            id="budgetRange"
            placeholder="NGN 25m - 50m"
            {...form.register("budgetRange")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">Opportunity notes</Label>
        <Textarea
          id="summary"
          placeholder="Paste a short opportunity summary, eligibility note, or internal bid/no-bid context."
          {...form.register("summary")}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save />
          )}
          Save changes
        </Button>
      </div>
    </form>
  );
}
