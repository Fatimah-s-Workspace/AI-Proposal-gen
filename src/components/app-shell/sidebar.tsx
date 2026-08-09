"use client";

import {
  BarChart3,
  ChevronDown,
  FolderKanban,
  History,
  Home,
  Users,
  ChevronsRightIcon,
  ChevronsLeftIcon,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AccountMenuContent,
  type AccountMenuUser,
} from "@/components/app-shell/account-menu-content";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/ui/truncated-text";
import { cn, initials } from "@/lib/utils";

import { useApp } from "@/providers/app-provider";

type SidebarProps = {
  user?: AccountMenuUser | null;
};

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof Home;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: History },
  { href: "/settings/team", label: "Team", icon: Users },
];

export function Sidebar({ user: initialUser }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed, projects, refreshProjects } =
    useApp();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    if (pathname.startsWith("/projects")) {
      refreshProjects();
    }
    // Fetch user data if not provided
    if (!user) {
      fetch("/api/auth/session")
        .then((res) => res.json())
        .then((data) => setUser(data.user))
        .catch(console.error);
    }
  }, [pathname, refreshProjects, user]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 hidden min-h-svh shrink-0 border-r bg-card transition-all duration-300 lg:flex lg:flex-col",
        sidebarCollapsed ? "w-16" : "max-w-xs w-72",
      )}
    >
      <div className="border-b p-5 relative">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                TF
              </div>
              <div>
                <p className="font-semibold tracking-normal">TenderFlow AI</p>
                <p className="text-xs text-muted-foreground">
                  Proposal workspace
                </p>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link
              href="/dashboard"
              className="flex size-6 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
            >
              TF
            </Link>
          )}
          <Button
            variant="link"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="size-8 p-0 absolute -right-4"
          >
            {sidebarCollapsed ? (
              <ChevronsRightIcon className="size-4" />
            ) : (
              <ChevronsLeftIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>
      <TooltipProvider>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            if (item.href === "/projects") {
              const active = pathname.startsWith(item.href);
              if (sidebarCollapsed) {
                // Popover version for collapsed sidebar
                return (
                  <Popover
                    key={item.href}
                    open={projectsOpen}
                    onOpenChange={setProjectsOpen}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                              active && "bg-primary/10 text-primary",
                              "justify-center px-2",
                            )}
                          >
                            <FolderKanban className="size-4" />
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                    <PopoverContent side="right" className="w-56 p-3">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">{item.label}</h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {projects.map((project) => (
                            <Link
                              key={project.id}
                              href={`/projects/${project.id}`}
                              onClick={() => setProjectsOpen(false)}
                              className={cn(
                                "block rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
                                pathname === `/projects/${project.id}` &&
                                  "bg-primary/10 text-primary",
                              )}
                            >
                              <TruncatedText
                                text={project.title}
                                className="font-medium"
                              />
                              <TruncatedText
                                text={project.clientName}
                                className="text-xs text-muted-foreground"
                              />
                            </Link>
                          ))}
                          <Link
                            href="/projects"
                            onClick={() => setProjectsOpen(false)}
                            className="block rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            View all projects
                          </Link>
                          <Link
                            href="/projects/new"
                            onClick={() => setProjectsOpen(false)}
                            className="block rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            + New project
                          </Link>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              // Normal version for expanded sidebar
              return (
                <div key={item.href}>
                  <button
                    onClick={() => setShowProjects(!showProjects)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      active && "bg-primary/10 text-primary",
                    )}
                  >
                    <FolderKanban className="size-4" />
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "ml-auto size-4 transition-transform",
                        showProjects && "rotate-180",
                      )}
                    />
                  </button>
                  {showProjects && (
                    <div className="ml-7 mt-1 max-h-48 overflow-y-auto space-y-1">
                      {projects.map((project) => (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className={cn(
                            "block rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
                            pathname === `/projects/${project.id}` &&
                              "bg-primary/10 text-primary",
                          )}
                        >
                          <TruncatedText
                            text={project.title}
                            className="font-medium"
                          />
                          <TruncatedText
                            text={project.clientName}
                            className="text-muted-foreground"
                          />
                        </Link>
                      ))}
                      <Link
                        href="/projects"
                        className="block rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        View all projects
                      </Link>
                      <Link
                        href="/projects/new"
                        className="block rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        + New project
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href as Route}
                      className={cn(
                        "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        active && "bg-primary/10 text-primary",
                        "justify-center px-2",
                      )}
                    >
                      <Icon className="size-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </TooltipProvider>

      {user && (
        <div
          className={cn(
            "border-t",
            sidebarCollapsed ? "p-3 space-y-2" : "space-y-4 p-4",
          )}
        >
          {sidebarCollapsed ? (
            <Popover key="signout">
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    "justify-center px-2",
                  )}
                >
                  {initials(user.name)}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right">
                <AccountMenuContent user={user} />
              </PopoverContent>
            </Popover>
          ) : (
            <AccountMenuContent user={user} />
          )}
        </div>
      )}
    </aside>
  );
}
