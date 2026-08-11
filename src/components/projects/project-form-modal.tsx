"use client";

import { Modal } from "@/components/ui/modal";
import { ProjectForm } from "@/components/projects/project-form";
import type { ProjectFormValues } from "@/lib/project-form-values";

export function ProjectFormModal({
  isOpen,
  onClose,
  project,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Omitted when creating. */
  project?: ProjectFormValues;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description={
        project
          ? "Changes apply to drafts generated from here on."
          : "Set up the opportunity. Only the title and client are required."
      }
      className="sm:max-w-2xl"
    >
      {/* Remounts per open so a cancelled edit doesn't leave its half-typed
          state behind for the next one. */}
      <ProjectForm key={project?.id ?? "new"} project={project} onDone={onClose} />
    </Modal>
  );
}
