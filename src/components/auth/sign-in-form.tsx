"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Label } from "@/components/ui/label";
import { signInSchema } from "@/lib/validations";
import { authMessages, genericMessages, signInErrorMessage } from "@/lib/messages";
import { Feedback } from "@/components/ui/feedback";
import { ResendVerification } from "@/components/auth/resend-verification";
import { useWatch } from "react-hook-form";
import type { PendingInvite } from "@/server/invites";
import type { DemoCredentials } from "@/lib/demo-credentials";

type FormValues = z.infer<typeof signInSchema>;

export function SignInForm({
  invite,
  demo,
}: {
  invite?: PendingInvite | null;
  demo?: DemoCredentials | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(signInSchema),
    // Someone arriving from an invite has a real account to reach. The demo
    // credentials only ever arrive from a development environment that opted
    // in - see @/lib/demo-credentials - so the public form starts empty.
    defaultValues: invite
      ? { email: invite.email, password: "" }
      : { email: demo?.email ?? "", password: demo?.password ?? "" },
  });

  // Read from the form rather than kept in a second piece of state, so the
  // resend below cannot send to a stale address after the user edits it.
  const typedEmail = useWatch({ control: form.control, name: "email" }) ?? "";

  // Carry the destination across, so bouncing between sign-in and sign-up
  // doesn't quietly drop the invite the visitor came here to accept.
  const callbackUrl = searchParams.get("callbackUrl");
  const signUpHref = (
    callbackUrl?.startsWith("/")
      ? `/auth/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/auth/sign-up"
  ) as Route;

  async function onSubmit(values: FormValues) {
    setError(null);

    try {
      const result = await signIn("credentials", {
        ...values,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!result || result.error || !result.ok) {
        // NextAuth reports a wrong password as the bare code
        // "CredentialsSignin", and this used to render that code verbatim.
        // signInErrorMessage turns codes into sentences and passes through
        // the messages authorize() throws, which is how the throttle and
        // unverified-email notices arrive intact.
        setError(signInErrorMessage(result?.error));
        return;
      }

      const destination = callbackUrl?.startsWith("/")
        ? callbackUrl
        : "/dashboard";
      router.replace(destination as Route);
    } catch (error) {
      // Whatever went wrong here is a transport or runtime failure, not
      // something the user did; its message is for the logs, not for them.
      console.error("Sign-in failed", error);
      setError(genericMessages.network);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
            The invite to {invite.organizationName} was sent to this address, so only
            that account can accept it.
          </p>
        ) : null}
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/auth/forgot-password" className="text-sm font-medium text-primary">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      {/* Only for the one failure a resend actually solves. */}
      {error === authMessages.emailNotVerified ? (
        <ResendVerification email={typedEmail} />
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <LogIn />
        )}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to TenderFlow AI?{" "}
        <Link href={signUpHref} className="font-medium text-primary">
          Create an account
        </Link>
      </p>
    </form>
  );
}
