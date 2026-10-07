import { FEATURE_KEYS, resolveAccess, type FeatureKey } from "../../core/access/resolve-access";
import { AuthGuardError, type AuthenticatedIdentity } from "./types";

export const AUTH_UNAVAILABLE = "Autenticação indisponível neste ambiente. Tente novamente mais tarde.";
export const LOGIN_FAILURE = "Não foi possível entrar. Confira os dados e tente novamente.";
export const RECOVERY_MESSAGE = "Se houver uma conta para esse endereço, você receberá as instruções de recuperação.";

export function sameOrigin(origin: string | null, expected: string): boolean {
  if (!origin) return false;
  try { const value = new URL(origin); return value.origin === expected && value.href === `${value.origin}/`; } catch { return false; }
}
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return "/"; }
  if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return "/";
  const url = new URL(value, "https://internal.invalid");
  if (url.origin !== "https://internal.invalid" || /^\/(?:auth|api|entrar|sair|recuperar-senha|redefinir-senha|trocar-senha)(?:\/|$)/.test(decodeURIComponent(url.pathname))) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
export function validEmail(value: string): boolean { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function validNewPassword(value: string): boolean { return [...value].length >= 12 && new TextEncoder().encode(value).length <= 72 && !/[\u0000-\u001f\u007f]/.test(value); }
export function parseAccessState(value: unknown, userId: string, sessionId: string, email?: string): AuthenticatedIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthGuardError("unavailable");
  const dto = value as Record<string, unknown>;
  if (dto.user_id !== userId || typeof dto.must_change_password !== "boolean") throw new AuthGuardError("unavailable");
  if (dto.must_change_password) return { userId, sessionId, email, mustChangePassword: true };
  if ((dto.role !== "user" && dto.role !== "master") || !dto.entitlements || typeof dto.entitlements !== "object" || Array.isArray(dto.entitlements)) throw new AuthGuardError("unavailable");
  const entitlements: Partial<Record<FeatureKey, boolean>> = {};
  for (const [key, allowed] of Object.entries(dto.entitlements)) {
    if (!FEATURE_KEYS.includes(key as FeatureKey) || typeof allowed !== "boolean") throw new AuthGuardError("unavailable");
    entitlements[key as FeatureKey] = allowed;
  }
  return { userId, sessionId, email, mustChangePassword: false, role: dto.role, entitlements };
}
export function assertFeature(identity: AuthenticatedIdentity, feature: FeatureKey): void {
  if (identity.mustChangePassword || !resolveAccess(feature, { entitlements: identity.entitlements ?? {}, preferences: {}, isAdmin: identity.role === "master" }).allowed) throw new AuthGuardError("forbidden");
}
