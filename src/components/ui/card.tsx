import type { HTMLAttributes } from "react";
import "./card.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "inverse" | "tinted";
  radius?: "lg" | "xl";
  elevation?: "border" | "shadow";
}

/** Adapted from the legacy Card: DS 2.1 surfaces and one elevation at a time. */
export function Card({ className = "", variant = "surface", radius = "lg", elevation = "border", ...props }: CardProps) {
  return <div {...props} className={`ui-card ui-card--${variant} ui-card--${radius} ui-card--${elevation} ${className}`.trim()} />;
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-card__header ${className}`.trim()} />;
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-card__body ${className}`.trim()} />;
}
