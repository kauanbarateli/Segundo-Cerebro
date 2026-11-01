"use client";

import { Icons } from "@/components/ui/icons";
import { useThemeChoice } from "./theme-selector";
import "./theme-toggle.css";

/**
 * One click swaps the resolved theme, light ↔ dark, through the shared write path
 * (browser first, then the connected account). The icon and the accessible name show the
 * action, not the state. "Sistema" stays in Configurações and in the login switcher.
 */
export function ThemeToggle() {
  const { resolvedTheme, choose } = useThemeChoice();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Ativar tema escuro" : "Ativar tema claro";
  const Icon = next === "dark" ? Icons.Moon : Icons.Sun;
  return (
    <button type="button" className="theme-toggle theme-toggle--button" aria-label={label} title={label} onClick={() => choose(next)}>
      <Icon className="theme-toggle__icon" />
    </button>
  );
}
