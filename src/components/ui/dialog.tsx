"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "./button";
import { Icons } from "./icons";
import { containDialogTab, isTopDialog, registerDialog } from "./focus-stack";
import "./dialog.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "dialog" | "drawer" | "sheet";
  /** Width by use: confirmations stay small, long editors get room. */
  size?: "sm" | "md" | "lg";
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  /** Use while a submitted operation cannot safely be interrupted. */
  dismissible?: boolean;
}

/** One native modal contract for dialogs, drawers, sheets and confirmations. */
export function Dialog({
  open, onClose, title, description, children, footer, variant = "dialog", size = "md",
  initialFocusRef, returnFocusRef, className = "", closeLabel = "Fechar",
  closeOnBackdrop = true, dismissible = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pointerStartedOutside = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const element = dialogRef.current;
    if (!open || !element) return;
    const unregister = registerDialog(element, () => returnFocusRef?.current ?? null);
    element.showModal();
    (initialFocusRef?.current ?? titleRef.current)?.focus({ preventScroll: true });
    return unregister;
  }, [open, initialFocusRef, returnFocusRef]);

  // The virtual keyboard shrinks the visual viewport, not the layout one: follow it so the
  // active field and the footer actions stay above the keyboard (CSS reads the variable).
  useEffect(() => {
    const element = dialogRef.current, viewport = window.visualViewport;
    if (!open || !element || !viewport) return;
    const sync = () => element.style.setProperty("--ui-visual-height", `${Math.round(viewport.height)}px`);
    sync();
    viewport.addEventListener("resize", sync);
    return () => { viewport.removeEventListener("resize", sync); element.style.removeProperty("--ui-visual-height"); };
  }, [open]);

  const requestClose = () => {
    if (dismissible && dialogRef.current && isTopDialog(dialogRef.current)) onClose();
  };
  const isOutside = (x: number, y: number) => {
    const rect = dialogRef.current?.getBoundingClientRect();
    return !!rect && (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom);
  };

  return (
    <dialog
      ref={dialogRef}
      className={`ui-dialog ui-dialog--${variant} ui-dialog--${size} ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
      onClose={(event) => {
        // Also synchronize a native method="dialog" form with controlled state.
        if (event.target === event.currentTarget && !event.currentTarget.open && open) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab" && !event.defaultPrevented) containDialogTab(event.currentTarget, event);
        if (event.key !== "Escape" || event.defaultPrevented || !isTopDialog(event.currentTarget)) return;
        // Close search dialogs on the first Escape, including a populated search field.
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
      onPointerDown={(event) => {
        pointerStartedOutside.current = event.target === event.currentTarget && isOutside(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (event.target !== event.currentTarget || !isOutside(event.clientX, event.clientY)) pointerStartedOutside.current = false;
      }}
      onPointerCancel={() => { pointerStartedOutside.current = false; }}
      onClick={(event) => {
        const closes = pointerStartedOutside.current && event.target === event.currentTarget && isOutside(event.clientX, event.clientY);
        pointerStartedOutside.current = false;
        if (closes && closeOnBackdrop) requestClose();
      }}
    >
      <header className="ui-dialog__header">
        <div className="ui-dialog__heading">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} data-dialog-title>{title}</h2>
          {description && <p id={descriptionId} className="ui-dialog__description">{description}</p>}
        </div>
        <Button variant="ghost" className="ui-dialog__close" aria-label={closeLabel} onClick={requestClose} disabled={!dismissible}>
          <Icons.X />
        </Button>
      </header>
      {children && <div className="ui-dialog__body">{children}</div>}
      {footer && <footer className="ui-dialog__footer">{footer}</footer>}
    </dialog>
  );
}

export function Drawer(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="drawer" />;
}

export function BottomSheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}

export interface ConfirmDialogProps extends Pick<DialogProps, "open" | "onClose" | "title" | "description" | "returnFocusRef"> {
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  /** Keep a failed operation visible and actionable in the same modal. */
  error?: string;
}

export function ConfirmDialog({
  onConfirm, confirmLabel = "Confirmar", cancelLabel = "Cancelar", loading = false,
  destructive = true, error, ...props
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      {...props}
      size="sm"
      initialFocusRef={cancelRef}
      dismissible={!loading}
      closeOnBackdrop={false}
      footer={<>
        <Button ref={cancelRef} onClick={props.onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}
    >
      {error && <p className="ui-dialog__error" role="alert">{error}</p>}
    </Dialog>
  );
}
