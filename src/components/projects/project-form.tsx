"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PlusCircle, Save, Sparkles } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectFormValues } from "@/lib/project-form-values";
import { createProjectSchema } from "@/lib/validations";
import { useApp } from "@/providers/app-provider";

type FormInput = z.input<typeof createProjectSchema>;
type FormValues = z.output<typeof createProjectSchema>;

const opportunityTypes = ["Tender", "RFP", "Grant", "EOI", "RFQ"] as const;

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ProjectForm({
  project,
  onDone,
}: {
  /** Omitted when creating. */
  project?: ProjectFormValues;
  onDone: () => void;
}) {
  const router = useRouter();
  const { refreshProjects } = useApp();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(project);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: project?.title ?? "",
      clientName: project?.clientName ?? "",
      opportunityType: opportunityTypes.includes(
        project?.opportunityType as (typeof opportunityTypes)[number],
      )
        ? (project?.opportunityType as FormInput["opportunityType"])
        : "Tender",
      sector: project?.sector ?? "General",
      country: project?.country ?? "Nigeria",
      authority: project?.authority ?? "",
      deadline: project?.deadline
        ? new Date(project.deadline).toISOString().split("T")[0]
        : "",
      budgetRange: project?.budgetRange ?? "",
      summary: project?.summary ?? "",
      referenceNumber: project?.referenceNumber ?? "",
      evaluationCriteria: project?.evaluationCriteria ?? "",
      winThemes: project?.winThemes ?? "",
      contractDuration: project?.contractDuration ?? "",
      incumbent: project?.incumbent ?? "",
      submissionLanguage: project?.submissionLanguage ?? "English",
    },
  });

  const errors = form.formState.errors;

  async function onSubmit(values: FormValues) {
    setError(null);

    const response = await fetch(
      project ? `/api/projects/${project.id}` : "/api/projects",
      {
        method: project ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(
        payload.error ||
          (project ? "Could not save changes." : "Could not create project."),
      );
      return;
    }

    // Keeps the sidebar's project menu in step with the change.
    await refreshProjects();
    onDone();

    if (project) {
      router.refresh();
    } else {
      const payload = await response.json();
      router.push(`/projects/${payload.project.id}` as Route);
      router.refresh();
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Section title="The opportunity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="title" label="Project title" error={errors.title?.message}>
            <Input
              id="title"
              placeholder="Lagos health supply RFP"
              {...form.register("title")}
            />
          </Field>
          <Field
            id="clientName"
            label="Issuer / client"
            error={errors.clientName?.message}
          >
            <Input
              id="clientName"
              placeholder="Federal Ministry, NGO, buyer"
              {...form.register("clientName")}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="opportunityType" label="Type">
            <select
              id="opportunityType"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...form.register("opportunityType")}
            >
              {opportunityTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field
            id="referenceNumber"
            label="Tender reference"
            hint="Quoted on cover letters and compliance forms."
          >
            <Input
              id="referenceNumber"
              placeholder="MOH/RFP/2026/014"
              {...form.register("referenceNumber")}
            />
          </Field>
        </div>
      </Section>

      <Section title="Where and when">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sector" label="Sector">
            <Input
              id="sector"
              placeholder="Energy, health, ICT"
              {...form.register("sector")}
            />
          </Field>
          <Field id="country" label="Country">
            <Input id="country" {...form.register("country")} />
          </Field>
          <Field id="authority" label="Procurement authority">
            <Input
              id="authority"
              placeholder="BPP, donor agency, state ministry"
              {...form.register("authority")}
            />
          </Field>
          <Field id="deadline" label="Submission deadline">
            <Input id="deadline" type="date" {...form.register("deadline")} />
          </Field>
          <Field id="budgetRange" label="Budget range">
            <Input
              id="budgetRange"
              placeholder="NGN 25m - 50m"
              {...form.register("budgetRange")}
            />
          </Field>
          <Field id="contractDuration" label="Contract duration">
            <Input
              id="contractDuration"
              placeholder="24 months from Q1 2027"
              {...form.register("contractDuration")}
            />
          </Field>
        </div>
        <Field
          id="submissionLanguage"
          label="Submission language"
          hint="Drafts are written in this language."
          error={errors.submissionLanguage?.message}
        >
          <Input
            id="submissionLanguage"
            placeholder="English"
            {...form.register("submissionLanguage")}
          />
        </Field>
      </Section>

      <Section
        title="What will win it"
        description="Optional, and the part that changes generated drafts the most. Everything here is passed to the model when sections are written."
      >
        <Field
          id="evaluationCriteria"
          label="Evaluation criteria"
          hint="Paste the scoring table from the pack. Drafts address each criterion in proportion to its weight."
          error={errors.evaluationCriteria?.message}
        >
          <Textarea
            id="evaluationCriteria"
            rows={4}
            placeholder={"Technical capacity 40%\nPast experience 30%\nMethodology 20%\nPrice 10%"}
            {...form.register("evaluationCriteria")}
          />
        </Field>
        <Field
          id="winThemes"
          label="Win themes"
          hint="Why you, in your own words - the argument you want carried through every section."
          error={errors.winThemes?.message}
        >
          <Textarea
            id="winThemes"
            rows={3}
            placeholder="Only bidder with an existing depot in the state; 14 similar deployments since 2021; local engineering team already certified."
            {...form.register("winThemes")}
          />
        </Field>
        <Field
          id="incumbent"
          label="Incumbent or known competitors"
          hint="Shapes how drafts position you against the alternative."
        >
          <Input
            id="incumbent"
            placeholder="Renewal of a contract currently held by ..."
            {...form.register("incumbent")}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field
          id="summary"
          label="Opportunity notes"
          error={errors.summary?.message}
        >
          <Textarea
            id="summary"
            rows={3}
            placeholder="Short opportunity summary, eligibility note, or internal bid/no-bid context."
            {...form.register("summary")}
          />
        </Field>
      </Section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={form.formState.isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : editing ? (
            <Save />
          ) : (
            <PlusCircle />
          )}
          {editing ? "Save changes" : "Create project"}
        </Button>
      </div>

      {!editing ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          Only a title and client are required. Everything else can be filled in
          once you have read the pack - the more of it that is set, the more
          specific the generated drafts.
        </p>
      ) : null}
    </form>
  );
}
