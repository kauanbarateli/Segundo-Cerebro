"use client";

import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { useThemeChoice } from "./theme-selector";
import "./theme-toggle.css";

const labels = { light: "Claro", dark: "Escuro", system: "Sistema" } as const;

/**
 * RECOMENDADO (layout Codex): the snapshot header swaps light/dark with an icon.
 * Production keeps the shared native Tema select, so Sistema and the account
 * choice stay one step away; the control is drawn as a 44×44 icon target.
 */
export function ThemeToggle() {
  const { preference, resolvedTheme, choose } = useThemeChoice();
  const Icon = preference === "system" ? Icons.Monitor : resolvedTheme === "dark" ? Icons.Moon : Icons.Sun;
  return (
    <span className="theme-toggle" title={`Tema: ${labels[preference]}`}>
      <Icon className="theme-toggle__icon" />
      <Field as="select" label="Tema" visuallyHiddenLabel wrapperClassName="theme-toggle__field" className="theme-toggle__control"
        value={preference} onChange={(event) => choose(event.target.value)}>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
        <option value="system">Sistema</option>
      </Field>
    </span>
  );
}
