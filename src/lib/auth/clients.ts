import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.generated";
import { AuthConfigurationError, type SupabaseAuthConfig } from "./config";
import { authDeploymentAllowed } from "../environment/application-destination";
import { AUTH_COOKIE_NAME, secureCookieOptions } from "./cookie-policy";
import {SIGNUP_CONTEXT_SECONDS} from "./signup-provisional";

export interface AuthCookieJar {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options: CookieOptions): void;
}
export function createRequestClient(config: SupabaseAuthConfig, jar: AuthCookieJar, writable: boolean, responseHeaders?: Headers, storageName: string = AUTH_COOKIE_NAME, timeoutMs?:number) {
  if (!authDeploymentAllowed(process.env, config)) throw new AuthConfigurationError();
  return createServerClient<Database>(config.supabaseUrl, config.publishableKey, {
    auth: { flowType: "pkce", autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store", ...(timeoutMs ? {signal:AbortSignal.timeout(timeoutMs)} : {}) }) },
    cookieOptions: { name: storageName, ...secureCookieOptions(config.secureCookies) },
    cookies: {
      getAll: () => jar.getAll(),
      ...(writable ? { setAll: (values: { name: string; value: string; options: CookieOptions }[], cacheHeaders: Record<string, string>) => {
        for (const { name, value, options } of values) {
          if(storageName!==AUTH_COOKIE_NAME && !(name===storageName || name.startsWith(`${storageName}.`) || name.startsWith(`${storageName}-`))) throw new AuthConfigurationError();
          const age=options.maxAge;
          const bounded=storageName===AUTH_COOKIE_NAME ? options : {...options,maxAge:typeof age==="number" ? Math.min(age,SIGNUP_CONTEXT_SECONDS) : SIGNUP_CONTEXT_SECONDS};
          jar.set(name, value, secureCookieOptions(config.secureCookies, bounded));
        }
        for (const [name, value] of Object.entries(cacheHeaders)) responseHeaders?.set(name, value);
      } } : {}),
    },
  });
}
export function createPrivilegedClient(config: SupabaseAuthConfig) {
  if (!authDeploymentAllowed(process.env, config)) throw new AuthConfigurationError();
  return createClient<Database>(config.supabaseUrl, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) },
  });
}
