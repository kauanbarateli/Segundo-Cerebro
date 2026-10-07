"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "./button";
import { Card } from "./card";
import { Icons } from "./icons";
import "./data-display.css";

export interface ChartCardProps {
  title: string;
  resumoAcessivel: string;
  children: ReactNode;
}

/** The textual summary is part of the visible content, not only its decoration. */
export function ChartCard({ title, resumoAcessivel, children }: ChartCardProps) {
  const id = useId();
  if (!resumoAcessivel.trim()) throw new Error("ChartCard exige resumoAcessivel não vazio.");
  return <Card className="ui-chart-card" role="figure" aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>
    <h3 id={`${id}-title`}>{title}</h3>
    <div className="ui-chart-card__plot">{children}</div>
    <p id={`${id}-summary`}>{resumoAcessivel}</p>
  </Card>;
}

export interface ProgressBarProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  valueText?: string;
}

/** Invalid limits fall back to 0–100; invalid values stay at the lower bound. */
export function ProgressBar({ label, value, min = 0, max = 100, valueText }: ProgressBarProps) {
  const id = useId();
  const validRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const lower = validRange ? min : 0;
  const upper = validRange ? max : 100;
  const current = Number.isFinite(value) ? Math.min(upper, Math.max(lower, value)) : lower;
  const percentage = (current - lower) / (upper - lower) * 100;
  const description = valueText ?? `${current.toLocaleString("pt-BR")} de ${upper.toLocaleString("pt-BR")}`;
  return <div className="ui-progress">
    <div className="ui-progress__label"><span id={id}>{label}</span><span>{description}</span></div>
    <div className="ui-progress__track" role="progressbar" aria-labelledby={id} aria-valuemin={lower} aria-valuemax={upper} aria-valuenow={current} aria-valuetext={description}><span className="ui-progress__fill" style={{ transform: `scaleX(${percentage / 100})` }} /></div>
  </div>;
}

export interface CollapsibleProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function Collapsible({ title, children, defaultOpen = false, disabled = false, loading = false }: CollapsibleProps) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return <section className="ui-collapsible">
    <h3><Button variant="ghost" className="ui-collapsible__trigger" id={`${id}-trigger`} aria-expanded={open} aria-controls={`${id}-content`} disabled={disabled} loading={loading} onClick={() => setOpen(!open)}>{title}<Icons.ChevronRight className="ui-collapsible__chevron" /></Button></h3>
    <div id={`${id}-content`} hidden={!open} aria-labelledby={`${id}-trigger`} className="ui-collapsible__content">{children}</div>
  </section>;
}

export interface PageNavigationProps {
  label: string;
  items: readonly { href: string; label: string }[];
  currentHref?: string;
}

export function PageNavigation({ label, items, currentHref }: PageNavigationProps) {
  return <nav className="ui-page-navigation" aria-label={label}><ul>{items.map((item) => <li key={item.href}><a href={item.href} aria-current={currentHref === item.href ? "location" : undefined}>{item.label}</a></li>)}</ul></nav>;
}
