"use client";

import { useId } from "react";
import { useThemeChoice } from "@/components/theme/theme-selector";
import { Icons } from "@/components/ui/icons";

const choices = [
  { value: "light", label: "Claro", Icon: Icons.Sun },
  { value: "dark", label: "Escuro", Icon: Icons.Moon },
  { value: "system", label: "Sistema", Icon: Icons.Monitor },
] as const;

/** Native radios share the existing theme write path and keyboard behavior. */
export function AuthThemeSwitcher() {
  const name = useId();
  const { preference, choose } = useThemeChoice();
  return <fieldset className="auth-theme">
    <legend className="auth-theme-legend">Tema</legend>
    {choices.map(({ value, label, Icon }) => <label className="auth-theme-option" key={value}>
      {/* eslint-disable-next-line no-restricted-syntax -- Native radio choices are not text Fields; each retains a name, label, keyboard behavior and 44px target. */}
      <input type="radio" name={name} value={value} checked={preference === value} onChange={() => choose(value)} aria-label={label} />
      <span className="auth-theme-choice"><Icon /><span className="auth-theme-label">{label}</span></span>
    </label>)}
  </fieldset>;
}
