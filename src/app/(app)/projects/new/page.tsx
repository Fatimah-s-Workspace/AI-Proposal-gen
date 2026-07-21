import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { Button } from "@/components/ui/button";

export default function NewProjectPage() {
  return (
    <div className="space-y-8">
      <div>
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
        <p className="text-sm font-medium text-primary">New submission</p>
        <h1 className="text-3xl font-semibold tracking-normal">Create project</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Capture the opportunity context first. TenderFlow AI will create proposal sections and wait for your tender pack.
        </p>
      </div>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <CreateProjectForm />
      </section>
    </div>
  );
}
