"use client";

import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TruncatedText } from "@/components/ui/truncated-text";

type Project = {
  id: string;
  title: string;
  clientName: string;
  opportunityType: string;
  stage: string;
  sector: string;
  country: string;
  deadline: Date | null;
  authority: string | null;
};

type ProjectHeaderProps = {
  project: Project;
  canDelete?: boolean;
};

export function ProjectHeader({ project, canDelete = true }: ProjectHeaderProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/projects" as Route);
      } else {
        console.error("Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-5 mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-3 mb-2 text-muted-foreground"
            >
              <Link href="/projects">
                <ArrowLeft className="size-4" />
                All projects
              </Link>
            </Button>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{project.opportunityType}</Badge>
              <Badge
                variant={project.stage === "drafting" ? "success" : "outline"}
              >
                {project.stage}
              </Badge>
            </div>

            <TruncatedText
              as="h2"
              text={project.title}
              className="text-3xl font-semibold tracking-normal"
              tooltipSide="bottom"
            />
            <TruncatedText
              as="p"
              text={`${project.clientName} · ${project.sector} · ${project.country}`}
              className="mt-2 text-muted-foreground"
              tooltipSide="bottom"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${project.id}/edit`}>Edit project</Link>
            </Button>
            {canDelete ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Delete Project
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/projects/${project.id}/export`}>Export</Link>
            </Button>
            <Button asChild>
              <Link href={`/projects/${project.id}/workspace`}>Open workspace</Link>
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        description="Are you sure you want to delete this project? This will permanently delete all documents, requirements, and proposal content. This action cannot be undone."
        confirmText="Delete Project"
      />
    </>
  );
}
