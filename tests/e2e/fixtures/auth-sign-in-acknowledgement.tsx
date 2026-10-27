import { type AnchorHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { AuthForm } from "../../../src/components/features/auth/auth-form";
import type { AuthActionState } from "../../../src/lib/auth/types";

// Presentation-only Actions: count attempts and return a finite rejection.
// No credentials, FormData, session, legal receipt or consent are persisted.
let attempts = 0;
const observationLimit = 32;
const observations: { phase: string; checked: boolean | null; defaultChecked: boolean | null; defaultPrevented: boolean | null }[] = [];
let observationTruncated = false;
function observe(phase: string, event?: Event) {
  if (observations.length >= observationLimit) { observationTruncated = true; return; }
  const input = document.querySelector<HTMLInputElement>('form.auth-form input[name="legalAcknowledgement"]');
  observations.push({ phase, checked: input?.checked ?? null, defaultChecked: input?.defaultChecked ?? null, defaultPrevented: event?.defaultPrevented ?? null });
}
function observeNativeEvents() {
  for (const name of ["input", "change", "reset", "submit"] as const) for (const capture of [true, false]) {
    document.addEventListener(name, event => {
      const target = event.target;
      const relevant = name === "reset" || name === "submit"
        ? target instanceof HTMLFormElement && target.matches("form.auth-form")
        : target instanceof HTMLInputElement && target.name === "legalAcknowledgement";
      if (!relevant) return;
      const phase = name.toUpperCase() + (capture ? "_CAPTURE" : "_BUBBLE");
      observe(phase, event);
      queueMicrotask(() => observe(phase + "_MICROTASK", event));
    }, { capture });
  }
}
export async function signInAction(): Promise<AuthActionState> {
  observe("ACTION_ENTER");
  attempts++;
  observe("ACTION_RESOLVED");
  return { status: "error", message: "Recusa sintética de autenticação." };
}
export async function recoverPasswordAction(): Promise<AuthActionState> { throw new Error("Recovery is outside this fixture."); }
export async function updatePasswordAction(): Promise<AuthActionState> { throw new Error("Password update is outside this fixture."); }
export function AuthFixtureLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
Object.assign(globalThis, {
  __authAcknowledgementCalls: () => attempts,
  __authAcknowledgementObservation: () => {
    observe("READOUT");
    return { schema: 1, limit: observationLimit, truncated: observationTruncated, records: observations.map(record => ({ ...record })) };
  },
  __startAuthAcknowledgement: () => {
    const target = document.getElementById("auth-acknowledgement");
    if (!target || attempts !== 0) throw new Error("Invalid Auth presentation fixture.");
    observeNativeEvents();
    createRoot(target).render(<AuthForm kind="sign-in" available={true} />);
  },
});
