"use client";

import { BarChart3, FolderKanban, History, Home, PlusCircle } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems: Array<{ href: Route; icon: typeof Home; label: string }> = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/projects/new", icon: PlusCircle, label: "New" },
  { href: "/usage", icon: BarChart3, label: "Usage" },
  { href: "/activity", icon: History, label: "Activity" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const isCreate = item.href === "/projects/new";

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors",
              active && !isCreate && "text-primary",
            )}
            aria-current={active ? "page" : undefined}
          >
            {isCreate ? (
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
            ) : (
              <Icon className={cn("size-5", active && "text-primary")} />
            )}
            <span className={isCreate ? "text-primary" : undefined}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
