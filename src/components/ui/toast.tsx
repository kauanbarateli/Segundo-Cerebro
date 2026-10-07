"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";
import { Icons } from "./icons";
import "./toast.css";

export interface ToastOptions {
  message: string;
  action?: { label: string; onClick: () => void };
  /** Milliseconds; null keeps the notice until dismissed. Actions default to null. */
  duration?: number | null;
}

interface ToastItem extends ToastOptions {
  id: number;
  duration: number | null;
  closing: boolean;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastNotice({ item, dismiss, remove }: { item: ToastItem; dismiss: (id: number) => void; remove: (id: number) => void }) {
  const elementRef = useRef<HTMLLIElement>(null);
  const remaining = useRef(item.duration);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauses = useRef(new Set<string>());

  const stopTimer = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    if (remaining.current !== null) remaining.current = Math.max(0, remaining.current - (performance.now() - started.current));
  }, []);

  const startTimer = useCallback(() => {
    if (item.closing || pauses.current.size || remaining.current === null || timer.current !== null) return;
    started.current = performance.now();
    timer.current = setTimeout(() => {
      timer.current = null;
      dismiss(item.id);
    }, remaining.current);
  }, [dismiss, item.closing, item.id]);

  const pause = useCallback((reason: string) => {
    pauses.current.add(reason);
    stopTimer();
  }, [stopTimer]);

  const resume = useCallback((reason: string) => {
    pauses.current.delete(reason);
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause("document");
      else resume("document");
    };
    onVisibility();
    startTimer();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pause, resume, startTimer, stopTimer]);

  useEffect(() => {
    if (!item.closing) return;
    const element = elementRef.current;
    if (!element) return;
    const style = getComputedStyle(element);
    const durations = style.animationDuration.split(",").map((part) => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000));
    const delay = style.animationName === "none" ? 0 : Math.max(...durations);
    // animationend is primary; the computed-duration fallback also handles hidden tabs.
    const fallback = setTimeout(() => remove(item.id), delay + (delay ? 32 : 0));
    return () => clearTimeout(fallback);
  }, [item.closing, item.id, remove]);

  return (
    <li
      ref={elementRef}
      className={`ui-toast${item.closing ? " toast-out" : ""}`}
      data-toast-id={item.id}
      onPointerEnter={() => pause("pointer")}
      onPointerLeave={() => resume("pointer")}
      onFocusCapture={() => pause("focus")}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resume("focus");
      }}
      onAnimationEnd={(event) => {
        if (item.closing && event.target === event.currentTarget) remove(item.id);
      }}
    >
      <p className="ui-toast__message" role="status" aria-live="polite" aria-atomic="true">{item.message}</p>
      <div className="ui-toast__actions">
        {item.action && <Button variant="ghost" disabled={item.closing} onClick={() => {
          item.action?.onClick();
          dismiss(item.id);
        }}>{item.action.label}</Button>}
        <Button variant="ghost" className="ui-toast__dismiss" disabled={item.closing} aria-label={`Dispensar aviso: ${item.message}`} onClick={() => dismiss(item.id)}>
          <Icons.X />
        </Button>
      </div>
    </li>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const toast = useCallback((options: ToastOptions) => {
    const id = ++nextId.current;
    const suppliedDuration = options.duration === undefined ? (options.action ? null : 5000) : options.duration;
    const duration = suppliedDuration === null ? null : Math.max(0, Number.isFinite(suppliedDuration) ? suppliedDuration : 5000);
    setItems((current) => [...current, { ...options, duration, id, closing: false }]);
    return id;
  }, []);
  const dismiss = useCallback((id: number) => {
    setItems((current) => current.map((item) => item.id === id && !item.closing ? { ...item, closing: true } : item));
  }, []);
  const remove = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return <ToastContext.Provider value={value}>
    {children}
    <section className="ui-toast-region" aria-label="Avisos">
      <ol className="ui-toast-list">
        {items.map((item) => <ToastNotice key={item.id} item={item} dismiss={dismiss} remove={remove} />)}
      </ol>
    </section>
  </ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de ToastProvider.");
  return context;
}
