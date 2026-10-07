export type AppMode = "demo" | "supabase";
export interface SupabaseAuthConfig {
  mode: "supabase";
  appOrigin: string;
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  rateLimitSecret: string;
  stateSecret: string;
  secureCookies: boolean;
}
type Environment = Readonly<Record<string, string | undefined>>;
export class AuthConfigurationError extends Error {
  constructor() { super("Autenticação indisponível neste ambiente."); this.name = "AuthConfigurationError"; }
}
export function getAppMode(environment: Environment = process.env): AppMode {
  const mode = environment.APP_MODE ?? "demo";
  if (mode !== "demo" && mode !== "supabase") throw new AuthConfigurationError();
  return mode;
}
function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new AuthConfigurationError();
  return value;
}
function origin(value: string, production: boolean): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AuthConfigurationError(); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local && !production))) throw new AuthConfigurationError();
  return url.origin;
}
export function readAuthConfiguration(environment: Environment = process.env): { mode: "demo" } | SupabaseAuthConfig {
  if (getAppMode(environment) === "demo") return { mode: "demo" };
  const production = environment.NODE_ENV === "production";
  const appOrigin = origin(required(environment, "APP_URL"), production);
  const supabaseUrl = origin(required(environment, "SUPABASE_URL"), production);
  const publishableKey = required(environment, "SUPABASE_PUBLISHABLE_KEY");
  const secretKey = required(environment, "SUPABASE_SECRET_KEY");
  const rateLimitSecret = required(environment, "AUTH_RATE_LIMIT_SECRET");
  const stateSecret = required(environment, "AUTH_STATE_SECRET");
  // Accept only current project keys; no ambiguous anon/service-role JWT fallback.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) || !/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey) ||
      new TextEncoder().encode(rateLimitSecret).length < 32 || new TextEncoder().encode(stateSecret).length < 32 ||
      new Set([rateLimitSecret, stateSecret, secretKey]).size !== 3) throw new AuthConfigurationError();
  return { mode: "supabase", appOrigin, supabaseUrl, publishableKey, secretKey, rateLimitSecret, stateSecret, secureCookies: production || appOrigin.startsWith("https:") };
}
