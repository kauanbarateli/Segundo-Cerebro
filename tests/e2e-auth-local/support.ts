import { isAbsolute, relative, dirname, basename } from "node:path";

export const LOCAL_APP_URL = "http://127.0.0.1:3117";
export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
export const AUTH_LOCAL_STAGES = [
  "fixtures-created", "login-a1", "login-a2", "login-b",
  "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions",
  "logout-global-a", "old-a-denied", "b-intact", "fixture-cleanup",
] as const;
export type AuthLocalStage = typeof AUTH_LOCAL_STAGES[number];
export const AUTH_LOCAL_FAILURE_POINTS = [
  "FIXTURE_CREATE", "BROWSER_CONTEXT_CREATE", "LOGIN_DOCUMENT", "LOGIN_FORM",
  "LOGIN_FIELDS", "LOGIN_SUBMIT_NAVIGATION", "LOGIN_DESTINATION",
  "SESSION_COOKIE_POLICY", "SESSION_COOKIE_HINT", "SESSION_USER_VERIFICATION",
  "SESSION_ACCESS_STATE", "SESSION_SCRIPT_COOKIE_ISOLATION", "SESSION_NETWORK_ISOLATION",
  "PROTECTED_PAGE", "DISTINCT_SESSIONS", "LOGOUT_DOCUMENT", "LOGOUT_SUBMIT_NAVIGATION",
  "LOGOUT_RESPONSE_POLICY", "LOGOUT_STATUS", "LOGOUT_LOCATION", "LOGOUT_PRIVATE_CACHE",
  "LOGOUT_NO_STORE_CACHE", "LOGOUT_CSP", "LOGOUT_NOSNIFF", "LOGOUT_STORAGE_CLEARANCE",
  "LOGOUT_COOKIE_CLEARANCE", "OLD_A_TOKEN_LIFETIME",
  "OLD_A_ACCESS_STATE", "OLD_A_PAGE_GUARD", "OTHER_B_SESSION_INTACT", "FIXTURE_CLEANUP",
] as const;
export type AuthLocalFailurePoint = typeof AUTH_LOCAL_FAILURE_POINTS[number];
export const AUTH_LOCAL_CLEANUP_FAILURE_POINTS = [
  "OUTCOME_UNCERTAIN", "CONTEXT_CLOSE", "FIXTURE_PRECHECK",
  "SESSION_REVOCATION", "FIXTURE_DELETE_ACK", "FIXTURE_ABSENCE",
] as const;
export type AuthLocalCleanupFailurePoint = typeof AUTH_LOCAL_CLEANUP_FAILURE_POINTS[number];
export type AuthLocalCode = "PASSED" | "ENVIRONMENT_REFUSED" | "FIXTURE_CREATE_FAILED"
  | "LOGIN_FAILED" | "PROTECTED_SESSION_FAILED" | "SESSION_ISOLATION_FAILED"
  | "LOGOUT_FAILED" | "OLD_SESSION_ACCEPTED" | "OTHER_ACCOUNT_CHANGED"
  | "CLEANUP_UNCONFIRMED" | "REPORT_WRITE_FAILED" | "ACCEPTANCE_FAILED";

export function refuse(code: AuthLocalCode): never { throw new Error(code); }

/** A closed point names the attempted check, never its inputs or raw error. */
export function retainFailurePoint(previous: unknown, active: unknown): AuthLocalFailurePoint {
  const known = (value: unknown): value is AuthLocalFailurePoint =>
    typeof value === "string" && (AUTH_LOCAL_FAILURE_POINTS as readonly string[]).includes(value);
  if ((previous !== null && !known(previous)) || !known(active)) refuse("ACCEPTANCE_FAILED");
  return previous ?? active;
}

/** Cleanup diagnostics are independent of the first acceptance failure. */
export function retainCleanupFailurePoint(previous: unknown, active: unknown): AuthLocalCleanupFailurePoint {
  const known = (value: unknown): value is AuthLocalCleanupFailurePoint =>
    typeof value === "string" && (AUTH_LOCAL_CLEANUP_FAILURE_POINTS as readonly string[]).includes(value);
  if ((previous !== null && !known(previous)) || !known(active)) refuse("ACCEPTANCE_FAILED");
  return previous ?? active;
}

/** Only local CI documents: Next 15.5.27 dev overwrites Cache-Control exactly.
 * Route handlers (including logout) retain their existing strict private guard.
 * This helper is never imported by the application or a production smoke test.
 */
export function hasLocalDocumentHeaders(headers: Readonly<Record<string, string>>): boolean {
  const cache = headers["cache-control"] ?? "";
  const appPrivate = /(?:^|,)\s*private\s*(?:,|$)/i.test(cache) && /(?:^|,)\s*no-store\s*(?:,|$)/i.test(cache);
  return (appPrivate || cache === "no-store, must-revalidate") &&
    !!headers["content-security-policy"]?.trim() && headers["x-content-type-options"] === "nosniff";
}

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
