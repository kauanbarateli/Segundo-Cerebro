import { isAbsolute, relative, dirname, basename } from "node:path";

export const LOCAL_APP_URL = "http://127.0.0.1:3117";
export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
export const AUTH_LOCAL_STAGES = [
  "fixtures-created", "login-a1", "login-a2", "login-b",
  "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions",
  "logout-global-a", "old-a-denied", "b-intact", "fixture-cleanup",
] as const;
export type AuthLocalStage = typeof AUTH_LOCAL_STAGES[number];
export type AuthLocalCode = "PASSED" | "ENVIRONMENT_REFUSED" | "FIXTURE_CREATE_FAILED"
  | "LOGIN_FAILED" | "PROTECTED_SESSION_FAILED" | "SESSION_ISOLATION_FAILED"
  | "LOGOUT_FAILED" | "OLD_SESSION_ACCEPTED" | "OTHER_ACCOUNT_CHANGED"
  | "CLEANUP_UNCONFIRMED" | "REPORT_WRITE_FAILED" | "ACCEPTANCE_FAILED";

export function refuse(code: AuthLocalCode): never { throw new Error(code); }

/** Pure opt-in guard: a supplied child environment never selects a remote host. */
export function localEnvironment(environment: Readonly<Record<string, string | undefined>>) {
  const state = environment.AUTH_STATE_SECRET, rate = environment.AUTH_RATE_LIMIT_SECRET;
  const publishable = environment.SUPABASE_PUBLISHABLE_KEY, secret = environment.SUPABASE_SECRET_KEY;
  const runnerTemp = environment.RUNNER_TEMP, reportPath = environment.SC_AUTH_LOCAL_CI_REPORT_PATH;
  if (environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true" ||
      environment.SC_AUTH_LOCAL_CI_RUN !== "1" || environment.APP_MODE !== "supabase" ||
      environment.NODE_ENV !== "development" || environment.APP_URL !== LOCAL_APP_URL ||
      environment.SUPABASE_URL !== LOCAL_SUPABASE_URL ||
      !publishable || publishable.trim() !== publishable || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishable) ||
      !secret || secret.trim() !== secret || !/^sb_secret_[A-Za-z0-9_-]+$/.test(secret) ||
      !state || !rate || state.trim() !== state || rate.trim() !== rate || Buffer.byteLength(state) < 32 || Buffer.byteLength(rate) < 32 ||
      new Set([state, rate, secret]).size !== 3 ||
      !runnerTemp || !reportPath || !isAbsolute(runnerTemp) || !isAbsolute(reportPath)) refuse("ENVIRONMENT_REFUSED");
  const inside = relative(runnerTemp, reportPath);
  if (!inside || inside.startsWith("..") || isAbsolute(inside) ||
      dirname(reportPath) === runnerTemp || basename(reportPath) !== "auth-local-ci-report.json" ||
      Object.keys(environment).some(key => /^(?:NEXT_PUBLIC_|GOOGLE_|SENTRY_|VERCEL_|GH_TOKEN$|GITHUB_TOKEN$|SUPABASE_ACCESS_TOKEN$|SUPABASE_DB_PASSWORD$|SUPABASE_ANON_KEY$|SUPABASE_SERVICE_ROLE_KEY$)/.test(key))) refuse("ENVIRONMENT_REFUSED");
  return { appUrl: LOCAL_APP_URL, supabaseUrl: LOCAL_SUPABASE_URL, runnerTemp, reportPath };
}

/** JWT fields are only a routing hint; the spec also verifies getUser + RPC. */
export function sessionFromCookies(cookies: readonly { name: string; value: string }[], expectedUser: string) {
  const single = cookies.filter(cookie => cookie.name === "sc-auth");
  const chunks = cookies.filter(cookie => /^sc-auth\.[0-9]+$/.test(cookie.name));
  if (single.length > 1 || (single.length && chunks.length) || (!single.length && !chunks.length)) refuse("LOGIN_FAILED");
  chunks.sort((a, b) => Number(a.name.slice(8)) - Number(b.name.slice(8)));
  if (chunks.some((cookie, index) => cookie.name !== `sc-auth.${index}`)) refuse("LOGIN_FAILED");
  const encoded = single[0]?.value ?? chunks.map(cookie => cookie.value).join("");
  if (!/^base64-[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > 128_000) refuse("LOGIN_FAILED");
  let session: unknown, claims: unknown;
  try {
    session = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString("utf8"));
    if (!session || typeof session !== "object" || Array.isArray(session)) refuse("LOGIN_FAILED");
    const accessToken = (session as Record<string, unknown>).access_token;
    if (typeof accessToken !== "string" || accessToken.length > 32_000 || accessToken.split(".").length !== 3) refuse("LOGIN_FAILED");
    claims = JSON.parse(Buffer.from(accessToken.split(".")[1]!, "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) refuse("LOGIN_FAILED");
    const fields = claims as Record<string, unknown>;
    if (fields.sub !== expectedUser || fields.role !== "authenticated" || typeof fields.session_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fields.session_id) ||
        typeof fields.exp !== "number" || !Number.isFinite(fields.exp) || fields.exp * 1000 <= Date.now() + 60_000) refuse("LOGIN_FAILED");
    return { accessToken, sessionId: fields.session_id, expiresAt: fields.exp * 1000 };
  } catch { return refuse("LOGIN_FAILED"); }
}

/** One explicit uncertainty latch blocks certification and deletion during work. */
export function cleanupMayProceed(uncertain: boolean): boolean { return !uncertain; }
