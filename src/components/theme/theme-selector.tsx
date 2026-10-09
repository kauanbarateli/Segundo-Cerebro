"use client";

import { parseThemePreference } from "@/lib/theme";
import { Field } from "@/components/ui/field";
import { useTheme } from "./theme-provider";
import { useOptionalDemoApplication } from "@/lib/demo/demo-provider";
import { useToast } from "@/components/ui/toast";

export function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  const app = useOptionalDemoApplication(), { toast } = useToast();

  return (
    <Field
      as="select"
      label="Tema"
      wrapperClassName="theme-selector"
      value={preference}
      onChange={(event) => {
        const theme = parseThemePreference(event.target.value); setPreference(theme);
        if (app?.mode === "connected") void app.executeDomainCommand("settings.preferences.update", { client_id: crypto.randomUUID(), patch: { theme } }).catch(error => toast({ message: error instanceof Error ? error.message : "O tema mudou neste aparelho; confirme o envio para salvar na conta." }));
      }}
    >
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
      <option value="system">Sistema</option>
    </Field>
  );
}
