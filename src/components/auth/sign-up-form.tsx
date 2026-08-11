"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpSchema } from "@/lib/validations";
import type { PendingInvite } from "@/server/invites";

type FormInput = z.input<typeof signUpSchema>;
type FormValues = z.output<typeof signUpSchema>;

export function SignUpForm({ invite }: { invite?: PendingInvite | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      // Someone joining a team gets their own workspace too, so this stays
      // theirs to name - prefilling the inviting team's name here would
      // create a confusing second workspace with an identical name.
      companyName: "",
      email: invite?.email ?? "",
      password: "",
      country: "Nigeria",
    },
  });

  // Carry the destination across, so bouncing between sign-up and sign-in
  // doesn't quietly drop the invite the visitor came here to accept.
  const callbackUrl = searchParams.get("callbackUrl");
  const signInHref = (
    callbackUrl?.startsWith("/")
      ? `/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/auth/sign-in"
  ) as Route;

  async function onSubmit(values: FormValues) {
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Could not create your account.");
        return;
      }

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!result || result.error || !result.ok) {
        setError(
          "Account created, but automatic sign-in failed. Please sign in with the same email and password.",
        );
        return;
      }

      setSuccess(true);
      const destination = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard";
      router.replace(destination as Route);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create account. Please try again.",
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...form.register("country")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyName">Organisation</Label>
        <Input
          id="companyName"
          autoComplete="organization"
          {...form.register("companyName")}
        />
        {form.formState.errors.companyName ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.companyName.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          readOnly={Boolean(invite)}
          aria-describedby={invite ? "email-invite-hint" : undefined}
          className={invite ? "bg-muted text-muted-foreground" : undefined}
          {...form.register("email")}
        />
        {invite ? (
          <p id="email-invite-hint" className="text-xs text-muted-foreground">
            The invite to {invite.organizationName} was sent to this address, so your
            account has to use it.{" "}
            <Link href="/auth/sign-up" className="font-medium text-primary">
              Sign up with a different email
            </Link>{" "}
            instead.
          </p>
        ) : null}
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="text-sm text-green-600">
          Account created successfully! Redirecting...
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <UserPlus />
        )}
        Create account
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="font-medium text-primary">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-primary">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={signInHref} className="font-medium text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}
