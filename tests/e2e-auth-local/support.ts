import { isAbsolute, relative, dirname, basename } from "node:path";
import { performance } from "node:perf_hooks";

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

/** Separate password-case contract: the already proven logout v1 stays intact. */
export const AUTH_PASSWORD_STAGES = [
  "fixtures-created", "login-a1", "login-a2", "login-b",
  "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions",
  "password-change-terminal", "old-a-denied", "b-intact",
  "old-password-denied", "new-password-login", "new-a-protected", "fixture-cleanup",
] as const;
export type AuthPasswordStage = typeof AUTH_PASSWORD_STAGES[number];
export const AUTH_PASSWORD_FAILURE_POINTS = [
  ...AUTH_LOCAL_FAILURE_POINTS,
  "PASSWORD_FORM", "PASSWORD_FIELDS", "PASSWORD_SUBMIT_NAVIGATION",
  "PASSWORD_TERMINAL_NOTICE", "PASSWORD_CHECKPOINT_CLEARANCE", "PASSWORD_AUTH_COOKIE_CLEARANCE",
  "OLD_PASSWORD_SUBMIT_COMPLETION", "OLD_PASSWORD_GENERIC_REFUSAL", "OLD_PASSWORD_COOKIE_CLEARANCE",
  "LOGIN_RESPONSE_WAIT", "LOGIN_URL_WAIT", "LOGIN_SUBMIT_CLICK", "LOGIN_POST_STATUS", "LOGIN_POST_COMPLETION",
  "POST_REQUEST_FAILED", "POST_COMPLETION_TIMEOUT",
] as const;
export type AuthPasswordFailurePoint = typeof AUTH_PASSWORD_FAILURE_POINTS[number];
export const AUTH_PASSWORD_CODES = [
  "PASSED", "ENVIRONMENT_REFUSED", "FIXTURE_CREATE_FAILED", "LOGIN_FAILED",
  "PROTECTED_SESSION_FAILED", "SESSION_ISOLATION_FAILED", "LOGOUT_FAILED", "OLD_SESSION_ACCEPTED",
  "OTHER_ACCOUNT_CHANGED", "CLEANUP_UNCONFIRMED", "REPORT_WRITE_FAILED", "ACCEPTANCE_FAILED",
  "PASSWORD_CHANGE_FAILED", "OLD_PASSWORD_ACCEPTED", "NEW_PASSWORD_LOGIN_FAILED",
] as const;
export type AuthPasswordCode = typeof AUTH_PASSWORD_CODES[number];
export const AUTH_PASSWORD_CHECKS = [
  "loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions",
  "passwordTerminalNotice", "checkpointCookiesCleared", "authCookiesCleared", "oldADenied", "bIntact",
  "oldPasswordDeniedWithoutSession", "newPasswordLogin", "newSessionDistinct", "newAProtected",
  "cleanupRevokedNewA", "cleanupRevokedB", "cleanupConfirmed",
] as const;
export type AuthPasswordChecks = Record<typeof AUTH_PASSWORD_CHECKS[number], boolean>;
export const AUTH_PASSWORD_COUNT_LIMITS = {
  fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3,
  appLoginPostsA: 4, appLoginPostsB: 1, passwordChangePosts: 1, credentialAttemptsA: 5,
} as const;
export type AuthPasswordCounts = Record<keyof typeof AUTH_PASSWORD_COUNT_LIMITS, number>;

export function refuse(code: AuthLocalCode | AuthPasswordCode): never { throw new Error(code); }

export function retainPasswordFailurePoint(previous: unknown, active: unknown): AuthPasswordFailurePoint {
  const known = (value: unknown): value is AuthPasswordFailurePoint =>
    typeof value === "string" && (AUTH_PASSWORD_FAILURE_POINTS as readonly string[]).includes(value);
  if ((previous !== null && !known(previous)) || !known(active)) refuse("ACCEPTANCE_FAILED");
  return previous ?? active;
}

/** Concurrent waits capture their own first failure before Promise.all rejects.
 * The callback retains that closed point; neither operation errors nor inputs
 * escape this helper. It does not change the operation or retry it.
 */
export async function observePasswordOperation<T>(point: AuthPasswordFailurePoint, operation: () => Promise<T>, firstFailure: (point: AuthPasswordFailurePoint) => void): Promise<T> {
  retainPasswordFailurePoint(null, point);
  if (typeof operation !== "function" || typeof firstFailure !== "function") refuse("ACCEPTANCE_FAILED");
  try { return await operation(); }
  catch {
    try { firstFailure(point); } catch { return refuse("ACCEPTANCE_FAILED"); }
    return refuse("LOGIN_FAILED");
  }
}

type PostRequest = { method(): string; url(): string; failure(): unknown };
type PostEvent = "request" | "requestfinished" | "requestfailed";
type PostPage = { url(): string; on(event: PostEvent, handler: (request: PostRequest) => void): unknown; off(event: PostEvent, handler: (request: PostRequest) => void): unknown };
const POST_OPERATIONS = {
  login: { path: "/entrar", aggregate: "LOGIN_POST_COMPLETION" },
  "password-change": { path: "/trocar-senha", aggregate: "PASSWORD_SUBMIT_NAVIGATION" },
  "old-password": { path: "/entrar", aggregate: "OLD_PASSWORD_SUBMIT_COMPLETION" },
} as const;
type PostOperation = keyof typeof POST_OPERATIONS;

/** Node CI only. Prearm before submission; complete binds the observed Response
 * to the exact unique Request. Only requestfinished + failure() === null proves
 * transport completion; URL, response headers or SDK identity never substitute.
 */
export function createPostCompletionObserver(options: Readonly<{ page: PostPage; operation: PostOperation; firstFailure: (point: AuthPasswordFailurePoint) => void; timeoutMs?: number }>) {
  if (!options || typeof options !== "object" || Array.isArray(options) ||
      Object.keys(options).some(key => !["page", "operation", "firstFailure", "timeoutMs"].includes(key))) refuse("ACCEPTANCE_FAILED");
  const { page, operation, firstFailure, timeoutMs = 15_000 } = options;
  if (!Object.hasOwn(POST_OPERATIONS, operation) || typeof firstFailure !== "function" ||
      !page || typeof page.on !== "function" || typeof page.off !== "function" || typeof page.url !== "function" ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15_000) refuse("ACCEPTANCE_FAILED");
  const spec = POST_OPERATIONS[operation];
  try {
    const current = new URL(page.url());
    if (current.origin !== LOCAL_APP_URL || current.pathname !== spec.path || current.username || current.password || current.hash) refuse("ACCEPTANCE_FAILED");
  } catch { refuse("ACCEPTANCE_FAILED"); }
  const deadline = performance.now() + timeoutMs;
  let candidate: PostRequest | null = null, finished = false, used = false, completed = false, released = false;
  let point: AuthPasswordFailurePoint | null = null, timer: ReturnType<typeof setTimeout> | undefined;
  let resolveTerminal!: (value: boolean) => void;
  const terminal = new Promise<boolean>(resolve => { resolveTerminal = resolve; });
  const listeners = new Map<PostEvent, (request: PostRequest) => void>();
  const record = (value: AuthPasswordFailurePoint) => { if (point === null) { point = value; try { firstFailure(value); } catch { /* No callback detail escapes. */ } } };
  const release = () => {
    if (released) return;
    released = true;
    if (timer) clearTimeout(timer);
    for (const [event, handler] of listeners) {
      try { page.off(event, handler); } catch { record(spec.aggregate); }
    }
    listeners.clear();
  };
  const fail = (value: AuthPasswordFailurePoint) => { record(value); resolveTerminal(false); release(); };
  const withinDeadline = () => {
    if (performance.now() >= deadline) { fail("POST_COMPLETION_TIMEOUT"); return false; }
    return point === null;
  };
  const matches = (request: PostRequest) => {
    if (!request || typeof request.method !== "function" || typeof request.url !== "function") refuse("ACCEPTANCE_FAILED");
    const url = new URL(request.url());
    return request.method() === "POST" && url.origin === LOCAL_APP_URL && url.pathname === spec.path && !url.username && !url.password && !url.hash;
  };
  const safely = (handler: (request: PostRequest) => void) => (request: PostRequest) => {
    if (released) return;
    try { handler(request); } catch { fail(spec.aggregate); }
  };
  listeners.set("request", safely(request => {
    if (!matches(request)) return;
    if (!withinDeadline()) return;
    if (candidate) { fail(spec.aggregate); return; }
    candidate = request;
  }));
  listeners.set("requestfinished", safely(request => {
    if (!matches(request)) return;
    if (!withinDeadline()) return;
    if (request !== candidate || finished || typeof request.failure !== "function") { fail(spec.aggregate); return; }
    if (request.failure() !== null) { fail("POST_REQUEST_FAILED"); return; }
    finished = true;
    // Only the terminal is bounded. A slower navigation may bind its already
    // completed Request later; it cannot turn a timeout into a valid terminal.
    if (timer) clearTimeout(timer);
    resolveTerminal(true);
  }));
  listeners.set("requestfailed", safely(request => {
    if (!matches(request)) return;
    if (!withinDeadline()) return;
    if (request !== candidate) { fail(spec.aggregate); return; }
    fail("POST_REQUEST_FAILED");
  }));
  try {
    for (const [event, handler] of listeners) page.on(event, handler);
    timer = setTimeout(() => fail("POST_COMPLETION_TIMEOUT"), timeoutMs);
  } catch { fail(spec.aggregate); refuse("ACCEPTANCE_FAILED"); }

  async function complete(expectedRequest: PostRequest) {
    if (used) return Object.freeze({ passed: false as const, failurePoint: spec.aggregate });
    used = true;
    if (point === null && (!candidate || expectedRequest !== candidate)) fail(spec.aggregate);
    if (point === null) await terminal;
    if (point === null) {
      try {
        if (!finished || candidate !== expectedRequest || typeof expectedRequest.failure !== "function") fail(spec.aggregate);
        else if (expectedRequest.failure() !== null) fail("POST_REQUEST_FAILED");
      } catch { fail(spec.aggregate); }
    }
    release(); candidate = null; completed = true;
    return point === null ? Object.freeze({ passed: true as const, failurePoint: null }) : Object.freeze({ passed: false as const, failurePoint: point });
  }
  function dispose() {
    // used marks entry, not settlement. Resolve a still-pending complete false
    // before removing the last timer/listener, including finish/resume races.
    if (!completed && point === null) fail(spec.aggregate);
    release(); candidate = null;
  }
  return Object.freeze({ complete, dispose });
}

/** Completed GUI observations, exact attempt budget and real cleanup are all
 * needed. Neither a successful subset nor resource disposal certifies this case.
 */
export function passwordAcceptanceComplete(value: Readonly<{
  stages: readonly Readonly<{ name: AuthPasswordStage; passed: boolean }>[];
  checks: AuthPasswordChecks; counts: AuthPasswordCounts;
  cleanupConfirmed: boolean; failurePoint: AuthPasswordFailurePoint | null;
  cleanupFailurePoint: AuthLocalCleanupFailurePoint | null;
}>): boolean {
  return value.cleanupConfirmed === true && value.failurePoint === null && value.cleanupFailurePoint === null &&
    value.stages.length === AUTH_PASSWORD_STAGES.length &&
    value.stages.every((stage, index) => stage.name === AUTH_PASSWORD_STAGES[index] && stage.passed === true) &&
    Object.keys(value.checks).length === AUTH_PASSWORD_CHECKS.length && AUTH_PASSWORD_CHECKS.every(key => value.checks[key] === true) &&
    Object.keys(value.counts).length === Object.keys(AUTH_PASSWORD_COUNT_LIMITS).length &&
    (Object.keys(AUTH_PASSWORD_COUNT_LIMITS) as (keyof AuthPasswordCounts)[]).every(key => value.counts[key] === AUTH_PASSWORD_COUNT_LIMITS[key]);
}

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

/** SDK 2.117.2 documents an empty user ACK for deleteUser. It proves neither
 * identity nor absence: the spec keeps exact precheck/revoke and later 404.
 */
export function acceptsDeleteAcknowledgement(result: unknown, fixture: Readonly<{ id: string; email: string; marker: string }>): boolean {
  const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(property => Object.hasOwn(property, "value"));
  if (!plain(result) || result.error !== null || !plain(result.data) || !plain(result.data.user)) return false;
  const user = result.data.user;
  if (Reflect.ownKeys(user).length === 0) return true;
  return user.id === fixture.id && user.email === fixture.email && user.role === "authenticated" &&
    !user.is_anonymous && plain(user.app_metadata) && user.app_metadata.sc_auth_local_ci_marker === fixture.marker;
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
