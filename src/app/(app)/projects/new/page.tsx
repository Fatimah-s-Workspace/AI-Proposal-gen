import { CreateProjectForm } from "@/components/projects/create-project-form";

export default function NewProjectPage() {
  return (
    <div className="space-y-8">
      <div>
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
