"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ScheduleTheme = "dark" | "light";

interface ScheduleThemeContextValue {
  theme: ScheduleTheme;
  toggleTheme: () => void;
}

const ScheduleThemeContext = createContext<ScheduleThemeContextValue | null>(
  null
);

const STORAGE_KEY = "schedule-theme";
const DEFAULT_THEME: ScheduleTheme = "dark";

export function ScheduleThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ScheduleTheme>(DEFAULT_THEME);

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ScheduleThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        data-schedule-theme={theme}
        style={{
          backgroundColor: "var(--sch-bg)",
          color: "var(--sch-text)",
          minHeight: "100%",
        }}
      >
        {children}
      </div>
    </ScheduleThemeContext.Provider>
  );
}

export function useScheduleTheme(): ScheduleThemeContextValue {
  const ctx = useContext(ScheduleThemeContext);
  if (!ctx) {
    throw new Error(
      "useScheduleTheme must be used within a ScheduleThemeProvider"
    );
  }
  return ctx;
}
