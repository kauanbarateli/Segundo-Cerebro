"use client";

import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import "./field.css";

interface SharedFieldProps {
  label: ReactNode;
  visuallyHiddenLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  loading?: boolean;
  /** Layout class for the label/control/messages wrapper; className styles the control. */
  wrapperClassName?: string;
}

type TextInputType = "text" | "search" | "email" | "password" | "url" | "tel" | "number" | "date" | "time" | "datetime-local" | "month" | "week";

type InputFieldProps = SharedFieldProps & Omit<ComponentPropsWithRef<"input">, keyof SharedFieldProps | "children" | "type"> & {
  as?: "input";
  type?: TextInputType;
  children?: never;
};

type TextareaFieldProps = SharedFieldProps & Omit<ComponentPropsWithRef<"textarea">, keyof SharedFieldProps> & {
  as: "textarea";
};

type SelectFieldProps = SharedFieldProps & Omit<ComponentPropsWithRef<"select">, keyof SharedFieldProps> & {
  as: "select";
};

export type FieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

function hasContent(value: ReactNode): boolean {
  return value !== undefined && value !== null && value !== false && value !== "";
}

/** A single field contract for native controls, labels, descriptions and errors. */
export function Field(props: FieldProps) {
  const generatedId = useId();
  const {
    label,
    visuallyHiddenLabel = false,
    hint,
    error,
    loading = false,
    wrapperClassName,
    id = generatedId,
    className,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    "aria-busy": busy,
    ...controlProps
  } = props;
  const hasHint = hasContent(hint);
  const hasError = hasContent(error);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const loadingId = `${id}-loading`;
  const descriptions = [...new Set([
    ...describedBy?.split(/\s+/).filter(Boolean) ?? [],
    ...(hasHint ? [hintId] : []),
    ...(hasError ? [errorId] : []),
    ...(loading ? [loadingId] : []),
  ])].join(" ") || undefined;
  const common = {
    id,
    className: ["field__control", className].filter(Boolean).join(" "),
    "aria-describedby": descriptions,
    "aria-invalid": hasError ? true : invalid,
    "aria-busy": loading ? true : busy,
  };

  let control: ReactNode;
  if (controlProps.as === "textarea") {
    const { as: Element, ...native } = controlProps;
    control = <Element {...native} {...common} readOnly={loading || native.readOnly} />;
  } else if (controlProps.as === "select") {
    const { as: Element, ...native } = controlProps;
    // Select has no readOnly state. Disable it while options are being loaded.
    control = <Element {...native} {...common} disabled={loading || native.disabled} />;
  } else {
    const { as: Element = "input", type = "text", ...native } = controlProps;
    control = <Element {...native} {...common} type={type} readOnly={loading || native.readOnly} />;
  }

  return (
    <div className={["field", wrapperClassName].filter(Boolean).join(" ")} data-loading={loading || undefined}>
      <label className={`field__label${visuallyHiddenLabel ? " field__label--hidden" : ""}`} htmlFor={id}>
        {label}
      </label>
      {control}
      {hasHint ? <div className="field__hint" id={hintId}>{hint}</div> : null}
      {hasError ? <div className="field__error" id={errorId} role="alert">{error}</div> : null}
      {loading ? <div className="field__loading" id={loadingId} role="status">Carregando…</div> : null}
    </div>
  );
}
