import {
  Building2,
  CreditCard,
  FileOutput,
  Pencil,
  Sparkles,
  Trash2,
  UploadCloud,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const ACTION_META: Record<string, { label: (metadata: Record<string, unknown>) => string; icon: LucideIcon }> = {
  "document.upload": {
    label: (m) => `Uploaded ${m.count ?? "a"} document${m.count === 1 ? "" : "s"}`,
    icon: UploadCloud,
  },
  "document.delete": {
    label: (m) => `Deleted ${m.count ?? "a"} document${m.count === 1 ? "" : "s"}`,
    icon: Trash2,
  },
  "requirement.update": {
    label: () => "Updated a checklist requirement",
    icon: Pencil,
  },
  "requirement.delete": {
    label: (m) => `Deleted requirement "${m.title ?? ""}"`,
    icon: Trash2,
  },
  "proposal_section.edit": {
    label: () => "Edited a proposal section",
    icon: Pencil,
  },
  "proposal.generate": {
    label: (m) => `Generated ${m.sectionCount ?? ""} proposal section${m.sectionCount === 1 ? "" : "s"}`,
    icon: Sparkles,
  },
  "proposal.rewrite": {
    label: () => "Rewrote proposal content",
    icon: Sparkles,
  },
  "proposal.draft_assistant": {
    label: () => "Ran the draft assistant",
    icon: Sparkles,
  },
  "export.create": {
    label: (m) => `Exported a proposal (${String(m.format ?? "").toUpperCase()})`,
    icon: FileOutput,
  },
  "payment.success": {
    label: () => "Upgraded to the Pro plan",
    icon: CreditCard,
  },
  "member.invite": {
    label: (m) => `Invited ${m.email ?? "a teammate"} to the team`,
    icon: UserPlus,
  },
  "member.join": {
    label: () => "Joined the team",
    icon: UserPlus,
  },
  "organization.create": {
    label: (m) => `Created the workspace "${m.name ?? ""}"`,
    icon: Building2,
  },
  "organization.rename": {
    label: (m) => `Renamed the workspace to "${m.name ?? ""}"`,
    icon: Pencil,
  },
  "member.invite_revoke": {
    label: (m) => `Revoked the invite for ${m.email ?? "a teammate"}`,
    icon: UserMinus,
  },
  "member.role_update": {
    label: (m) => `Changed ${m.email ?? "a teammate"}'s role to ${m.role ?? ""}`,
    icon: Pencil,
  },
  "member.remove": {
    label: (m) => `Removed ${m.email ?? "a teammate"} from the team`,
    icon: UserMinus,
  },
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatRelativeDate(date: Date, now: number) {
  const diffDays = Math.floor((now - date.getTime()) / (24 * 60 * 60 * 1000));
  const time = formatTime(date);
  if (diffDays <= 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  if (diffDays < 7) return `${diffDays}d ago, ${time}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago, ${time}`;
  return `${new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(date)}, ${time}`;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where: { userId: user.id } }),
  ]);

  const now = new Date().getTime();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 pb-8">
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-5 mb-8">
        <h1 className="text-3xl font-semibold tracking-normal">Activity</h1>
        <p className="mt-2 text-muted-foreground">
          A record of generation, edit, export, delete, and payment actions on your account.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No activity recorded yet.
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const metadata = (log.metadata as Record<string, unknown>) ?? {};
                const meta = ACTION_META[log.action];
                const Icon = meta?.icon ?? Pencil;
                const label = meta ? meta.label(metadata) : log.action;

                return (
                  <div key={log.id} className="flex items-center gap-4 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(log.createdAt, now)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/activity?page=${page - 1}`}
                className="rounded-md border px-3 py-1.5 hover:bg-muted"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/activity?page=${page + 1}`}
                className="rounded-md border px-3 py-1.5 hover:bg-muted"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
