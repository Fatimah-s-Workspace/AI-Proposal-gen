import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  FolderKanban,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TruncatedText } from "@/components/ui/truncated-text";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

const RECENT_PROJECT_LIMIT = 4;
const ATTENTION_DEADLINE_DAYS = 14;
const ATTENTION_COMPLIANCE_THRESHOLD = 50;

export default async function DashboardPage() {
  const user = await requireUser();
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [projects, usageThisPeriod] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: "desc" },
      take: RECENT_PROJECT_LIMIT,
      include: {
        _count: {
          select: {
            documents: true,
            requirements: true,
            proposalSections: true,
          },
        },
      },
    }),
    prisma.usageTracking.findMany({
      where: { organizationId: user.organizationId, period: currentPeriod },
    }),
  ]);

  const totals = projects.reduce(
    (acc, project) => {
      acc.documents += project._count.documents;
      acc.requirements += project._count.requirements;
      acc.sections += project._count.proposalSections;
      return acc;
    },
    { documents: 0, requirements: 0, sections: 0 },
  );
  const activeProjects = projects.filter(
    (project) => project.status !== "archived",
  ).length;
  const currentUsage = usageThisPeriod.reduce(
    (acc, period) => ({
      uploads: acc.uploads + period.uploads,
      aiGenerations: acc.aiGenerations + period.aiGenerations,
      exports: acc.exports + period.exports,
    }),
    { uploads: 0, aiGenerations: 0, exports: 0 },
  );
  const uploadLimit = user.subscription?.monthlyUploadLimit ?? 100;
  const proposalLimit = user.subscription?.monthlyProposalLimit ?? 10;

  const now = new Date().getTime();
  const soonCutoff = now + ATTENTION_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
  const attentionItems = projects
    .map((project) => {
      const daysToDeadline = project.deadline
        ? Math.ceil((project.deadline.getTime() - now) / (24 * 60 * 60 * 1000))
        : null;
      const deadlineSoon =
        project.deadline != null &&
        project.deadline.getTime() > now &&
        project.deadline.getTime() <= soonCutoff;
      const lowCompliance =
        project.complianceScore < ATTENTION_COMPLIANCE_THRESHOLD &&
        project._count.requirements > 0;
      if (!deadlineSoon && !lowCompliance) return null;
      return { project, daysToDeadline, deadlineSoon, lowCompliance };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="space-y-8">
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3 mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              Workspace overview
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">
              Dashboard
            </h1>
            <p className="mt-2 text-muted-foreground">
              Track tender packs, compliance readiness, drafts, and export
              activity.
            </p>
          </div>
          <NewProjectButton />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <MetricCard
          icon={FolderKanban}
          label="Active projects"
          value={activeProjects.toString()}
        />
        <MetricCard
          icon={UploadCloud}
          label="Uploaded documents"
          value={totals.documents.toString()}
        />
        <MetricCard
          icon={FileText}
          label="Requirements tracked"
          value={totals.requirements.toString()}
        />
        <MetricCard
          icon={Sparkles}
          label="Proposal sections"
          value={totals.sections.toString()}
        />
      </section>

      {attentionItems.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle className="size-4 text-amber-600" />
            Needs attention
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {attentionItems.map(({ project, daysToDeadline, deadlineSoon, lowCompliance }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-lg border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:hover:bg-amber-900/60"
              >
                <TruncatedText
                  as="p"
                  text={project.title}
                  className="font-medium"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {deadlineSoon && daysToDeadline !== null && (
                    <Badge variant="outline" className="gap-1 bg-background">
                      <Clock className="size-3" />
                      {daysToDeadline <= 0
                        ? "Due today"
                        : `${daysToDeadline}d to deadline`}
                    </Badge>
                  )}
                  {lowCompliance && (
                    <Badge variant="outline" className="gap-1 bg-background">
                      {project.complianceScore}% compliant
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent projects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {projects.length ? (
              <div className="divide-y rounded-md border">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="grid gap-3 p-4 transition-colors hover:bg-muted/60 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                  >
                    <div className="min-w-0">
                      <TruncatedText text={project.title} className="font-medium" />
                      <TruncatedText
                        text={project.clientName}
                        className="text-xs text-muted-foreground"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {project.stage.replace("_", " ")}
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${project.complianceScore}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {project.complianceScore}% ready
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center">
                <p className="font-medium">No projects yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first tender workspace and upload the RFP pack.
                </p>
                <NewProjectButton label="Create project" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Plan usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current plan</p>
                  <p className="text-2xl font-semibold tracking-normal capitalize">
                    {user.subscription?.plan ?? "starter"}
                  </p>
                </div>
                <span className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
                  {user.subscription?.status ?? "trialing"}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Usage for {currentPeriod}, across all active workspaces.
              </p>
            </div>
            <UsageMeter
              label="Document uploads"
              value={currentUsage.uploads}
              limit={uploadLimit}
            />
            <UsageMeter
              label="AI generations"
              value={currentUsage.aiGenerations}
              limit={proposalLimit}
            />
            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <div>
                <p className="font-medium">{currentUsage.exports}</p>
                <p className="text-xs text-muted-foreground">Exports this month</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/usage">
                  Full usage
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function UsageMeter({
  label,
  value,
  limit,
}: {
  label: string;
  value: number;
  limit: number;
}) {
  const percent = Math.min(100, Math.round((value / Math.max(limit, 1)) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value}/{limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 md:gap-4 md:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary md:size-11">
          <Icon className="size-4 md:size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs leading-tight text-muted-foreground md:text-sm">
            {label}
          </p>
          <p className="text-xl font-semibold tracking-normal md:text-2xl">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
