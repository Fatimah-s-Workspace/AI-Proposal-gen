import {
  ArrowRight,
  FileText,
  FolderKanban,
  PlusCircle,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [projects, usage] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
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
      where: { userId: user.id },
      orderBy: { period: "desc" },
      take: 24,
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
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const currentUsage = usage
    .filter((period) => period.period === currentPeriod)
    .reduce(
      (acc, period) => ({
        uploads: acc.uploads + period.uploads,
        aiGenerations: acc.aiGenerations + period.aiGenerations,
        exports: acc.exports + period.exports,
        tokensUsed: acc.tokensUsed + period.tokensUsed,
      }),
      { uploads: 0, aiGenerations: 0, exports: 0, tokensUsed: 0 },
    );
  const uploadLimit = user.subscription?.monthlyUploadLimit ?? 100;
  const proposalLimit = user.subscription?.monthlyProposalLimit ?? 10;

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3 mb-8">
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
          <Button asChild>
            <Link href="/projects/new">
              <PlusCircle />
              New project
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
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
                {projects
                  .map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="grid gap-3 p-4 transition-colors hover:bg-muted/60 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.clientName}
                        </p>
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
                  ))
                  .splice(0, 4)}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center">
                <p className="font-medium">No projects yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first tender workspace and upload the RFP pack.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/projects/new">Create project</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="usage" className="md:col-span-1">
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
                Usage for {currentPeriod}. Uploads and AI actions are counted
                across all active workspaces.
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
            <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <p className="font-medium">{currentUsage.exports}</p>
                <p className="text-xs text-muted-foreground">Exports</p>
              </div>
              <div>
                <p className="font-medium">
                  {currentUsage.tokensUsed.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Mock tokens</p>
              </div>
            </div>
            {usage.length > 1 && (
              <>
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Usage history
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {usage.map((period) => (
                      <div
                        key={period.id}
                        className="flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50"
                      >
                        <span className="text-muted-foreground">
                          {period.period}
                        </span>
                        <div className="flex gap-2 text-right">
                          <span>
                            {period.uploads}
                            <span className="text-muted-foreground ml-1">
                              up
                            </span>
                          </span>
                          <span>
                            {period.aiGenerations}
                            <span className="text-muted-foreground ml-1">
                              ai
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
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
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-normal">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
