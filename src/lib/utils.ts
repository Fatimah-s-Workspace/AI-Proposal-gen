import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function initials(name?: string | null) {
  if (!name) return "TF";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function truncate(text: string, length = 120) {
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

// Appends a random suffix rather than checking for collisions against the DB,
// since Organization.slug isn't user-facing/routable yet (Phase 2 territory)
// - it just needs to satisfy the unique constraint.
export function slugifyOrganizationName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "org"}-${suffix}`;
}
