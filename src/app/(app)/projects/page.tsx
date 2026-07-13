import { ArrowRight, PlusCircle } from "lucide-react";
import Link from "next/link";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { ai } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const models = await ai.models.list();
  console.log("Available AI models:", models);
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
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

  return (
    <div className="space-y-8">
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
        <Button asChild>
          <Link href="/projects/new">
            <PlusCircle />
            New project
          </Link>
        </Button>
      </div>

      {projects.length > 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Project</TableHead>
                    <TableHead className="min-w-40">Client</TableHead>
                    <TableHead className="min-w-32">Type</TableHead>
                    <TableHead className="min-w-32">Compliance</TableHead>
                    <TableHead className="min-w-40">Stats</TableHead>
                    <TableHead className="min-w-32">Deadline</TableHead>
                    <TableHead className="min-w-24 text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/projects/${project.id}`}
                                className="font-semibold hover:text-primary line-clamp-1"
                              >
                                {project.title}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center">
                              {project.title}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {project.clientName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {project.opportunityType}
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
                        <TableCell className="text-right">
                          <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/projects/${project.id}/edit`}>
                                Edit
                              </Link>
                            </Button>
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
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-lg font-medium">No project workspaces yet</p>
          <p className="mt-2 text-muted-foreground">
            Create a project and upload a tender document to begin extraction.
          </p>
          <Button asChild className="mt-5">
            <Link href="/projects/new">Create project</Link>
          </Button>
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
