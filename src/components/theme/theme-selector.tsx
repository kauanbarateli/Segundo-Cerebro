"use client";

import { parseThemePreference } from "@/lib/theme";
import { Field } from "@/components/ui/field";
import { useTheme } from "./theme-provider";

export function ThemeSelector() {
  const { preference, setPreference } = useTheme();

  return (
    <Field
      as="select"
      label="Tema"
      wrapperClassName="theme-selector"
      value={preference}
      onChange={(event) => setPreference(parseThemePreference(event.target.value))}
    >
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
      <option value="system">Sistema</option>
    </Field>
  );
}
