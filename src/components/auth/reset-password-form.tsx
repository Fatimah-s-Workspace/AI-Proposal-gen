"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage, authMessages, genericMessages } from "@/lib/messages";
import { Feedback } from "@/components/ui/feedback";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { resetPasswordSchema } from "@/lib/validations";

type FormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email, token, password: "" },
  });

  // Subscribed to on its own so the checklist updates as the user types,
  // without re-rendering the whole form on every keystroke.
  const password = useWatch({ control: form.control, name: "password" }) ?? "";

  if (!token || !email) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          This reset link is missing required information. Please request a new one.
        </p>
        <Link href="/auth/forgot-password" className="text-sm font-medium text-primary">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(values: FormValues) {
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        setError(await apiErrorMessage(response));
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace("/auth/sign-in" as Route), 2000);
    } catch (error) {
      console.error("Password reset failed", error);
      setError(genericMessages.network);
    }
  }

  if (success) {
    return (
      <Feedback tone="success" title="Password updated">
        {authMessages.passwordUpdated}
      </Feedback>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register("password")}
        />
        <PasswordRequirements value={password} />
        {form.formState.errors.password ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <KeyRound />
        )}
        Reset password
      </Button>
    </form>
  );
}
