"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start"
      onClick={() => signOut({ callbackUrl })}
    >
      <LogOut />
      Sign out
    </Button>
  );
}
