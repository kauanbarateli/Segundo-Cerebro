import { type AnchorHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { AuthForm } from "../../../src/components/features/auth/auth-form";
import type { AuthActionState } from "../../../src/lib/auth/types";

// Presentation-only Actions: count attempts and return a finite rejection.
// No credentials, FormData, session, legal receipt or consent are persisted.
let attempts = 0;
export async function signInAction(): Promise<AuthActionState> {
  attempts++;
  return { status: "error", message: "Recusa sintética de autenticação." };
}
export async function recoverPasswordAction(): Promise<AuthActionState> { throw new Error("Recovery is outside this fixture."); }
export async function updatePasswordAction(): Promise<AuthActionState> { throw new Error("Password update is outside this fixture."); }
export function AuthFixtureLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
Object.assign(globalThis, {
  __authAcknowledgementCalls: () => attempts,
  __startAuthAcknowledgement: () => {
    const target = document.getElementById("auth-acknowledgement");
    if (!target || attempts !== 0) throw new Error("Invalid Auth presentation fixture.");
    createRoot(target).render(<AuthForm kind="sign-in" available={true} />);
  },
});
