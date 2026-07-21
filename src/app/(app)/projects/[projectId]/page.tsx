import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftChecklist } from "@/components/projects/draft-checklist";
import { DocumentsTable } from "@/components/projects/documents-table";
import { ProjectHeader } from "@/components/projects/project-header";
import { UploadDropzone } from "@/components/projects/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
        include: {
          parsedSections: true,
        },
      },
      requirements: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
      proposalSections: {
        orderBy: { order: "asc" },
      },
      exports: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!project) notFound();

  const completedSections = project.proposalSections.filter(
    (section) => section.content,
  ).length;

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} />

      <UploadDropzone projectId={project.id} />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Compliance</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-semibold tracking-normal">
                {project.complianceScore}%
              </p>
              <p className="text-sm text-muted-foreground">
                {project.requirements.length} requirements
              </p>
            </div>
            <Progress value={project.complianceScore} className="mt-4" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Draft sections</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal">
              {completedSections}/{project.proposalSections.length}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Autosave and version history enabled in the editor.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Submission deadline</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal">
              {formatDate(project.deadline)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {project.authority || "Authority not specified"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {project.documents.length ? (
              <DocumentsTable
                documents={project.documents.map((doc) => ({
                  id: doc.id,
                  originalName: doc.originalName,
                  size: doc.size,
                  status: doc.status,
                  parsingStatus: doc.parsingStatus,
                  parsingError: doc.parsingError,
                  parsedAt: doc.parsedAt,
                  documentType: doc.documentType,
                  isPrimary: doc.isPrimary,
                  version: doc.version,
                  parentId: doc.parentId,
                  revisionNotes: doc.revisionNotes,
                  createdAt: doc.createdAt,
                }))}
                projectId={project.id}
                // onMarkPrimary={() => window.location.reload()}
              />
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No documents uploaded yet. Use the upload area above to get
                started.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Parsed tender details</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${project.id}/parsed-overview`}>
                Full overview
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto pr-4">
            {project.documents.length &&
            project.documents[0].parsedSections?.length ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Latest parsed document
                  </p>
                  <p className="mt-1 font-medium">
                    {project.documents[0].originalName}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs uppercase tracking-[.2em] text-muted-foreground">
                      Parsed sections
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {project.documents[0].parsedSections.length}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs uppercase tracking-[.2em] text-muted-foreground">
                      Last parsed
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {project.documents[0].parsedAt
                        ? formatDate(project.documents[0].parsedAt)
                        : "Not yet parsed"}
                    </p>
                  </div>
                </div>
                <details className="rounded-md border p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    View parsed sections
                  </summary>
                  <div className="mt-4 max-h-[300px] space-y-3 overflow-y-auto pr-1">
                    {project.documents[0].parsedSections.map((section) => (
                      <div key={section.id} className="rounded-md border p-3">
                        <p className="text-sm font-semibold">{section.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                          {section.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
                <details className="rounded-md border p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    View raw document payload
                  </summary>
                  <pre className="mt-4 max-h-[320px] overflow-auto rounded-md border bg-muted/50 p-3 text-xs text-foreground">
                    {JSON.stringify(
                      {
                        parsedSections: project.documents[0].parsedSections,
                        parsingStatus: project.documents[0].parsingStatus,
                        parsingError: project.documents[0].parsingError,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                No parsed tender data is available yet. Upload a document to
                start extraction.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Draft against checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Draft against checklist</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Generate proposal content that addresses your key requirements
          </p>
        </CardHeader>
        <CardContent>
          <DraftChecklist
            requirements={project.requirements.map((requirement) => ({
              id: requirement.id,
              title: requirement.title,
              description: requirement.description,
              category: requirement.category,
              sourceClause: requirement.sourceClause,
              priority: requirement.priority,
              status: requirement.status,
              owner: requirement.owner,
            }))}
            proposalSections={project.proposalSections.map((section) => ({
              id: section.id,
              title: section.title,
              content: section.content,
              sectionType: section.sectionType,
              status: section.status,
              wordTarget: section.wordTarget,
            }))}
            projectId={project.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(date: Date | null) {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
