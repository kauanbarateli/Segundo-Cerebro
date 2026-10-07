import "server-only";
import { redirect } from "next/navigation";
import type { FeatureKey } from "../../core/access/resolve-access";
import { readAuthConfiguration } from "./config";
import { assertFeature } from "./policy";
import { requestAuthServices } from "./runtime";
import { AuthGuardError } from "./types";

export async function getAuthFormAvailability(): Promise<boolean> {
  try { return readAuthConfiguration().mode === "supabase"; } catch { return false; }
}
export async function readAuthState() {
  if (readAuthConfiguration().mode === "demo") return { mode: "demo" as const };
  return { mode: "supabase" as const, identity: await (await requestAuthServices()).gateway.readIdentity() };
}
export async function requireUser(options: { allowPasswordChange?: boolean } = {}) {
  const state = await readAuthState();
  if (state.mode === "demo") throw new AuthGuardError("demo");
  if (!state.identity) redirect("/entrar?notice=session-required");
  if (state.identity.mustChangePassword && !options.allowPasswordChange) redirect("/trocar-senha");
  return state.identity;
}
export async function requireFeature(feature: FeatureKey) {
  const identity = await requireUser(); assertFeature(identity, feature); return identity;
}
export async function requireMaster() { return requireFeature("admin"); }
export async function getPasswordFormContext(kind: "change" | "recovery" = "change"): Promise<{ available: boolean; requiresCurrentPassword: boolean; completionPending?: boolean }> {
  if (!await getAuthFormAvailability()) return { available: false, requiresCurrentPassword: kind === "change" };
  const services = await requestAuthServices();
  const identity = await services.gateway.readIdentity();
  if (!identity) redirect(kind === "recovery" ? "/recuperar-senha?notice=recovery-invalid" : "/entrar?notice=session-required");
  const recovery = services.flows.get("recovery-session"), pending = services.flows.get("password-updated");
  const isRecovery = recovery?.kind === "recovery-session" && recovery.userId === identity.userId && recovery.sessionId === identity.sessionId;
  const isPending = pending?.kind === "password-updated" && pending.userId === identity.userId && pending.sessionId === identity.sessionId;
  if (kind === "recovery" && !isRecovery && !isPending) redirect("/recuperar-senha?notice=recovery-invalid");
  return { available: true, requiresCurrentPassword: !isRecovery && !isPending, completionPending: isPending };
}
