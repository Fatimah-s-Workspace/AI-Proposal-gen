"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_RANGES,
  type ActivityCategory,
  type ActivityRange,
} from "@/lib/activity-filters";

export function ActivityFilters({
  category,
  range,
}: {
  category: ActivityCategory;
  range: ActivityRange;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(key: "category" | "range", value: string) {
    // Rebuilt from the resolved props rather than merged into the existing
    // query, so a value the page fell back on (an unrecognized ?range=, say)
    // is rewritten to what's actually on screen instead of lingering in the
    // URL and contradicting it. Page 4 of the old filter is meaningless
    // under the new one - often past the end of it - so paging resets too.
    const next = { category, range, [key]: value };
    const params = new URLSearchParams();

    if (next.category !== "all") params.set("category", next.category);
    if (next.range !== "all") params.set("range", next.range);

    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, {
      scroll: false,
    });
  }

  const filtered = category !== "all" || range !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={category} onValueChange={(v) => apply("category", v)}>
        <SelectTrigger className="h-9 w-auto min-w-40" aria-label="Filter by type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTIVITY_CATEGORIES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={range} onValueChange={(v) => apply("range", v)}>
        <SelectTrigger className="h-9 w-auto min-w-36" aria-label="Filter by date">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTIVITY_RANGES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filtered ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname as Route, { scroll: false })}
        >
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
