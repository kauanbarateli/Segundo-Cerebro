"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readAuthConfiguration } from "./config";
import { AUTH_UNAVAILABLE, sameOrigin } from "./policy";
import { requestAuthServices } from "./runtime";
import { recoverPassword, signIn, updatePassword } from "./service";
import type { AuthServices } from "./ports";
import type { AuthActionOutcome, AuthActionState } from "./types";

function text(form: FormData, name: string): string {
  const fields = form.getAll(name);
  if (fields.length > 1 || (fields.length === 1 && typeof fields[0] !== "string")) throw new Error("invalid-field");
  const value = fields[0] ?? "";
  if (typeof value !== "string" || value.length > 4096) throw new Error("invalid-field");
  return value;
}
async function perform(operation: (services: AuthServices) => Promise<AuthActionOutcome>): Promise<AuthActionState> {
  let outcome: AuthActionOutcome;
  let services: AuthServices | undefined;
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase") return { status: "error", message: AUTH_UNAVAILABLE };
    const requestHeaders = await headers();
    if (!sameOrigin(requestHeaders.get("origin"), config.appOrigin)) return { status: "error", message: "Não foi possível confirmar a origem da solicitação. Recarregue a página." };
    services = await requestAuthServices(true);
    outcome = await operation(services);
  } catch {
    // Never serialize provider errors, form values, tokens, URLs or configuration.
    // UX hint only, from a signed unexpired server cookie; the next command still
    // rechecks current Auth user/session before accepting a completion checkpoint.
    return { status: "error", message: AUTH_UNAVAILABLE, completionPending: services?.flows.get("password-updated")?.kind === "password-updated" };
  }
  if ("redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome.state;
}
export async function signInAction(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  return perform((services) => signIn(services, { email: text(form, "email"), password: text(form, "password"), returnTo: text(form, "returnTo") }));
}
export async function recoverPasswordAction(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  return perform((services) => recoverPassword(services, { email: text(form, "email") }));
}
export async function updatePasswordAction(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  return perform((services) => updatePassword(services, { password: text(form, "password"), confirmPassword: text(form, "confirmPassword"), currentPassword: text(form, "currentPassword") }));
}
