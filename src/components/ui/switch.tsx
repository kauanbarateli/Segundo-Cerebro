"use client";

import { useId } from "react";
import { Button, type ButtonProps } from "./button";
import "./switch.css";

export interface SwitchProps extends Omit<ButtonProps, "role" | "aria-checked" | "onClick" | "children"> {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint?: string;
}

/** A single native button supplies both Enter and Space activation. */
export function Switch({ label, checked, onCheckedChange, hint, className = "", "aria-describedby": describedBy, ...props }: SwitchProps) {
  const hintId = useId();
  return (
    <div className="ui-switch-group">
      <Button {...props} variant="ghost" className={`ui-switch ${className}`.trim()} role="switch" aria-checked={checked} aria-describedby={[describedBy, hint ? hintId : undefined].filter(Boolean).join(" ") || undefined} onClick={() => onCheckedChange(!checked)}>
        <span className="ui-switch__track" aria-hidden="true"><span className="ui-switch__thumb" /></span>
        <span>{label}</span>
      </Button>
      {hint && <p id={hintId} className="ui-switch__hint">{hint}</p>}
    </div>
  );
}
