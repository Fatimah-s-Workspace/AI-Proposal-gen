"use client";

import { type ReactNode, useEffect } from "react";

function applyStoredTheme() {
  const stored = window.localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = stored ? stored === "dark" : prefersDark;
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyStoredTheme();

    function handleStorage(event: StorageEvent) {
      if (event.key === "theme") applyStoredTheme();
    }

    function handlePageShow() {
      applyStoredTheme();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return children;
}
