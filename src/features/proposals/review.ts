/**
 * The states a proposal section moves through while several people work on
 * one bid against a deadline.
 *
 * These existed already, in two places that disagreed: one route accepted
 * six values, another four, and the editor autosaves through the shorter one.
 * A section set to "needs_work" by a reviewer was rejected the next time the
 * writer's editor saved it - the review state a person had deliberately set
 * could be undone by someone else simply typing.
 */

export const PROPOSAL_SECTION_STATUSES = [
  "not_started",
  "drafting",
  "review",
  "needs_work",
  "approved",
] as const;

export type ProposalSectionStatus = (typeof PROPOSAL_SECTION_STATUSES)[number];

const LABELS: Record<ProposalSectionStatus, string> = {
  not_started: "Not started",
  drafting: "Drafting",
  review: "In review",
  needs_work: "Needs work",
  approved: "Approved",
};

export function statusLabel(status: string): string {
  return LABELS[status as ProposalSectionStatus] ?? "Drafting";
}

export function isProposalSectionStatus(value: string): value is ProposalSectionStatus {
  return (PROPOSAL_SECTION_STATUSES as readonly string[]).includes(value);
}

/**
 * Whether editing should move a section back to "drafting".
 *
 * Typing in a section is not a review decision, so it must not silently
 * overwrite one - but a section that was approved and has since been edited
 * is no longer the text that was approved, and leaving the badge saying
 * "Approved" would be a false statement about work someone signed off.
 *
 * So: editing an approved or in-review section returns it to drafting, and
 * editing anything else leaves the state alone.
 */
export function statusAfterEdit(current: string): ProposalSectionStatus {
  if (current === "approved" || current === "review") return "drafting";
  if (isProposalSectionStatus(current)) return current === "not_started" ? "drafting" : current;
  return "drafting";
}

/** Whether a section still needs attention before the bid goes out. */
export function isOutstanding(status: string): boolean {
  return status !== "approved";
}
