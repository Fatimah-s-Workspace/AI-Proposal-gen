import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { EditProjectButton } from "@/components/projects/edit-project-button";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsSearch } from "@/components/projects/projects-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TruncatedText } from "@/components/ui/truncated-text";
import { toProjectFormValues } from "@/lib/project-form-values";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const projects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      // Searching server-side rather than filtering the rendered rows, so it
      // still finds things once a workspace outgrows one page of projects.
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { clientName: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          requirements: true,
          proposalSections: true,
          exports: true,
        },
      },
    },
  });
  const now = new Date().getTime();

  return (
    <div className="space-y-8">
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-5 mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              Submission pipeline
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">Projects</h1>
            <p className="mt-2 text-muted-foreground">
              Manage tenders, grants, RFQs, and proposal submissions from intake
              to export.
            </p>
          </div>
          <NewProjectButton />
        </div>
        <div className="mt-4">
          <ProjectsSearch initialQuery={query} />
        </div>
      </div>

      {projects.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-xl border bg-card p-4 active:bg-muted/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <TruncatedText text={project.title} className="font-semibold" />
                    <TruncatedText
                      text={project.clientName}
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {project.opportunityType}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <Badge
                    variant={project.stage === "drafting" ? "success" : "outline"}
                  >
                    {project.stage.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(project.updatedAt, now)}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
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

                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex gap-3">
                    <span>{project._count.documents} docs</span>
                    <span>{project._count.requirements} reqs</span>
                    <span>{project._count.exports} exports</span>
                  </div>
                  <span>{formatDate(project.deadline)}</span>
                </div>
              </Link>
            ))}
          </div>

          <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Project</TableHead>
                    <TableHead className="min-w-40">Client</TableHead>
                    <TableHead className="min-w-32">Type</TableHead>
                    <TableHead className="min-w-28">Stage</TableHead>
                    <TableHead className="min-w-32">Compliance</TableHead>
                    <TableHead className="min-w-40">Stats</TableHead>
                    <TableHead className="min-w-32">Deadline</TableHead>
                    <TableHead className="min-w-28">Updated</TableHead>
                    <TableHead className="min-w-24 text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="max-w-64">
                        <Link
                          href={`/projects/${project.id}`}
                          className="hover:text-primary"
                        >
                          <TruncatedText
                            text={project.title}
                            className="font-semibold"
                          />
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-48 text-sm text-muted-foreground">
                        <TruncatedText text={project.clientName} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {project.opportunityType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            project.stage === "drafting" ? "success" : "outline"
                          }
                        >
                          {project.stage.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <Progress value={project.complianceScore} />
                          </div>
                          <span className="text-sm font-medium">
                            {project.complianceScore}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex gap-4">
                          <span>{project._count.documents} docs</span>
                          <span>{project._count.requirements} reqs</span>
                          <span>{project._count.exports} exports</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(project.deadline)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeDate(project.updatedAt, now)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2">
                          <EditProjectButton
                            project={toProjectFormValues(project)}
                            label="Edit"
                            size="sm"
                          />
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/projects/${project.id}`}>
                              Open
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          </Card>
        </>
      ) : query ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-lg font-medium">
            No projects match &ldquo;{query}&rdquo;
          </p>
          <p className="mt-2 text-muted-foreground">
            Search covers project titles and client names.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-lg font-medium">No project workspaces yet</p>
          <p className="mt-2 text-muted-foreground">
            Create a project and upload a tender document to begin extraction.
          </p>
          <div className="mt-5 flex justify-center">
            <NewProjectButton label="Create project" />
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date | null) {
  if (!date) return "No deadline";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatRelativeDate(date: Date, now: number) {
  const diffDays = Math.floor((now - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
  }).format(date);
}
