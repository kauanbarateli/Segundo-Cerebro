"use client";
import { useId, type ChangeEventHandler, type Ref } from "react";
import "../ui/field.css";

/** Native file control using the existing DS field classes. Field itself has a
 * deliberately narrower text-input contract; do not widen it for this feature. */
export function EntityImagePicker({ label, hint, inputRef, disabled, onChange }: {
  label: string; hint: string; inputRef?: Ref<HTMLInputElement>; disabled: boolean; onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  const id = useId();
  return <div className="field"><label className="field__label" htmlFor={id}>{label}</label>
    {/* eslint-disable-next-line no-restricted-syntax -- Field only supports text/select/textarea; this shared native file picker retains its DS classes, label and hint. */}
    <input id={id} ref={inputRef} type="file" className="field__control" accept="image/png,image/jpeg,image/webp,image/gif" disabled={disabled} aria-describedby={`${id}-hint`} onChange={onChange} />
    <div className="field__hint" id={`${id}-hint`}>{hint}</div>
  </div>;
}
