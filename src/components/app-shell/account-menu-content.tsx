"use client";

import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/ui/truncated-text";
import { initials } from "@/lib/utils";

export type AccountMenuUser = {
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
  subscription?: {
    plan: string;
    status: string;
  } | null;
};

export function AccountMenuContent({ user }: { user: AccountMenuUser }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-sm font-semibold">
          {initials(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <TruncatedText
            text={user.companyName || user.name || "TenderFlow user"}
            className="text-sm font-medium"
          />
          <TruncatedText
            text={user.email ?? ""}
            className="text-xs text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Badge variant="secondary">
          {user.subscription?.plan ?? "starter"}
        </Badge>
        <ThemeToggle />
      </div>

      <SignOutButton />
    </>
  );
}
