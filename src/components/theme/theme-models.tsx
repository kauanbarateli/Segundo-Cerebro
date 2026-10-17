"use client";

import { useId } from "react";
import { Icons } from "@/components/ui/icons";
import type { ThemePreference } from "@/lib/theme";
import { useThemeChoice } from "./theme-selector";
import "./theme-models.css";

const models: readonly { value: ThemePreference; label: string; Icon: typeof Icons.Sun }[] = [
  { value: "light", label: "Claro", Icon: Icons.Sun },
  { value: "dark", label: "Escuro", Icon: Icons.Moon },
  { value: "system", label: "Sistema", Icon: Icons.Monitor },
];

/**
 * Layout Codex appearance models. Each sample paints its own palette from the
 * generated `--theme-{light|dark}-*` constants, so Claro stays light in dark mode.
 * Native radios keep arrow-key selection and one tab stop.
 */
export function ThemeModelPicker({ value, onChange, legend = "Modelo de aparência", disabled = false }: {
  value: ThemePreference; onChange: (value: ThemePreference) => void; legend?: string; disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="theme-models" disabled={disabled}>
      <legend className="theme-models__legend">{legend}</legend>
      <div className="theme-models__options">
        {models.map(({ value: option, label, Icon }) => (
          <label key={option} className="theme-model" data-selected={value === option || undefined}>
            {/* eslint-disable-next-line no-restricted-syntax -- a radio card is not a text Field. */}
            <input type="radio" className="theme-model__input" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            <span className={`theme-model__preview theme-model__preview--${option}`} aria-hidden="true"><i /><i /><i /></span>
            <span className="theme-model__label"><Icon />{label}{value === option && <Icons.Check className="theme-model__check" />}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Browser + account write path shared with the header control. */
export function ThemeModels({ legend }: { legend?: string }) {
  const { preference, choose } = useThemeChoice();
  return <ThemeModelPicker value={preference} onChange={choose} legend={legend} />;
}
