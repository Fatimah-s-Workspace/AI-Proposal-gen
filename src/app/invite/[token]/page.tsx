import { createHash } from "crypto";
import { AlertTriangle, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { AcceptInviteButton } from "@/components/organization/accept-invite-button";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { Button } from "@/components/ui/button";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Team invite" };
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-soft sm:p-8">
        {children}
      </div>
    </main>
  );
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <Shell>
      <div className="flex size-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-normal">Invite unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="mt-6 w-full">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </Shell>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hashedToken = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.organizationInvite.findUnique({
    where: { token: hashedToken },
    include: {
      organization: { select: { name: true } },
      // Joined rather than fetched separately: the relation is nullable
      // (the inviter may have since been deleted), so this resolves to null
      // instead of needing a guarded second query.
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invite) {
    return (
      <InvalidInvite message="This invite link isn't valid. It may have already been used, or been revoked by the team." />
    );
  }

  if (invite.expires < new Date()) {
    return (
      <InvalidInvite message="This invite has expired. Ask whoever invited you to send a new one." />
    );
  }

  const inviterName = invite.invitedBy?.name ?? invite.invitedBy?.email ?? "Someone";

  const user = await getCurrentUser();
  const returnTo = `/invite/${token}`;

  const heading = (
    <>
      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Users className="size-5" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-normal">
        Join {invite.organization.name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {inviterName} invited <span className="font-medium text-foreground">{invite.email}</span> to
        collaborate as {invite.role === "admin" ? "an admin" : "a member"}.
      </p>
    </>
  );

  if (!user) {
    return (
      <Shell>
        {heading}
        <div className="mt-6 space-y-3">
          <Button asChild className="w-full" size="lg">
            <Link href={`/auth/sign-in?callbackUrl=${encodeURIComponent(returnTo)}` as Route}>
              Sign in to accept
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href={`/auth/sign-up?callbackUrl=${encodeURIComponent(returnTo)}` as Route}>
              Create an account
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Use {invite.email} when signing in or creating your account - this invite is tied to that
          address.
        </p>
      </Shell>
    );
  }

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        {heading}
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="font-medium">You&apos;re signed in as {user.email}</p>
          <p className="mt-1 text-muted-foreground">
            This invite was sent to {invite.email}. Sign out and sign back in as that user to accept
            it.
          </p>
        </div>
        <div className="mt-4 rounded-md border">
          <SignOutButton callbackUrl={returnTo} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {heading}
      <div className="mt-6">
        <AcceptInviteButton token={token} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Accepting switches you into {invite.organization.name}. You&apos;ll keep access to your own
        workspace.
      </p>
    </Shell>
  );
}
