"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import {
  PROPOSAL_SECTION_STATUSES,
  statusLabel,
  type ProposalSectionStatus,
} from "@/features/proposals/review";

const TONE: Record<ProposalSectionStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  drafting: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  review: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  needs_work: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  approved: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
};

/**
 * Where a section stands, and the one control that moves it.
 *
 * Deliberately separate from the editor's autosave. Typing is not a review
 * decision, and for a long time it behaved as one: the save endpoint took a
 * status from the request and defaulted it to "drafting", so a reviewer's
 * "needs work" was erased the moment the writer touched the section.
 */
export function SectionStatusControl({
  projectId,
  sectionId,
  status,
}: {
  projectId: string;
  sectionId: string;
  status: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);

  const update = useMutation({
    mutationFn: async (next: ProposalSectionStatus) => {
      const response = await fetch(
        `/api/projects/${projectId}/proposal-sections/${sectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      if (!response.ok) throw new Error("Could not update this section");
      return next;
    },
    onSuccess: (next) => {
      setCurrent(next);
      router.refresh();
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Review state</h4>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            TONE[current as ProposalSectionStatus] ?? TONE.drafting
          }`}
        >
          {statusLabel(current)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PROPOSAL_SECTION_STATUSES.filter((value) => value !== "not_started").map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={value === current ? "default" : "outline"}
            className="h-7 text-xs"
            disabled={update.isPending || value === current}
            onClick={() => update.mutate(value)}
          >
            {statusLabel(value)}
          </Button>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Editing an approved section returns it to drafting - the text that was
        approved no longer exists. A request for changes stays until someone
        acts on it.
      </p>

      {update.isError ? (
        <Feedback tone="error">Could not change the review state.</Feedback>
      ) : null}
    </div>
  );
}
