import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, lstatSync, linkSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { AUTH_LOCAL_LIFECYCLE_FILE, AUTH_LOCAL_LIFECYCLE_LIMIT, AUTH_LOCAL_LIFECYCLE_MAX_BYTES, createAuthLocalLifecycle, validateAuthLocalLifecycle } from "../e2e-auth-local/auth-local-lifecycle-contract.mjs";
import Reporter, { createAuthLocalLifecycleReporter } from "../e2e-auth-local/auth-local-lifecycle-reporter.mjs";

const refused = operation => assert.throws(operation, error => error instanceof Error && error.message === "AUTH_LOCAL_LIFECYCLE_REFUSED");
const fresh = () => createAuthLocalLifecycle().snapshot();
function fixture(t) {
  assert.equal(process.platform, "linux", "Private sidecar filesystem checks require the qualified Linux runner.");
  const temp = mkdtempSync(join(realpathSync(tmpdir()), "sc-auth-lifecycle-unit-"));
  const root = mkdtempSync(join(temp, "sc-auth-local-ci-"));
  chmodSync(root, 0o700);
  t.after(() => {
    assert.equal(dirname(temp), realpathSync(tmpdir()));
    assert.match(basename(temp), /^sc-auth-lifecycle-unit-[A-Za-z0-9]+$/);
    rmSync(temp, { recursive: true, force: true });
  });
  const principal = join(root, "auth-local-ci-report.json"), sidecar = join(root, AUTH_LOCAL_LIFECYCLE_FILE);
  const env = { CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1", RUNNER_TEMP: temp, SC_AUTH_LOCAL_CI_REPORT_PATH: principal };
  return { temp, root, principal, sidecar, env };
}
function read(f) { return validateAuthLocalLifecycle(JSON.parse(readFileSync(f.sidecar, "utf8"))); }

test("lifecycle model projects only bounded callback names and freezes its copies", () => {
  const observer = createAuthLocalLifecycle();
  assert.deepEqual(fresh(), { schemaVersion: 2, scenario: "auth-local-playwright-lifecycle", diagnosticOnly: true, phase: "initial",
    counts: { begin: 0, testBegin: 0, testEnd: 0, errorSeen: 0, end: 0 }, events: [], activeTests: 0, orderViolation: false, overflow: false, endStatus: "unknown" });
  for (const event of ["begin", "test-begin", "test-end", "test-begin", "test-end", "error-seen", "end"]) observer.record(event);
  const row = validateAuthLocalLifecycle(observer.snapshot());
  assert.deepEqual(row.counts, { begin: 1, testBegin: 2, testEnd: 2, errorSeen: 1, end: 1 });
  assert.equal(row.phase, "ended"); assert.equal(row.orderViolation, false); assert.equal(row.activeTests, 0);
  assert.ok(Object.isFrozen(row) && Object.isFrozen(row.counts) && Object.isFrozen(row.events));
  assert.throws(() => row.events.push("begin"), TypeError);
  assert.throws(() => { row.counts.begin = 4; }, TypeError);
  assert.deepEqual(observer.snapshot(), row);
  refused(() => observer.record("PRIVATE_CALLBACK_CANARY"));
});

for (const status of ["passed", "failed", "timedout", "interrupted", "unknown"]) test("model keeps only the first primitive end status: " + status, () => {
  const observer = createAuthLocalLifecycle();
  observer.record("begin"); observer.record("end", status);
  const row = validateAuthLocalLifecycle(observer.snapshot());
  assert.equal(row.schemaVersion, 2); assert.equal(row.endStatus, status);
  assert.equal(Object.hasOwn(row, "accepted"), false); assert.equal(Object.hasOwn(row, "status"), false);
  observer.record("end", status === "passed" ? "failed" : "passed");
  assert.deepEqual(observer.snapshot(), row);
});

test("end status is a closed primitive and cannot describe a callback before end", () => {
  let reads = 0;
  const proxy = new Proxy({}, { get() { reads++; throw new Error("PRIVATE_STATUS_CANARY"); } });
  for (const status of [null, 0, {}, proxy, "PRIVATE_STATUS_CANARY", "PASSED"]) {
    const observer = createAuthLocalLifecycle();
    refused(() => observer.record("end", status));
    assert.deepEqual(observer.snapshot(), fresh());
  }
  refused(() => createAuthLocalLifecycle().record("begin", "passed"));
  for (const phase of ["initial", "begun", "testing"]) {
    const observer = createAuthLocalLifecycle();
    if (phase !== "initial") observer.record("begin");
    if (phase === "testing") observer.record("test-begin");
    const row = observer.snapshot();
    assert.equal(row.endStatus, "unknown");
    refused(() => validateAuthLocalLifecycle({ ...row, endStatus: "passed" }));
  }
  assert.equal(reads, 0);
});

test("literal v1 diagnostics remain exact nine-field records without invented end status", () => {
  const initial = { schemaVersion: 1, scenario: "auth-local-playwright-lifecycle", diagnosticOnly: true, phase: "initial",
    counts: { begin: 0, testBegin: 0, testEnd: 0, errorSeen: 0, end: 0 }, events: [], activeTests: 0, orderViolation: false, overflow: false };
  const ended = { schemaVersion: 1, scenario: "auth-local-playwright-lifecycle", diagnosticOnly: true, phase: "ended",
    counts: { begin: 0, testBegin: 0, testEnd: 0, errorSeen: 1, end: 1 }, events: ["error-seen", "end"], activeTests: 0, orderViolation: false, overflow: false };
  for (const legacy of [initial, ended]) {
    const row = validateAuthLocalLifecycle(legacy);
    assert.deepEqual(row, legacy); assert.equal(Object.keys(row).length, 9);
    assert.equal(Object.hasOwn(row, "endStatus"), false);
    refused(() => validateAuthLocalLifecycle({ ...legacy, endStatus: "unknown" }));
    refused(() => validateAuthLocalLifecycle({ ...legacy, schemaVersion: 2 }));
  }
  const missing = { ...fresh() }; delete missing.endStatus;
  refused(() => validateAuthLocalLifecycle(missing));
  refused(() => validateAuthLocalLifecycle({ ...fresh(), schemaVersion: 3 }));
  refused(() => validateAuthLocalLifecycle({ ...fresh(), endStatus: null }));
  refused(() => validateAuthLocalLifecycle({ ...fresh(), endStatus: "PRIVATE_STATUS_CANARY" }));
  assert.equal(Object.keys(validateAuthLocalLifecycle(fresh())).length, 10);
});

test("global error and end before begin remain observations, never fabricated test execution", () => {
  const observer = createAuthLocalLifecycle();
  observer.record("error-seen"); observer.record("end");
  const row = validateAuthLocalLifecycle(observer.snapshot());
  assert.deepEqual(row.events, ["error-seen", "end"]);
  assert.deepEqual(row.counts, { begin: 0, testBegin: 0, testEnd: 0, errorSeen: 1, end: 1 });
  assert.equal(row.phase, "ended"); assert.equal(row.orderViolation, false);
  assert.equal(Object.hasOwn(row, "status"), false); assert.equal(Object.hasOwn(row, "accepted"), false);
});

for (const events of [
  ["test-end", "end"], ["begin", "begin", "end"],
  ["begin", "test-begin", "test-begin", "test-end", "test-end", "end"],
  ["begin", "test-begin", "end"],
]) test("unexpected callback order is retained as closed diagnostic: " + events.join("/"), () => {
  const observer = createAuthLocalLifecycle();
  events.forEach(event => observer.record(event));
  assert.equal(validateAuthLocalLifecycle(observer.snapshot()).orderViolation, true);
});

test("events and counters saturate explicitly without unbounded observations", () => {
  const observer = createAuthLocalLifecycle();
  for (let index = 0; index < AUTH_LOCAL_LIFECYCLE_LIMIT + 20; index++) observer.record("error-seen");
  observer.record("end");
  const row = validateAuthLocalLifecycle(observer.snapshot());
  assert.equal(row.overflow, true); assert.equal(row.events.length, AUTH_LOCAL_LIFECYCLE_LIMIT);
  assert.equal(row.counts.errorSeen, AUTH_LOCAL_LIFECYCLE_LIMIT); assert.equal(row.counts.end, 1); assert.equal(row.phase, "ended");
  assert.ok(Buffer.byteLength(JSON.stringify(row)) < AUTH_LOCAL_LIFECYCLE_MAX_BYTES);
  observer.record("begin"); observer.record("test-begin"); observer.record("end");
  assert.deepEqual(observer.snapshot(), row, "The first onEnd seals the observation window.");
});

test("overflow preserves the observed lifecycle phase without inventing a suffix callback", () => {
  const observer = createAuthLocalLifecycle();
  for (let index = 0; index <= AUTH_LOCAL_LIFECYCLE_LIMIT; index++) observer.record("error-seen");
  const initial = observer.snapshot();
  assert.equal(validateAuthLocalLifecycle(initial).phase, "initial");
  for (const row of [
    { ...initial, counts: { ...initial.counts, begin: 1 } },
    { ...initial, activeTests: 1 },
    { ...initial, phase: "begun" },
    { ...initial, phase: "testing" },
    { ...initial, phase: "testing", activeTests: 1 },
  ]) refused(() => validateAuthLocalLifecycle(row));
  const sealed = createAuthLocalLifecycle();
  for (let index = 0; index < AUTH_LOCAL_LIFECYCLE_LIMIT - 1; index++) sealed.record("error-seen");
  sealed.record("end");
  assert.equal(sealed.snapshot().overflow, false);
  refused(() => validateAuthLocalLifecycle({ ...sealed.snapshot(), overflow: true }));
  observer.record("begin");
  assert.equal(validateAuthLocalLifecycle(observer.snapshot()).phase, "begun");
  refused(() => validateAuthLocalLifecycle({ ...observer.snapshot(), activeTests: 1 }));
  observer.record("test-begin");
  assert.equal(validateAuthLocalLifecycle(observer.snapshot()).phase, "testing");
  refused(() => validateAuthLocalLifecycle({ ...observer.snapshot(), activeTests: 2 }));
  observer.record("test-end"); observer.record("end");
  const ended = validateAuthLocalLifecycle(observer.snapshot());
  assert.equal(ended.phase, "ended"); assert.equal(ended.activeTests, 0); assert.equal(ended.orderViolation, false);
});

test("closed validator rejects forged acceptance, arbitrary strings and inconsistent counters", () => {
  for (const row of [
    { ...fresh(), status: "passed" }, { ...fresh(), accepted: true }, { ...fresh(), code: "PASSED" },
    { ...fresh(), scenario: "PRIVATE_SCENARIO_CANARY" }, { ...fresh(), diagnosticOnly: false },
    { ...fresh(), phase: "PRIVATE_PHASE_CANARY" }, { ...fresh(), schemaVersion: 3 },
    { ...fresh(), counts: { ...fresh().counts, begin: 1 } },
    { ...fresh(), counts: { ...fresh().counts, errorSeen: -1 } },
    { ...fresh(), counts: { ...fresh().counts, errorSeen: 1.5 } },
    { ...fresh(), events: ["PRIVATE_EVENT_CANARY"] }, { ...fresh(), activeTests: 1 },
    { ...fresh(), orderViolation: true }, { ...fresh(), overflow: true },
    { ...fresh(), events: ["end", "begin"], phase: "ended", counts: { ...fresh().counts, end: 1 } },
  ]) refused(() => validateAuthLocalLifecycle(row));
});

test("validator never invokes accessors, inherited values or Proxy traps", () => {
  let reads = 0;
  const getter = { ...fresh() }; Object.defineProperty(getter, "phase", { enumerable: true, get() { reads++; throw new Error("PRIVATE_GETTER_CANARY"); } });
  const versionGetter = { ...fresh() }; Object.defineProperty(versionGetter, "schemaVersion", { enumerable: true, get() { reads++; return 2; } });
  const statusGetter = { ...fresh() }; Object.defineProperty(statusGetter, "endStatus", { enumerable: true, get() { reads++; return "unknown"; } });
  const counts = { ...fresh().counts }; Object.defineProperty(counts, "begin", { enumerable: true, get() { reads++; return 0; } });
  const events = ["begin"]; Object.defineProperty(events, "0", { enumerable: true, get() { reads++; return "begin"; } });
  const proxy = new Proxy({}, { getPrototypeOf() { reads++; throw new Error("PRIVATE_PROXY_CANARY"); }, ownKeys() { reads++; return []; } });
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  const symbol = { ...fresh(), [Symbol("PRIVATE_SYMBOL_CANARY")]: true };
  const hidden = { ...fresh() }; Object.defineProperty(hidden, "extra", { value: true });
  for (const row of [getter, versionGetter, statusGetter, { ...fresh(), counts }, { ...fresh(), events }, proxy,
    { ...fresh(), counts: proxy }, { ...fresh(), events: proxy }, { ...fresh(), events: revoked.proxy },
    Object.create(fresh()), symbol, hidden, { ...fresh(), events: new Array(1) }]) refused(() => validateAuthLocalLifecycle(row));
  assert.equal(reads, 0);
});

for (const status of ["passed", "failed", "timedout", "interrupted", "unknown"]) test("reporter projects only its own data status and never overrides FullResult: " + status, t => {
  const f = fixture(t), reporter = createAuthLocalLifecycleReporter(f.env);
  let reads = 0;
  const result = { status };
  for (const key of ["duration", "startTime", "error", "errors", "then", "PRIVATE_FIELD_CANARY"]) {
    Object.defineProperty(result, key, { enumerable: true, get() { reads++; throw new Error("PRIVATE_RESULT_CANARY"); } });
  }
  reporter.onBegin();
  assert.equal(reporter.onEnd(result), undefined);
  const row = read(f), bytes = readFileSync(f.sidecar);
  assert.equal(row.schemaVersion, 2); assert.equal(row.endStatus, status); assert.equal(row.phase, "ended");
  assert.ok(bytes.length <= AUTH_LOCAL_LIFECYCLE_MAX_BYTES);
  assert.equal(bytes.includes(Buffer.from("PRIVATE_RESULT_CANARY")), false);
  assert.equal(bytes.includes(Buffer.from("PRIVATE_FIELD_CANARY")), false);
  assert.equal(reporter.onEnd({ status: status === "passed" ? "failed" : "passed" }), undefined);
  assert.deepEqual(readFileSync(f.sidecar), bytes);
  assert.equal(reads, 0);
});

test("reporter maps unsafe, absent, inherited and unknown result status to unknown without traps", t => {
  let reads = 0;
  const getter = Object.defineProperty({}, "status", { get() { reads++; throw new Error("PRIVATE_STATUS_GETTER_CANARY"); } });
  const proxy = new Proxy({}, {
    get() { reads++; throw new Error("PRIVATE_RESULT_PROXY_CANARY"); },
    getOwnPropertyDescriptor() { reads++; throw new Error("PRIVATE_RESULT_PROXY_CANARY"); },
    getPrototypeOf() { reads++; throw new Error("PRIVATE_RESULT_PROXY_CANARY"); },
  });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const result of [undefined, null, "passed", () => {}, {}, getter, proxy, revoked.proxy,
    Object.create({ status: "passed" }), { status: "PRIVATE_STATUS_CANARY" }, { status: 0 }, { status: null }, { status: proxy }]) {
    const f = fixture(t), reporter = createAuthLocalLifecycleReporter(f.env);
    assert.equal(reporter.onEnd(result), undefined);
    const row = read(f), bytes = readFileSync(f.sidecar);
    assert.equal(row.endStatus, "unknown"); assert.deepEqual(row.events, ["end"]);
    for (const canary of ["PRIVATE_STATUS_GETTER_CANARY", "PRIVATE_RESULT_PROXY_CANARY", "PRIVATE_STATUS_CANARY"]) {
      assert.equal(bytes.includes(Buffer.from(canary)), false);
    }
  }
  assert.equal(reads, 0);
});

test("reporter import and construction are inert; onEnd writes one private nominal sidecar", async t => {
  const f = fixture(t), principal = "PRINCIPAL_PRIVATE_CANARY";
  writeFileSync(f.principal, principal, { mode: 0o600 });
  const url = new URL("../e2e-auth-local/auth-local-lifecycle-reporter.mjs", import.meta.url); url.search = "?inert-lifecycle";
  const imported = await import(url.href);
  assert.equal(typeof imported.default, "function"); assert.equal(typeof Reporter, "function");
  const reporter = createAuthLocalLifecycleReporter(f.env);
  assert.deepEqual(readdirSync(f.root), ["auth-local-ci-report.json"]);
  assert.equal(reporter.printsToStdio(), true, "Suppress the implicit terminal reporter without printing.");
  let reads = 0;
  const privateArgument = new Proxy({}, {
    get() { reads++; throw new Error("PRIVATE_ERROR_ARGUMENT_CANARY"); },
    ownKeys() { reads++; throw new Error("PRIVATE_ERROR_ARGUMENT_CANARY"); },
    getPrototypeOf() { reads++; throw new Error("PRIVATE_ERROR_ARGUMENT_CANARY"); },
  });
  reporter.onBegin(privateArgument, privateArgument);
  reporter.onTestBegin(privateArgument, privateArgument);
  reporter.onStdOut(privateArgument, privateArgument, privateArgument);
  reporter.onStdErr(privateArgument, privateArgument, privateArgument);
  reporter.onError(privateArgument, privateArgument);
  reporter.onTestEnd(privateArgument, privateArgument);
  assert.deepEqual(readdirSync(f.root), ["auth-local-ci-report.json"]);
  assert.equal(reporter.onEnd(privateArgument), undefined);
  assert.equal(reads, 0);
  const row = read(f);
  assert.equal(row.endStatus, "unknown");
  assert.deepEqual(row.events, ["begin", "test-begin", "error-seen", "test-end", "end"]);
  assert.equal(lstatSync(f.sidecar).mode & 0o7777, 0o600);
  assert.equal(lstatSync(f.sidecar).nlink, 1);
  assert.equal(lstatSync(f.root).mode & 0o7777, 0o700);
  const bytes = readFileSync(f.sidecar);
  assert.ok(bytes.length <= AUTH_LOCAL_LIFECYCLE_MAX_BYTES);
  for (const privateText of [principal, f.root, f.principal, "PRIVATE_ERROR_ARGUMENT_CANARY"]) assert.equal(bytes.includes(Buffer.from(privateText)), false);
  reporter.onError(privateArgument); reporter.onBegin(privateArgument); reporter.onEnd(privateArgument);
  assert.deepEqual(readFileSync(f.sidecar), bytes);
  assert.equal(readFileSync(f.principal, "utf8"), principal);
});

test("reporter writes zero-test global failure observations without inspecting the error", t => {
  const f = fixture(t), reporter = createAuthLocalLifecycleReporter(f.env);
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  reporter.onError(revoked.proxy); assert.equal(reporter.onEnd(revoked.proxy), undefined);
  const row = read(f);
  assert.deepEqual(row.events, ["error-seen", "end"]);
  assert.equal(row.counts.begin, 0); assert.equal(row.counts.testBegin, 0);
});

test("reporter snapshots only own environment data without invoking a supplied getter", t => {
  const f = fixture(t); let reads = 0;
  const env = { ...f.env };
  Object.defineProperty(env, "SC_AUTH_LOCAL_CI_REPORT_PATH", { enumerable: true, get() { reads++; return f.principal; } });
  const reporter = createAuthLocalLifecycleReporter(env);
  reporter.onBegin(); assert.equal(reporter.onEnd(), undefined);
  assert.equal(reads, 0); assert.deepEqual(readdirSync(f.root), []);
  const reporter2 = createAuthLocalLifecycleReporter(f.env);
  f.env.SC_AUTH_LOCAL_CI_REPORT_PATH = join(f.root, "redirected.json");
  reporter2.onEnd();
  assert.deepEqual(readdirSync(f.root), [AUTH_LOCAL_LIFECYCLE_FILE]);
});

for (const patch of [
  { CI: "false" }, { GITHUB_ACTIONS: "false" }, { SC_AUTH_LOCAL_CI_RUN: "0" },
  { SC_AUTH_LOCAL_CI_REPORT_PATH: "auth-local-ci-report.json" }, { RUNNER_TEMP: "relative" },
]) test("noncanonical environment cannot select diagnostic IO: " + Object.keys(patch).join(","), t => {
  const f = fixture(t), reporter = createAuthLocalLifecycleReporter({ ...f.env, ...patch });
  reporter.onBegin(); assert.equal(reporter.onEnd(), undefined);
  assert.deepEqual(readdirSync(f.root), []);
});

test("nominal filename, direct case parent and canonical paths are mandatory", t => {
  const f = fixture(t), wrong = join(f.temp, "not-a-case"); writeFileSync(wrong, "OUTSIDE_PRIVATE_CANARY");
  const nested = join(f.root, "sc-auth-local-ci-nested");
  const selections = [
    { ...f.env, SC_AUTH_LOCAL_CI_REPORT_PATH: join(f.root, "arbitrary.json") },
    { ...f.env, SC_AUTH_LOCAL_CI_REPORT_PATH: join(f.temp, "auth-local-ci-report.json") },
    { ...f.env, SC_AUTH_LOCAL_CI_REPORT_PATH: nested + "/../auth-local-ci-report.json" },
    { ...f.env, SC_AUTH_LOCAL_CI_REPORT_PATH: f.principal + "\u0000" },
    { ...f.env, RUNNER_TEMP: dirname(f.temp) },
  ];
  for (const env of selections) { const reporter = createAuthLocalLifecycleReporter(env); assert.equal(reporter.onEnd(), undefined); }
  assert.deepEqual(readdirSync(f.root), []);
  assert.equal(readFileSync(wrong, "utf8"), "OUTSIDE_PRIVATE_CANARY");
});

test("nonprivate directory and symbolic case root are refused without writes", t => {
  const f = fixture(t);
  chmodSync(f.root, 0o755);
  assert.equal(createAuthLocalLifecycleReporter(f.env).onEnd(), undefined);
  assert.deepEqual(readdirSync(f.root), []);
  chmodSync(f.root, 0o700);
  const alias = join(f.temp, "sc-auth-local-ci-alias");
  symlinkSync(f.root, alias, "dir");
  const reporter = createAuthLocalLifecycleReporter({ ...f.env, SC_AUTH_LOCAL_CI_REPORT_PATH: join(alias, "auth-local-ci-report.json") });
  assert.equal(reporter.onEnd(), undefined); assert.deepEqual(readdirSync(f.root), []);
});

for (const kind of ["regular", "symlink", "hardlink"]) test("exclusive sidecar cannot overwrite or follow an existing " + kind, t => {
  const f = fixture(t), target = join(f.temp, "outside-sentinel.json"), canary = "OUTSIDE_CONTENT_PRIVATE_CANARY";
  writeFileSync(target, canary, { mode: 0o600 });
  if (kind === "regular") writeFileSync(f.sidecar, canary, { mode: 0o600 });
  else if (kind === "symlink") symlinkSync(target, f.sidecar);
  else linkSync(target, f.sidecar);
  const reporter = createAuthLocalLifecycleReporter(f.env);
  reporter.onBegin(); assert.equal(reporter.onEnd(), undefined);
  assert.equal(readFileSync(target, "utf8"), canary); assert.equal(readFileSync(f.sidecar, "utf8"), canary);
});

test("reporter module has only the closed filesystem/path/util and passive-contract imports", async () => {
  const source = readFileSync(new URL("../e2e-auth-local/auth-local-lifecycle-reporter.mjs", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map(match => match[1]);
  assert.deepEqual(imports, ["node:fs", "node:path", "node:util", "./auth-local-lifecycle-contract.mjs"]);
  assert.equal(/\b(?:console|fetch|spawn|exec|setTimeout|setInterval)\s*[.(]/.test(source), false);
  assert.equal(source.includes("auth-local-ci.mjs"), false);
  const contract = readFileSync(new URL("../e2e-auth-local/auth-local-lifecycle-contract.mjs", import.meta.url), "utf8");
  assert.deepEqual([...contract.matchAll(/^import .* from "([^"]+)";$/gm)].map(match => match[1]), ["node:util"]);
});
