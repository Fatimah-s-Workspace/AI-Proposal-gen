"use client";

import { Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

// Only meaningful inside a <Link>: useLinkStatus reports that link's own
// pending state.
//
// This replaces the per-route loading.tsx skeletons. Those swapped the whole
// content area out for pulsing placeholders and back again, and since pages
// render in tens of milliseconds the swap read as the page refreshing rather
// than as loading. Holding the current page and marking the link being
// navigated to is quieter and says the same thing.
export function NavPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  // The delay is CSS rather than a timer: a navigation that resolves in 20ms
  // should show nothing at all, and starting the fade only after 150ms gets
  // that without a state update per render pass.
  return (
    <span
      aria-hidden
      className={cn("opacity-0 [animation:nav-pending-in_120ms_150ms_forwards]", className)}
    >
      <Loader2 className="size-3.5 shrink-0 animate-spin" />
    </span>
  );
}
