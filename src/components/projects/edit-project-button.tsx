"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import type { ProjectFormValues } from "@/lib/project-form-values";
import { Button } from "@/components/ui/button";

export function EditProjectButton({
  project,
  label = "Edit project",
  size,
  variant = "outline",
  openFromUrl = false,
}: {
  project: ProjectFormValues;
  label?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  /** Only the project page honours ?edit=1 - on a list, every row would open. */
  openFromUrl?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // /projects/<id>/edit redirects here with ?edit=1 rather than 404ing, so
  // existing links and bookmarks still open the form.
  const openedByUrl = openFromUrl && searchParams.get("edit") === "1";
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    if (openedByUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("edit");
      const query = params.toString();
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, {
        scroll: false,
      });
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ProjectFormModal
        isOpen={open || openedByUrl}
        onClose={close}
        project={project}
      />
    </>
  );
}
