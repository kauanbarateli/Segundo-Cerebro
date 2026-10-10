import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import ts from "typescript";

// Compile only this repository-owned pure helper. No SDK, env file, browser,
// service, operator snapshot or credentials are loaded by these controls.
const source = await readFile(new URL("./support.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { localEnvironment, sessionFromCookies, cleanupMayProceed, hasLocalDocumentHeaders, retainFailurePoint, retainCleanupFailurePoint, AUTH_LOCAL_STAGES, AUTH_LOCAL_FAILURE_POINTS, AUTH_LOCAL_CLEANUP_FAILURE_POINTS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
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
