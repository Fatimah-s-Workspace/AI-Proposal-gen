"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

type WorkspaceImpact = {
  name: string;
  outcome: "deleted" | "blocked" | "left";
  projectCount: number;
};

export function AccountSettings({
  name,
  email,
  emailVerified,
  workspaces,
}: {
  name: string | null;
  email: string;
  emailVerified: boolean;
  workspaces: WorkspaceImpact[];
}) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedWorkspaces, setBlockedWorkspaces] = useState<string[]>([]);

  const toDelete = workspaces.filter((w) => w.outcome === "deleted");
  const blocked = workspaces.filter((w) => w.outcome === "blocked");
  const toLeave = workspaces.filter((w) => w.outcome === "left");

  async function remove() {
    setDeleting(true);
    setError(null);
    setBlockedWorkspaces([]);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: confirmEmail }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "Could not delete your account.");
        if (Array.isArray(payload.workspaces)) setBlockedWorkspaces(payload.workspaces);
        setDeleting(false);
        return;
      }

      // The account is gone, so the session is meaningless - clear it and
      // land on the marketing page rather than bouncing off a redirect.
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Could not delete your account. Check your connection.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{name || "Not set"}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <span className="text-muted-foreground">Email confirmed</span>
            <span className="font-medium">{emailVerified ? "Yes" : "Not yet"}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Delete account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Permanently deletes your account. This cannot be undone.
          </p>

          {blocked.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <p className="font-medium">You need to hand over ownership first</p>
              <p className="mt-1 text-muted-foreground">
                You&apos;re the only owner of{" "}
                {blocked.map((w) => w.name).join(", ")}, and{" "}
                {blocked.length === 1 ? "it still has" : "they still have"} other members.
                Make someone else an owner, or delete the workspace, then come back.
              </p>
            </div>
          ) : null}

          {toDelete.length > 0 ? (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">These workspaces will be deleted with you</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {toDelete.map((w) => (
                  <li key={w.name}>
                    {w.name} — {w.projectCount} project{w.projectCount === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                You&apos;re the only member, so nobody else would be able to reach them.
              </p>
            </div>
          ) : null}

          {toLeave.length > 0 ? (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">You&apos;ll simply be removed from these</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {toLeave.map((w) => (
                  <li key={w.name}>{w.name}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                They have other owners, so the work carries on without you.
              </p>
            </div>
          ) : null}

          <Button
            variant="destructive"
            onClick={() => {
              setConfirmEmail("");
              setError(null);
              setOpen(true);
            }}
            disabled={blocked.length > 0}
          >
            <Trash2 />
            Delete my account
          </Button>
        </CardContent>
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        description="This permanently deletes your account and any workspace where you're the only member. This cannot be undone."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type <span className="font-semibold text-foreground">{email}</span> to confirm
            </Label>
            <Input
              id="confirm-email"
              autoFocus
              autoComplete="off"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              disabled={deleting}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {blockedWorkspaces.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Blocked by: {blockedWorkspaces.join(", ")}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={deleting || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
