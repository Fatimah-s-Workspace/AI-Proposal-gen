"use client";

import { Building2, CheckCircle2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCompanyProfileSchema } from "@/lib/validations";

type FormInput = z.input<typeof updateCompanyProfileSchema>;
type FormValues = z.output<typeof updateCompanyProfileSchema>;

export type CompanyProfileValues = {
  legalName: string | null;
  registrationNumber: string | null;
  foundedYear: number | null;
  teamSize: string | null;
  profileSummary: string | null;
  capabilities: string | null;
  certifications: string | null;
  pastPerformance: string | null;
};

// Which fields count towards "how complete is this", and the order they're
// worth filling in. Past performance and capabilities carry the most weight
// in an evaluated bid, so they come first.
const COMPLETENESS_FIELDS: Array<keyof CompanyProfileValues> = [
  "pastPerformance",
  "capabilities",
  "certifications",
  "profileSummary",
  "legalName",
  "registrationNumber",
  "foundedYear",
  "teamSize",
];

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

export function CompanyProfile({
  organizationId,
  workspaceName,
  profile,
  canEdit,
}: {
  organizationId: string;
  workspaceName: string;
  profile: CompanyProfileValues;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(updateCompanyProfileSchema),
    defaultValues: {
      legalName: profile.legalName ?? "",
      registrationNumber: profile.registrationNumber ?? "",
      foundedYear: profile.foundedYear ?? undefined,
      teamSize: profile.teamSize ?? "",
      profileSummary: profile.profileSummary ?? "",
      capabilities: profile.capabilities ?? "",
      certifications: profile.certifications ?? "",
      pastPerformance: profile.pastPerformance ?? "",
    },
  });

  const errors = form.formState.errors;
  const filled = COMPLETENESS_FIELDS.filter((field) => {
    const value = profile[field];
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  }).length;

  async function onSubmit(values: FormValues) {
    setError(null);
    setSaved(false);

    const response = await fetch(
      `/api/organization/${organizationId}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          // An emptied number input parses to undefined; the API needs an
          // explicit null to clear a year that was previously set.
          foundedYear: values.foundedYear ?? null,
        }),
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Could not save the company profile.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Company profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Every proposal generated in {workspaceName} is written on behalf of
            this company. Drafts may only use what is set here when describing
            your experience, credentials, or capacity — so a fuller profile
            means less to rewrite, and nothing invented.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2
              className={
                filled === COMPLETENESS_FIELDS.length
                  ? "size-4 text-primary"
                  : "size-4 text-muted-foreground"
              }
            />
            <span className="text-muted-foreground">
              {filled} of {COMPLETENESS_FIELDS.length} filled in
            </span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="legalName"
                label="Registered legal name"
                hint="Used verbatim on cover letters and declarations."
                error={errors.legalName?.message}
              >
                <Input
                  id="legalName"
                  disabled={!canEdit}
                  placeholder="Acme Engineering Services Limited"
                  {...form.register("legalName")}
                />
              </Field>
              <Field
                id="registrationNumber"
                label="Registration number"
                hint="CAC/RC number, tax ID, or equivalent."
                error={errors.registrationNumber?.message}
              >
                <Input
                  id="registrationNumber"
                  disabled={!canEdit}
                  placeholder="RC 1234567"
                  {...form.register("registrationNumber")}
                />
              </Field>
              <Field
                id="foundedYear"
                label="Operating since"
                hint="Drafts count years of experience from this."
                error={errors.foundedYear?.message}
              >
                <Input
                  id="foundedYear"
                  type="number"
                  inputMode="numeric"
                  disabled={!canEdit}
                  placeholder="2014"
                  {...form.register("foundedYear")}
                />
              </Field>
              <Field
                id="teamSize"
                label="Team size"
                hint="Backs up capacity and staffing claims."
                error={errors.teamSize?.message}
              >
                <Input
                  id="teamSize"
                  disabled={!canEdit}
                  placeholder="45 permanent staff, 20 contractors"
                  {...form.register("teamSize")}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              id="pastPerformance"
              label="Relevant past performance"
              hint="Contracts, clients, values, dates. The strongest evidence in any bid — and the thing a draft cannot make up."
              error={errors.pastPerformance?.message}
            >
              <Textarea
                id="pastPerformance"
                rows={5}
                disabled={!canEdit}
                placeholder={
                  "2024 — Kano State Ministry of Health, cold-chain rollout, NGN 180m, completed on schedule\n2023 — UNDP Nigeria, 12 solar mini-grids, USD 400k"
                }
                {...form.register("pastPerformance")}
              />
            </Field>
            <Field
              id="capabilities"
              label="Core capabilities"
              hint="What you actually deliver, in your own words."
              error={errors.capabilities?.message}
            >
              <Textarea
                id="capabilities"
                rows={4}
                disabled={!canEdit}
                placeholder="Solar mini-grid design and installation; O&M contracts; last-mile logistics across northern Nigeria."
                {...form.register("capabilities")}
              />
            </Field>
            <Field
              id="certifications"
              label="Certifications and accreditations"
              hint="ISO, tax clearance, professional licences. Compliance sections answer directly from this."
              error={errors.certifications?.message}
            >
              <Textarea
                id="certifications"
                rows={3}
                disabled={!canEdit}
                placeholder={"ISO 9001:2015 (valid to 2027)\nTax clearance certificate 2024, 2025\nCOREN-registered engineers on staff"}
                {...form.register("certifications")}
              />
            </Field>
            <Field
              id="profileSummary"
              label="About the company"
              hint="One or two paragraphs. Often reused close to verbatim in an introduction."
              error={errors.profileSummary?.message}
            >
              <Textarea
                id="profileSummary"
                rows={4}
                disabled={!canEdit}
                placeholder="Acme Engineering Services is a Kano-based renewable energy contractor working with state governments and donor programmes across northern Nigeria."
                {...form.register("profileSummary")}
              />
            </Field>
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-primary">Company profile saved.</p>
        ) : null}

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Save />
              )}
              Save profile
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only owners and admins can edit the company profile.
          </p>
        )}
      </form>
    </div>
  );
}
