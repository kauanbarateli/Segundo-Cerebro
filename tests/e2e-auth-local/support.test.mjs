import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import ts from "typescript";

// Compile only this repository-owned pure helper. No SDK, env file, browser,
// service, operator snapshot or credentials are loaded by these controls.
const source = await readFile(new URL("./support.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { localEnvironment, sessionFromCookies, cleanupMayProceed, AUTH_LOCAL_STAGES } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
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
