"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  applyTheme,
  parseThemePreference,
  readThemePreference,
  saveThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** The head script owns first paint; React starts with deterministic SSR values. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [preference, setStoredPreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const currentPreference = useRef<ThemePreference>("system");

  const syncPreference = useCallback((next: ThemePreference) => {
    currentPreference.current = next;
    setStoredPreference(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  useEffect(() => {
    syncPreference(readThemePreference());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (currentPreference.current === "system") {
        setResolvedTheme(applyTheme("system"));
      }
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      // sessionStorage can also emit storage events between same-tab frames.
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      syncPreference(parseThemePreference(event.newValue));
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, [syncPreference]);

  useEffect(() => {
    // App Router writes viewport metadata on each navigation. Reapply the live
    // choice after that commit, including choices made while storage is blocked.
    applyTheme(currentPreference.current);
  }, [pathname]);

  const setPreference = useCallback((next: ThemePreference) => {
    syncPreference(next);
    saveThemePreference(next);
  }, [syncPreference]);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve estar dentro de ThemeProvider.");
  return context;
}
