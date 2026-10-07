"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import "./button.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

/** Adapted from novo-segundo-cerebro@151b2db, reference/runtime/ui/Button. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className = "", variant = "secondary", size = "md", type = "button", loading = false, disabled = false, onClick, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onClick={(event) => {
        if (disabled || loading) return;
        onClick?.(event);
      }}
    >
      {loading && (
        <svg className="ui-button__spinner" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
          <path d="M10 3a7 7 0 1 1-7 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )}
      <span className="ui-button__label">{children}</span>
    </button>
  );
});
