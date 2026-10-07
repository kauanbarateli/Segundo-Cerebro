import type { CSSProperties } from "react";
import "./brand.css";

export type BrandVariant = "symbol" | "horizontal" | "compact";

export interface BrandProps {
  variant?: BrandVariant;
  /** Symbol side in CSS pixels. The observed brand minimum is 24px. */
  size?: number;
  className?: string;
}

function symbolSize(size: number | undefined, fallback: number): number {
  return size === undefined || !Number.isFinite(size) ? fallback : Math.max(24, size);
}

/** OBSERVADO: unchanged symbol geometry from novo-segundo-cerebro@20914ce. */
export function BrandSymbol({ size, className }: Pick<BrandProps, "size" | "className">) {
  const side = symbolSize(size, 36);
  return (
    <svg
      className={["sb-brand-symbol", className].filter(Boolean).join(" ")}
      width={side}
      height={side}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path
        d="M18.5 20C18.5 15.858 21.858 12.5 26 12.5H35C41.627 12.5 47 17.873 47 24.5C47 28.253 45.245 31.791 42.255 34.056L21.5 49.5H47"
        stroke="var(--accent-ink)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.5" cy="20" r="3" fill="currentColor" stroke="var(--accent-ink)" strokeWidth="1.5" />
      <circle cx="47" cy="49.5" r="3" fill="currentColor" stroke="var(--accent-ink)" strokeWidth="1.5" />
    </svg>
  );
}

/** The wordmark is real Geist text. Containers preserve the symbol's ¼-side clear space. */
export function Brand({ variant = "horizontal", size, className }: BrandProps) {
  const side = symbolSize(size, variant === "symbol" ? 36 : 44);
  const style = {
    // OBSERVADO: proportions from the historic master, independent of UI type roles.
    "--brand-first-size": `${Math.round(side * (variant === "compact" ? 0.3 : 0.317))}px`,
    "--brand-second-size": `${Math.round(side * 0.26)}px`,
  } as CSSProperties;

  return (
    <span
      className={["sb-brand", `sb-brand--${variant}`, className].filter(Boolean).join(" ")}
      style={style}
      {...(variant === "symbol" ? { role: "img", "aria-label": "Segundo Cérebro" } : {})}
    >
      <BrandSymbol size={side} />
      {variant !== "symbol" && (
        <span className="sb-brand__wordmark">
          <span className="sb-brand__first">Segundo</span>{" "}
          <span className="sb-brand__second">Cérebro</span>
        </span>
      )}
    </span>
  );
}
