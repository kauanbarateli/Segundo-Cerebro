"use client";

import { useId } from "react";
import { parseThemePreference } from "@/lib/theme";
import { useTheme } from "./theme-provider";

export function ThemeSelector() {
  const id = useId();
  const { preference, setPreference } = useTheme();

  return (
    <div className="theme-selector">
      <label className="theme-selector__label" htmlFor={id}>Tema</label>
      <select
        className="theme-selector__select"
        id={id}
        value={preference}
        onChange={(event) => setPreference(parseThemePreference(event.target.value))}
      >
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
        <option value="system">Sistema</option>
      </select>
    </div>
  );
}
