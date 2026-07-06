"use client";

import { FilePlus2, FolderKanban, Home } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { cn } from "@/lib/utils";

const mobileItems: Array<{ href: Route; icon: typeof Home; label: string }> = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/projects/new", icon: FilePlus2, label: "New" },
];

export function MobileHeader() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 z-40 w-full border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold">
          TenderFlow AI
        </Link>
        <ThemeToggle />
      </div>
      <nav className="grid grid-cols-3 gap-2">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-muted-foreground",
                active && "border-primary bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
