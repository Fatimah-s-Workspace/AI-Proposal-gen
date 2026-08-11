// Audit actions are namespaced ("document.upload", "member.role_update"), so
// a category is just the set of prefixes that belong to it. Shared between the
// filter UI and the page's query so the two can't drift apart.
export const ACTIVITY_CATEGORIES = [
  { value: "all", label: "All activity", prefixes: [] },
  { value: "documents", label: "Documents", prefixes: ["document."] },
  { value: "requirements", label: "Requirements", prefixes: ["requirement."] },
  {
    value: "proposals",
    label: "Proposals",
    prefixes: ["proposal.", "proposal_section."],
  },
  { value: "exports", label: "Exports", prefixes: ["export."] },
  { value: "team", label: "Team", prefixes: ["member."] },
  { value: "workspace", label: "Workspace", prefixes: ["organization."] },
  { value: "billing", label: "Billing", prefixes: ["payment."] },
] as const;

export const ACTIVITY_RANGES = [
  { value: "all", label: "All time", days: null },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["value"];
export type ActivityRange = (typeof ACTIVITY_RANGES)[number]["value"];

export function resolveCategory(value?: string): ActivityCategory {
  return ACTIVITY_CATEGORIES.some((c) => c.value === value)
    ? (value as ActivityCategory)
    : "all";
}

export function resolveRange(value?: string): ActivityRange {
  return ACTIVITY_RANGES.some((r) => r.value === value)
    ? (value as ActivityRange)
    : "all";
}

/** Prefix matches for a category, or null when nothing should be narrowed. */
export function categoryPrefixes(category: ActivityCategory): string[] | null {
  const match = ACTIVITY_CATEGORIES.find((c) => c.value === category);
  return match && match.prefixes.length > 0 ? [...match.prefixes] : null;
}

/** The oldest timestamp a range includes, or null for "all time". */
export function rangeStart(range: ActivityRange, now: Date): Date | null {
  const match = ACTIVITY_RANGES.find((r) => r.value === range);
  if (!match?.days) return null;
  return new Date(now.getTime() - match.days * 24 * 60 * 60 * 1000);
}
