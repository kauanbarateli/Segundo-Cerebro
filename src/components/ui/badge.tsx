import type { HTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import "./badge.css";

export type SemanticDot = "success" | "danger" | "warning" | "info" | "work" | "personal" | "fin";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "solid" | "outline";
  dot?: SemanticDot;
  children: ReactNode;
}

/** The adjacent written label carries the meaning; the dot is decorative. */
function Dot({ tone }: { tone: SemanticDot }) {
  return <span className={`ui-semantic-dot ui-semantic-dot--${tone}`} aria-hidden="true" />;
}

/** Non-interactive label, adapted from the legacy Badge. */
export function Badge({ tone = "default", dot, children, className = "", ...props }: BadgeProps) {
  return (
    <span {...props} className={`ui-badge ui-badge--${tone} ${className}`.trim()}>
      {dot && <Dot tone={dot} />}
      <span className="ui-badge__label">{children}</span>
    </span>
  );
}

export interface PillButtonProps extends Omit<ButtonProps, "variant" | "children"> {
  active?: boolean;
  dot?: SemanticDot;
  children: ReactNode;
}

/** Native toggle button: the pressed state is conveyed without relying on color. */
export function PillButton({ active = false, dot, children, className = "", ...props }: PillButtonProps) {
  return (
    <Button {...props} variant={active ? "primary" : "secondary"} aria-pressed={active} className={`ui-pill-button ${className}`.trim()}>
      {dot && <Dot tone={dot} />}
      <span className="ui-badge__label">{children}</span>
    </Button>
  );
}
