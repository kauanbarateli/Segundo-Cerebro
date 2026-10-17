import type { HTMLAttributes } from "react";
import "./card.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "inverse" | "tinted";
  radius?: "panel" | "lg" | "xl";
  elevation?: "flat" | "border" | "shadow";
}

/** Adapted from the legacy Card: DS 2.1 surfaces and one elevation at a time.
 * Layout Codex default: flat 16px panel; hierarchy comes from spacing and dividers. */
export function Card({ className = "", variant = "surface", radius = "panel", elevation = "flat", ...props }: CardProps) {
  return <div {...props} className={`ui-card ui-card--${variant} ui-card--${radius} ui-card--${elevation} ${className}`.trim()} />;
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-card__header ${className}`.trim()} />;
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-card__body ${className}`.trim()} />;
}
