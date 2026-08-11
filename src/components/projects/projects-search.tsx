"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export function ProjectsSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Nothing to push on mount - the server already rendered this query.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Searching hits the database on every keystroke otherwise, and each
    // navigation re-renders the whole list. A short debounce keeps typing
    // responsive without turning the list into a strobe light.
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();

      if (trimmed) params.set("q", trimmed);
      else params.delete("q");

      const query = params.toString();
      // scroll:false so the page doesn't jump back to the top mid-search.
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, {
        scroll: false,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="relative w-full md:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search projects or clients"
        aria-label="Search projects"
        className="pl-9 pr-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
