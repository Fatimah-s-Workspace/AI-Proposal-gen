"use client";

import { PlusCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import { Button } from "@/components/ui/button";

export function NewProjectButton({
  label = "New project",
  variant,
  className,
}: {
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // /projects/new redirects here with ?new=1 rather than 404ing, so bookmarks,
  // the mobile "New" tab, and the sidebar link all still land on the form.
  const openedByUrl = searchParams.get("new") === "1";
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    if (openedByUrl) {
      // Drop the parameter, or closing the modal leaves a URL that reopens it
      // on the next refresh.
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      const query = params.toString();
      router.replace(query ? `/projects?${query}` : "/projects", {
        scroll: false,
      });
    }
  }

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        <PlusCircle />
        {label}
      </Button>
      <ProjectFormModal isOpen={open || openedByUrl} onClose={close} />
    </>
  );
}
