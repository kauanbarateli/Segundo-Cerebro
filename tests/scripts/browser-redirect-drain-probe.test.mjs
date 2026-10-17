/** No browser, HTTP listener, workflow, database, credentials or private file. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runBrowserRedirectDrainProbe, validateRedirectDrainReport, validateRedirectProbeEnvironment, createRedirectRequestLedger, REDIRECT_COUNT_KEYS, REDIRECT_PROBE_BINDING, main } from "../../scripts/verification/browser-redirect-drain-probe.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const proto = terminal => ({ identity: "exact-server-request", order: terminal ? "pause-before-terminal" : "no-terminal-observed", terminal: terminal ?? "not-observed", publicTerminal: terminal ?? "not-observed", managerEntry: terminal ? "absent" : "same-request", sessionRegistered: "registered", fetchCommand: "continue", fetchOutcome: "resolved" });
const clean = () => ({ server: "close_observed", context: "close_observed", browser: "close_observed", session: "close_observed", socketsClosed: true, startupSettled: true, handlersSettled: true });
function fixture(configs = []) {
  let at = 0, id = 0, current; const timers = new Map(), records = [];
  const advance = ms => { const end = at + ms; for (;;) { const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); at = next[1].at; next[1].callback(); } at = end; };
  const ports = {
    sourceSha: "f".repeat(40), now: () => at,
    schedule(callback, ms) { const token = ++id, early = ms === 15000 && configs[records.length]?.early; timers.set(token, { at: at + ms - (early ? 1 : 0), callback }); return token; },
    cancel(token) { timers.delete(token); },
    async pause(ms) { if (current.config.early && !current.early && at + ms >= current.start + 14999) { current.early = true; ms = current.start + 14999 - at; } advance(ms); },
    createCase(options) {
      const config = configs[records.length] ?? {}, r = { config, start: at, options, n: Object.fromEntries(REDIRECT_COUNT_KEYS.map(k => [k, 0])), p: proto(), closed: false, listener: true, cleanupCalls: 0, sourceCalls: 0, snapshots: 0 }; records.push(r); current = r;
      const terminal = () => { r.n.publicFinished = options.kind === "control" ? 1 : options.kind === "redirect" ? 1 : 0; r.n.publicFailed = options.kind === "control" ? 0 : 1; r.n.pendingRequests = 0; r.p = proto(options.kind === "control" ? "finished" : "failed"); };
      return {
        async start() { advance(config.startMs ?? 0); },
        async trigger() { const red = options.kind === "redirect"; Object.assign(r.n, { requestsStarted: red ? 2 : 1, targetRequests: 1, redirectRoots: red ? 1 : 0, redirectLinks: red ? 1 : 0, redirectReceived: red ? 1 : 0, redirectResponsesFinished: red ? 1 : 0, rootRouteCallbacks: red ? 1 : 0, rootRouteAcks: red ? 1 : 0, targetRouteCallbacks: red ? 0 : 1, targetRouteAcks: red ? 0 : 1, serverReceived: 1, publicFinished: red ? 1 : 0, pendingRequests: 1, socketsCreated: 1, socketsLive: 1, handlersStarted: 1, handlersSettled: 1 }); if (config.unknown) r.n.unknownRequests = 1; },
        armFence() {},
        async releaseResponse() { r.n.responsesFinished = 1; terminal(); },
        async stopLoading() { if (config.refuse) options.refuse("TRANSPORT_REFUSED"); },
        async blank() {},
        async closeSource() { r.sourceCalls++; if (!config.openSource) { r.closed = true; r.listener = false; r.n.socketsLive = 0; r.n.socketsClosed = 1; } if (config.drained) terminal(); if (config.protocolUnavailable) r.p = Object.fromEntries(Object.keys(proto()).map(k => [k, "unavailable"])); },
        sourceFacts() { return { closed: r.closed, listenerAlive: r.listener }; },
        snapshot() { r.snapshots++; r.snapshotAt = at; config.onSnapshot?.(r, { terminal, advance }); return { counts: { ...r.n }, finalProtocol: { ...r.p } }; },
        async cleanup() { r.cleanupCalls++; r.abortedAtCleanup = options.signal.aborted; if (config.cleanupTerminal) terminal(); return config.cleanupUnconfirmed ? { ...clean(), handlersSettled: false } : clean(); },
      };
    },
  };
  return { ports, records };
}

test("import/help are inert even with a hostile environment", async () => {
  let touched = 0; const poison = new Proxy({}, { get() { touched++; throw Error("PRIVATE_CANARY"); } }), output = [];
  assert.equal(await main(["--help"], poison, v => output.push(v)), 0); assert.equal(touched, 0); assert.equal(output[0].code, "NO_SERVICE_STARTED"); assert.equal(output[0].applicationAccepted, false);
});
test("malformed arguments never invoke getters or inspect the environment", async () => {
  let invoked = 0; const argv = ["--help"], environment = new Proxy({}, { get() { invoked++; throw Error("PRIVATE_CANARY"); } }), output = []; Object.defineProperty(argv, "0", { enumerable: true, get() { invoked++; return "--execute"; } });
  assert.equal(await main(argv, environment, value => output.push(value)), 1); assert.equal(invoked, 0); assert.equal(output[0].code, "ARGUMENTS_REFUSED"); assert.equal(JSON.stringify(output).includes("PRIVATE_CANARY"), false);
});
test("runtime and sterile environment are exact and reject credential scope", () => {
  const env = { CI: "true", GITHUB_ACTIONS: "true", SC_BROWSER_REDIRECT_DRAIN_PROBE_RUN: "1", GITHUB_SHA: "a".repeat(40), PATH: "/usr/bin", HOME: "/public/home" }, runtime = { platform: "linux", arch: "x64", node: REDIRECT_PROBE_BINDING.node };
  assert.equal(validateRedirectProbeEnvironment(env, runtime).TZ, "UTC");
  for (const extra of [{ GH_TOKEN: "PRIVATE_CANARY" }, { SUPABASE_SECRET_KEY: "PRIVATE_CANARY" }, { NODE_OPTIONS: "--inspect" }, { HOME: "relative" }]) assert.throws(() => validateRedirectProbeEnvironment({ ...env, ...extra }, runtime));
  assert.throws(() => validateRedirectProbeEnvironment(env, { ...runtime, node: "v25.0.0" }));
});
test("control is finite, direct/redirect share source closure, and injected ports remain synthetic", async () => {
  const f = fixture([{}, { drained: true }, { drained: true }]), r = await runBrowserRedirectDrainProbe(f.ports);
  assert.equal(r.mode, "synthetic"); assert.equal(r.sourceSha, null); assert.equal(r.applicationAccepted, false); assert.equal(r.controlQualified, true);
  assert.deepEqual(r.cases.map(c => c.outcome), ["CONTROL_PASSED", "DRAINED", "DRAINED"]);
  assert.equal(r.cases.every(c => c.sourceClosedBeforeDecision && !c.sourceListenerAlive && c.counts.socketsLive === 0), true);
  assert.equal(f.records.every(row => row.sourceCalls === 1 && row.cleanupCalls === 1 && row.abortedAtCleanup), true);
});
test("unchanged absolute deadline permits PENDING only with exact original public/CDP counters", async () => {
  const f = fixture(), r = await runBrowserRedirectDrainProbe(f.ports);
  for (const c of r.cases.slice(1)) { assert.equal(c.outcome, "PENDING"); assert.equal(c.code, "ORIGINAL_PENDING_AT_DEADLINE"); assert.equal(c.timing.decisionMs, 15000); assert.equal(c.counts.pendingRequests, 1); assert.equal(c.finalProtocol.terminal, "not-observed"); }
});
test("early timer at 14999 cannot become PENDING in either candidate", async () => {
  for (const index of [1, 2]) { const configs = [{}, { drained: true }, { drained: true }]; configs[index] = { early: true }; const r = await runBrowserRedirectDrainProbe(fixture(configs).ports), c = r.cases[index]; assert.equal(c.timing.decisionMs, 14999); assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "CASE_TIMEOUT"); assert.equal(c.counts.pendingRequests, 1); }
});
test("startup consumes the same 15000ms and receives no renewed drain budget", async () => {
  const r = await runBrowserRedirectDrainProbe(fixture([{}, { startMs: 4000 }, {}]).ports); assert.equal(r.cases[1].timing.readyMs, 4000); assert.equal(r.cases[1].timing.decisionMs, 15000);
});
test("clock rollback vetoes a candidate rather than manufacturing elapsed time", async () => {
  const f = fixture([{}, { drained: true }, {}]); const original = f.ports.now; let reads = 0; f.ports.now = () => { const at = original(); return f.records.length === 2 && ++reads > 2 ? at - 1 : at; }; const r = await runBrowserRedirectDrainProbe(f.ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(r.cases[1].code, "CLOCK_REFUSED");
});
test("source close request without original close/socket proof cannot certify drain", async () => {
  const r = await runBrowserRedirectDrainProbe(fixture([{}, { drained: true, openSource: true }, {}]).ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(r.cases[1].code, "TRANSPORT_REFUSED"); assert.equal(r.cases[1].sourceClosedBeforeDecision, false);
});
test("ambiguous or unavailable CDP after source closure stays inconclusive", async () => {
  const r = await runBrowserRedirectDrainProbe(fixture([{}, { drained: true }, { drained: true, protocolUnavailable: true }]).ports); assert.equal(r.cases[2].outcome, "INCONCLUSIVE"); assert.equal(r.cases[2].code, "PROTOCOL_UNAVAILABLE"); assert.equal(r.cases[2].counts.pendingRequests, 0); assert.equal(r.cases[2].finalProtocol.identity, "unavailable");
});
test("cleanup terminals never replace the earlier sealed pending observation", async () => {
  const f = fixture([{}, { cleanupTerminal: true }, { drained: true }]), r = await runBrowserRedirectDrainProbe(f.ports); assert.equal(r.cases[1].outcome, "PENDING"); assert.equal(r.cases[1].counts.pendingRequests, 1); assert.equal(f.records[1].n.pendingRequests, 0); assert.equal(r.cases[1].finalProtocol.terminal, "not-observed");
});
test("unconfirmed cleanup blocks the following candidate and cannot qualify the control", async () => {
  const r = await runBrowserRedirectDrainProbe(fixture([{ cleanupUnconfirmed: true }]).ports); assert.equal(r.controlQualified, false); assert.equal(r.cases[1].outcome, "NOT_RUN");
  const later = await runBrowserRedirectDrainProbe(fixture([{}, { drained: true, cleanupUnconfirmed: true }]).ports); assert.equal(later.cases[2].outcome, "NOT_RUN"); assert.equal(later.cases[2].code, "CLEANUP_REQUIRED");
});
test("first refusal survives apparent terminal counters and source completion", async () => {
  const r = await runBrowserRedirectDrainProbe(fixture([{}, { drained: true, refuse: true }, {}]).ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(r.cases[1].code, "TRANSPORT_REFUSED");
});
test("snapshot microtask veto is checked before final decision", async () => {
  const f = fixture([{}, { drained: true, onSnapshot(r) { if (r.closed && !r.vetoSent) { r.vetoSent = true; queueMicrotask(() => r.options.refuse("REQUEST_REFUSED")); } } }, {}]); const r = await runBrowserRedirectDrainProbe(f.ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(r.cases[1].code, "REQUEST_REFUSED");
});
test("non-timeout veto after the deadline preserves first error but prevents PENDING", async () => {
  const f = fixture([{}, { onSnapshot(r) { if (r.snapshotAt - r.start >= 15000 && !r.vetoSent) { r.vetoSent = true; queueMicrotask(() => r.options.refuse("TRANSPORT_REFUSED")); } } }, { drained: true }]); const r = await runBrowserRedirectDrainProbe(f.ports); assert.equal(r.cases[1].timing.decisionMs, 15000); assert.equal(r.cases[1].outcome, "INCONCLUSIVE"); assert.equal(r.cases[1].code, "CASE_TIMEOUT");
});
test("handlers introduced at snapshot checkpoints remain in the sealed counts", async () => {
  const f = fixture([{}, { drained: true, onSnapshot(r) { if (r.closed && !r.handlerQueued) { r.handlerQueued = true; queueMicrotask(() => { r.n.handlersStarted++; r.n.handlersPending++; }); } } }, {}]); const r = await runBrowserRedirectDrainProbe(f.ports); assert.equal(r.cases[1].outcome, "INCONCLUSIVE"); assert.equal(r.cases[1].counts.handlersPending, 1);
});
test("report schema refuses forged time/source/lineage/terminals and additional data", async () => {
  const original = await runBrowserRedirectDrainProbe(fixture().ports);
  for (const mutate of [r => { r.applicationAccepted = true; }, r => { r.privateBody = "PRIVATE_CANARY"; }, r => { r.cases[1].timing.decisionMs = 14999; }, r => { r.cases[1].sourceClosedBeforeDecision = false; }, r => { r.cases[2].counts.redirectLinks = 0; }, r => { r.cases[1].counts.targetRouteAcks = 0; }, r => { r.cases[2].counts.rootRouteAcks = 0; }, r => { r.cases[1].timing.fenceMs = 1; r.cases[1].timing.sourceClosedMs = 0; }, r => { r.cases[1].finalProtocol.terminal = "finished"; }, r => { r.cases[1].counts.pendingRequests = 0; }, r => { r.cases[1].cleanup.secret = "PRIVATE_CANARY"; }]) { const r = clone(original); mutate(r); assert.throws(() => validateRedirectDrainReport(r)); }
});
test("report arrays reject accessors, holes, proxies and added properties without invoking them", async () => {
  const original = await runBrowserRedirectDrainProbe(fixture().ports); let invoked = 0;
  for (const mutate of [r => { delete r.cases[1]; }, r => { r.cases.extra = "PRIVATE_CANARY"; }, r => { Object.defineProperty(r.cases, "1", { enumerable: true, get() { invoked++; return original.cases[1]; } }); }, r => { r.cases = new Proxy(r.cases, { get() { invoked++; throw Error("PRIVATE_CANARY"); } }); }]) { const r = clone(original); mutate(r); assert.throws(() => validateRedirectDrainReport(r)); }
  assert.equal(invoked, 0);
});
test("ledger records original linked Request objects and permits absent final route callback after redirect", () => {
  const captured = [], terminals = [], refusals = [], observer = { request: r => captured.push(r), terminal: (r, kind) => terminals.push([r, kind]), snapshot: rows => { assert.equal(rows[0], target); return proto(); } };
  const root = { redirectedFrom: () => null, redirectedTo: () => target }, target = { redirectedFrom: () => root, redirectedTo: () => null };
  const l = createRedirectRequestLedger(observer, c => refusals.push(c)); l.begin(root, {}, "root"); l.route(root, false); l.route(root, true); l.terminal(root, "finished"); l.begin(target, {}, "target");
  const s = l.snapshot(); assert.equal(s.counts.redirectLinks, 1); assert.equal(s.counts.requestsStarted, 2); assert.equal(s.counts.targetRouteCallbacks, 0); assert.equal(s.counts.pendingRequests, 1); assert.deepEqual(captured, [root, target]); assert.deepEqual(terminals, [[root, "finished"]]); assert.deepEqual(refusals, []);
});
test("ledger refuses substituted lineage, repeated callbacks/terminals and never deduplicates", () => {
  for (const operation of ["lineage", "route", "terminal", "duplicate"]) {
    const refusals = [], observer = { request() {}, terminal() {}, snapshot: () => proto() }, root = { redirectedFrom: () => null, redirectedTo: () => null }, target = { redirectedFrom: () => ({}), redirectedTo: () => null }, l = createRedirectRequestLedger(observer, c => refusals.push(c));
    // Operations below use the exact local objects; no URL/time identity seam.
    l.begin(root, {}, "root");
    if (operation === "lineage") l.begin(target, {}, "target"); else if (operation === "route") { l.route(root, false); l.route(root, false); } else if (operation === "terminal") { l.terminal(root, "finished"); l.terminal(root, "finished"); } else l.begin(root, {}, "root");
    assert.equal(refusals.length > 0, true); assert.equal(l.snapshot().counts.lineageAmbiguous > 0, true);
  }
});
test("source/workflow remain public GET-only/manual and consume finite fetch bodies", async () => {
  const source = await readFile(new URL("../../scripts/verification/browser-redirect-drain-probe.mjs", import.meta.url), "utf8"), workflow = await readFile(new URL("../../.github/workflows/browser-redirect-drain-probe.yml", import.meta.url), "utf8");
  assert.equal(source.includes('request.method() === "GET"'), true); assert.equal(source.includes("response.arrayBuffer()"), true); assert.equal(source.includes("response.writeHead(303"), true); assert.equal(source.includes("_requestIdToRequest.delete"), false);
  assert.equal(workflow.includes("workflow_dispatch:"), true); assert.equal(/^\s+(push|pull_request):/m.test(workflow), false); assert.equal(workflow.includes("secrets."), false); assert.equal(workflow.includes("supabase"), false); assert.equal(workflow.includes("pg_restore"), false);
});
