import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { APP_URL, API_URL, BROWSER_CLEANUP_FAILURE_POINTS, BROWSER_FAILURE_POINTS, BROWSER_IMAGE, BROWSER_IMAGE_ID, BROWSER_INSPECT_FORMAT, BROWSER_STAGES, DATABASE_PREFLIGHT, LOCAL_INFRASTRUCTURE_FIXTURE, assertDatabasePreflight, assertNoEnvironmentFiles, assertTempDescendant, browserContainerArguments, createBrowserContainerPlan, createBrowserEnvironment, decodeLocalStatus, evaluateBrowserRun, loadCanonicalMigrations, localPsqlEnvironment, main, renderLocalConfig, requireCiRunner, runBoundedProcess, runBrowserNamespace, validateAuthLocalChildEnvironment, validateAuthLocalReport, validateBrowserContainer } from "../../scripts/verification/auth-local-ci.mjs";

const TEMP = resolve(tmpdir());
const RUN_ROOT = join(TEMP, "sc-auth-local-ci-test123");
const ENV = { CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1", RUNNER_TEMP: TEMP, PATH: "unit-path", PLAYWRIGHT_BROWSERS_PATH: join(TEMP, "auth-local-browsers") };
const STATUS = { API_URL, DB_URL: "postgresql://postgres:unit-only-password@127.0.0.1:54322/postgres", PUBLISHABLE_KEY: "sb_publishable_unit_only_not_real_key", SECRET_KEY: `sb_secret_${"S".repeat(32)}` };
const PREFLIGHT = { owner: "postgres", database: "postgres", version: 170004, auth_empty: true, schema_empty: true, application_empty: true, infrastructure_ready: true };
const errorCode = code => error => error.code === code && error.message === code;

async function fixture(t) {
  const root = await mkdtemp(join(TEMP, "sc-auth-local-unit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return realpath(root);
}
function report() {
  return { schemaVersion: 1, status: "passed", code: "PASSED", failurePoint: null, cleanupFailurePoint: null, stages: BROWSER_STAGES.map(name => ({ name, passed: true })), counts: { fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3 }, checks: Object.fromEntries(["loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions", "logoutGlobalA", "oldADenied", "bIntact", "cleanupConfirmed"].map(key => [key, true])), cleanupConfirmed: true };
}
function failedReport(failurePoint = "LOGIN_FIELDS") {
  const value = report();
  value.status = "failed"; value.code = "CLEANUP_UNCONFIRMED"; value.failurePoint = failurePoint;
  value.cleanupFailurePoint = "FIXTURE_DELETE_ACK";
  value.counts.fixtureDeleted = 0; value.cleanupConfirmed = false;
  value.checks = Object.fromEntries(Object.keys(value.checks).map(key => [key, false]));
  value.stages = [{ name: "fixtures-created", passed: true }, { name: "login-a1", passed: false }, { name: "fixture-cleanup", passed: false }];
  return value;
}
function fakeProcess({ stdout = "", stderr = "", exitCode = 0, close = true } = {}) {
  const child = new EventEmitter();
  Object.assign(child, { pid: 2001, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  queueMicrotask(() => { child.stdout.write(stdout); child.stderr.write(stderr); if (close) child.emit("close", exitCode); });
  return child;
}

test("help/default never inspect credentials or spawn a command", async () => {
  for (const argv of [[], ["--help"]]) {
    const outputs = [];
    const exit = await main(argv, new Proxy({}, { get() { throw Error("environment inspected"); } }), value => outputs.push(value));
    assert.equal(exit, 0); assert.equal(outputs[0].code, "NO_SERVICE_STARTED");
  }
});
test("unknown arguments fail closed without reflecting input", async () => {
  const outputs = [];
  assert.equal(await main(["--execute", STATUS.SECRET_KEY], {}, value => outputs.push(value)), 1);
  assert.deepEqual(outputs, [{ schemaVersion: 1, status: "failed", code: "ARGUMENTS_REFUSED" }]);
});
test("runner requires all explicit flags and refuses Windows/macOS", () => {
  assert.deepEqual(requireCiRunner(ENV, "linux"), { runnerTemp: TEMP });
  for (const name of ["CI", "GITHUB_ACTIONS", "SC_AUTH_LOCAL_CI_RUN"]) assert.throws(() => requireCiRunner({ ...ENV, [name]: "false" }, "linux"), errorCode("CI_OPT_IN_REQUIRED"));
  for (const platform of ["win32", "darwin"]) assert.throws(() => requireCiRunner(ENV, platform), errorCode("CI_OPT_IN_REQUIRED"));
});
test("hosted keys/URLs, PG options, linked IDs and Docker override cannot enter orchestration", () => {
  for (const name of ["SUPABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID", "PGHOST", "PGOPTIONS", "DATABASE_URL", "APP_URL", "AUTH_STATE_SECRET", "DOCKER_HOST", "SC_VERIFY_ACK", "VERCEL", "GOOGLE_CLIENT_SECRET"]) assert.throws(() => requireCiRunner({ ...ENV, [name]: "unit-foreign-canary" }, "linux"), errorCode("FOREIGN_ENVIRONMENT_REFUSED"));
});
test("report paths cannot escape the exclusive runner subdirectory", () => {
  for (const path of [TEMP, resolve(TEMP, "..", "escape"), "relative", TEMP + "\0bad"]) assert.throws(() => assertTempDescendant(TEMP, path), errorCode("RUNNER_PATH_REFUSED"));
  assert.equal(assertTempDescendant(TEMP, join(RUN_ROOT, "auth-local-ci-report.json")), join(RUN_ROOT, "auth-local-ci-report.json"));
});
test("status uses real modern fields and keeps keys/password non-enumerable", () => {
  const local = decodeLocalStatus(JSON.stringify(STATUS));
  assert.equal(local.publishable, STATUS.PUBLISHABLE_KEY); assert.equal(local.secret, STATUS.SECRET_KEY); assert.equal(local.password, "unit-only-password");
  assert.deepEqual(JSON.parse(JSON.stringify(local)), { apiUrl: API_URL, databaseLocal: true });
});
test("status refuses any linked state, envelopes, alias/remote URL and credential query", () => {
  const invalid = [
    { ...STATUS, linked_project_ref: "unit-foreign-project" }, { ...STATUS, linked_project: null }, { ...STATUS, unknown: "unexpected" },
    { ...STATUS, API_URL: "http://localhost:54321" }, { ...STATUS, API_URL: "https://unit-project.supabase.co" },
    { ...STATUS, REST_URL: "https://unit-project.supabase.co/rest/v1" }, { ...STATUS, STUDIO_URL: "http://127.0.0.1:54399" },
    ...["postgresql://postgres:canary@localhost:54322/postgres", "postgresql://postgres:canary@127.0.0.1:5432/postgres", "postgresql://other:canary@127.0.0.1:54322/postgres", "postgresql://postgres:canary@127.0.0.1:54322/other", "postgresql://postgres:canary@127.0.0.1:54322/postgres?sslmode=require"].map(DB_URL => ({ ...STATUS, DB_URL })),
    { data: STATUS }, { ...STATUS, PUBLISHABLE_KEY: "eyJlegacy.jwt.key" }, { ...STATUS, SECRET_KEY: "eyJlegacy.jwt.key" },
    { ...STATUS, PUBLISHABLE_KEY: undefined }, { ...STATUS, SECRET_KEY: undefined },
  ];
  for (const value of invalid) assert.throws(() => decodeLocalStatus(JSON.stringify(value)), errorCode("LOCAL_STATUS_REFUSED"));
  for (const text of ["bad JSON", "x".repeat(65537), "null", "[]"]) assert.throws(() => decodeLocalStatus(text), errorCode("LOCAL_STATUS_REFUSED"));
});
test("child receives only local Auth configuration, random distinct HMACs and no parent secret", () => {
  const parent = { ...ENV, GITHUB_TOKEN: "unit-secret-canary", PGPASSWORD: "foreign-password", UNRELATED_SECRET: "foreign-secret" };
  const local = decodeLocalStatus(JSON.stringify(STATUS));
  const first = createBrowserEnvironment(parent, join(RUN_ROOT, "home"), RUN_ROOT, local), second = createBrowserEnvironment(parent, join(RUN_ROOT, "home"), RUN_ROOT, local);
  assert.deepEqual(validateAuthLocalChildEnvironment(first), { appUrl: APP_URL, supabaseUrl: API_URL, reportPath: join(RUN_ROOT, "auth-local-ci-report.json") });
  assert.equal(first.GITHUB_TOKEN, undefined); assert.equal(first.PGPASSWORD, undefined); assert.equal(first.UNRELATED_SECRET, undefined);
  assert.notEqual(first.AUTH_STATE_SECRET, second.AUTH_STATE_SECRET); assert.notEqual(first.AUTH_STATE_SECRET, first.AUTH_RATE_LIMIT_SECRET);
  assert.equal(parent.GITHUB_TOKEN, "unit-secret-canary");
  const pg = localPsqlEnvironment(parent, join(RUN_ROOT, "home"), local);
  assert.equal(pg.PGPASSWORD, local.password); assert.equal(pg.GITHUB_TOKEN, undefined); assert.equal(pg.PGHOST, "127.0.0.1"); assert.equal(pg.PGPORT, "54322");
});
test("child guards reject mode/origin/legacy key/equal HMAC/path drift", () => {
  const valid = createBrowserEnvironment(ENV, join(RUN_ROOT, "home"), RUN_ROOT, decodeLocalStatus(JSON.stringify(STATUS)));
  const changes = [{ APP_MODE: "demo" }, { NODE_ENV: "production" }, { SUPABASE_URL: "https://unit.supabase.co" }, { APP_URL: APP_URL + "/" }, { SUPABASE_PUBLISHABLE_KEY: "eyJjwt" }, { AUTH_STATE_SECRET: valid.AUTH_RATE_LIMIT_SECRET }, { AUTH_RATE_LIMIT_SECRET: "short" }];
  for (const delta of changes) assert.throws(() => validateAuthLocalChildEnvironment({ ...valid, ...delta }), errorCode("ENVIRONMENT_REFUSED"));
  for (const path of [join(TEMP, "auth-local-ci-report.json"), join(RUN_ROOT, "other.json"), join(TEMP, "sc-auth-local-ci-test123", "..", "other", "auth-local-ci-report.json")]) assert.throws(() => validateAuthLocalChildEnvironment({ ...valid, SC_AUTH_LOCAL_CI_REPORT_PATH: path }), errorCode("RUNNER_PATH_REFUSED"));
});
test("only a complete closed report proves the browser acceptance", () => {
  const value = report(); assert.deepEqual(validateAuthLocalReport(value), value);
  const deltas = [value => { value.email = "unit-canary"; }, value => { value.checks.token = "unit-canary"; }, value => { value.counts.fixtureDeleted = 1; }, value => { value.checks.loginA2 = false; }, value => { value.stages.pop(); }, value => { value.stages[3].passed = false; }, value => { value.stages[3].name = value.stages[2].name; }, value => { value.code = "ACCEPTANCE_FAILED"; }, value => { value.counts.browserContexts = 2; }, value => { value.cleanupConfirmed = false; }];
  for (const mutate of deltas) { const invalid = report(); mutate(invalid); assert.throws(() => validateAuthLocalReport(invalid), errorCode("BROWSER_REPORT_REFUSED")); }
});
test("partial failure is never promoted; cleanup stage may follow an early failure", () => {
  const failed = report(); failed.status = "failed"; failed.code = "LOGIN_FAILED"; failed.failurePoint = "LOGIN_FIELDS"; failed.stages = [{ name: "fixtures-created", passed: true }, { name: "login-a1", passed: false }, { name: "fixture-cleanup", passed: true }]; failed.checks.loginA1 = false;
  assert.equal(validateAuthLocalReport(failed).status, "failed");
  failed.counts.fixtureDeleted = 1; assert.throws(() => validateAuthLocalReport(failed), errorCode("BROWSER_REPORT_REFUSED"));
  failed.cleanupConfirmed = false; failed.checks.cleanupConfirmed = false; failed.cleanupFailurePoint = "FIXTURE_DELETE_ACK"; assert.equal(validateAuthLocalReport(failed).cleanupConfirmed, false);
});
test("a complete browser report cannot certify failed or unconfirmed process exit", () => {
  assert.equal(evaluateBrowserRun(undefined, report()).accepted, true);
  for (const code of ["COMMAND_FAILED", "COMMAND_TIMEOUT", "COMMAND_GROUP_UNCONFIRMED"]) {
    const outcome = evaluateBrowserRun(code, report()); assert.equal(outcome.accepted, false); assert.equal(outcome.code, code); assert.equal(outcome.phase, "browser");
  }
});
test("a closed failed report keeps safe stage/code/check diagnostics after exit1", () => {
  const failed = report(); failed.status = "failed"; failed.code = "LOGIN_FAILED"; failed.failurePoint = "LOGIN_FIELDS"; failed.stages = [{ name: "login-a1", passed: false }, { name: "fixture-cleanup", passed: true }]; failed.checks.loginA1 = false;
  const outcome = evaluateBrowserRun("COMMAND_FAILED", failed); assert.equal(outcome.accepted, false); assert.equal(outcome.browser.code, "LOGIN_FAILED"); assert.deepEqual(outcome.browser.stages, failed.stages);
  assert.throws(() => evaluateBrowserRun("unit-raw-provider-canary", failed), errorCode("BROWSER_REPORT_REFUSED"));
  failed.providerError = "unit-raw-provider-canary"; assert.throws(() => evaluateBrowserRun("COMMAND_FAILED", failed), errorCode("BROWSER_REPORT_REFUSED"));
});
test("browser writer and runner share every closed failure point", async () => {
  // Repository-owned pure support only: no SDK, browser, env or operator input.
  const source = await readFile(new URL("../e2e-auth-local/support.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const writer = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  assert.deepEqual([...BROWSER_FAILURE_POINTS], writer.AUTH_LOCAL_FAILURE_POINTS);
  assert.deepEqual([...BROWSER_CLEANUP_FAILURE_POINTS], writer.AUTH_LOCAL_CLEANUP_FAILURE_POINTS);
  assert.equal(BROWSER_FAILURE_POINTS.length, 31); assert.equal(new Set(BROWSER_FAILURE_POINTS).size, 31);
  assert.equal(BROWSER_CLEANUP_FAILURE_POINTS.length, 6); assert.equal(new Set(BROWSER_CLEANUP_FAILURE_POINTS).size, 6);
  for (const point of BROWSER_FAILURE_POINTS) assert.equal(validateAuthLocalReport(failedReport(point)).failurePoint, point);
  for (const point of BROWSER_CLEANUP_FAILURE_POINTS) {
    const failed = failedReport(); failed.cleanupFailurePoint = point;
    assert.equal(validateAuthLocalReport(failed).cleanupFailurePoint, point);
  }
});

test("failure point is required, null only for passed, and cannot carry raw diagnostics", () => {
  for (const template of [report(), failedReport()]) {
    const missing = structuredClone(template); delete missing.failurePoint;
    assert.throws(() => validateAuthLocalReport(missing), errorCode("BROWSER_REPORT_REFUSED"));
    const extra = { ...template, failureDetails: "unit-raw-provider-canary" };
    assert.throws(() => validateAuthLocalReport(extra), errorCode("BROWSER_REPORT_REFUSED"));
  }
  for (const value of [undefined, null, "", "unit-raw-provider-canary", "LOGIN_FIELDS\n", "LOGOUT_SECURITY_HEADERS", 1, false, {}, ["LOGIN_FIELDS"]]) {
    const failed = failedReport(); failed.failurePoint = value;
    assert.throws(() => validateAuthLocalReport(failed), errorCode("BROWSER_REPORT_REFUSED"));
  }
  for (const value of [undefined, "LOGIN_FIELDS", {}, false]) {
    const passed = report(); passed.failurePoint = value;
    assert.throws(() => validateAuthLocalReport(passed), errorCode("BROWSER_REPORT_REFUSED"));
  }
});

test("first failure point survives cleanup failure without certifying fixture cleanup or PASS", () => {
  const failed = failedReport("LOGIN_SUBMIT_NAVIGATION");
  for (const processFailure of [undefined, "COMMAND_FAILED"]) {
    const outcome = evaluateBrowserRun(processFailure, failed);
    assert.equal(outcome.accepted, false); assert.equal(outcome.browser.code, "CLEANUP_UNCONFIRMED");
    assert.equal(outcome.browser.failurePoint, "LOGIN_SUBMIT_NAVIGATION"); assert.equal(outcome.browser.cleanupConfirmed, false);
    assert.equal(outcome.browser.cleanupFailurePoint, "FIXTURE_DELETE_ACK");
    assert.equal(outcome.browser.counts.fixtureDeleted, 0);
  }
  const cleanupOnly = failedReport("FIXTURE_CLEANUP");
  assert.equal(evaluateBrowserRun(undefined, cleanupOnly).accepted, false);
});

test("cleanup point is required and null exactly when individual cleanup is confirmed", () => {
  for (const template of [report(), failedReport()]) {
    const missing = structuredClone(template); delete missing.cleanupFailurePoint;
    assert.throws(() => validateAuthLocalReport(missing), errorCode("BROWSER_REPORT_REFUSED"));
    assert.throws(() => validateAuthLocalReport({ ...template, cleanupDetails: "unit-provider-canary" }), errorCode("BROWSER_REPORT_REFUSED"));
  }
  for (const point of [undefined, null, "", "unit-provider-canary", "FIXTURE_DELETE_ACK\n", false, 1, {}, ["FIXTURE_DELETE_ACK"]]) {
    const failed = failedReport(); failed.cleanupFailurePoint = point;
    assert.throws(() => validateAuthLocalReport(failed), errorCode("BROWSER_REPORT_REFUSED"));
  }
  for (const point of BROWSER_CLEANUP_FAILURE_POINTS) {
    const passed = report(); passed.cleanupFailurePoint = point;
    assert.throws(() => validateAuthLocalReport(passed), errorCode("BROWSER_REPORT_REFUSED"));
  }
  const failedButClean = failedReport();
  failedButClean.code = "LOGIN_FAILED"; failedButClean.cleanupConfirmed = true; failedButClean.checks.cleanupConfirmed = true;
  failedButClean.counts.fixtureDeleted = 2; failedButClean.cleanupFailurePoint = null;
  failedButClean.stages.at(-1).passed = true;
  assert.equal(validateAuthLocalReport(failedButClean).cleanupFailurePoint, null);
  assert.equal(evaluateBrowserRun(undefined, failedButClean).accepted, false);
});

test("independent cleanup diagnostics never replace the first functional failure or imply a login submission", () => {
  const failed = failedReport("LOGIN_DOCUMENT"); failed.cleanupFailurePoint = "FIXTURE_PRECHECK";
  const outcome = evaluateBrowserRun("COMMAND_FAILED", failed);
  assert.equal(outcome.accepted, false); assert.equal(outcome.browser.failurePoint, "LOGIN_DOCUMENT");
  assert.equal(outcome.browser.cleanupFailurePoint, "FIXTURE_PRECHECK"); assert.equal(outcome.browser.cleanupConfirmed, false);
  assert.equal(outcome.browser.counts.fixtureDeleted, 0); assert.deepEqual(outcome.browser, failed);
});

test("completed login and protected checkpoints never certify failed logout or uncertain cleanup", () => {
  const failed = failedReport("LOGOUT_RESPONSE_POLICY");
  failed.cleanupFailurePoint = "OUTCOME_UNCERTAIN";
  failed.stages = [
    ...BROWSER_STAGES.slice(0, 8).map(name => ({ name, passed: true })),
    { name: "logout-global-a", passed: false }, { name: "fixture-cleanup", passed: false },
  ];
  for (const name of ["loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions"]) failed.checks[name] = true;
  const points = ["LOGOUT_RESPONSE_POLICY", "LOGOUT_STATUS", "LOGOUT_LOCATION", "LOGOUT_PRIVATE_CACHE", "LOGOUT_NO_STORE_CACHE", "LOGOUT_CSP", "LOGOUT_NOSNIFF", "LOGOUT_STORAGE_CLEARANCE"];
  for (const point of points) {
    const value = { ...failed, failurePoint: point };
    for (const processFailure of [undefined, "COMMAND_FAILED"]) {
      const outcome = evaluateBrowserRun(processFailure, value);
      assert.equal(outcome.accepted, false); assert.equal(outcome.browser.failurePoint, point);
      assert.equal(outcome.browser.cleanupFailurePoint, "OUTCOME_UNCERTAIN");
      assert.equal(outcome.browser.counts.fixtureDeleted, 0); assert.equal(outcome.browser.cleanupConfirmed, false);
      assert.equal(outcome.browser.stages.filter(stage => stage.passed).length, 8);
      assert.equal(outcome.browser.checks.logoutGlobalA, false);
    }
    for (const extra of [{ logoutHeaders: "unit-private-header-canary" }, { logoutStatus: 303 }]) {
      assert.throws(() => validateAuthLocalReport({ ...value, ...extra }), errorCode("BROWSER_REPORT_REFUSED"));
    }
  }
});

test("environment-file presence fails without reading its contents", async t => {
  const root = await fixture(t); await writeFile(join(root, ".env.example"), "template"); await assertNoEnvironmentFiles(root);
  await mkdir(join(root, ".env.local")); await assert.rejects(assertNoEnvironmentFiles(root), errorCode("ENVIRONMENT_FILE_REFUSED"));
});
test("config only substitutes a safe exclusive identity", async () => {
  const template = await readFile(new URL("../fixtures/supabase-auth-local/config.toml", import.meta.url), "utf8");
  const rendered = renderLocalConfig(template, "sc-auth-ci-" + "a".repeat(24));
  const section = name => rendered.split(`\n[${name}]\n`)[1].split(/\n\[/, 1)[0];
  assert.match(section("api"), /^schemas = \["public"\]$/m); assert.match(section("db"), /^major_version = 17$/m);
  assert.match(section("auth"), /^enable_signup = false$/m); assert.match(section("auth"), /^enable_anonymous_sign_ins = false$/m);
  assert.match(section("auth.email"), /^enable_signup = true$/m); // Actual email/password provider, global signup stays off.
  for (const changed of [template.replace("enable_signup = false", "enable_signup = true"), template.replace("# CLI maps this to GOTRUE_EXTERNAL_EMAIL_ENABLED, not global signup.\nenable_signup = true", "enable_signup = false"), template.replace("major_version = 17", "major_version = 18"), template.replace("[db.seed]\nenabled = false", "[db.seed]\nenabled = true")]) assert.throws(() => renderLocalConfig(changed, "sc-auth-ci-" + "a".repeat(24)), errorCode("LOCAL_CONFIG_REFUSED"));
  for (const id of ["", "other-project", "sc-auth-ci-" + "a".repeat(25), 'sc-auth-ci-"\n[remotes.prod]']) assert.throws(() => renderLocalConfig(template, id), errorCode("LOCAL_CONFIG_REFUSED"));
  for (const changed of [template.replace("SC_AUTH_LOCAL_CI_PROJECT", "other"), template + '\nsecret="env(PAT)"', template + "\n[remotes.prod]\n", template + '\nurl="https://unit.supabase.co"']) assert.throws(() => renderLocalConfig(changed, "sc-auth-ci-" + "a".repeat(24)), errorCode("LOCAL_CONFIG_REFUSED"));
});
test("canonical 17 migrations are read and checked without executing SQL", async () => {
  const plan = await loadCanonicalMigrations(); assert.equal(plan.length, 17); assert.ok(plan.every(row => Buffer.isBuffer(row.source)));
});
test("manifest/source mismatch is refused before any database command", async t => {
  const root = await fixture(t); await mkdir(join(root, "supabase/migrations"), { recursive: true }); await mkdir(join(root, "supabase/sql-editor/installation"), { recursive: true });
  const installation = [];
  for (let index = 1; index <= 17; index++) {
    const version = String(20261010000000 + index), name = `${version}_unit.sql`, source = Buffer.from("-- inert unit fixture\n"), file = `installation/${String(index).padStart(3, "0")}_${name}`;
    await writeFile(join(root, "supabase/migrations", name), source); await writeFile(join(root, "supabase/sql-editor", file), source);
    installation.push({ order: index, version, source: `supabase/migrations/${name}`, file, bytes: source.length, sha256: createHash("sha256").update(source).digest("hex") });
  }
  await writeFile(join(root, "supabase/sql-editor/manifest.json"), JSON.stringify({ formatVersion: 1, hashAlgorithm: "sha256", installation }));
  assert.equal((await loadCanonicalMigrations(root)).length, 17);
  await writeFile(join(root, installation[8].source), "-- changed unit source\n");
  await assert.rejects(loadCanonicalMigrations(root), errorCode("MIGRATION_INTEGRITY_FAILED"));
});
test("preflight refuses non-owner/nonempty/PG16 or missing infrastructure", () => {
  assertDatabasePreflight(PREFLIGHT);
  for (const delta of [{ owner: "service_role" }, { database: "other" }, { version: 160005 }, { version: 180001 }, { auth_empty: false }, { schema_empty: false }, { application_empty: false }, { infrastructure_ready: "true" }]) assert.throws(() => assertDatabasePreflight({ ...PREFLIGHT, ...delta }), errorCode("LOCAL_DATABASE_REFUSED"));
  assert.throws(() => assertDatabasePreflight({ ...PREFLIGHT, infrastructure_ready: false }), errorCode("INFRASTRUCTURE_CONTRACT_MISSING"));
  assertDatabasePreflight({ ...PREFLIGHT, infrastructure_ready: false }, false);
});
test("bounded process uses no shell or inherited environment; raw stderr stays private", async () => {
  let captured;
  const result = await runBoundedProcess("unit-command", ["--safe"], { cwd: TEMP, env: { ONLY: "known" }, timeoutMs: 100, maxBytes: 1000 }, { spawnProcess(command, args, options) { captured = { command, args, options }; return fakeProcess({ stdout: "metadata", stderr: "unit-provider-secret-canary" }); }, terminateGroup: async () => true });
  assert.equal(result.stdout, "metadata"); assert.equal(JSON.stringify(result).includes("canary"), false); assert.equal(captured.options.shell, false); assert.equal(captured.options.detached, true); assert.deepEqual(captured.options.env, { ONLY: "known" });
});
test("nonzero/oversize/timeout/group uncertainty refuse without exposing child output", async () => {
  for (const [setup, code] of [[{ stdout: "unit-password-canary", exitCode: 1 }, "COMMAND_FAILED"], [{ stderr: "x".repeat(200) }, "COMMAND_OUTPUT_LIMIT"], [{ close: false }, "COMMAND_TIMEOUT"]]) {
    let child;
    await assert.rejects(runBoundedProcess("unit", [], { cwd: TEMP, env: {}, timeoutMs: 15, maxBytes: 100 }, { spawnProcess() { child = fakeProcess(setup); return child; }, terminateGroup: async () => { if (setup.close === false) queueMicrotask(() => child.emit("close", null)); return true; } }), errorCode(code));
  }
  await assert.rejects(runBoundedProcess("unit", [], { env: {}, timeoutMs: 100, maxBytes: 100 }, { spawnProcess: () => fakeProcess(), terminateGroup: async () => false }), errorCode("COMMAND_GROUP_UNCONFIRMED"));
});
test("invalid process budget cannot spawn", async () => {
  await assert.rejects(runBoundedProcess("unit", [], { timeoutMs: 600001, maxBytes: 100 }, { spawnProcess() { throw Error("must not spawn"); } }), errorCode("PROCESS_OPTIONS_REFUSED"));
});
test("oversized stdout is rejected before copying; late chunks cannot revive output", async () => {
  let copies = 0;
  const guarded = size => { const buffer = Buffer.alloc(size); buffer.toString = () => { copies++; return "unit-late-canary"; }; return buffer; };
  await assert.rejects(runBoundedProcess("unit", [], { env: {}, timeoutMs: 100, maxBytes: 100 }, {
    spawnProcess() {
      const child = new EventEmitter(); Object.assign(child, { pid: 2001, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
      queueMicrotask(() => { child.stdout.emit("data", guarded(101)); child.stdout.emit("data", guarded(10)); child.stderr.emit("data", guarded(10)); child.emit("close", 0); child.stdout.emit("data", guarded(10)); }); return child;
    }, terminateGroup: async () => true,
  }), errorCode("COMMAND_OUTPUT_LIMIT"));
  assert.equal(copies, 0);
  const result = await runBoundedProcess("unit", [], { env: {}, timeoutMs: 100, maxBytes: 100 }, {
    spawnProcess() {
      const child = new EventEmitter(); Object.assign(child, { pid: 2001, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
      queueMicrotask(() => { child.stdout.emit("data", Buffer.from("safe-metadata")); child.emit("close", 0); child.stdout.emit("data", guarded(10)); }); return child;
    }, terminateGroup: async () => true,
  });
  assert.equal(result.stdout, "safe-metadata"); assert.equal(copies, 0);
});

function namespaceFixture(options = {}) {
  const plan = createBrowserContainerPlan(resolve("."), RUN_ROOT, TEMP, 1001, 1001);
  const environment = createBrowserEnvironment(ENV, join(RUN_ROOT, "home"), RUN_ROOT, decodeLocalStatus(JSON.stringify(STATUS)));
  const id = "c".repeat(64), calls = [];
  let exists = options.preexisting === true;
  let value = { id, name: `/${plan.name}`, label: plan.label, image: BROWSER_IMAGE, imageId: BROWSER_IMAGE_ID, state: "created", running: false, exitCode: 0, pidMode: "", ipcMode: "private", networkMode: "host", privileged: false, init: true, user: "1001:1001", logType: "none", capDrop: ["ALL"], securityOpt: ["no-new-privileges:true"], shmSize: 536870912, restartPolicy: "no", ...options.projection };
  const run = async (command, args, deadline, processOptions = {}) => {
    assert.equal(command, "docker"); calls.push({ args, deadline, processOptions });
    switch (args[0]) {
      case "ps": return { stdout: exists ? `${id}\n` : "", groupConfirmed: true };
      case "pull": return { stdout: "", groupConfirmed: true };
      case "create": {
        exists = options.createInvisible !== true;
        if (options.createFailure) throw await fakeCommandFailure(options.createFailure);
        return { stdout: `${id}\n`, groupConfirmed: true };
      }
      case "inspect": return { stdout: JSON.stringify(value), groupConfirmed: true };
      case "start": {
        value = { ...value, state: options.keepRunning ? "running" : "exited", running: options.keepRunning === true, exitCode: options.containerExitCode ?? 0 };
        if (options.startFailure) throw await fakeCommandFailure(options.startFailure);
        return { stdout: "", groupConfirmed: options.groupConfirmed !== false };
      }
      case "stop": value = { ...value, state: "exited", running: false }; return { stdout: "", groupConfirmed: true };
      case "rm": {
        assert.equal(args.at(-1), id); exists = options.removalUnconfirmed === true; return { stdout: "", groupConfirmed: true };
      }
      default: throw Error("Unexpected fake command");
    }
  };
  return { plan, environment, id, calls, value, run };
}
async function fakeCommandFailure(kind) {
  let child;
  try {
    await runBoundedProcess("unit", [], { env: {}, timeoutMs: 10, maxBytes: 100 }, {
      spawnProcess() { child = fakeProcess(kind === "timeout" ? { close: false } : kind === "oversize" ? { stdout: "x".repeat(101) } : { exitCode: 1 }); return child; },
      terminateGroup: async () => { if (kind === "timeout") queueMicrotask(() => child.emit("close", null)); return true; },
    });
  } catch (error) { return error; }
  throw Error("Fake failure expected");
}
test("browser namespace plan pins image/UID and passes environment NAMES only", () => {
  const { plan, environment } = namespaceFixture();
  const args = browserContainerArguments(plan, environment);
  assert.equal(environment.PLAYWRIGHT_BROWSERS_PATH, "/ms-playwright");
  assert.ok(args.includes(BROWSER_IMAGE)); assert.ok(args.includes("linux/amd64")); assert.ok(args.includes("1001:1001")); assert.ok(args.includes("--init"));
  assert.equal(args.includes("--pid"), false); assert.equal(args.includes("--privileged"), false); assert.equal(args.includes("--env-file"), false);
  assert.equal(args.filter(value => value === "--mount").length, 2);
  assert.equal(args[args.indexOf("--network") + 1], "host"); assert.equal(args[args.indexOf("--ipc") + 1], "private"); assert.equal(args[args.indexOf("--log-driver") + 1], "none");
  for (const value of [environment.SUPABASE_SECRET_KEY, environment.AUTH_STATE_SECRET, environment.AUTH_RATE_LIMIT_SECRET]) assert.equal(args.some(arg => arg.includes(value)), false);
  for (const name of Object.keys(environment)) assert.ok(args.some((arg, index) => arg === "--env" && args[index + 1] === name));
  assert.equal(BROWSER_INSPECT_FORMAT.includes(".Config.Env"), false); assert.equal(BROWSER_INSPECT_FORMAT.includes(".State.Error"), false);
});
test("namespace guard refuses privileged UID/mount/env contamination", () => {
  for (const identity of [[0, 1001], [1001, 0], [1001, 70000]]) assert.throws(() => createBrowserContainerPlan(resolve("."), RUN_ROOT, TEMP, ...identity), errorCode("BROWSER_NAMESPACE_REFUSED"));
  assert.throws(() => createBrowserContainerPlan(resolve("path,escape"), RUN_ROOT, TEMP, 1001, 1001), errorCode("BROWSER_NAMESPACE_REFUSED"));
  const { plan, environment } = namespaceFixture();
  for (const delta of [{ GITHUB_TOKEN: "unit-canary" }, { PGPASSWORD: "unit-canary" }, { PLAYWRIGHT_BROWSERS_PATH: TEMP }, { HOME: TEMP }]) assert.throws(() => browserContainerArguments(plan, { ...environment, ...delta }), errorCode("BROWSER_NAMESPACE_REFUSED"));
});
test("safe inspect refuses identity/image/namespace/logging drift and extra environment", () => {
  const { plan, value, id } = namespaceFixture(); assert.equal(validateBrowserContainer(value, plan, id).id, id);
  for (const delta of [{ id: "d".repeat(64) }, { name: "/other" }, { label: "foreign" }, { image: "other-image" }, { imageId: "sha256:" + "0".repeat(64) }, { pidMode: "host" }, { ipcMode: "host" }, { networkMode: "bridge" }, { privileged: true }, { init: false }, { user: "0:0" }, { logType: "json-file" }, { capDrop: [] }, { securityOpt: [] }, { shmSize: 67108864 }, { restartPolicy: "always" }, { running: true }, { env: ["unit-secret-canary"] }]) assert.throws(() => validateBrowserContainer({ ...value, ...delta }, plan, id), errorCode("BROWSER_NAMESPACE_REFUSED"));
});
test("successful namespace exits naturally with zero before removal and is absent by label AND name", async () => {
  const fixture = namespaceFixture();
  const result = await runBrowserNamespace(fixture);
  assert.equal(result.failure, null); assert.equal(result.groupConfirmed, true); assert.equal(result.cleanupConfirmed, true); assert.equal(result.creationConfirmed, true);
  assert.ok(fixture.calls.findIndex(row => row.args[0] === "inspect") < fixture.calls.findIndex(row => row.args[0] === "start"));
  const startIndex = fixture.calls.findIndex(row => row.args[0] === "start"), removeIndex = fixture.calls.findIndex(row => row.args[0] === "rm");
  assert.ok(fixture.calls.some((row, index) => row.args[0] === "inspect" && index > startIndex && index < removeIndex));
  assert.equal(fixture.calls.some(row => row.args[0] === "stop"), false); assert.ok(removeIndex > startIndex);
  const filters = fixture.calls.filter(row => row.args[0] === "ps").map(row => row.args.at(-1)); assert.ok(filters.some(filter => filter.startsWith("label="))); assert.ok(filters.some(filter => filter.startsWith("name=")));
  for (const sensitive of [fixture.plan.name, fixture.plan.label, fixture.id, fixture.environment.SUPABASE_SECRET_KEY]) assert.equal(JSON.stringify(result).includes(sensitive), false);
});
test("attach CLI zero with container exit one never passes even with a passed browser report", async () => {
  const fixture = namespaceFixture({ containerExitCode: 1 });
  const result = await runBrowserNamespace(fixture);
  assert.equal(result.failure, "BROWSER_NAMESPACE_EXIT_FAILED"); assert.equal(result.stage, "namespace-exit-check");
  assert.equal(result.cleanupConfirmed, true); assert.equal(result.groupConfirmed, true);
  assert.equal(evaluateBrowserRun(result.failure, report()).accepted, false);
  assert.ok(fixture.calls.some(row => row.args[0] === "rm"));
});

test("attach CLI zero with a still-running container is cleaned but never passes", async () => {
  const fixture = namespaceFixture({ keepRunning: true });
  const result = await runBrowserNamespace(fixture);
  assert.equal(result.failure, "BROWSER_NAMESPACE_EXIT_FAILED"); assert.equal(result.stage, "namespace-exit-check");
  assert.equal(result.cleanupConfirmed, true); assert.equal(result.groupConfirmed, true);
  assert.equal(evaluateBrowserRun(result.failure, report()).accepted, false);
  assert.ok(fixture.calls.some(row => row.args[0] === "stop")); assert.ok(fixture.calls.some(row => row.args[0] === "rm"));
});

test("namespace mismatch never starts or removes another container", async () => {
  for (const projection of [{ label: "foreign" }, { pidMode: "host" }, { logType: "json-file" }, { image: "other" }]) {
    const fixture = namespaceFixture({ projection }); const result = await runBrowserNamespace(fixture);
    assert.equal(result.failure, "BROWSER_NAMESPACE_REFUSED"); assert.equal(result.cleanupConfirmed, false);
    assert.equal(fixture.calls.some(row => ["start", "stop", "rm"].includes(row.args[0])), false);
  }
  const fixture = namespaceFixture({ preexisting: true }); const result = await runBrowserNamespace(fixture);
  assert.equal(result.failure, "BROWSER_NAMESPACE_NOT_EMPTY"); assert.equal(result.cleanupConfirmed, false); assert.equal(fixture.calls.some(row => ["create", "start", "rm"].includes(row.args[0])), false);
});
test("namespace removal ACK without absence is inconclusive", async () => {
  const fixture = namespaceFixture({ removalUnconfirmed: true }); const result = await runBrowserNamespace(fixture);
  assert.equal(result.cleanupConfirmed, false); assert.equal(result.failure, "BROWSER_NAMESPACE_CLEANUP_UNCONFIRMED");
});
test("lost create reply remains unknown even when empty or a scoped object was removed", async () => {
  for (const createInvisible of [true, false]) {
    const fixture = namespaceFixture({ createFailure: "timeout", createInvisible }); const result = await runBrowserNamespace(fixture);
    assert.equal(result.unknownOutcome, true); assert.equal(result.creationConfirmed, false); assert.equal(result.cleanupConfirmed, false); assert.equal(result.failure, "COMMAND_TIMEOUT");
    assert.equal(fixture.calls.some(row => row.args[0] === "start"), false);
    assert.equal(fixture.calls.some(row => row.args[0] === "rm"), !createInvisible);
  }
});
test("browser nonzero cannot PASS; timeout/output-limit latch cleanup uncertainty", async () => {
  const failed = await runBrowserNamespace(namespaceFixture({ startFailure: "nonzero" }));
  assert.equal(failed.failure, "COMMAND_FAILED"); assert.equal(failed.cleanupConfirmed, true); assert.equal(failed.groupConfirmed, true);
  for (const startFailure of ["timeout", "oversize"]) {
    const fixture = namespaceFixture({ startFailure, keepRunning: true }); const result = await runBrowserNamespace(fixture);
    assert.equal(result.cleanupConfirmed, false); assert.equal(result.unknownOutcome, true); assert.ok(fixture.calls.some(row => row.args[0] === "stop")); assert.ok(fixture.calls.some(row => row.args[0] === "rm"));
  }
  const unconfirmed = await runBrowserNamespace(namespaceFixture({ groupConfirmed: false }));
  assert.equal(unconfirmed.cleanupConfirmed, false); assert.equal(unconfirmed.failure, "COMMAND_GROUP_UNCONFIRMED");
});

// Embedded SQL parsing/semantic checks only; this PGlite fixture is not real Auth
// and is never used by the CI browser gate, which starts the official CLI stack.
async function infrastructureDatabase(t, extra = "") {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create schema auth; create table auth.users(id uuid primary key);" + extra);
  return db;
}
test("local infrastructure creates only missing helper/trigger, proves RLS and rolls back probe", async t => {
  const db = await infrastructureDatabase(t);
  const metadata = async () => (await db.exec(DATABASE_PREFLIGHT)).flatMap(result => result.rows).find(row => row.jsonb_build_object)?.jsonb_build_object;
  const initial = await metadata();
  // PGlite currently embeds PG18; only semantics are checked here. The real CI
  // preflight remains strictly PG17, as the pure negative version tests show.
  assert.equal(initial.auth_empty, true); assert.equal(initial.schema_empty, true); assert.equal(initial.application_empty, true); assert.equal(initial.infrastructure_ready, false);
  await db.exec(LOCAL_INFRASTRUCTURE_FIXTURE);
  assert.equal((await metadata()).infrastructure_ready, true);
  const before = await db.query("select oid,prosrc from pg_proc where oid='public.rls_auto_enable()'::regprocedure");
  await db.exec(LOCAL_INFRASTRUCTURE_FIXTURE);
  assert.deepEqual((await db.query("select oid,prosrc from pg_proc where oid='public.rls_auto_enable()'::regprocedure")).rows, before.rows);
  assert.equal((await db.query("select to_regclass('public.__sc_auth_local_rls_probe') is null as absent")).rows[0].absent, true);
});
test("local infrastructure refuses users/application objects before creating the helper", async t => {
  for (const extra of ["insert into auth.users values('00000000-0000-4000-8000-000000000001');", "create schema app_private;", "create table public.unexpected(id integer);"]) {
    const db = await infrastructureDatabase(t, extra);
    await assert.rejects(db.exec(LOCAL_INFRASTRUCTURE_FIXTURE), /Disposable empty local database required/);
    await db.exec("rollback"); assert.equal((await db.query("select to_regprocedure('public.rls_auto_enable()') is null as absent")).rows[0].absent, true);
  }
});
test("partial/malformed infrastructure is never replaced or accepted", async t => {
  for (const extra of ["create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;", "create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$begin end$$; create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable();"]) {
    const db = await infrastructureDatabase(t, extra);
    await assert.rejects(db.exec(LOCAL_INFRASTRUCTURE_FIXTURE), /Partial infrastructure contract refused|Infrastructure failed the RLS probe/); await db.exec("rollback");
    assert.equal((await db.query("select prosrc from pg_proc where oid='public.rls_auto_enable()'::regprocedure")).rows[0].prosrc, "begin end");
    assert.equal((await db.query("select to_regclass('public.__sc_auth_local_rls_probe') is null as absent")).rows[0].absent, true);
  }
});
