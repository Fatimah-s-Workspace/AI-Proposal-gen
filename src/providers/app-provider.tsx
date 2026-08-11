"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type Project = {
  id: string;
  title: string;
  clientName: string;
  stage: string;
  _count: {
    documents: number;
    requirements: number;
  };
};

type AppContextType = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  projects: Project[];
  // False until a fetch has actually resolved, so an empty `projects` can be
  // told apart from "we haven't looked yet" - the two need different UI.
  projectsLoaded: boolean;
  refreshProjects: () => Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) return;
      const data = await response.json();
      setProjects(data.projects ?? []);
      setProjectsLoaded(true);
    } catch (error) {
      console.error("Failed to refresh projects:", error);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        projects,
        projectsLoaded,
        refreshProjects,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
