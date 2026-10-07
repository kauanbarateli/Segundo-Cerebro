import type { CookieOptions } from "@supabase/ssr";

export const AUTH_COOKIE_NAME = "sc-auth";
export const FLOW_COOKIE_NAMES = {
  "recovery-request": "sc-flow-request",
  "recovery-session": "sc-flow-recovery",
  "password-updated": "sc-flow-password",
} as const;
export function secureCookieOptions(secure: boolean, options: CookieOptions = {}): CookieOptions {
  return { ...options, domain: undefined, httpOnly: true, secure, sameSite: "lax", path: "/" };
}
export function isOwnedAuthCookie(name: string): boolean {
  return name === AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`) || name.startsWith(`${AUTH_COOKIE_NAME}-`) || Object.values(FLOW_COOKIE_NAMES).some((value) => value === name);
}
export function noStoreHeaders(): Record<string, string> {
  return { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" };
}
