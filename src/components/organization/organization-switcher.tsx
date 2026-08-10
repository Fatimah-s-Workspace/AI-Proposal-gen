"use client";

import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TruncatedText } from "@/components/ui/truncated-text";
import { cn } from "@/lib/utils";

export type SwitchableOrganization = {
  organizationId: string;
  name: string;
  role: string;
};

// Fired by anything that renames, creates, or deletes a workspace so the
// switcher can refresh the copy of the list it holds in client state.
export const ORGANIZATIONS_CHANGED_EVENT = "tf:organizations-changed";

export function notifyOrganizationsChanged() {
  window.dispatchEvent(new Event(ORGANIZATIONS_CHANGED_EVENT));
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

// Self-fetching, matching how Sidebar and MobileHeader already load their
// own session data - keeps this droppable into the client-side app shell
// without threading props through it.
export function OrganizationSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<SwitchableOrganization[]>(
    [],
  );
  const [activeOrganizationId, setActiveOrganizationId] = useState<
    string | null
  >(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      fetch("/api/organization/list")
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return;
          setOrganizations(data.organizations ?? []);
          setActiveOrganizationId(data.activeOrganizationId ?? null);
        })
        .catch(() => {});
    }

    load();

    // This is a client component holding its own copy of the workspace
    // list, so router.refresh() after a rename updates the server-rendered
    // page but leaves the name in here stale. Anything that changes the
    // list fires this event to pull it again.
    window.addEventListener(ORGANIZATIONS_CHANGED_EVENT, load);
    return () => window.removeEventListener(ORGANIZATIONS_CHANGED_EVENT, load);
  }, []);

  const active = organizations.find(
    (organization) => organization.organizationId === activeOrganizationId,
  );

  // Renders even with one workspace: this dropdown is the only route to
  // "Create workspace", so hiding it would leave a single-workspace user
  // with no way to make a second one.
  if (organizations.length === 0) return null;

  async function switchTo(organizationId: string) {
    if (organizationId === activeOrganizationId) {
      setOpen(false);
      return;
    }

    setSwitchingTo(organizationId);
    try {
      const response = await fetch("/api/organization/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        setSwitchingTo(null);
        return;
      }

      setOpen(false);
      // Everything on screen is scoped to the old organization, so send
      // them somewhere org-neutral and refetch rather than leaving stale
      // project data from a workspace they're no longer looking at.
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setSwitchingTo(null);
    }
  }

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setCreateError(payload.error || "Could not create the workspace.");
        setCreating(false);
        return;
      }

      // The route already made it active, so land in the new (empty)
      // workspace rather than whatever the previous one was showing.
      setCreateOpen(false);
      setNewName("");
      notifyOrganizationsChanged();
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setCreateError("Could not create the workspace. Check your connection.");
    }
    setCreating(false);
  }

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-between gap-2", className)}
          aria-label="Switch organization"
        >
          <TruncatedText
            text={active?.name ?? "Select workspace"}
            className="min-w-0 flex-1 text-left text-sm"
          />
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Workspaces
        </p>
        {organizations.map((organization) => {
          const isActive = organization.organizationId === activeOrganizationId;
          const isSwitching = switchingTo === organization.organizationId;

          return (
            <button
              key={organization.organizationId}
              type="button"
              onClick={() => switchTo(organization.organizationId)}
              disabled={switchingTo !== null}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <TruncatedText
                  text={organization.name}
                  className="font-medium"
                />
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[organization.role] ?? organization.role}
                </span>
              </span>
              {isSwitching ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : isActive ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}

        <div className="mt-1 border-t pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCreateError(null);
              setNewName("");
              setCreateOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
          >
            <Plus className="size-4 shrink-0" />
            Create workspace
          </button>
        </div>
      </PopoverContent>
    </Popover>

    <Modal
      isOpen={createOpen}
      onClose={() => setCreateOpen(false)}
      title="Create a workspace"
      description="A separate space for its own projects, team, and plan. Nothing is shared with your other workspaces."
    >
      <form onSubmit={createWorkspace} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            required
            autoFocus
            placeholder="Acme Consulting"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={creating}
          />
        </div>

        {createError ? <p className="text-sm text-destructive">{createError}</p> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating || newName.trim().length < 2}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Create workspace
          </Button>
        </div>
      </form>
    </Modal>
    </>
  );
}
