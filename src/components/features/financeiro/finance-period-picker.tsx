"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { financeMonthLabel } from "./finance-model";
import { adjacentFinanceMonth } from "./finance-period";
import "./finance-period-picker.css";

interface FinancePeriodPickerProps {
  month: string;
  today: string;
  /** The rendered URL closes a transient selection after external navigation. */
  navigationKey: string;
  onChange(month: string): void;
}
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const shown = (element: HTMLDivElement) => typeof element.showPopover === "function" && element.matches(":popover-open");
const MONTH_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };

export function FinancePeriodPicker({ month, today, navigationKey, onChange }: FinancePeriodPickerProps) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ year: number; navigationKey: string } | null>(null);
  // Discard only a diverged session, including when no native toggle is emitted.
  // A conditional render adjustment prevents an old URL from reviving its state.
  if (selection !== null && selection.navigationKey !== navigationKey) setSelection(null);
  const open = selection !== null && selection.navigationKey === navigationKey;
  const year = selection?.year ?? Number(month.slice(0, 4));
  const previous = adjacentFinanceMonth(month, -1), next = adjacentFinanceMonth(month, 1);
  const close = useCallback((returnFocus: boolean) => {
    const element = popup.current;
    if (element && shown(element)) element.hidePopover();
    element?.removeAttribute("data-fallback-open");
    setSelection(null);
    if (returnFocus && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    const element = popup.current;
    if (!element) return;
    if (!open) {
      const heldFocus = element.contains(document.activeElement);
      if (shown(element)) element.hidePopover();
      element.removeAttribute("data-fallback-open");
      if (heldFocus) trigger.current?.focus({ preventScroll: true });
      return;
    }
    if (typeof element.showPopover === "function") element.showPopover();
    else element.setAttribute("data-fallback-open", "true");
    function position() {
      if (!trigger.current) return;
      const viewport = window.visualViewport;
      const inset = 12, leftEdge = (viewport?.offsetLeft ?? 0) + inset, topEdge = (viewport?.offsetTop ?? 0) + inset;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - inset * 2;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - inset * 2;
      // Bounding rects include CSS zoom; fixed CSS coordinates use layout units.
      const scale = element!.getBoundingClientRect().width / element!.offsetWidth || 1;
      element!.style.maxHeight = `${Math.max(0, bottomEdge - topEdge) / scale}px`;
      element!.style.maxWidth = `${Math.max(0, rightEdge - leftEdge) / scale}px`;
      const anchor = trigger.current.getBoundingClientRect(), bounds = element!.getBoundingClientRect();
      const below = anchor.bottom + 8, above = anchor.top - bounds.height - 8;
      element!.style.left = `${Math.max(leftEdge, Math.min(anchor.right - bounds.width, rightEdge - bounds.width)) / scale}px`;
      element!.style.top = `${Math.max(topEdge, Math.min(below + bounds.height <= bottomEdge ? below : above, bottomEdge - bounds.height)) / scale}px`;
    }
    function outside(event: Event) {
      if (event.target instanceof Node && !element!.contains(event.target) && !trigger.current?.contains(event.target)) close(false);
    }
    position();
    element.querySelector<HTMLButtonElement>(`[data-month="${month}"]`)?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(element); observer.observe(trigger.current!);
    window.addEventListener("resize", position); window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position); window.visualViewport?.addEventListener("scroll", position);
    document.addEventListener("pointerdown", outside); document.addEventListener("focusin", outside);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position); window.visualViewport?.removeEventListener("scroll", position);
      document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside);
      if (shown(element)) element.hidePopover();
      element.removeAttribute("data-fallback-open");
    };
  }, [open, month, close]);

  function choose(value: string) {
    if (!open) return;
    close(true); onChange(value);
  }
  function moveMonthFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button")), index = buttons.indexOf(event.target);
    const target = event.key === "Home" ? 0 : event.key === "End" ? 11 : index + (MONTH_KEYS[event.key] ?? 0);
    if (!["Home", "End", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); buttons[Math.max(0, Math.min(11, target))]?.focus();
  }
  return <div className="finance-period" role="group" aria-label="Período financeiro">
    <Button className="finance-period-arrow" aria-label="Mês anterior" disabled={previous === null} onClick={() => { if (previous) onChange(previous); }}><Icons.ChevronLeft /></Button>
    <Button ref={trigger} className="finance-period-trigger" data-month={month} aria-label={`Competência selecionada: ${financeMonthLabel(month)}. Selecionar período`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => { if (open) close(true); else setSelection({ year: Number(month.slice(0, 4)), navigationKey }); }}><span>{financeMonthLabel(month)}</span><Icons.ChevronDown /></Button>
    <Button className="finance-period-arrow" aria-label="Próximo mês" disabled={next === null} onClick={() => { if (next) onChange(next); }}><Icons.ChevronRight /></Button>
    <div ref={popup} id={id} className="finance-period-dialog" popover="auto" role="dialog" aria-label="Selecionar período" onToggle={(event) => { if (event.target === event.currentTarget && !shown(event.currentTarget) && !event.currentTarget.hasAttribute("data-fallback-open")) setSelection(null); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); } }}>
      <header className="finance-period-year"><Button className="finance-period-arrow" aria-label="Ano anterior" disabled={year <= 1} onClick={() => setSelection((current) => current && { ...current, year: Math.max(1, current.year - 1) })}><Icons.ChevronLeft /></Button><output aria-label="Ano do período" aria-live="polite">{String(year).padStart(4, "0")}</output><Button className="finance-period-arrow" aria-label="Próximo ano" disabled={year >= 9999} onClick={() => setSelection((current) => current && { ...current, year: Math.min(9999, current.year + 1) })}><Icons.ChevronRight /></Button></header>
      <div className="finance-period-months" role="group" aria-label={`Meses de ${year}`} onKeyDown={moveMonthFocus}>{MONTHS.map((label, index) => {
        const value = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}-01`;
        return <Button key={index} data-month={value} variant={month === value ? "primary" : "secondary"} aria-pressed={month === value} aria-label={financeMonthLabel(value)} onClick={() => choose(value)}>{label}</Button>;
      })}</div>
      <footer className="finance-period-footer"><Button onClick={() => choose(`${today.slice(0, 7)}-01`)}>Mês atual</Button><Button variant="ghost" onClick={() => close(true)}>Cancelar</Button></footer>
    </div>
  </div>;
}
