import { ArrowLeft, FileArchive } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportControls } from "@/components/projects/export-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TruncatedText } from "@/components/ui/truncated-text";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    include: {
      proposalSections: {
        orderBy: { order: "asc" },
      },
      exports: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  const draftCount = project.proposalSections.filter(
    (section) => section.content,
  ).length;

  return (
    <div className="space-y-8">
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-5 mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
              <Link href={`/projects/${project.id}`}>
                <ArrowLeft />
                Project
              </Link>
            </Button>
            <h1 className="text-3xl font-semibold tracking-normal">Export</h1>
            <p className="mt-2 text-muted-foreground">{project.title}</p>
          </div>
          <Badge
            variant={
              draftCount === project.proposalSections.length
                ? "success"
                : "warning"
            }
          >
            {draftCount}/{project.proposalSections.length} sections drafted
          </Badge>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <ExportControls projectId={project.id} />

        <Card>
          <CardHeader>
            <CardTitle>Export readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.proposalSections.map((section) => (
              <div
                key={section.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{section.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {section.wordTarget} word target
                  </p>
                </div>
                <Badge variant={section.content ? "success" : "secondary"}>
                  {section.content ? "drafted" : "pending"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Export history</CardTitle>
        </CardHeader>
        <CardContent>
          {project.exports.length ? (
            <>
              <div className="space-y-3 md:hidden">
                {project.exports.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <FileArchive className="mt-0.5 size-4 shrink-0 text-primary" />
                        <TruncatedText
                          text={item.fileName}
                          className="min-w-0 flex-1 font-medium"
                        />
                      </div>
                      <Badge variant="success" className="shrink-0">
                        {item.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="uppercase">{item.format}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                      <Link href={`/api/exports/${item.id}/download`}>
                        Download
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>

              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.exports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileArchive className="size-4 text-primary" />
                          <span className="font-medium">{item.fileName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.filePath}
                        </p>
                      </TableCell>
                      <TableCell className="uppercase">{item.format}</TableCell>
                      <TableCell>
                        <Badge variant="success">{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/api/exports/${item.id}/download`}>
                            Download
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              DOCX and PDF exports will be listed here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
