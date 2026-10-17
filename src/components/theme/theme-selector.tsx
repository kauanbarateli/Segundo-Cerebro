"use client";

import { parseThemePreference, type ThemePreference } from "@/lib/theme";
import { Field } from "@/components/ui/field";
import { useTheme } from "./theme-provider";
import { useOptionalDemoApplication } from "@/lib/demo/demo-provider";
import { useToast } from "@/components/ui/toast";

/** One write path for every theme control: browser first, then the connected account. */
export function useThemeChoice() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const app = useOptionalDemoApplication(), { toast } = useToast();
  const choose = (value: string | ThemePreference) => {
    const theme = parseThemePreference(value); setPreference(theme);
    if (app?.mode === "connected") void app.executeDomainCommand("settings.preferences.update", { client_id: crypto.randomUUID(), patch: { theme } }).catch(error => toast({ message: error instanceof Error ? error.message : "O tema mudou neste aparelho; confirme o envio para salvar na conta." }));
  };
  return { preference, resolvedTheme, choose };
}

export function ThemeSelector() {
  const { preference, choose } = useThemeChoice();

  return (
    <Field
      as="select"
      label="Tema"
      wrapperClassName="theme-selector"
      value={preference}
      onChange={(event) => choose(event.target.value)}
    >
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
      <option value="system">Sistema</option>
    </Field>
  );
}
