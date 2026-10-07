import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.generated";
import type { SupabaseAuthConfig } from "./config";
import { AUTH_COOKIE_NAME, secureCookieOptions } from "./cookie-policy";

export interface AuthCookieJar {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options: CookieOptions): void;
}
export function createRequestClient(config: SupabaseAuthConfig, jar: AuthCookieJar, writable: boolean, responseHeaders?: Headers) {
  return createServerClient<Database>(config.supabaseUrl, config.publishableKey, {
    auth: { flowType: "pkce", autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) },
    cookieOptions: { name: AUTH_COOKIE_NAME, ...secureCookieOptions(config.secureCookies) },
    cookies: {
      getAll: () => jar.getAll(),
      ...(writable ? { setAll: (values: { name: string; value: string; options: CookieOptions }[], cacheHeaders: Record<string, string>) => {
        for (const { name, value, options } of values) jar.set(name, value, secureCookieOptions(config.secureCookies, options));
        for (const [name, value] of Object.entries(cacheHeaders)) responseHeaders?.set(name, value);
      } } : {}),
    },
  });
}
export function createPrivilegedClient(config: SupabaseAuthConfig) {
  return createClient<Database>(config.supabaseUrl, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) },
  });
}
