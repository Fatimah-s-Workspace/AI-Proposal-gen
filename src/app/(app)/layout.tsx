"use client";

import { MobileHeader } from "@/components/app-shell/mobile-header";
import { Sidebar } from "@/components/app-shell/sidebar";
import { AppProvider, useApp } from "@/providers/app-provider";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useApp();
  const router = useRouter();

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) router.refresh();
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  return (
    <div className="min-h-svh bg-background">
      <Sidebar user={null} />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-72",
        )}
      >
        <MobileHeader />
        <main className="mx-auto w-full max-w-8xl px-4 py-6 pt-24 sm:px-6  lg:pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <LayoutContent>{children}</LayoutContent>
    </AppProvider>
  );
}
