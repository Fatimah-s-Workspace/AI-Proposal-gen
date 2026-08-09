"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AccountMenuContent,
  type AccountMenuUser,
} from "@/components/app-shell/account-menu-content";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { initials } from "@/lib/utils";

export function MobileHeader() {
  const [user, setUser] = useState<AccountMenuUser | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 z-40 flex w-full items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          TF
        </div>
        <span className="font-semibold tracking-normal">TenderFlow AI</span>
      </Link>
      {/* The Popover is keyed on the route so following a link inside the
          menu remounts it closed - client-side navigation alone doesn't
          unmount this header, so it would otherwise stay open over the
          page the user just moved to. */}
      {user && (
        <Popover key={pathname}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold"
            >
              {initials(user.name)}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-4">
            <AccountMenuContent user={user} />
          </PopoverContent>
        </Popover>
      )}
    </header>
  );
}
