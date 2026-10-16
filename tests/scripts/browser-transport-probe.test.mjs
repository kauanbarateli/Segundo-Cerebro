// RAM-only scheduling/lease fixtures. These tests do not open HTTP or Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { main, parseProbeArguments, validateProbeEnvironment, validateProbeReport, runBrowserTransportProbe, PROBE_LIMITS, PROBE_BINDING, PUBLIC_PINS } from "../../scripts/verification/browser-transport-probe.mjs";

const clean = () => ({ server: "close_observed", context: "close_observed", browser: "close_observed", session: "absent", socketsClosed: true, startupSettled: true });
const env = () => ({ PATH: "/usr/bin:/bin", HOME: "/home/runner", CI: "true", GITHUB_ACTIONS: "true", SC_BROWSER_TRANSPORT_PROBE_RUN: "1", GITHUB_SHA: "a".repeat(40) });
const runtime = () => ({ platform: "linux", arch: "x64", node: "v24.19.0" });
const clone = value => JSON.parse(JSON.stringify(value));
const refuses = (operation, code = "PROBE_UNAVAILABLE") => assert.throws(operation, error => error.code === code && error.message === code);
const COUNT_KEYS = ["requestsStarted", "routeAcks", "serverReceived", "responsesFinished", "socketsCreated", "socketsClosed", "socketsLive", "publicFinished", "publicFailed", "pendingRequests", "cdpFinished", "cdpFailed", "cdpNoTerminal", "managerSame", "managerAbsent", "sessionRegistered", "sessionRemoved", "protocolUnavailable", "unexpectedRequests", "downloads", "popups"];
function fixture(configurations = []) {
  let at = 0, nextId = 0, current = null;
  const timers = new Map(), records = [];
  const advance = ms => {
    const target = at + ms;
    while (true) {
      const due = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      timers.delete(due[0]); at = due[1].at; due[1].callback();
    }
    at = target;
  };
  const ports = {
    // A forged sourceSha is deliberately ignored for unbranded fixture ports.
    sourceSha: "f".repeat(40), now: () => at,
    schedule(callback, ms) { const id = ++nextId; timers.set(id, { at: at + ms, callback }); return id; },
    cancel(id) { timers.delete(id); },
    async pause(ms) { advance(ms); current?.config.onPause?.(current, { advance, now: () => at }); },
    createCase(options) {
      const config = configurations[records.length] ?? {}, n = options.resource === "control" ? 5 : options.resource === "held-fetch" ? 1 : 4;
      const record = { config, options, calls: [], state: Object.fromEntries(COUNT_KEYS.map(key => [key, 0])), createdAt: at, cleanupCalls: 0, startupSettled: false };
      current = record; records.push(record);
      const s = record.state, note = method => record.calls.push(method);
      const end = kind => { s.pendingRequests = 0; s[kind === "finished" ? "publicFinished" : "publicFailed"] = n; s.cdpNoTerminal = 0; s[kind === "finished" ? "cdpFinished" : "cdpFailed"] = n; s.managerSame = 0; s.managerAbsent = n; };
      record.end = end;
      return {
        snapshot() { if (config.snapshotError) throw new Error("PRIVATE_SYNTHETIC_ERROR"); return { ...s }; },
        async start(budget) { note("start"); record.initialBudget = budget(); try { advance(config.startMs ?? 0); if (config.startRefusal) { options.refuse(config.startRefusal); throw new Error("PRIVATE_SYNTHETIC_ERROR"); } if (config.startError) throw config.startError; } finally { record.startupSettled = true; } },
        async trigger() { note("trigger"); Object.assign(s, { requestsStarted: n, routeAcks: n, serverReceived: n, socketsCreated: n, socketsLive: n, pendingRequests: n, cdpNoTerminal: n, managerSame: n, sessionRegistered: n }); if (config.triggerRefusal) { options.refuse(config.triggerRefusal); throw new Error("PRIVATE_SYNTHETIC_ERROR"); } },
        async releaseResponses() { note("releaseResponses"); s.responsesFinished = n; end("finished"); if (config.controlMissingCDP) { s.cdpFinished = 0; s.cdpNoTerminal = n; } },
        async offline() { note("offline"); },
        async stopLoading() { note("stopLoading"); },
        async blank() { note("blank"); },
        async unroute() { note("unroute"); },
        async closeSource() { note("closeSource"); advance(config.closeMs ?? 0); if (!config.sourceLive) { s.socketsClosed = n; s.socketsLive = 0; } if (options.resource !== "control" && config.result !== "pending") end("failed"); },
        async cleanup() { note("cleanup"); record.cleanupCalls++; record.abortedAtCleanup = options.signal.aborted; if (config.cleanupMs) advance(config.cleanupMs); if (config.cleanupWorkMs) at += config.cleanupWorkMs; if (config.cleanupError) throw new Error("PRIVATE_CLEANUP_ERROR"); const facts = { ...clean(), startupSettled: record.startupSettled }; if (config.unclean) facts.browser = "unconfirmed"; return facts; },
      };
    },
  };
  return { ports, records, timers, advance, get now() { return at; } };
}

test("import and help remain inert with native IO ports forbidden", async () => {
  const original = { createServer: http.createServer, spawn: childProcess.spawn, readFile: fs.readFile, readdir: fs.readdir, lstat: fs.lstat, realpath: fs.realpath, fetch: globalThis.fetch };
  let attempts = 0;
  const forbidden = () => { attempts++; throw new Error("NATIVE_IO_FORBIDDEN"); };
  try {
    http.createServer = forbidden; childProcess.spawn = forbidden;
    for (const key of ["readFile", "readdir", "lstat", "realpath"]) fs[key] = forbidden;
    globalThis.fetch = forbidden; syncBuiltinESMExports();
    const inert = await import("../../scripts/verification/browser-transport-probe.mjs?inert-ram-case");
    const output = [], unreadEnv = new Proxy({}, { get: forbidden, ownKeys: forbidden });
    assert.equal(await inert.main(["--help"], unreadEnv, value => output.push(value)), 0);
    assert.deepEqual(output, [{ schemaVersion: 1, scenario: "browser-transport-probe", code: "NO_SERVICE_STARTED" }]);
    assert.equal(attempts, 0);
  } finally { http.createServer = original.createServer; childProcess.spawn = original.spawn; for (const key of ["readFile", "readdir", "lstat", "realpath"]) fs[key] = original[key]; globalThis.fetch = original.fetch; syncBuiltinESMExports(); }
});

test("native arguments and sterile runtime binding reject wider authority", async () => {
  assert.deepEqual(parseProbeArguments(["--execute", "--variants"]), { execute: true, variants: true });
  for (const args of [[], ["--variants"], ["--execute", "--execute"], ["--help", "--execute"], ["--execute", "--variants", "extra"], [1]]) refuses(() => parseProbeArguments(args), "ARGUMENTS_REFUSED");
  assert.deepEqual(validateProbeEnvironment(env(), runtime()), { PATH: "/usr/bin:/bin", HOME: "/home/runner", TZ: "UTC" });
  for (const key of ["TOKEN", "GH_TOKEN", "SUPABASE_URL", "GOOGLE_CLIENT_ID", "VERCEL_ENV", "PGHOST", "NODE_OPTIONS", "HTTPS_PROXY", "OTHER_API_KEY", "LD_PRELOAD"]) refuses(() => validateProbeEnvironment({ ...env(), [key]: "SYNTHETIC_PRIVATE" }, runtime()), "ENVIRONMENT_REFUSED");
  for (const [key, value] of [["node", "v24.18.0"], ["platform", "win32"], ["arch", "arm64"]]) refuses(() => validateProbeEnvironment(env(), { ...runtime(), [key]: value }), "ENVIRONMENT_REFUSED");
  for (const changed of [{ CI: "1" }, { GITHUB_ACTIONS: "false" }, { SC_BROWSER_TRANSPORT_PROBE_RUN: "0" }, { GITHUB_SHA: "HEAD" }, { HOME: "relative" }, { TMPDIR: "relative" }, { PATH: "" }]) refuses(() => validateProbeEnvironment({ ...env(), ...changed }, runtime()), "ENVIRONMENT_REFUSED");
  const output = [];
  assert.equal(await main(["--execute"], { ...env(), GH_TOKEN: "SYNTHETIC_PRIVATE" }, value => output.push(value)), 1);
  assert.equal(output[0].code, "ENVIRONMENT_REFUSED"); assert.equal(JSON.stringify(output).includes("SYNTHETIC_PRIVATE"), false);
});

test("natural control and two held cases use original public terminal observations", async () => {
  const f = fixture(), report = await runBrowserTransportProbe(f.ports);
  assert.equal(report.mode, "synthetic"); assert.equal(report.sourceSha, null); assert.equal(report.applicationAccepted, false);
  assert.equal(report.controlQualified, true); assert.deepEqual(report.cases.map(c => c.outcome), ["CONTROL_PASSED", "NOT_REPRODUCED", "NOT_REPRODUCED"]);
  assert.deepEqual(f.records[0].calls, ["start", "trigger", "releaseResponses", "closeSource", "cleanup"]);
  for (const record of f.records.slice(1)) assert.deepEqual(record.calls, ["start", "trigger", "offline", "stopLoading", "blank", "unroute", "closeSource", "cleanup"]);
  assert.equal(report.cases[1].counts.publicFailed, 1); assert.equal(report.cases[2].counts.publicFailed, 4);
  assert.equal(f.timers.size, 0); assert.equal(report.diagnosticOnly, true);
});

test("missing original CDP terminal vetoes control and every following case", async () => {
  const f = fixture([{ controlMissingCDP: true }]), report = await runBrowserTransportProbe(f.ports, { variants: true });
  assert.equal(report.controlQualified, false); assert.equal(report.cases[0].outcome, "INCONCLUSIVE"); assert.equal(report.cases[0].code, "CASE_TIMEOUT");
  assert.equal(report.cases[0].counts.publicFinished, 5); assert.equal(report.cases[0].counts.cdpNoTerminal, 5);
  assert.equal(report.cases.slice(1).every(c => c.outcome === "NOT_RUN"), true); assert.equal(f.records.length, 1);
});

test("source close or route ACK never fabricates a request terminal", async () => {
  const f = fixture([{}, { result: "pending" }, { result: "pending" }]), report = await runBrowserTransportProbe(f.ports);
  for (const c of report.cases.slice(1)) {
    assert.equal(c.outcome, "REPRODUCED"); assert.equal(c.code, "PENDING_AFTER_SOURCE_CLOSE");
    assert.equal(c.counts.pendingRequests, c.expectedRequests); assert.equal(c.counts.publicFinished + c.counts.publicFailed, 0);
    assert.equal(c.counts.managerSame, c.expectedRequests); assert.equal(c.counts.cdpNoTerminal, c.expectedRequests); assert.equal(c.counts.socketsLive, 0); assert.equal(c.timing.decisionMs, 15000);
  }
  assert.equal(f.records.length, 3); assert.equal(f.records.every(r => r.cleanupCalls === 1 && r.abortedAtCleanup), true);
});

test("startup spends the same absolute case budget without renewal", async () => {
  const f = fixture([{}, { result: "pending", startMs: 10000 }]), report = await runBrowserTransportProbe(f.ports);
  const c = report.cases[1]; assert.equal(c.outcome, "REPRODUCED"); assert.equal(c.timing.readyMs, 10000); assert.equal(c.timing.sourceClosedMs, 10000); assert.equal(c.timing.decisionMs, 15000);
  assert.equal(f.records[1].initialBudget, 15000); assert.equal(f.records[2].createdAt, 15000);
});

test("source closure at the deadline and live sockets cannot establish reproduction", async () => {
  const f = fixture([{}, { result: "pending", closeMs: 15000 }, { result: "pending", sourceLive: true }]), report = await runBrowserTransportProbe(f.ports);
  assert.deepEqual(report.cases.slice(1).map(c => c.outcome), ["INCONCLUSIVE", "INCONCLUSIVE"]);
  assert.equal(report.cases[1].timing.sourceClosedMs, null); assert.equal(report.cases[2].counts.socketsLive, 4);
});

test("late startup timeout still reaches its own lease cleanup", async () => {
  const f = fixture([{ startMs: 15000 }]), report = await runBrowserTransportProbe(f.ports);
  assert.equal(report.cases[0].outcome, "INCONCLUSIVE"); assert.equal(report.cases[0].code, "CASE_TIMEOUT");
  assert.deepEqual(f.records[0].calls, ["start", "cleanup"]); assert.equal(f.records[0].cleanupCalls, 1); assert.equal(f.records[0].abortedAtCleanup, true); assert.equal(f.records.length, 1);
});

test("a backwards clock refuses observation without renewing the deadline", async () => {
  const f = fixture([{}, { result: "pending", onPause(_record, clock) { clock.advance(-30); } }]), report = await runBrowserTransportProbe(f.ports);
  assert.equal(report.cases[1].outcome, "REFUSED"); assert.equal(report.cases[1].code, "CLOCK_REFUSED"); assert.equal(report.cases[1].timing.decisionMs, null);
  assert.equal(f.records[1].cleanupCalls, 1); assert.equal(f.records[1].abortedAtCleanup, true);
});

test("original refusal remains closed even when a later operation throws private text", async () => {
  const f = fixture([{ triggerRefusal: "REQUEST_REFUSED" }]), report = await runBrowserTransportProbe(f.ports);
  assert.equal(report.cases[0].code, "REQUEST_REFUSED"); assert.equal(report.cases[0].outcome, "REFUSED"); assert.equal(JSON.stringify(report).includes("PRIVATE"), false); assert.equal(f.records[0].cleanupCalls, 1);
  const g = fixture([{ startError: new Error("PRIVATE_SYNTHETIC_ERROR") }]), unknown = await runBrowserTransportProbe(g.ports);
  assert.equal(unknown.cases[0].code, "PROBE_UNAVAILABLE"); assert.equal(JSON.stringify(unknown).includes("PRIVATE"), false);
});

test("unconfirmed cleanup prevents another base case or variant", async () => {
  const f = fixture([{}, { result: "pending", unclean: true }]), report = await runBrowserTransportProbe(f.ports, { variants: true });
  assert.equal(report.cases[1].outcome, "REPRODUCED"); assert.equal(report.cases[1].cleanup.browser, "unconfirmed");
  assert.equal(report.cases.slice(2).every(c => c.outcome === "NOT_RUN" && c.code === "CLEANUP_REQUIRED"), true); assert.equal(f.records.length, 2);
});

test("cleanup rejection cannot turn a natural control into a qualified one", async () => {
  const f = fixture([{ cleanupError: true }]), report = await runBrowserTransportProbe(f.ports);
  assert.equal(report.controlQualified, false); assert.equal(report.cases[0].outcome, "INCONCLUSIVE"); assert.equal(report.cases[0].code, "CLEANUP_UNCONFIRMED");
  assert.equal(f.records.length, 1); assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
});

test("cleanup deadline is separate and never changes the frozen decision counts", async () => {
  const f = fixture([{}, { result: "pending", cleanupMs: 5000 }]), report = await runBrowserTransportProbe(f.ports);
  const c = report.cases[1]; assert.equal(c.outcome, "REPRODUCED"); assert.equal(c.timing.decisionMs, 15000); assert.equal(c.timing.cleanupMs, 5000); assert.equal(c.counts.pendingRequests, 1); assert.equal(c.cleanup.startupSettled, false); assert.equal(f.records.length, 2);
});

test("synchronous cleanup beyond the absolute budget is refused before the timer runs", async () => {
  const f = fixture([{ cleanupWorkMs: 5001 }]), report = await runBrowserTransportProbe(f.ports);
  assert.equal(report.controlQualified, false); assert.equal(report.cases[0].code, "CLEANUP_UNCONFIRMED");
  assert.equal(report.cases[0].timing.decisionMs, 0); assert.equal(report.cases[0].timing.cleanupMs, 5001); assert.equal(report.cases[0].cleanup.startupSettled, false); assert.equal(f.records.length, 1);
});

test("variants run once each only after the first reproduced base resource", async () => {
  const f = fixture([{}, {}, { result: "pending" }, {}, {}]), report = await runBrowserTransportProbe(f.ports, { variants: true });
  assert.equal(report.variantsExecuted, 2); assert.equal(f.records.length, 5);
  assert.deepEqual(report.cases.slice(3).map(c => [c.kind, c.resource, c.offline, c.fetchCommands]), [["variant-online", "held-scripts", false, true], ["variant-observer-off", "held-scripts", true, false]]);
  assert.equal(f.records[3].calls.includes("offline"), false); assert.equal(f.records[4].calls.includes("offline"), true);
  const g = fixture(), noRepro = await runBrowserTransportProbe(g.ports, { variants: true });
  assert.equal(g.records.length, 3); assert.equal(noRepro.variantsExecuted, 0); assert.equal(noRepro.cases.slice(3).every(c => c.outcome === "NOT_RUN"), true);
});

test("an unconfirmed first variant prevents the second with a cleanup reason", async () => {
  const f = fixture([{}, { result: "pending" }, {}, { unclean: true }]), report = await runBrowserTransportProbe(f.ports, { variants: true });
  assert.equal(report.variantsExecuted, 1); assert.equal(f.records.length, 4);
  assert.equal(report.cases[3].outcome, "INCONCLUSIVE"); assert.equal(report.cases[4].outcome, "NOT_RUN"); assert.equal(report.cases[4].code, "CLEANUP_REQUIRED");
});

test("options cannot invoke getters or brand synthetic ports as a native result", async () => {
  let reads = 0;
  const options = Object.defineProperty({}, "variants", { enumerable: true, get() { reads++; return true; } });
  await assert.rejects(runBrowserTransportProbe(fixture().ports, options), error => error.code === "ARGUMENTS_REFUSED");
  assert.equal(reads, 0); await assert.rejects(runBrowserTransportProbe(fixture().ports, null), error => error.code === "ARGUMENTS_REFUSED");
  const report = await runBrowserTransportProbe(fixture().ports); assert.equal(report.mode, "synthetic"); assert.equal(report.sourceSha, null);
});

test("closed report rejects terminal laundering, partial control and changed experiment factors", async () => {
  const report = await runBrowserTransportProbe(fixture().ports);
  const mutations = [
    r => { r.applicationAccepted = true; }, r => { r.sourceSha = "a".repeat(40); },
    r => { r.cases[0].counts.cdpFinished = 4; r.cases[0].counts.cdpNoTerminal = 1; },
    r => { r.cases[0].counts.publicFailed = 1; r.cases[0].counts.publicFinished = 4; },
    r => { r.cases[0].counts.managerSame = 1; r.cases[0].counts.managerAbsent = 4; },
    r => { r.cases[1].offline = false; }, r => { r.cases[1].fetchCommands = false; },
    r => { r.cases[1].counts.pendingRequests = 1; }, r => { r.cases[1].counts.socketsLive = 1; },
    r => { r.cases[1].timing.sourceClosedMs = 15000; }, r => { r.cases[1].counts.extra = "PRIVATE"; },
    r => { r.cases[0].cleanup.server = true; }, r => { r.cases[2] = r.cases[1]; },
    r => { r.variantsRequested = true; }, r => { r.cases[1].timing.readyMs = 15001; },
  ];
  for (const mutate of mutations) { const changed = clone(report); mutate(changed); refuses(() => validateProbeReport(changed)); }
  const repro = await runBrowserTransportProbe(fixture([{}, { result: "pending" }]).ports);
  for (const mutate of [r => { r.cases[1].timing.decisionMs = 14999; }, r => { r.cases[1].timing.sourceClosedMs = null; }, r => { r.cases[1].code = "NATURAL_TERMINALS"; }]) { const changed = clone(repro); mutate(changed); refuses(() => validateProbeReport(changed)); }
});

test("descriptor-only closed report rejects accessors, sparse arrays and private fields without reading them", async () => {
  const report = await runBrowserTransportProbe(fixture().ports); let reads = 0;
  const field = clone(report); Object.defineProperty(field.cases[1].counts, "pendingRequests", { enumerable: true, get() { reads++; throw new Error("PRIVATE"); } }); refuses(() => validateProbeReport(field));
  const array = clone(report); Object.defineProperty(array.cases, "1", { enumerable: true, get() { reads++; throw new Error("PRIVATE"); } }); refuses(() => validateProbeReport(array));
  const sparse = clone(report); delete sparse.cases[1]; refuses(() => validateProbeReport(sparse));
  const extra = clone(report); extra.cases.privateUrl = "PRIVATE"; refuses(() => validateProbeReport(extra));
  assert.equal(reads, 0); assert.ok(Buffer.byteLength(JSON.stringify(report)) <= PROBE_LIMITS.reportBytes);
});

test("public producer and observer are pinned without an archive, credential or app dependency", () => {
  assert.equal(PROBE_BINDING.node, "v24.19.0"); assert.equal(PROBE_BINDING.playwright, "1.63.0"); assert.equal(PROBE_BINDING.chromium, "153.0.8010.12"); assert.equal(PROBE_BINDING.revision, "1243");
  assert.deepEqual(PUBLIC_PINS.map(([path]) => path), ["node_modules/playwright-core/package.json", "node_modules/playwright-core/browsers.json", "node_modules/playwright-core/lib/coreBundle.js", "tests/e2e-auth-local/admin-browser-support.mjs"]);
  assert.equal(PUBLIC_PINS.every(entry => Object.isFrozen(entry) && entry[1] > 0 && /^[a-f0-9]{64}$/.test(entry[2])), true); assert.equal(Object.isFrozen(PUBLIC_PINS), true);
  assert.equal(PROBE_LIMITS.caseMs, 15000); assert.equal(PROBE_LIMITS.cleanupMs, 5000); assert.equal(PROBE_LIMITS.maxCases, 5);
});
