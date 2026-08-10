"use client";

import { AlertTriangle, Loader2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { notifyOrganizationsChanged } from "@/components/organization/organization-switcher";

type WorkspaceSettingsProps = {
  organizationId: string;
  name: string;
  canRename: boolean;
  canDelete: boolean;
  isOnlyWorkspace: boolean;
  memberCount: number;
  projectCount: number;
};

export function WorkspaceSettings({
  organizationId,
  name,
  canRename,
  canDelete,
  isOnlyWorkspace,
  memberCount,
  projectCount,
}: WorkspaceSettingsProps) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/organization/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "Could not rename the workspace.");
      } else {
        setNotice("Workspace name updated.");
        router.refresh();
        // router.refresh() only re-renders server components - the switcher
        // holds its own copy of the list and would keep the old name.
        notifyOrganizationsChanged();
      }
    } catch {
      setError("Could not rename the workspace. Check your connection.");
    }
    setSaving(false);
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/organization/${organizationId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDeleteError(payload.error || "Could not delete the workspace.");
        setDeleting(false);
        return;
      }

      // The active-workspace cookie was cleared server-side, so a full
      // reload lands on whichever workspace resolves next.
      window.location.href = "/dashboard";
    } catch {
      setDeleteError("Could not delete the workspace. Check your connection.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace name</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown in the workspace switcher and on team invites.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={rename} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={!canRename || saving}
                required
              />
            </div>
            {canRename ? (
              <Button
                type="submit"
                disabled={saving || value.trim().length < 2 || value.trim() === name}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Save
              </Button>
            ) : null}
          </form>
          {!canRename ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Ask an owner or admin to change the workspace name.
            </p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="mt-3 text-sm text-primary">{notice}</p> : null}
        </CardContent>
      </Card>

      {canDelete ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deleting this workspace permanently removes its {projectCount} project
              {projectCount === 1 ? "" : "s"} and every document, requirement, draft, and
              export inside{memberCount > 1 ? `, for all ${memberCount} members` : ""}. This
              cannot be undone.
            </p>

            {isOnlyWorkspace ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                This is your only workspace, so it can&apos;t be deleted. Create another one
                first if you want to start over.
              </p>
            ) : (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete this workspace
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Modal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmName("");
          setDeleteError(null);
        }}
        title="Delete this workspace?"
        description="This permanently deletes every project, document, and export in it. This cannot be undone."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-semibold text-foreground">{name}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              autoFocus
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              disabled={deleting}
            />
          </div>

          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              // Typing the exact name is the guard against a reflexive
              // click - this destroys everyone's work in the workspace.
              disabled={deleting || confirmName !== name}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete workspace
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
