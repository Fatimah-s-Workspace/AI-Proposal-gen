"use client";

import { Check, Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TruncatedText } from "@/components/ui/truncated-text";

type Member = {
  id: string;
  role: string;
  userId: string;
  name: string | null;
  email: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expires: string;
};

type TeamManagerProps = {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
  currentRole: string;
  canManage: boolean;
  emailVerified: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function TeamManager({
  members,
  invites,
  currentUserId,
  currentRole,
  canManage,
  emailVerified,
}: TeamManagerProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [revoking, setRevoking] = useState<Invite | null>(null);

  const ownerCount = members.filter((member) => member.role === "owner").length;

  async function call(url: string, init: RequestInit) {
    setError(null);
    const response = await fetch(url, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Something went wrong.");
      return null;
    }
    router.refresh();
    return payload as Record<string, unknown>;
  }

  function resetInviteForm() {
    setEmail("");
    setRole("member");
    setError(null);
    setFallbackLink(null);
    setCopied(false);
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true);
    setNotice(null);
    setFallbackLink(null);

    const payload = await call("/api/organization/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (payload) {
      if (payload.emailDelivered) {
        setNotice(`Invite sent to ${email}.`);
        setInviteOpen(false);
        resetInviteForm();
      } else {
        // The invite is live either way - hand over the link so the invite
        // still works when email delivery is unavailable.
        setFallbackLink(String(payload.inviteUrl ?? ""));
        setNotice(null);
      }
    }
    setInviting(false);
  }

  async function copyLink() {
    if (!fallbackLink) return;
    try {
      await navigator.clipboard.writeText(fallbackLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically - select the link and copy it manually.");
    }
  }

  async function changeRole(membershipId: string, nextRole: string) {
    setBusyId(membershipId);
    setNotice(null);
    await call(`/api/organization/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    setBusyId(null);
  }

  async function removeMember() {
    if (!removing) return;
    setBusyId(removing.id);
    setNotice(null);
    await call(`/api/organization/members/${removing.id}`, { method: "DELETE" });
    setBusyId(null);
    setRemoving(null);
  }

  async function revokeInvite() {
    if (!revoking) return;
    setBusyId(revoking.id);
    setNotice(null);
    await call(`/api/organization/invites/${revoking.id}`, { method: "DELETE" });
    setBusyId(null);
    setRevoking(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 text-muted-foreground">
          {canManage
            ? "Invite teammates, set what they can do, and manage who has access to this workspace."
            : "People with access to this workspace. Ask an owner or admin to make changes."}
        </p>
        {canManage ? (
          <div className="flex w-full shrink-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end">
            <Button
              onClick={() => {
                resetInviteForm();
                setInviteOpen(true);
              }}
              disabled={!emailVerified}
              className="w-full sm:w-auto"
            >
              <UserPlus />
              Invite teammate
            </Button>
            {!emailVerified ? (
              <p className="text-xs text-muted-foreground">
                Confirm your email address to invite teammates.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">{notice}</div>
      ) : null}
      {error && !inviteOpen ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="sticky top-14 z-10 mb-4 flex h-auto w-full justify-start overflow-x-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:top-0">
          <TabsTrigger value="members" className="shrink-0">
            Members
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {members.length}
            </Badge>
          </TabsTrigger>
          {canManage ? (
            <TabsTrigger value="invites" className="shrink-0">
              Pending invites
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {invites.length}
              </Badge>
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="members" className="space-y-3">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const isLastOwner = member.role === "owner" && ownerCount <= 1;
            const canEditThisRole =
              canManage && !isLastOwner && (currentRole === "owner" || member.role !== "owner");
            const canRemoveThis =
              !isLastOwner &&
              (isSelf || (canManage && (currentRole === "owner" || member.role !== "owner")));

            return (
              <div
                key={member.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TruncatedText text={member.name || member.email} className="font-medium" />
                    {isSelf ? (
                      <Badge variant="secondary" className="text-[10px]">
                        You
                      </Badge>
                    ) : null}
                  </div>
                  <TruncatedText text={member.email} className="text-sm text-muted-foreground" />
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {canEditThisRole ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => changeRole(member.id, value)}
                      disabled={busyId === member.id}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs" aria-label="Role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentRole === "owner" ? (
                          <SelectItem value="owner">Owner</SelectItem>
                        ) : null}
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
                  )}

                  {canRemoveThis ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRemoving(member)}
                      disabled={busyId === member.id}
                      aria-label={isSelf ? "Leave team" : `Remove ${member.email}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {canManage ? (
          <TabsContent value="invites" className="space-y-3">
            {invites.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No pending invites. Anyone you invite will show up here until they accept.
                </CardContent>
              </Card>
            ) : (
              invites.map((pending) => (
                <div
                  key={pending.id}
                  className="flex flex-col gap-3 rounded-lg border border-dashed bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <TruncatedText text={pending.email} className="font-medium" />
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(pending.expires).toLocaleDateString("en-NG")}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{ROLE_LABELS[pending.role] ?? pending.role}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRevoking(pending)}
                      disabled={busyId === pending.id}
                      aria-label={`Revoke invite for ${pending.email}`}
                    >
                      {busyId === pending.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        ) : null}
      </Tabs>

      <Modal
        isOpen={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          resetInviteForm();
        }}
        title="Invite a teammate"
        description="They'll get an email with a link to join. Invites expire after 7 days."
      >
        <form onSubmit={invite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              required
              autoFocus
              placeholder="teammate@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={inviting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "admin" | "member")}
              disabled={inviting}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "admin"
                ? "Admins can invite and manage teammates, but can't change billing."
                : "Members can create and edit projects."}
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {fallbackLink ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
              <p className="text-sm font-medium">Invite created, but the email couldn&apos;t be sent</p>
              <p className="text-xs text-muted-foreground">
                Share this link with {email} directly - it works exactly like the emailed one.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={fallbackLink} className="h-8 text-xs" />
                <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInviteOpen(false);
                resetInviteForm();
              }}
            >
              {fallbackLink ? "Done" : "Cancel"}
            </Button>
            <Button type="submit" disabled={inviting || !email}>
              {inviting ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Send invite
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={removeMember}
        title={removing?.userId === currentUserId ? "Leave this team?" : "Remove member"}
        description={
          removing?.userId === currentUserId
            ? "You'll lose access to this organization's projects. You can be re-invited later."
            : `${removing?.email ?? "This person"} will lose access to this organization's projects. This doesn't delete their account.`
        }
        confirmText={removing?.userId === currentUserId ? "Leave team" : "Remove"}
        confirmDisabled={busyId !== null}
      />

      <ConfirmDialog
        isOpen={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={revokeInvite}
        title="Revoke invite"
        description={`${revoking?.email ?? "This person"} won't be able to join with the link they were sent. You can invite them again later.`}
        confirmText="Revoke invite"
        confirmDisabled={busyId !== null}
      />
    </div>
  );
}
