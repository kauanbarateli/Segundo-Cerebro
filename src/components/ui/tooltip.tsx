"use client";

import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactElement } from "react";
import { createPortal } from "react-dom";
import "./tooltip.css";

export interface TooltipProps {
  /** Text only: interactive help belongs in a dialog or disclosure. */
  content: string;
  children: ReactElement<Pick<HTMLAttributes<HTMLElement>, "aria-describedby">>;
}

/** The child forwards aria-describedby and remains the sole focusable trigger. */
export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const focused = useRef(false);
  const dismissed = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  function show() {
    cancelClose();
    if (!dismissed.current) setOpen(true);
  }

  function closeIfOutside() {
    cancelClose();
    if (!hovering.current && !focused.current) dismissed.current = false;
    // RECOMENDADO: a short bridge lets the pointer reach the tooltip itself.
    closeTimer.current = setTimeout(() => {
      if (!hovering.current && !focused.current) {
        dismissed.current = false;
        setOpen(false);
      }
    }, 120);
  }

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tooltipRef.current) return;
    const tooltip = tooltipRef.current;
    // Native popover escapes overflow and dialog top layers; fixed portal is fallback.
    if (typeof tooltip.showPopover === "function" && !tooltip.matches(":popover-open")) tooltip.showPopover();
    function position() {
      if (!anchorRef.current) return;
      const anchor = anchorRef.current.getBoundingClientRect();
      const bounds = tooltip.getBoundingClientRect();
      const gap = 8;
      const left = Math.max(gap, Math.min(anchor.left + (anchor.width - bounds.width) / 2, window.innerWidth - bounds.width - gap));
      const below = anchor.bottom + gap;
      const top = below + bounds.height <= window.innerHeight - gap ? below : Math.max(gap, anchor.top - bounds.height - gap);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const resizeObserver = new ResizeObserver(position);
    resizeObserver.observe(tooltip);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      resizeObserver.disconnect();
    };
  }, [open, content]);

  useEffect(() => {
    if (!open) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // An older tooltip outside a newer modal must not take that modal's Escape.
      const eventDialog = event.target instanceof Element ? event.target.closest("dialog[open]") : null;
      const anchorDialog = anchorRef.current?.closest("dialog[open]") ?? null;
      if (eventDialog !== anchorDialog) return;
      event.preventDefault();
      event.stopPropagation();
      dismissed.current = true;
      setOpen(false);
    }
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [open]);

  return (
    <span ref={anchorRef} className="ui-tooltip-anchor" onMouseEnter={() => { hovering.current = true; show(); }} onMouseLeave={() => { hovering.current = false; closeIfOutside(); }} onFocus={() => { focused.current = true; show(); }} onBlur={() => { focused.current = false; closeIfOutside(); }}>
      {cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], open ? id : undefined].filter(Boolean).join(" ") || undefined })}
      {open && createPortal(<div ref={tooltipRef} id={id} className="ui-tooltip" role="tooltip" popover="manual" onMouseEnter={() => { hovering.current = true; show(); }} onMouseLeave={() => { hovering.current = false; closeIfOutside(); }}>{content}</div>, anchorRef.current?.closest("dialog") ?? document.body)}
    </span>
  );
}
