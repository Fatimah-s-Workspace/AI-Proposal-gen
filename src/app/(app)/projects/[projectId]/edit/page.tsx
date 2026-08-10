import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditProjectForm } from "@/components/projects/edit-project-form";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

interface EditProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EditProjectPage({
  params,
}: EditProjectPageProps) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: user.organizationId,
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-5 mb-8">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="size-4" />
              Back to project
            </Link>
          </Button>
        </div>

        <div>
          <p className="text-sm font-medium text-primary">Edit submission</p>
          <h1 className="text-3xl font-semibold tracking-normal">
            Update project
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Modify the opportunity details and save the project changes.
          </p>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <EditProjectForm
          project={{
            id: project.id,
            title: project.title,
            clientName: project.clientName,
            opportunityType: project.opportunityType,
            sector: project.sector,
            country: project.country,
            authority: project.authority,
            deadline: project.deadline ? project.deadline.toISOString() : null,
            budgetRange: project.budgetRange ?? "",
            summary: project.summary ?? "",
          }}
        />
      </section>
    </div>
  );
}
