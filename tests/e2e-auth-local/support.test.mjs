import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { EventEmitter } from "node:events";
import { prepareAuthEffectObservation, createAuthEffectLedger } from "./auth-effect-outcome.mjs";

// Compile only this repository-owned pure helper. SDK calls below use fakes;
// these controls load no env file, browser, services or real credentials.
const source = await readFile(new URL("./support.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { localEnvironment, sessionFromCookies, cleanupMayProceed, hasLocalDocumentHeaders, acceptsDeleteAcknowledgement, retainFailurePoint, retainCleanupFailurePoint, AUTH_LOCAL_STAGES, AUTH_LOCAL_FAILURE_POINTS, AUTH_LOCAL_CLEANUP_FAILURE_POINTS, AUTH_PASSWORD_STAGES, AUTH_PASSWORD_FAILURE_POINTS, AUTH_PASSWORD_CODES, AUTH_PASSWORD_CHECKS, AUTH_PASSWORD_COUNT_LIMITS, retainPasswordFailurePoint, passwordAcceptanceComplete, observePasswordOperation, createPostCompletionObserver, classifyPostRequestFailure } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const temp = resolve("work", "unit-auth-local-temp");
const environment = () => ({
  CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1", APP_MODE: "supabase", NODE_ENV: "development",
  APP_URL: "http://127.0.0.1:3117", SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"P".repeat(32)}`, SUPABASE_SECRET_KEY: `sb_secret_${"S".repeat(32)}`,
  AUTH_STATE_SECRET: "A".repeat(48), AUTH_RATE_LIMIT_SECRET: "B".repeat(48),
  RUNNER_TEMP: temp, SC_AUTH_LOCAL_CI_REPORT_PATH: join(temp, "sc-auth-local-ci-unit", "auth-local-ci-report.json"),
});
function refused(action, code) { assert.throws(action, error => error?.message === code); }
test("child local guard accepts only explicit local metadata and returns no keys", () => {
  const result = localEnvironment(environment());
  assert.deepEqual(Object.keys(result).sort(), ["appUrl", "reportPath", "runnerTemp", "supabaseUrl"]);
  assert.equal(result.appUrl === environment().APP_URL && result.supabaseUrl === environment().SUPABASE_URL, true);
});
for (const key of Object.keys(environment())) {
  test(`child local guard refuses missing ${key}`, () => {
    const supplied = environment(); delete supplied[key]; refused(() => localEnvironment(supplied), "ENVIRONMENT_REFUSED");
  });
}
const invalid = [
  ["CI", "1"], ["GITHUB_ACTIONS", "1"], ["SC_AUTH_LOCAL_CI_RUN", "true"], ["APP_MODE", "demo"], ["NODE_ENV", "production"],
  ["APP_URL", "https://segundo-cerebro-of.vercel.app"], ["APP_URL", "http://localhost:3117"], ["APP_URL", "http://127.0.0.1:3117/"],
  ["APP_URL", "http://127.0.0.1:3100"], ["APP_URL", "http://user:pass@127.0.0.1:3117"],
  ["SUPABASE_URL", "https://rishenjoikgmfubmnfiu.supabase.co"], ["SUPABASE_URL", "http://localhost:54321"],
  ["SUPABASE_URL", "http://127.0.0.1:54321/path"], ["SUPABASE_URL", "http://127.0.0.1:54321?key=x"],
  ["SUPABASE_PUBLISHABLE_KEY", "legacy.jwt.value"], ["SUPABASE_SECRET_KEY", "legacy.jwt.value"],
  ["SUPABASE_PUBLISHABLE_KEY", `${environment().SUPABASE_PUBLISHABLE_KEY}\n`], ["SUPABASE_SECRET_KEY", `${environment().SUPABASE_SECRET_KEY}\n`],
  ["AUTH_STATE_SECRET", "A".repeat(31)], ["AUTH_RATE_LIMIT_SECRET", "B".repeat(31)], ["AUTH_STATE_SECRET", " ".repeat(48)],
  ["AUTH_RATE_LIMIT_SECRET", environment().AUTH_STATE_SECRET], ["AUTH_STATE_SECRET", environment().SUPABASE_SECRET_KEY],
  ["AUTH_RATE_LIMIT_SECRET", environment().SUPABASE_SECRET_KEY], ["RUNNER_TEMP", "relative-temp"],
  ["SC_AUTH_LOCAL_CI_REPORT_PATH", "relative-report.json"], ["SC_AUTH_LOCAL_CI_REPORT_PATH", join(temp, "auth-local-ci-report.json")],
  ["SC_AUTH_LOCAL_CI_REPORT_PATH", join(temp, "..", "outside", "auth-local-ci-report.json")],
  ["SC_AUTH_LOCAL_CI_REPORT_PATH", join(temp, "nested", "raw-report.json")],
];
invalid.forEach(([key, value], index) => test(`child local guard rejects boundary ${index + 1}`, () => {
  refused(() => localEnvironment({ ...environment(), [key]: value }), "ENVIRONMENT_REFUSED");
}));
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "GOOGLE_OAUTH_CLIENT_SECRET", "SENTRY_DSN", "VERCEL_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  test(`child local guard refuses foreign inherited ${key}`, () => refused(() => localEnvironment({ ...environment(), [key]: "synthetic-only" }), "ENVIRONMENT_REFUSED"));
}

const user = "f1900000-0000-4000-8000-000000000001", sid = "f1900000-0000-4000-8000-000000000002";
const claims = () => ({ sub: user, session_id: sid, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 });
function cookie(fields = claims()) {
  const token = `header.${Buffer.from(JSON.stringify(fields)).toString("base64url")}.signature`;
  return { name: "sc-auth", value: `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "synthetic-not-authority" })).toString("base64url")}` };
}
test("single Auth cookie yields a hint, never verified authority", () => {
  const value = sessionFromCookies([cookie()], user);
  assert.equal(value.sessionId === sid && typeof value.accessToken === "string", true);
  assert.deepEqual(Object.keys(value).sort(), ["accessToken", "expiresAt", "sessionId"]);
});
test("ordered chunks reconstruct the same hint without mutating supplied cookies", () => {
  const raw = cookie().value, middle = Math.floor(raw.length / 2);
  const supplied = [{ name: "sc-auth.1", value: raw.slice(middle) }, { name: "sc-auth.0", value: raw.slice(0, middle) }];
  const before = supplied.map(item => item.name).join();
  assert.equal(sessionFromCookies(supplied, user).sessionId === sid, true);
  assert.equal(supplied.map(item => item.name).join() === before, true);
});
const badClaims = [
  { ...claims(), sub: sid }, { ...claims(), session_id: "invalid" }, { ...claims(), role: "service_role" },
  { ...claims(), role: "user" }, { ...claims(), exp: 0 }, { ...claims(), exp: "future" }, { ...claims(), exp: null },
  { ...claims(), exp: Math.floor(Date.now() / 1000) + 40 }, { ...claims(), exp: Math.floor(Date.now() / 1000) + 60 },
];
badClaims.forEach((value, index) => test(`Auth cookie hint refuses claims boundary ${index + 1}`, () => refused(() => sessionFromCookies([cookie(value)], user), "LOGIN_FAILED")));
const badCookies = [
  [], [cookie(), cookie()], [cookie(), { name: "sc-auth.0", value: cookie().value }],
  [{ name: "sc-auth.1", value: cookie().value }], [{ name: "sc-auth.00", value: cookie().value }],
  [{ name: "sc-auth.0", value: cookie().value }, { name: "sc-auth.0", value: "x" }],
  [{ name: "sc-auth", value: "unprefixed" }], [{ name: "sc-auth", value: "base64-@@@" }],
  [{ name: "sc-auth", value: "base64-e30" }], [{ name: "sc-auth", value: "base64-" + "A".repeat(128_000) }],
];
badCookies.forEach((value, index) => test(`Auth cookie hint refuses storage boundary ${index + 1}`, () => refused(() => sessionFromCookies(value, user), "LOGIN_FAILED")));
test("cleanup cannot proceed while any remote outcome is uncertain", () => {
  assert.equal(cleanupMayProceed(true), false); assert.equal(cleanupMayProceed(false), true);
});
test("stage contract is closed, ordered and includes finally cleanup", () => {
  assert.equal(AUTH_LOCAL_STAGES.length, 12); assert.equal(new Set(AUTH_LOCAL_STAGES).size, 12);
  assert.equal(AUTH_LOCAL_STAGES.at(-1), "fixture-cleanup");
});

const failurePoints = [
  "FIXTURE_CREATE", "BROWSER_CONTEXT_CREATE", "LOGIN_DOCUMENT", "LOGIN_FORM",
  "LOGIN_FIELDS", "LOGIN_SUBMIT_NAVIGATION", "LOGIN_DESTINATION",
  "SESSION_COOKIE_POLICY", "SESSION_COOKIE_HINT", "SESSION_USER_VERIFICATION",
  "SESSION_ACCESS_STATE", "SESSION_SCRIPT_COOKIE_ISOLATION", "SESSION_NETWORK_ISOLATION",
  "PROTECTED_PAGE", "DISTINCT_SESSIONS", "LOGOUT_DOCUMENT", "LOGOUT_SUBMIT_NAVIGATION",
  "LOGOUT_RESPONSE_POLICY", "LOGOUT_STATUS", "LOGOUT_LOCATION", "LOGOUT_PRIVATE_CACHE",
  "LOGOUT_NO_STORE_CACHE", "LOGOUT_CSP", "LOGOUT_NOSNIFF", "LOGOUT_STORAGE_CLEARANCE",
  "LOGOUT_COOKIE_CLEARANCE", "OLD_A_TOKEN_LIFETIME",
  "OLD_A_ACCESS_STATE", "OLD_A_PAGE_GUARD", "OTHER_B_SESSION_INTACT", "FIXTURE_CLEANUP",
];
test("failure point contract contains only the 31 agreed check names including the historical aggregate", () => {
  assert.deepEqual(AUTH_LOCAL_FAILURE_POINTS, failurePoints);
  assert.equal(new Set(AUTH_LOCAL_FAILURE_POINTS).size, 31);
});
for (const point of failurePoints) {
  test(`failure point retains the first ${point} through final cleanup`, () => {
    const first = retainFailurePoint(null, point);
    assert.equal(first, point);
    assert.equal(retainFailurePoint(first, "FIXTURE_CLEANUP"), point);
  });
}
test("a cleanup-only failure has its own closed point", () => {
  assert.equal(retainFailurePoint(null, "FIXTURE_CLEANUP"), "FIXTURE_CLEANUP");
});
test("a login failure remains diagnostic when its report code becomes cleanup unconfirmed", () => {
  const report = { status: "failed", code: "LOGIN_FAILED", failurePoint: retainFailurePoint(null, "LOGIN_SUBMIT_NAVIGATION") };
  report.code = "CLEANUP_UNCONFIRMED";
  report.failurePoint = retainFailurePoint(report.failurePoint, "FIXTURE_CLEANUP");
  assert.deepEqual(report, { status: "failed", code: "CLEANUP_UNCONFIRMED", failurePoint: "LOGIN_SUBMIT_NAVIGATION" });
});
const invalidPoints = [undefined, null, "", "login-a1", "LOGIN_SUBMIT_NAVIGATION\n", "untrusted-diagnostic", 0, false, {}, [], new Error("untrusted-diagnostic")];
invalidPoints.forEach((value, index) => {
  test(`failure point rejects active boundary ${index + 1} without reflecting it`, () => {
    refused(() => retainFailurePoint(null, value), "ACCEPTANCE_FAILED");
    refused(() => retainFailurePoint("LOGIN_DOCUMENT", value), "ACCEPTANCE_FAILED");
  });
  if (value !== null) {
    test(`failure point rejects previous boundary ${index + 1} without reflecting it`, () => {
      refused(() => retainFailurePoint(value, "FIXTURE_CLEANUP"), "ACCEPTANCE_FAILED");
    });
  }
});

const cleanupPoints = ["OUTCOME_UNCERTAIN", "CONTEXT_CLOSE", "FIXTURE_PRECHECK", "SESSION_REVOCATION", "FIXTURE_DELETE_ACK", "FIXTURE_ABSENCE"];
test("cleanup point contract is the agreed independent six-value projection", () => {
  assert.deepEqual(AUTH_LOCAL_CLEANUP_FAILURE_POINTS, cleanupPoints);
  assert.equal(new Set(AUTH_LOCAL_CLEANUP_FAILURE_POINTS).size, 6);
});
for (const point of cleanupPoints) {
  test(`cleanup point retains the first ${point} across later failures`, () => {
    const first = retainCleanupFailurePoint(null, point);
    assert.equal(first, point);
    for (const later of cleanupPoints) assert.equal(retainCleanupFailurePoint(first, later), point);
  });
}
invalidPoints.forEach((value, index) => {
  test(`cleanup point rejects active boundary ${index + 1} without reflecting it`, () => {
    refused(() => retainCleanupFailurePoint(null, value), "ACCEPTANCE_FAILED");
    refused(() => retainCleanupFailurePoint("FIXTURE_PRECHECK", value), "ACCEPTANCE_FAILED");
  });
  if (value !== null) test(`cleanup point rejects previous boundary ${index + 1} without reflecting it`, () => {
    refused(() => retainCleanupFailurePoint(value, "FIXTURE_ABSENCE"), "ACCEPTANCE_FAILED");
  });
});
test("independent cleanup failure never replaces the document failure or certifies deletion", () => {
  const report = { failurePoint: retainFailurePoint(null, "LOGIN_DOCUMENT"), cleanupFailurePoint: retainCleanupFailurePoint(null, "FIXTURE_DELETE_ACK"), cleanupConfirmed: false, fixtureDeleted: 0 };
  report.failurePoint = retainFailurePoint(report.failurePoint, "FIXTURE_CLEANUP");
  report.cleanupFailurePoint = retainCleanupFailurePoint(report.cleanupFailurePoint, "FIXTURE_ABSENCE");
  assert.deepEqual(report, { failurePoint: "LOGIN_DOCUMENT", cleanupFailurePoint: "FIXTURE_DELETE_ACK", cleanupConfirmed: false, fixtureDeleted: 0 });
});
test("an uncertain outcome prevents cleanup before any deletion step is recorded", () => {
  const permitted = cleanupMayProceed(true);
  const point = permitted ? null : retainCleanupFailurePoint(null, "OUTCOME_UNCERTAIN");
  assert.equal(permitted, false);
  assert.equal(point, "OUTCOME_UNCERTAIN");
});

const documentHeaders = cache => ({ "cache-control": cache, "content-security-policy": "default-src 'self'; object-src 'none'", "x-content-type-options": "nosniff" });
test("local documents accept the exact installed Next dev cache override with protection", () => {
  assert.equal(hasLocalDocumentHeaders(documentHeaders("no-store, must-revalidate")), true);
});
test("local documents preserve the application private/no-store cache case", () => {
  assert.equal(hasLocalDocumentHeaders(documentHeaders("private, no-store")), true);
  assert.equal(hasLocalDocumentHeaders(documentHeaders("private, no-store, max-age=0")), true);
});
const badDocumentHeaders = [
  documentHeaders("public, max-age=60"), documentHeaders("no-store"), documentHeaders("private"),
  documentHeaders("no-store,must-revalidate"), documentHeaders("no-store, must-revalidate "),
  documentHeaders("NO-STORE, MUST-REVALIDATE"), documentHeaders("no-store, must-revalidate, max-age=0"),
  documentHeaders("private-data, no-store"), documentHeaders("private, x-no-store"),
  { ...documentHeaders("no-store, must-revalidate"), "content-security-policy": "" },
  { ...documentHeaders("private, no-store"), "content-security-policy": " " },
  { ...documentHeaders("no-store, must-revalidate"), "x-content-type-options": "" },
  { ...documentHeaders("private, no-store"), "x-content-type-options": "wrong" }, {},
];
badDocumentHeaders.forEach((headers, index) => test(`local document headers reject protection boundary ${index + 1}`, () => {
  assert.equal(hasLocalDocumentHeaders(headers), false);
}));

// Compile only the repository-owned logout header collection and predicates.
// The complete spec, SDK, browser, environment and provider are never imported.
const specSource = await readFile(new URL("./auth-local.spec.ts", import.meta.url), "utf8");
const predicateStart = '      activeFailurePoint = "LOGOUT_RESPONSE_POLICY";';
const predicateEnd = '      activeFailurePoint = "LOGOUT_COOKIE_CLEARANCE";';
assert.equal(specSource.split(predicateStart).length, 2);
assert.equal(specSource.split(predicateEnd).length, 2);
const predicateBody = specSource.slice(specSource.indexOf(predicateStart), specSource.indexOf(predicateEnd));
assert.equal(/\b(?:fetch|process|console|import|session|password)\b/.test(predicateBody), false);
assert.equal((predicateBody.match(/\bawait\b/g) ?? []).length, 1);
assert.equal(predicateBody.includes("const logoutHeaders = await logout.allHeaders();"), true);
const predicateModule = ts.transpileModule(`export async function inspect(logout) {
  let activeFailurePoint;
  const refuse = () => { throw new Error("LOGOUT_FAILED"); };
  try { ${predicateBody} return null; } catch { return activeFailurePoint; }
}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { inspect: inspectLogout } = await import(`data:text/javascript;base64,${Buffer.from(predicateModule).toString("base64")}`);
const logoutResponse = (status = 303, overrides = {}) => ({ status: () => status, allHeaders: async () => ({
  location: "/entrar?notice=signed-out", "cache-control": "private, no-store",
  "content-security-policy": "default-src 'self'", "x-content-type-options": "nosniff", "clear-site-data": '"storage"',
  ...overrides,
}) });
test("split logout predicates accept exactly the prior successful response contract", async () => {
  assert.equal(await inspectLogout(logoutResponse()), null);
});
const failedLogoutPredicates = [
  [logoutResponse(200), "LOGOUT_STATUS"],
  [logoutResponse(303, { location: "/entrar" }), "LOGOUT_LOCATION"],
  [logoutResponse(303, { "cache-control": "no-store" }), "LOGOUT_PRIVATE_CACHE"],
  [logoutResponse(303, { "cache-control": "private" }), "LOGOUT_NO_STORE_CACHE"],
  [logoutResponse(303, { "content-security-policy": "" }), "LOGOUT_CSP"],
  [logoutResponse(303, { "x-content-type-options": "" }), "LOGOUT_NOSNIFF"],
  [logoutResponse(303, { "clear-site-data": '"cache"' }), "LOGOUT_STORAGE_CLEARANCE"],
];
for (const [response, point] of failedLogoutPredicates) test(`split logout reports the first ${point} without raw response material`, async () => {
  assert.equal(await inspectLogout(response), point);
});
test("split logout retains the first failing predicate when multiple requirements fail", async () => {
  assert.equal(await inspectLogout(logoutResponse(200, { location: "wrong", "cache-control": "", "content-security-policy": "", "x-content-type-options": "", "clear-site-data": "" })), "LOGOUT_STATUS");
});
test("the absolute same-origin location is still refused by the unchanged relative-location expectation", async () => {
  assert.equal(await inspectLogout(logoutResponse(303, { location: "http://127.0.0.1:3117/entrar?notice=signed-out" })), "LOGOUT_LOCATION");
});
test("the exact document-dev cache exception never relaxes the logout route-handler requirement", async () => {
  assert.equal(await inspectLogout(logoutResponse(303, { "cache-control": "no-store, must-revalidate" })), "LOGOUT_PRIVATE_CACHE");
});
test("split logout acceptance equals the prior aggregate across independent predicate combinations", async () => {
  let combinations = 0;
  for (const status of [200, 303]) for (const location of ["/entrar", "/entrar?notice=signed-out"])
    for (const cache of ["", "private", "no-store", "private, no-store", "no-store, must-revalidate", "private, no-store, max-age=0"])
      for (const csp of [undefined, "", "default-src 'self'"]) for (const nosniff of [undefined, "nosniff"])
        for (const clearance of [undefined, '"cache"', '"storage"']) {
          const response = logoutResponse(status, { location, "cache-control": cache, "content-security-policy": csp, "x-content-type-options": nosniff, "clear-site-data": clearance });
          const oldAcceptance = status === 303 && location === "/entrar?notice=signed-out" && /private/.test(cache) && /no-store/.test(cache) && !!csp && nosniff === "nosniff" && !!clearance?.includes('"storage"');
          assert.equal(await inspectLogout(response) === null, oldAcceptance);
          combinations++;
        }
  assert.equal(combinations, 432);
});
test("complete header collection failure preserves the historical aggregate point without error content", async () => {
  const response = { ...logoutResponse(), allHeaders: async () => { throw new Error("untrusted-provider-detail"); } };
  assert.equal(await inspectLogout(response), "LOGOUT_RESPONSE_POLICY");
});
test("logout reads the complete header map even if a partial view would omit security headers", async () => {
  const response = { ...logoutResponse(), headers: () => ({ location: "/entrar?notice=signed-out" }) };
  assert.equal(await inspectLogout(response), null);
});

// Only fixed synthetic payloads enter a fake fetch. Actual SDK normalization is
// exercised without loading environment values or contacting any service.
const deletionFixture = { id: user, email: "synthetic-ack@example.invalid", marker: "synthetic-ack-marker" };
const deletedOwner = { id: user, email: deletionFixture.email, role: "authenticated", aud: "authenticated", is_anonymous: false, app_metadata: { sc_auth_local_ci_marker: deletionFixture.marker }, user_metadata: {}, created_at: "2026-10-10T00:00:00Z" };
const ackCases = [
  ["empty JSON", 200, {}, true], ["empty wrapped user", 200, { user: {} }, true],
  ["full owned user", 200, deletedOwner, true], ["full wrapped owned user", 200, { user: deletedOwner }, true],
  ["foreign ID", 200, { user: { ...deletedOwner, id: sid } }, false],
  ["partial identity", 200, { id: user }, false],
  ["empty 204", 204, null, false], ["null JSON", 200, null, false], ["array JSON", 200, [], false],
  ["string JSON", 200, "synthetic", false],
  ["provider rejection", 403, { code: "unexpected_failure", msg: "synthetic-not-reported" }, false],
  ["provider unavailable", 503, { code: "unexpected_failure", msg: "synthetic-not-reported" }, false],
];
for (const [name, status, body, accepted] of ackCases) test(`delete ACK uses actual SDK and refuses unsafe ${name} outcomes`, async () => {
  let calls = 0;
  const sdk = createClient("http://127.0.0.1:54321", "sb_secret_synthetic_ack_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      assert.equal(target.origin, "http://127.0.0.1:54321"); assert.equal(target.pathname, `/auth/v1/admin/users/${user}`);
      assert.equal(target.search, ""); assert.equal(options.method, "DELETE");
      assert.deepEqual(JSON.parse(options.body), { should_soft_delete: false });
      calls++;
      return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "x-supabase-api-version": "2024-01-01" } });
    } },
  });
  let result, threw = false;
  try { result = await sdk.auth.admin.deleteUser(user, false); } catch { threw = true; }
  assert.equal(!threw && acceptsDeleteAcknowledgement(result, deletionFixture), accepted);
  assert.equal(calls, 1);
});
test("delete ACK rejects malformed JSON through the actual SDK with no retry", async () => {
  let calls = 0;
  const sdk = createClient("http://127.0.0.1:54321", "sb_secret_synthetic_ack_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => { calls++; return new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }); } },
  });
  const result = await sdk.auth.admin.deleteUser(user, false);
  assert.equal(result.error !== null, true); assert.equal(acceptsDeleteAcknowledgement(result, deletionFixture), false); assert.equal(calls, 1);
});
const invalidAcknowledgements = [undefined, null, [], {}, { data: {}, error: null },
  { data: { user: {} } }, { data: { user: {} }, error: undefined }, { data: { user: {} }, error: false },
  { data: { user: {} }, error: {} }, { data: { user: null }, error: null }, { data: { user: [] }, error: null },
  { data: { user: Object.create(null) }, error: null }, { data: { user: { extra: true } }, error: null },
  { data: { user: { ...deletedOwner, email: "other@example.invalid" } }, error: null },
  { data: { user: { ...deletedOwner, role: "service_role" } }, error: null },
  { data: { user: { ...deletedOwner, is_anonymous: true } }, error: null },
  { data: { user: { ...deletedOwner, app_metadata: {} } }, error: null },
];
invalidAcknowledgements.forEach((value, index) => test(`delete ACK refuses exact null/shape/ownership boundary ${index + 1}`, () => {
  assert.equal(acceptsDeleteAcknowledgement(value, deletionFixture), false);
}));
test("delete ACK rejects hidden/symbol/accessor fields while never invoking their contents", () => {
  const symbolUser = {}; symbolUser[Symbol("synthetic")] = true;
  const hiddenUser = {}; Object.defineProperty(hiddenUser, "synthetic", { value: true });
  let called = false;
  const accessorUser = {}; Object.defineProperty(accessorUser, "id", { get() { called = true; throw new Error("untrusted"); } });
  for (const value of [symbolUser, hiddenUser, accessorUser]) assert.equal(acceptsDeleteAcknowledgement({ data: { user: value }, error: null }, deletionFixture), false);
  assert.equal(called, false);
});
test("accepted ACK alone never satisfies the mandatory later exact SDK 404 and uncertainty gate", async () => {
  const sdk = createClient("http://127.0.0.1:54321", "sb_secret_synthetic_absence_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      assert.equal(target.origin, "http://127.0.0.1:54321"); assert.equal(target.pathname, `/auth/v1/admin/users/${user}`); assert.equal(options.method, "GET");
      return new Response(JSON.stringify({ code: "user_not_found", msg: "synthetic" }), { status: 404, headers: { "Content-Type": "application/json", "x-supabase-api-version": "2024-01-01" } });
    } },
  });
  const acknowledgement = { data: { user: {} }, error: null };
  assert.equal(acceptsDeleteAcknowledgement(acknowledgement, deletionFixture), true);
  assert.equal(cleanupMayProceed(true), false);
  const absent = await sdk.auth.admin.getUserById(user);
  assert.equal(absent.data.user, null); assert.equal(absent.error.status, 404); assert.equal(absent.error.code, "user_not_found");
  // The production spec still executes its exact precheck/revoke and separate
  // SDK 404 checks before incrementing. This control does not replace them.
  const precheck = specSource.indexOf('if (current.error || !matchesFixture(current.data.user, owner) || !UUID.test(owner.id))');
  const revocation = specSource.indexOf('if (verified.error || !matchesFixture(verified.data.user, owner))');
  const acknowledgementCheck = specSource.indexOf('if (!acceptsDeleteAcknowledgement(removed, owner))');
  const absenceCheck = specSource.indexOf('if (absent.data.user || absent.error?.status !== 404 || absent.error?.code !== "user_not_found")');
  const counter = specSource.indexOf('report.counts.fixtureDeleted++');
  assert.equal([precheck, revocation, acknowledgementCheck, absenceCheck, counter].every(index => index >= 0), true);
  assert.equal(precheck < revocation && revocation < acknowledgementCheck && acknowledgementCheck < absenceCheck && absenceCheck < counter, true);
});

const passwordStages = ["fixtures-created", "login-a1", "login-a2", "login-b", "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions", "password-change-terminal", "old-a-denied", "b-intact", "old-password-denied", "new-password-login", "new-a-protected", "fixture-cleanup"];
const passwordPoints = ["PASSWORD_FORM", "PASSWORD_FIELDS", "PASSWORD_SUBMIT_NAVIGATION", "PASSWORD_TERMINAL_NOTICE", "PASSWORD_CHECKPOINT_CLEARANCE", "PASSWORD_AUTH_COOKIE_CLEARANCE", "OLD_PASSWORD_SUBMIT_COMPLETION", "OLD_PASSWORD_GENERIC_REFUSAL", "OLD_PASSWORD_COOKIE_CLEARANCE", "LOGIN_RESPONSE_WAIT", "LOGIN_URL_WAIT", "LOGIN_SUBMIT_CLICK", "LOGIN_POST_STATUS", "LOGIN_POST_COMPLETION", "POST_REQUEST_FAILED", "POST_COMPLETION_TIMEOUT", "POST_REQUEST_ABORTED"];
const passwordChecks = ["loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions", "passwordTerminalNotice", "checkpointCookiesCleared", "authCookiesCleared", "oldADenied", "bIntact", "oldPasswordDeniedWithoutSession", "newPasswordLogin", "newSessionDistinct", "newAProtected", "cleanupRevokedNewA", "cleanupRevokedB", "cleanupConfirmed"];
const passwordCountLimits = { fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3, appLoginPostsA: 4, appLoginPostsB: 1, passwordChangePosts: 1, credentialAttemptsA: 5 };

test("password v2 is separate from the unchanged minimum v1 contracts", () => {
  assert.deepEqual(AUTH_PASSWORD_STAGES, passwordStages);
  assert.deepEqual(AUTH_PASSWORD_FAILURE_POINTS, [...failurePoints, ...passwordPoints]);
  assert.equal(new Set(AUTH_PASSWORD_FAILURE_POINTS).size, 48);
  assert.deepEqual(AUTH_PASSWORD_CHECKS, passwordChecks);
  assert.deepEqual(AUTH_PASSWORD_COUNT_LIMITS, passwordCountLimits);
  assert.equal(AUTH_PASSWORD_CODES.length, 15);
  assert.deepEqual(AUTH_PASSWORD_CODES.slice(-3), ["PASSWORD_CHANGE_FAILED", "OLD_PASSWORD_ACCEPTED", "NEW_PASSWORD_LOGIN_FAILED"]);
  assert.equal(AUTH_LOCAL_STAGES.length, 12); assert.equal(AUTH_LOCAL_FAILURE_POINTS.length, 31);
});
for (const point of AUTH_PASSWORD_FAILURE_POINTS) test(`password case preserves the first closed ${point}`, () => {
  assert.equal(retainPasswordFailurePoint(null, point), point);
  assert.equal(retainPasswordFailurePoint(point, "FIXTURE_CLEANUP"), point);
});
test("password points cannot enter minimum v1 or carry raw diagnostics", () => {
  for (const point of passwordPoints) refused(() => retainFailurePoint(null, point), "ACCEPTANCE_FAILED");
  for (const point of invalidPoints) refused(() => retainPasswordFailurePoint(null, point), "ACCEPTANCE_FAILED");
});
for (const point of ["LOGIN_RESPONSE_WAIT", "LOGIN_URL_WAIT", "LOGIN_SUBMIT_CLICK"]) test(`concurrent login observer captures its own closed ${point} once`, async () => {
  let calls = 0, first = null;
  await assert.rejects(observePasswordOperation(point, async () => { calls++; throw new Error("synthetic-private-operation"); }, value => { first = retainPasswordFailurePoint(first, value); }), { message: "LOGIN_FAILED" });
  assert.equal(first, point); assert.equal(calls, 1);
});
test("concurrent login observers retain the first branch failure before Promise.all and after a late rejection", async () => {
  let responseReject, navigationReject, first = null;
  const calls = [0, 0, 0];
  const record = point => { first = retainPasswordFailurePoint(first, point); };
  const response = observePasswordOperation("LOGIN_RESPONSE_WAIT", () => { calls[0]++; return new Promise((_, reject) => { responseReject = reject; }); }, record);
  const navigation = observePasswordOperation("LOGIN_URL_WAIT", () => { calls[1]++; return new Promise((_, reject) => { navigationReject = reject; }); }, record);
  const click = observePasswordOperation("LOGIN_SUBMIT_CLICK", async () => { calls[2]++; }, record);
  const completion = Promise.all([response, navigation, click]);
  navigationReject(new Error("synthetic-private-navigation"));
  await assert.rejects(completion, { message: "LOGIN_FAILED" });
  assert.equal(first, "LOGIN_URL_WAIT");
  responseReject(new Error("synthetic-private-late-response"));
  await Promise.allSettled([response, navigation, click]);
  assert.equal(first, "LOGIN_URL_WAIT"); assert.deepEqual(calls, [1, 1, 1]);
  assert.equal(retainPasswordFailurePoint(first, "FIXTURE_CLEANUP"), "LOGIN_URL_WAIT");
});
test("login observer preserves success values without recording any failure or retry", async () => {
  let calls = 0, recorded = false;
  const value = { status: "synthetic-success" };
  const result = await observePasswordOperation("LOGIN_RESPONSE_WAIT", async () => { calls++; return value; }, () => { recorded = true; });
  assert.equal(result, value); assert.equal(calls, 1); assert.equal(recorded, false);
});
test("login observer closes synchronous operation errors and callback errors without diagnostics", async () => {
  let first = null;
  await assert.rejects(observePasswordOperation("LOGIN_SUBMIT_CLICK", () => { throw new Error("synthetic-private-sync"); }, point => { first = retainPasswordFailurePoint(first, point); }), { message: "LOGIN_FAILED" });
  assert.equal(first, "LOGIN_SUBMIT_CLICK");
  await assert.rejects(observePasswordOperation("LOGIN_RESPONSE_WAIT", async () => { throw new Error("synthetic-private-input"); }, () => { throw new Error("synthetic-private-callback"); }), { message: "ACCEPTANCE_FAILED" });
});
test("login observer rejects unknown points or callbacks before starting the operation", async () => {
  let calls = 0;
  const operation = async () => { calls++; };
  await assert.rejects(observePasswordOperation("synthetic-private-point", operation, () => {}), { message: "ACCEPTANCE_FAILED" });
  await assert.rejects(observePasswordOperation("LOGIN_SUBMIT_CLICK", operation, null), { message: "ACCEPTANCE_FAILED" });
  assert.equal(calls, 0);
});
const successfulPassword = () => ({
  stages: passwordStages.map(name => ({ name, passed: true })),
  checks: Object.fromEntries(passwordChecks.map(name => [name, true])), counts: { ...passwordCountLimits },
  cleanupConfirmed: true, failurePoint: null, cleanupFailurePoint: null,
});
test("only the complete password observations and attempt budget can certify success", () => {
  assert.equal(passwordAcceptanceComplete(successfulPassword()), true);
});
for (const name of passwordChecks) test(`password success refuses missing evidence ${name}`, () => {
  const report = successfulPassword(); report.checks[name] = false;
  assert.equal(passwordAcceptanceComplete(report), false);
});
for (const name of passwordStages) test(`password success refuses failed stage ${name}`, () => {
  const report = successfulPassword(); report.stages.find(stage => stage.name === name).passed = false;
  assert.equal(passwordAcceptanceComplete(report), false);
});
for (const name of Object.keys(passwordCountLimits)) test(`password attempt/cleanup budget is exact for ${name}`, () => {
  for (const count of [0, passwordCountLimits[name] + 1, -1, 0.5, NaN, "1"]) {
    const report = successfulPassword(); report.counts[name] = count;
    assert.equal(passwordAcceptanceComplete(report), false);
  }
});
test("namespace disposal, reordered stages or extra report material never substitute for password success", () => {
  const reports = [successfulPassword(), successfulPassword(), successfulPassword(), successfulPassword(), successfulPassword(), successfulPassword()];
  reports[0].cleanupConfirmed = false;
  reports[1].failurePoint = "PASSWORD_TERMINAL_NOTICE";
  reports[2].cleanupFailurePoint = "SESSION_REVOCATION";
  reports[3].stages.reverse(); reports[4].checks.extra = true; reports[5].counts.extra = 0;
  for (const report of reports) assert.equal(passwordAcceptanceComplete(report), false);
});

// These controls compile only owned stage bodies with fake pages/SDK calls.
// They never import a spec, read child env, launch a browser or contact Auth.
const passwordSpecSource = await readFile(new URL("./auth-password-local.spec.ts", import.meta.url), "utf8");
const passwordSyntax = ts.createSourceFile("owned-password-spec.ts", passwordSpecSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function passwordFunction(name) {
  const matches = [];
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node); ts.forEachChild(node, visit); };
  visit(passwordSyntax); assert.equal(matches.length, 1); return matches[0].getText(passwordSyntax);
}
const observationFailureSource = passwordFunction("observationFailed");
async function fixtureLedger(progress = 0) {
  const ledger = createAuthEffectLedger();
  if (progress === 0) return ledger;
  // Establish only the isolated stage's synthetic prerequisites with the real
  // protocol. These doubles are never evidence of an Auth/session outcome.
  async function receipt(operation) {
    const page = new EventEmitter(), path = operation === "password-change" ? "/trocar-senha" : "/entrar";
    page.url = () => `http://127.0.0.1:3117${path}`;
    const request = { method: () => "POST", url: page.url, failure: () => null };
    const observer = await prepareAuthEffectObservation({ page, operation, prerequisite: async () => true });
    page.emit("request", request); page.emit("requestfinished", request);
    return observer.observe(request, { request: () => request, url: page.url, status: () => 200 });
  }
  ledger.begin("password-change"); await ledger.confirmPasswordTerminal(await receipt("password-change"), async () => true);
  await ledger.checkpoint("old-a-denied", async () => true); await ledger.checkpoint("b-intact", async () => true);
  if (progress === 3) return ledger;
  ledger.begin("old-password"); await ledger.confirmOldPasswordRefusal(await receipt("old-password"), async () => true);
  if (progress === 4) return ledger;
  ledger.begin("login"); await ledger.confirmLogin(await receipt("login"), {
    destination: async () => true, newSessionIdentityAndAccess: async () => true, protectedSameSession: async () => true,
  });
  return ledger;
}
function passwordStageBody(name) {
  const matches = [];
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "stage" &&
        ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === name) matches.push(node.arguments[2]);
    ts.forEachChild(node, visit);
  };
  visit(passwordSyntax); assert.equal(matches.length, 1);
  assert.equal(ts.isArrowFunction(matches[0]) && ts.isBlock(matches[0].body), true);
  return matches[0].body.getText(passwordSyntax).slice(1, -1);
}
async function compilePasswordStage(name) {
  const body = passwordStageBody(name);
  assert.equal(/\b(?:fetch|process|console|import)\b/.test(body), false);
  const ownedModule = ts.transpileModule(`export async function probe(inputs) {
    const { a1, a, oldA1, newPassword, environment, hasLocalDocumentHeaders, prepareAuthEffectObservation, retainPasswordFailurePoint, classifyPostRequestFailure, fixtureLedger } = inputs;
    const effectLedger = await fixtureLedger(${name === "old-password-denied" ? 3 : 0});
    const verifySession = async actor => actor.session;
    const checks = { passwordTerminalNotice: false, checkpointCookiesCleared: false, authCookiesCleared: false, oldPasswordDeniedWithoutSession: false };
    const report = { failurePoint: null, counts: { appLoginPostsA: 0, passwordChangePosts: 0, credentialAttemptsA: 0 } };
    let uncertain = false, activeFailurePoint;
    const refuse = () => { throw new Error("ACCEPTANCE_FAILED"); };
    ${observationFailureSource}
    try { ${body} return { passed: true, uncertain, passwordPending: effectLedger.metadata().pendingPasswordEffect, checks, counts: report.counts, point: null }; }
    catch { return { passed: false, uncertain, passwordPending: effectLedger.metadata().pendingPasswordEffect, checks, counts: report.counts, point: report.failurePoint ?? activeFailurePoint }; }
  }`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(ownedModule).toString("base64")}`)).probe;
}
const inspectPasswordTerminal = await compilePasswordStage("password-change-terminal");
const inspectOldPassword = await compilePasswordStage("old-password-denied");
function fakePasswordPage(options = {}, old = false) {
  const app = "http://127.0.0.1:3117", path = old ? "/entrar?returnTo=%2Foffline" : "/trocar-senha";
  const terminal = `${app}/entrar?notice=password-updated`;
  let currentUrl = `${app}${path}`, posts = 0, terminalEvents = 0, inputFills = 0;
  const events = new EventEmitter();
  const req = { method: () => "POST", url: () => `${app}${path}`, failure: () => options.postFailure ?? (options.postRequestFailed ? { errorText: "synthetic-private" } : null) };
  const posted = { request: () => req, url: () => `${app}${path}`, status: () => options.postStatus ?? 200,
    allHeaders: async () => options.actionHeaders ?? { "x-action-redirect": old && options.login ? "/offline;push" : "/entrar?notice=password-updated;push" },
    finished: async () => { throw new Error("FINISHED_FALLBACK_FORBIDDEN"); } };
  const field = { isEnabled: async () => options.enabled !== false, fill: async () => { inputFills++; } };
  const form = { count: async () => options.formCount ?? 1, getByLabel: () => field,
    getByRole: () => ({ click: async () => {
      posts++; if (options.clickThrows) throw new Error("synthetic-private");
      events.emit("request", req);
      if (!options.missingTerminal) { terminalEvents++; events.emit(options.postRequestFailed ? "requestfailed" : "requestfinished", req); }
    } }) };
  const notice = { count: async () => options.noticeCount ?? 1, isVisible: async () => options.visible !== false,
    waitFor: async () => { if (options.visible === false) throw new Error("synthetic-private"); },
    textContent: async () => options.notice ?? (old ? "Não foi possível entrar. Confira os dados e tente novamente." : "Senha atualizada. Entre novamente com sua nova senha.") };
  const page = {
    on: events.on.bind(events), off: events.off.bind(events),
    url: () => posts > 0 ? (options.url ?? currentUrl) : currentUrl,
    goto: async url => { currentUrl = url; return { status: () => 200, headers: () => documentHeaders("no-store, must-revalidate") }; },
    locator: selector => selector === "form.auth-form" ? form : notice,
    getByRole: () => ({ isVisible: async () => options.headingVisible !== false }),
    waitForResponse: async predicate => { assert.equal(predicate(posted), true); if (options.lostResponse) throw new Error("synthetic-private"); return posted; },
    waitForURL: async url => { assert.equal(url, options.login ? `${app}/offline` : terminal); currentUrl = url; if (options.lostNavigation) throw new Error("synthetic-private"); },
  };
  return { inputs: { environment: { appUrl: app }, hasLocalDocumentHeaders, retainPasswordFailurePoint, classifyPostRequestFailure,
    prepareAuthEffectObservation: supplied => prepareAuthEffectObservation({ ...supplied, timeoutMs: 10 }), fixtureLedger,
    a: { email: "synthetic-password@example.invalid", password: "Synthetic-Old1!" },
    oldA1: { accessToken: "synthetic-old-only", sessionId: "synthetic-old-sid" },
    newPassword: "Synthetic-New2!", a1: { page, context: { cookies: async () => posts > 0 ? options.cookies ?? [] : options.initialCookies ?? [] }, session: old ? undefined : { accessToken: "synthetic-old-only", sessionId: "synthetic-old-sid" } } },
    observations: () => ({ posts, terminalEvents, inputFills }) };
}
test("owned password stage requires POST completion, exact terminal and both cookie clearances", async () => {
  const fixture = fakePasswordPage(); const result = await inspectPasswordTerminal(fixture.inputs);
  assert.equal(result.passed, true); assert.equal(result.uncertain, false);
  assert.equal(result.checks.passwordTerminalNotice && result.checks.checkpointCookiesCleared && result.checks.authCookiesCleared, true);
  assert.deepEqual(result.counts, { appLoginPostsA: 0, passwordChangePosts: 1, credentialAttemptsA: 1 });
  assert.deepEqual(fixture.observations(), { posts: 1, terminalEvents: 1, inputFills: 3 });
});
test("owned positive password abort candidate certifies only the terminal transition and keeps PW pending", async () => {
  const fixture = fakePasswordPage({ postRequestFailed: true, postFailure: { errorText: "net::ERR_ABORTED" } });
  const result = await inspectPasswordTerminal(fixture.inputs);
  assert.equal(result.passed, true); assert.equal(result.uncertain, false); assert.equal(result.passwordPending, true);
  assert.equal(result.checks.passwordTerminalNotice && result.checks.checkpointCookiesCleared && result.checks.authCookiesCleared, true);
  assert.equal(result.counts.passwordChangePosts, 1); assert.equal(fixture.observations().posts, 1);
});
const passwordTerminalFailures = [
  [{ postStatus: 500 }, "PASSWORD_SUBMIT_NAVIGATION"], [{ lostResponse: true }, "PASSWORD_SUBMIT_NAVIGATION"],
  [{ lostNavigation: true }, "PASSWORD_SUBMIT_NAVIGATION"], [{ postRequestFailed: true }, "POST_REQUEST_FAILED"],
  [{ missingTerminal: true }, "POST_COMPLETION_TIMEOUT"],
  [{ url: "http://127.0.0.1:3117/entrar?notice=password-recheck" }, "PASSWORD_TERMINAL_NOTICE"],
  [{ notice: "Senha atualizada e saída local concluída." }, "PASSWORD_TERMINAL_NOTICE"],
  [{ noticeCount: 2 }, "PASSWORD_TERMINAL_NOTICE"], [{ visible: false }, "PASSWORD_TERMINAL_NOTICE"],
  [{ cookies: [{ name: "sc-flow-password" }] }, "PASSWORD_CHECKPOINT_CLEARANCE"],
  [{ cookies: [{ name: "sc-auth.0" }] }, "PASSWORD_AUTH_COOKIE_CLEARANCE"],
];
passwordTerminalFailures.forEach(([options, point], index) => test(`owned password stage preserves unknown outcome boundary ${index + 1}`, async () => {
  const fixture = fakePasswordPage(options); const result = await inspectPasswordTerminal(fixture.inputs);
  assert.equal(result.passed, false); assert.equal(result.uncertain, true); assert.equal(result.point, point);
  assert.equal(result.counts.passwordChangePosts, 1); assert.equal(result.counts.credentialAttemptsA, 1);
}));
test("a disabled or incomplete password form never spends a POST attempt", async () => {
  for (const options of [{ enabled: false }, { formCount: 0 }]) {
    const fixture = fakePasswordPage(options); const result = await inspectPasswordTerminal(fixture.inputs);
    assert.equal(result.passed, false); assert.equal(result.point, "PASSWORD_FORM"); assert.equal(result.uncertain, false);
    assert.equal(result.counts.passwordChangePosts, 0); assert.equal(fixture.observations().posts, 0);
  }
});
test("owned old-password stage proves only completed GUI generic refusal without a session", async () => {
  const fixture = fakePasswordPage({}, true); const result = await inspectOldPassword(fixture.inputs);
  assert.equal(result.passed, true); assert.equal(result.uncertain, false); assert.equal(result.checks.oldPasswordDeniedWithoutSession, true);
  assert.deepEqual(result.counts, { appLoginPostsA: 1, passwordChangePosts: 0, credentialAttemptsA: 1 });
  assert.deepEqual(fixture.observations(), { posts: 1, terminalEvents: 1, inputFills: 2 });
});
const oldPasswordFailures = [
  [{ postStatus: 303 }, "OLD_PASSWORD_SUBMIT_COMPLETION"], [{ lostResponse: true }, "OLD_PASSWORD_SUBMIT_COMPLETION"],
  [{ postRequestFailed: true }, "POST_REQUEST_FAILED"], [{ missingTerminal: true }, "POST_COMPLETION_TIMEOUT"],
  [{ notice: "invalid_credentials" }, "OLD_PASSWORD_GENERIC_REFUSAL"], [{ visible: false }, "OLD_PASSWORD_GENERIC_REFUSAL"],
  [{ noticeCount: 2 }, "OLD_PASSWORD_GENERIC_REFUSAL"], [{ url: "http://127.0.0.1:3117/offline" }, "OLD_PASSWORD_GENERIC_REFUSAL"],
  [{ cookies: [{ name: "sc-auth" }] }, "OLD_PASSWORD_COOKIE_CLEARANCE"],
];
oldPasswordFailures.forEach(([options, point], index) => test(`owned old-password stage refuses uncertain or non-generic outcome ${index + 1}`, async () => {
  const result = await inspectOldPassword(fakePasswordPage(options, true).inputs);
  assert.equal(result.passed, false); assert.equal(result.uncertain, true); assert.equal(result.point, point);
  assert.equal(result.checks.oldPasswordDeniedWithoutSession, false);
}));

const ownedLoginSource = passwordFunction("login");
const ownedLoginModule = ts.transpileModule(`export async function probe(inputs) {
  const { a1, a, environment, hasLocalDocumentHeaders, options, observePasswordOperation, retainPasswordFailurePoint, classifyPostRequestFailure, prepareAuthEffectObservation, fixtureLedger } = inputs;
  const effectLedger = await fixtureLedger(); const actors = [a1];
  let uncertain = false, activeFailurePoint, verified = 0;
  const report = { failurePoint: null, counts: { appLoginPostsA: 0, appLoginPostsB: 0, credentialAttemptsA: 0 } };
  const refuse = () => { throw new Error("LOGIN_FAILED"); };
  const verifySession = async actor => { if (options.verifyFailure) throw new Error("synthetic-private"); verified++; return actor.session = { sessionId: "synthetic-new-a", accessToken: "synthetic-new-token" }; };
  const protectedPage = async actor => { activeFailurePoint = "PROTECTED_PAGE"; if (options.protectedFailure) throw new Error("synthetic-private"); return options.sameSessionFailure ? { sessionId: "synthetic-other", accessToken: "synthetic-other-token" } : actor.session; };
  ${observationFailureSource}
  ${ownedLoginSource}
  try { await login(a1); return { passed: true, uncertain, counts: report.counts, verified, point: null }; }
  catch { return { passed: false, uncertain, counts: report.counts, verified, point: report.failurePoint ?? activeFailurePoint }; }
}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { probe: inspectPasswordLogin } = await import(`data:text/javascript;base64,${Buffer.from(ownedLoginModule).toString("base64")}`);
function fakePasswordLogin(options = {}, ownerIsB = false) {
  const fake = fakePasswordPage({ ...options, login: true }, true);
  fake.inputs.options = options;
  fake.inputs.observePasswordOperation = observePasswordOperation;
  fake.inputs.retainPasswordFailurePoint = retainPasswordFailurePoint;
  fake.inputs.a1.fixture = ownerIsB ? { ...fake.inputs.a } : fake.inputs.a;
  return fake;
}
test("owned password-case login records A attempt only after form readiness and requires completed POST plus session verification", async () => {
  const fixture = fakePasswordLogin(); const result = await inspectPasswordLogin(fixture.inputs);
  assert.deepEqual(result, { passed: true, uncertain: false, counts: { appLoginPostsA: 1, appLoginPostsB: 0, credentialAttemptsA: 1 }, verified: 1, point: null });
  assert.deepEqual(fixture.observations(), { posts: 1, terminalEvents: 1, inputFills: 2 });
});
test("owned password-case B login has its independent one-attempt budget", async () => {
  const result = await inspectPasswordLogin(fakePasswordLogin({}, true).inputs);
  assert.equal(result.passed, true); assert.deepEqual(result.counts, { appLoginPostsA: 0, appLoginPostsB: 1, credentialAttemptsA: 0 });
});
test("owned positive login abort candidate requires identity/access and a guard for its same new session", async () => {
  const aborted = { postRequestFailed: true, postFailure: { errorText: "net::ERR_ABORTED" } };
  const positive = await inspectPasswordLogin(fakePasswordLogin(aborted).inputs);
  assert.equal(positive.passed, true); assert.equal(positive.uncertain, false); assert.equal(positive.verified, 1);
  assert.equal(positive.counts.appLoginPostsA, 1);
  for (const [delta, point] of [[{ verifyFailure: true }, "LOGIN_DESTINATION"], [{ protectedFailure: true }, "PROTECTED_PAGE"], [{ sameSessionFailure: true }, "DISTINCT_SESSIONS"]]) {
    const fixture = fakePasswordLogin({ ...aborted, ...delta }), refused = await inspectPasswordLogin(fixture.inputs);
    assert.equal(refused.passed, false); assert.equal(refused.uncertain, true); assert.equal(refused.point, point);
    assert.equal(refused.counts.appLoginPostsA, 1); assert.equal(fixture.observations().posts, 1);
  }
});
test("owned login cannot arm an effect observation from a context with existing Auth cookies", async () => {
  const fixture = fakePasswordLogin({ initialCookies: [{ name: "sc-auth.0" }] }), result = await inspectPasswordLogin(fixture.inputs);
  assert.equal(result.passed, false); assert.equal(result.uncertain, false); assert.equal(result.point, "LOGIN_SUBMIT_NAVIGATION");
  assert.equal(result.counts.appLoginPostsA, 0); assert.equal(fixture.observations().posts, 0);
});
const passwordLoginFailures = [
  [{ lostResponse: true }, "LOGIN_RESPONSE_WAIT"], [{ lostNavigation: true }, "LOGIN_URL_WAIT"],
  [{ clickThrows: true }, "LOGIN_SUBMIT_CLICK"],
  [{ postRequestFailed: true }, "POST_REQUEST_FAILED"], [{ missingTerminal: true }, "POST_COMPLETION_TIMEOUT"],
  [{ postStatus: 500 }, "LOGIN_POST_STATUS"],
  [{ headingVisible: false }, "LOGIN_DESTINATION"], [{ verifyFailure: true }, "LOGIN_DESTINATION"],
];
passwordLoginFailures.forEach(([options, point], index) => test(`owned password-case login never clears unknown outcome ${index + 1}`, async () => {
  const fixture = fakePasswordLogin(options); const result = await inspectPasswordLogin(fixture.inputs);
  assert.equal(result.passed, false); assert.equal(result.uncertain, true); assert.equal(result.point, point);
  assert.equal(result.counts.appLoginPostsA, 1); assert.equal(result.verified, 0); assert.equal(fixture.observations().posts, 1);
}));
test("terminal observation preserves the original status range and rejects status failure before disposing", async () => {
  for (const status of [100, 199, 200, 201, 302, 303, 399, 400, 500]) {
    const fixture = fakePasswordLogin({ postStatus: status }); const result = await inspectPasswordLogin(fixture.inputs);
    const previouslyAccepted = status >= 200 && status < 400;
    assert.equal(result.passed, previouslyAccepted);
    assert.equal(result.point, previouslyAccepted ? null : "LOGIN_POST_STATUS");
    assert.equal(result.uncertain, !previouslyAccepted);
    assert.equal(fixture.observations().terminalEvents, 1);
  }
});
test("owned password-case disabled login never spends its attempt or creates uncertainty", async () => {
  const fixture = fakePasswordLogin({ enabled: false }); const result = await inspectPasswordLogin(fixture.inputs);
  assert.equal(result.passed, false); assert.equal(result.uncertain, false); assert.equal(result.counts.appLoginPostsA, 0);
  assert.equal(fixture.observations().posts, 0);
});

const newLoginBody = passwordStageBody("new-password-login");
const newLoginModule = ts.transpileModule(`export async function probe(candidate, fixtureLedger) {
  const effectLedger = await fixtureLedger(5);
  const a1 = {}, oldA1 = { sessionId: "synthetic-old-a1" }, oldA = { sessionId: "synthetic-old-a2" }, originalB = { sessionId: "synthetic-original-b" };
  const checks = { newPasswordLogin: false, newSessionDistinct: false };
  const newPassword = "synthetic-new-only";
  let newASession, activeFailurePoint;
  const login = async actor => { actor.session = candidate; };
  const refuse = () => { throw new Error("NEW_PASSWORD_LOGIN_FAILED"); };
  try { ${newLoginBody} return { passed: true, hasCleanupSession: !!newASession, checks, point: null }; }
  catch { return { passed: false, hasCleanupSession: !!newASession, checks, point: activeFailurePoint }; }
}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { probe: inspectNewPasswordSession } = await import(`data:text/javascript;base64,${Buffer.from(newLoginModule).toString("base64")}`);
test("only a verified distinct new A session can become the password cleanup session", async () => {
  assert.deepEqual(await inspectNewPasswordSession({ sessionId: "synthetic-new-a" }, fixtureLedger), { passed: true, hasCleanupSession: true, checks: { newPasswordLogin: true, newSessionDistinct: true }, point: null });
  for (const candidate of [undefined, { sessionId: "synthetic-old-a1" }, { sessionId: "synthetic-old-a2" }, { sessionId: "synthetic-original-b" }]) {
    assert.deepEqual(await inspectNewPasswordSession(candidate, fixtureLedger), { passed: false, hasCleanupSession: false, checks: { newPasswordLogin: false, newSessionDistinct: false }, point: "DISTINCT_SESSIONS" });
  }
});

const cleanupStart = "          const current = await admin.auth.admin.getUserById(owner.id);";
const cleanupEnd = "          report.counts.fixtureDeleted++;";
assert.equal(passwordSpecSource.split(cleanupStart).length, 2); assert.equal(passwordSpecSource.split(cleanupEnd).length, 2);
const passwordCleanupBody = passwordSpecSource.slice(passwordSpecSource.indexOf(cleanupStart), passwordSpecSource.indexOf(cleanupEnd) + cleanupEnd.length);
const fixtureMatcher = passwordSpecSource.slice(passwordSpecSource.indexOf("function matchesFixture"), passwordSpecSource.indexOf("function readerFor"));
const cleanupModule = ts.transpileModule(`export async function probe(inputs) {
  const { admin, owner, a, b, actors, newASession, acceptsDeleteAcknowledgement } = inputs;
  const checks = { cleanupRevokedNewA: false, cleanupRevokedB: false }, report = { counts: { fixtureDeleted: 0 } };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let cleanupPoint = "FIXTURE_PRECHECK";
  const refuse = () => { throw new Error("CLEANUP_UNCONFIRMED"); };
  ${fixtureMatcher}
  try { ${passwordCleanupBody} return { passed: true, point: null, checks, deleted: report.counts.fixtureDeleted }; }
  catch { return { passed: false, point: cleanupPoint, checks, deleted: report.counts.fixtureDeleted }; }
}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { probe: inspectPasswordCleanup } = await import(`data:text/javascript;base64,${Buffer.from(cleanupModule).toString("base64")}`);
function fakePasswordCleanup(options = {}, ownerIsB = false) {
  const a = { ...deletionFixture }, b = { ...deletionFixture, id: sid, email: "synthetic-other@example.invalid", marker: "synthetic-other-marker" };
  const owner = ownerIsB ? b : a;
  const completeUser = { ...deletedOwner, id: owner.id, email: owner.email, app_metadata: { sc_auth_local_ci_marker: owner.marker } };
  const calls = [];
  const admin = { auth: {
    getUser: async token => { calls.push("verify"); assert.equal(token, ownerIsB ? "synthetic-b" : "synthetic-new-a"); return { data: { user: options.foreignUser ? { ...completeUser, id: "foreign" } : completeUser }, error: null }; },
    admin: {
      getUserById: async id => { assert.equal(id, owner.id); calls.push("get"); return calls.filter(call => call === "get").length === 1 ?
        { data: { user: completeUser }, error: null } : options.absenceFailure ? { data: { user: completeUser }, error: null } : { data: { user: null }, error: { status: 404, code: "user_not_found" } }; },
      signOut: async (token, scope) => { calls.push("revoke"); assert.equal(token, ownerIsB ? "synthetic-b" : "synthetic-new-a"); assert.equal(scope, "global"); return { error: options.revokeFailure ? {} : null }; },
      deleteUser: async (id, soft) => { calls.push("delete"); assert.equal(id, owner.id); assert.equal(soft, false); return options.ackFailure ? { data: { user: null }, error: null } : { data: { user: {} }, error: null }; },
    },
  } };
  return { inputs: { admin, owner, a, b, actors: [{ fixture: a, session: { accessToken: "synthetic-old-a" } }, { fixture: b, session: { accessToken: "synthetic-b" } }],
    newASession: options.missingNew ? undefined : { accessToken: "synthetic-new-a" }, acceptsDeleteAcknowledgement }, calls };
}
test("owned password cleanup always globally revokes NEW A before ACK and exact absence", async () => {
  const fixture = fakePasswordCleanup(); const result = await inspectPasswordCleanup(fixture.inputs);
  assert.deepEqual(result, { passed: true, point: null, checks: { cleanupRevokedNewA: true, cleanupRevokedB: false }, deleted: 1 });
  assert.deepEqual(fixture.calls, ["get", "verify", "revoke", "delete", "get"]);
});
test("owned password cleanup globally revokes B's original verified session independently", async () => {
  const fixture = fakePasswordCleanup({}, true); const result = await inspectPasswordCleanup(fixture.inputs);
  assert.equal(result.passed, true); assert.equal(result.checks.cleanupRevokedB, true); assert.equal(result.checks.cleanupRevokedNewA, false);
  assert.deepEqual(fixture.calls, ["get", "verify", "revoke", "delete", "get"]);
});
test("old A sessions never substitute for the missing NEW session or certify cleanup", async () => {
  const fixture = fakePasswordCleanup({ missingNew: true }); const result = await inspectPasswordCleanup(fixture.inputs);
  assert.deepEqual(result, { passed: false, point: "SESSION_REVOCATION", checks: { cleanupRevokedNewA: false, cleanupRevokedB: false }, deleted: 0 });
  assert.deepEqual(fixture.calls, ["get"]);
});
const passwordCleanupFailures = [
  [{ foreignUser: true }, "SESSION_REVOCATION", ["get", "verify"]],
  [{ revokeFailure: true }, "SESSION_REVOCATION", ["get", "verify", "revoke"]],
  [{ ackFailure: true }, "FIXTURE_DELETE_ACK", ["get", "verify", "revoke", "delete"]],
  [{ absenceFailure: true }, "FIXTURE_ABSENCE", ["get", "verify", "revoke", "delete", "get"]],
];
passwordCleanupFailures.forEach(([options, point, calls], index) => test(`owned password cleanup cannot certify unverified outcome ${index + 1}`, async () => {
  const fixture = fakePasswordCleanup(options); const result = await inspectPasswordCleanup(fixture.inputs);
  assert.equal(result.passed, false); assert.equal(result.point, point); assert.equal(result.deleted, 0); assert.deepEqual(fixture.calls, calls);
}));


// The independently reviewed protocol controls use only EventEmitter doubles.
const APP = "http://127.0.0.1:3117";
function request({ url = `${APP}/entrar?returnTo=%2Foffline`, method = "POST", failed = false } = {}) {
  let failure = failed;
  return { url: () => url, method: () => method, failure: () => failure ? { errorText: "synthetic-private-failure" } : null, setFailure: value => { failure = value; } };
}
function setup(operation = "login", timeoutMs = 1_000) {
  const page = new EventEmitter();
  page.url = () => `${APP}${operation === "password-change" ? "/trocar-senha" : "/entrar?returnTo=%2Foffline"}`;
  const failures = [];
  const observer = createPostCompletionObserver({ page, operation, firstFailure: point => { failures.push(point); }, timeoutMs });
  return { page, observer, failures };
}
function noListeners(page) { for (const event of ["request", "requestfinished", "requestfailed"]) assert.equal(page.listenerCount(event), 0); }
const failed = point => ({ passed: false, failurePoint: point });

test("prearmed canonical terminal requires exact POST identity and releases all listeners", async () => {
  const h = setup(), req = request();
  for (const event of ["request", "requestfinished", "requestfailed"]) assert.equal(h.page.listenerCount(event), 1);
  h.page.emit("request", req);
  const pending = h.observer.complete(req);
  h.page.emit("requestfinished", req);
  assert.deepEqual(await pending, { passed: true, failurePoint: null });
  assert.deepEqual(h.failures, []); noListeners(h.page); h.observer.dispose();
});
test("a finished event preceding response binding is preserved by identity, not by response object", async () => {
  const h = setup(), req = request(); h.page.emit("request", req); h.page.emit("requestfinished", req);
  // A Request terminal remains sufficient even if a protocol response field
  // were omitted. This does not assert such an omission happened in real CI.
  assert.deepEqual(await h.observer.complete(req), { passed: true, failurePoint: null }); noListeners(h.page);
});
test("binding after the network bound never discards a terminal already completed within it", async () => {
  const h = setup("login", 5), req = request(); h.page.emit("request", req); h.page.emit("requestfinished", req);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.deepEqual(await h.observer.complete(req), { passed: true, failurePoint: null }); noListeners(h.page);
});
test("all six proposed GUI POSTs use the same finite protocol without new login attempts", async () => {
  const operations = ["login", "login", "login", "password-change", "old-password", "login"];
  let submitted = 0;
  for (const operation of operations) {
    const h = setup(operation), req = request({ url: `${APP}${operation === "password-change" ? "/trocar-senha" : "/entrar"}` });
    h.page.emit("request", req); submitted++; h.page.emit("requestfinished", req);
    assert.deepEqual(await h.observer.complete(req), { passed: true, failurePoint: null }); noListeners(h.page);
  }
  assert.equal(submitted, 6);
});
test("failed request is never accepted even if navigation/response/session might have succeeded", async () => {
  const h = setup(), req = request(); h.page.emit("request", req); h.page.emit("requestfailed", req);
  assert.deepEqual(await h.observer.complete(req), failed("POST_REQUEST_FAILED"));
  assert.deepEqual(h.failures, ["POST_REQUEST_FAILED"]); noListeners(h.page);
});
test("nonnull failure at terminal or at later binding is never accepted", async () => {
  for (const later of [false, true]) {
    const h = setup(), req = request({ failed: !later }); h.page.emit("request", req); h.page.emit("requestfinished", req);
    if (later) req.setFailure(true);
    assert.deepEqual(await h.observer.complete(req), failed("POST_REQUEST_FAILED")); noListeners(h.page);
  }
});
test("response/header or failure-null alone never substitute for the terminal", async () => {
  const h = setup("login", 5), req = request(); h.page.emit("request", req);
  h.page.emit("response", { request: () => req, status: () => 200 });
  assert.equal(req.failure(), null);
  assert.deepEqual(await h.observer.complete(req), failed("POST_COMPLETION_TIMEOUT")); noListeners(h.page);
});
test("timeout stays closed after a late requestfinished and does not retry", async () => {
  const h = setup("login", 5), req = request(); h.page.emit("request", req);
  const result = await h.observer.complete(req); assert.deepEqual(result, failed("POST_COMPLETION_TIMEOUT"));
  h.page.emit("requestfinished", req); h.page.emit("requestfailed", req);
  assert.deepEqual(result, failed("POST_COMPLETION_TIMEOUT")); assert.deepEqual(h.failures, ["POST_COMPLETION_TIMEOUT"]); noListeners(h.page);
});
test("a missing or different request identity fails without waiting or accepting a sibling", async () => {
  const h = setup(), req = request(), sibling = request(); h.page.emit("request", req); h.page.emit("requestfinished", req);
  assert.deepEqual(await h.observer.complete(sibling), failed("LOGIN_POST_COMPLETION")); noListeners(h.page);
  const empty = setup(); assert.deepEqual(await empty.observer.complete(req), failed("LOGIN_POST_COMPLETION")); noListeners(empty.page);
});
test("a terminal without the prearmed matching request is refused", async () => {
  const h = setup(), req = request(); h.page.emit("requestfinished", req);
  assert.deepEqual(await h.observer.complete(req), failed("LOGIN_POST_COMPLETION")); noListeners(h.page);
});
test("duplicate request, same-object duplicate or duplicate terminal before binding all fail", async () => {
  for (const mode of ["sibling", "same-request", "same-terminal"]) {
    const h = setup(), req = request(); h.page.emit("request", req);
    if (mode === "sibling") h.page.emit("request", request());
    if (mode === "same-request") h.page.emit("request", req);
    if (mode === "same-terminal") { h.page.emit("requestfinished", req); h.page.emit("requestfinished", req); }
    assert.deepEqual(await h.observer.complete(req), failed("LOGIN_POST_COMPLETION")); noListeners(h.page);
  }
});
test("failed terminal after a finish before binding remains a failure", async () => {
  const h = setup(), req = request(); h.page.emit("request", req); h.page.emit("requestfinished", req); h.page.emit("requestfailed", req);
  assert.deepEqual(await h.observer.complete(req), failed("POST_REQUEST_FAILED")); noListeners(h.page);
});
test("unrelated GET, foreign-origin POST and other-path POST cannot certify completion", async () => {
  const h = setup(), req = request();
  for (const other of [request({ method: "GET" }), request({ url: "https://foreign.invalid/entrar" }), request({ url: `${APP}/api/settings` })]) {
    h.page.emit("request", other); h.page.emit("requestfinished", other);
  }
  assert.deepEqual(await h.observer.complete(req), failed("LOGIN_POST_COMPLETION")); noListeners(h.page);
});
test("factory pins reject foreign document, unsupported operation and excessive deadline", () => {
  const page = new EventEmitter(); page.url = () => "https://foreign.invalid/entrar";
  assert.throws(() => createPostCompletionObserver({ page, operation: "login", firstFailure: () => {} }), { message: "ACCEPTANCE_FAILED" });
  page.url = () => `${APP}/entrar`;
  for (const options of [{ operation: "arbitrary" }, { timeoutMs: 0 }, { timeoutMs: 15_001 }, { firstFailure: null }]) {
    assert.throws(() => createPostCompletionObserver({ page, operation: "login", firstFailure: () => {}, ...options }), { message: "ACCEPTANCE_FAILED" });
  }
  noListeners(page);
});
test("disposed unresolved observation remains refused and detached", async () => {
  const h = setup(), req = request(); h.page.emit("request", req); h.observer.dispose();
  assert.deepEqual(await h.observer.complete(req), failed("LOGIN_POST_COMPLETION")); noListeners(h.page);
});
async function boundedResult(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve("UNSETTLED"), 100); })]); }
  finally { clearTimeout(timer); }
}
test("dispose during complete's pending wait resolves failure before clearing the last timer/listeners", async () => {
  const h = setup(), req = request(); h.page.emit("request", req);
  const pending = h.observer.complete(req); h.observer.dispose();
  assert.deepEqual(await boundedResult(pending), failed("LOGIN_POST_COMPLETION"));
  assert.deepEqual(h.failures, ["LOGIN_POST_COMPLETION"]); noListeners(h.page);
});
test("dispose after network finish but before complete resumes never certifies the disposed observation", async () => {
  const h = setup(), req = request(); h.page.emit("request", req);
  const pending = h.observer.complete(req); h.page.emit("requestfinished", req); h.observer.dispose();
  assert.deepEqual(await boundedResult(pending), failed("LOGIN_POST_COMPLETION"));
  assert.deepEqual(h.failures, ["LOGIN_POST_COMPLETION"]); noListeners(h.page);
});
test("raw request/callback errors never escape event handlers or the closed result", async () => {
  const h = setup(), req = request(); req.url = () => { throw new Error("synthetic-private-url"); };
  assert.doesNotThrow(() => h.page.emit("request", req));
  assert.deepEqual(await h.observer.complete(req), failed("LOGIN_POST_COMPLETION")); noListeners(h.page);
  const page = new EventEmitter(); page.url = () => `${APP}/entrar`;
  const probe = createPostCompletionObserver({ page, operation: "login", firstFailure: () => { throw new Error("synthetic-private-callback"); } });
  const failedRequest = request(); page.emit("request", failedRequest); assert.doesNotThrow(() => page.emit("requestfailed", failedRequest));
  assert.deepEqual(await probe.complete(failedRequest), failed("POST_REQUEST_FAILED")); noListeners(page);
});
test("observer listener cleanup failure cannot certify success or expose its error", async () => {
  const h = setup(), req = request(); h.page.emit("request", req); h.page.emit("requestfinished", req);
  const original = h.page.off.bind(h.page); h.page.off = (event, handler) => { original(event, handler); throw new Error("synthetic-private-off"); };
  assert.deepEqual(await h.observer.complete(req), failed("LOGIN_POST_COMPLETION")); noListeners(h.page);
});
test("result is immutable and second complete is not a retry or another success", async () => {
  const h = setup(), req = request(); h.page.emit("request", req); h.page.emit("requestfinished", req);
  const result = await h.observer.complete(req); assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(await h.observer.complete(req), failed("LOGIN_POST_COMPLETION"));
  assert.deepEqual(result, { passed: true, failurePoint: null }); noListeners(h.page);
});

test("abort diagnostic recognizes only the exact public one-data-property shape without reading getters", () => {
  assert.equal(classifyPostRequestFailure({ errorText: "net::ERR_ABORTED" }), "POST_REQUEST_ABORTED");
  let accessorRead = false;
  const accessor = {}; Object.defineProperty(accessor, "errorText", { enumerable: true, get: () => { accessorRead = true; throw new Error("synthetic-private"); } });
  const unknown = [null, undefined, {}, [], "net::ERR_ABORTED", { errorText: "net::ERR_ABORTED " },
    { errorText: "prefix net::ERR_ABORTED" }, { errorText: "NET::ERR_ABORTED" }, { errorText: "net::ERR_FAILED" },
    { errorText: 1 }, { errorText: "net::ERR_ABORTED", extra: true }, Object.create({ errorText: "net::ERR_ABORTED" }),
    Object.assign(Object.create(null), { errorText: "net::ERR_ABORTED" }), accessor,
    { errorText: "net::ERR_ABORTED", [Symbol("extra")]: true },
    new Proxy({}, { getPrototypeOf: () => { throw new Error("synthetic-private"); } })];
  for (const value of unknown) assert.equal(classifyPostRequestFailure(value), "POST_REQUEST_FAILED");
  assert.equal(accessorRead, false);
});

test("failed event, nonnull finished failure and nonnull binding classify abort while remaining refused", async () => {
  for (const mode of ["failed", "finished", "binding"]) {
    const h = setup(), req = request(); let value = mode === "binding" ? null : { errorText: "net::ERR_ABORTED" };
    req.failure = () => value;
    h.page.emit("request", req); h.page.emit(mode === "failed" ? "requestfailed" : "requestfinished", req);
    value = { errorText: "net::ERR_ABORTED" };
    assert.deepEqual(await h.observer.complete(req), failed("POST_REQUEST_ABORTED"));
    assert.deepEqual(h.failures, ["POST_REQUEST_ABORTED"]); noListeners(h.page);
  }
});

test("each failure observation captures failure once and closes thrown or unreadable values generically", async () => {
  const h = setup(), req = request(); let reads = 0;
  req.failure = () => { reads++; return reads === 1 ? { errorText: "net::ERR_ABORTED" } : null; };
  h.page.emit("request", req); h.page.emit("requestfinished", req);
  assert.deepEqual(await h.observer.complete(req), failed("POST_REQUEST_ABORTED")); assert.equal(reads, 1); noListeners(h.page);
  const later = setup(), bound = request(); let laterReads = 0;
  bound.failure = () => { laterReads++; return laterReads === 1 ? null : { errorText: "net::ERR_ABORTED" }; };
  later.page.emit("request", bound); later.page.emit("requestfinished", bound);
  assert.deepEqual(await later.observer.complete(bound), failed("POST_REQUEST_ABORTED")); assert.equal(laterReads, 2); noListeners(later.page);
  for (const event of ["requestfailed", "requestfinished"]) {
    const closed = setup(), unreadable = request(); let calls = 0;
    unreadable.failure = () => { calls++; throw new Error("synthetic-private"); };
    closed.page.emit("request", unreadable); assert.doesNotThrow(() => closed.page.emit(event, unreadable));
    assert.deepEqual(await closed.observer.complete(unreadable), failed("POST_REQUEST_FAILED")); assert.equal(calls, 1); noListeners(closed.page);
  }
});

test("literal abort alone never promotes login, password update or old-password refusal from an unknown POST", async () => {
  const options = { postRequestFailed: true, postFailure: { errorText: "net::ERR_ABORTED" }, actionHeaders: {} };
  for (const [probe, fixture] of [[inspectPasswordLogin, fakePasswordLogin(options)],
    [inspectPasswordTerminal, fakePasswordPage(options)], [inspectOldPassword, fakePasswordPage(options, true)]]) {
    const result = await probe(fixture.inputs);
    assert.equal(result.passed, false); assert.equal(result.uncertain, true);
    if (probe === inspectOldPassword) assert.equal(result.point, "POST_REQUEST_ABORTED");
    assert.equal(fixture.observations().posts, 1);
  }
});
