/** RAM-only fixture. No native browser, server, workflow or private file. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACTIVE_CLOSE_BINDING, runBrowserActiveCloseProbe, validateActiveCloseReport, validateActiveCloseEnvironment, settleActiveCloseCleanup, main } from "../../scripts/verification/browser-active-close-probe.mjs";
import { REDIRECT_COUNT_KEYS } from "../../scripts/verification/browser-redirect-drain-probe.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const protocol = (terminal, removed = false) => ({ identity: "exact-server-request", order: terminal ? "pause-before-terminal" : "no-terminal-observed", terminal: terminal ?? "not-observed", publicTerminal: terminal ?? "not-observed", managerEntry: terminal ? "absent" : "same-request", sessionRegistered: removed ? "removed" : "registered", fetchCommand: terminal ? "unavailable" : "continue", fetchOutcome: terminal ? "unavailable" : "resolved" });
const clean = () => ({ server: "close_observed", context: "close_observed", browser: "close_observed", session: "close_observed", socketsClosed: true, startupSettled: true, actionsSettled: true, handlersSettled: true });
function fixture(configs = []) {
  let at = 0, token = 0, current; const timers = new Map(), records = [];
  const advance = ms => { const end = at + ms; for (;;) { const entry = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!entry) break; timers.delete(entry[0]); at = entry[1].at; entry[1].callback(); } at = end; };
  const ports = {
    sourceSha: "f".repeat(40), now: () => at,
    schedule(callback, ms) { const id = ++token; timers.set(id, { callback, at: at + ms - (ms === 15000 && configs[records.length]?.early ? 1 : 0) }); return id; }, cancel: id => timers.delete(id),
    async pause(ms) { if (current.config.early && !current.early && at + ms >= current.start + 14999) { current.early = true; ms = current.start + 14999 - at; } advance(ms); },
    createCase(options) {
      const config = configs[records.length] ?? {}, row = { config, options, start: at, n: Object.fromEntries(REDIRECT_COUNT_KEYS.map(k => [k, 0])), p: protocol(), close: { requests: 0, events: 0, promise: "not-requested" }, actions: 0, closed: false, listener: true, snapshots: 0, closeCalls: 0, cleanupCalls: 0 }; records.push(row); current = row;
      const terminal = (removed = false) => { row.n.pendingRequests = 0; row.n.publicFinished = options.kind === "control" ? 1 : 0; row.n.publicFailed = options.kind === "control" ? 0 : 1; row.p = protocol(options.kind === "control" ? "finished" : "failed", removed); };
      return {
        async start() { advance(config.startMs ?? 0); },
        async trigger() { Object.assign(row.n, { requestsStarted: 1, targetRequests: 1, targetRouteCallbacks: 1, targetRouteAcks: 1, serverReceived: 1, pendingRequests: 1, socketsCreated: 1, socketsLive: 1, handlersStarted: 2, handlersSettled: 2 }); },
        armFence() {}, async releaseResponse() { row.n.responsesFinished = 1; if (!config.controlPending) terminal(); }, async stopLoading() {}, async blank() {},
        async closeSource() { if (!config.openSource) { row.closed = true; row.listener = false; row.n.socketsClosed = 1; row.n.socketsLive = 0; } if (config.beforeTerminal) terminal(); },
        closeContext() {
          row.closeCalls++; row.close.requests++; row.close.promise = "pending";
          if (config.hangClose) { advance(row.start + 15000 - at); return new Promise(() => {}); }
          advance(config.closeMs ?? 0); if (!config.noCloseEvent) row.close.events++;
          if (config.terminal) terminal(config.removed ?? true);
          if (config.publicOnly) { row.n.pendingRequests = 0; row.n.publicFailed = 1; row.p.publicTerminal = "failed"; }
          if (config.protocolUnavailable) row.p = Object.fromEntries(Object.keys(row.p).map(k => [k, "unavailable"]));
          if (config.managerAbsentOnly) { row.p.managerEntry = "absent"; row.p.sessionRegistered = "removed"; }
          if (config.rejectClose) { row.close.promise = "rejected"; const error = Object.assign(Error("PRIVATE_CANARY"), { code: "OWNED_CLOSE_UNCONFIRMED" }); return Promise.reject(error); }
          row.close.promise = "resolved"; return Promise.resolve();
        },
        sourceFacts: () => ({ closed: row.closed, listenerAlive: row.listener }),
        snapshot() { row.snapshots++; row.snapshotAt = at; config.onSnapshot?.(row, { advance, terminal }); return { counts: { ...row.n }, finalProtocol: { ...row.p }, close: { ...row.close }, actionsPending: row.actions }; },
        async cleanup() { row.cleanupCalls++; row.aborted = options.signal.aborted; advance(config.cleanupMs ?? 0); if (config.cleanupTerminal) { terminal(true); row.close.events = 1; row.close.promise = "resolved"; } return config.cleanupUnconfirmed ? { ...clean(), actionsSettled: false } : clean(); },
      };
    },
  };
  return { ports, records };
}

test("import/help is inert and malformed argv/environment getters are not invoked", async () => {
  let touched = 0; const env = new Proxy({}, { get() { touched++; throw Error("PRIVATE_CANARY"); } }), output = []; assert.equal(await main(["--help"], env, v => output.push(v)), 0); assert.equal(output[0].code, "NO_SERVICE_STARTED");
  const args = ["--help"]; Object.defineProperty(args, "0", { enumerable: true, get() { touched++; return "--execute"; } }); assert.equal(await main(args, env, v => output.push(v)), 1); assert.equal(output[1].code, "ARGUMENTS_REFUSED"); assert.equal(touched, 0);
});
test("environment reuses exact qualifiers only after refusing every unexpected key", () => {
  const env = { CI: "true", GITHUB_ACTIONS: "true", SC_BROWSER_ACTIVE_CLOSE_PROBE_RUN: "1", GITHUB_SHA: "a".repeat(40), PATH: "/usr/bin", HOME: "/public/home" }, runtime = { platform: "linux", arch: "x64", node: ACTIVE_CLOSE_BINDING.node }; assert.equal(validateActiveCloseEnvironment(env, runtime).TZ, "UTC");
  for (const extra of [{ GH_TOKEN: "PRIVATE_CANARY" }, { SUPABASE_SECRET_KEY: "PRIVATE_CANARY" }, { SC_BROWSER_REDIRECT_DRAIN_PROBE_RUN: "1" }, { NODE_OPTIONS: "--inspect" }]) assert.throws(() => validateActiveCloseEnvironment({ ...env, ...extra }, runtime));
  let touched = 0; const poison = { ...env }; Object.defineProperty(poison, "HOME", { enumerable: true, get() { touched++; return "/private"; } }); assert.throws(() => validateActiveCloseEnvironment(poison, runtime)); assert.equal(touched, 0); assert.throws(() => validateActiveCloseEnvironment(env, { ...runtime, node: "v25.0.0" }));
});
test("control and exact original terminals during active close qualify without retrospective pre-close zero", async () => {
  const f = fixture([{}, { terminal: true }]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.mode, "synthetic"); assert.equal(r.sourceSha, null); assert.equal(r.applicationAccepted, false); assert.equal(r.controlQualified, true); assert.deepEqual(r.cases.map(c => c.outcome), ["CONTROL_PASSED", "DRAINED"]);
  const c = r.cases[1]; assert.equal(c.ioZeroBeforeClose, false); assert.equal(c.beforeClose.counts.pendingRequests, 1); assert.equal(c.ioZeroAfterClose, true); assert.equal(c.final.counts.pendingRequests, 0); assert.equal(c.final.finalProtocol.terminal, "failed"); assert.equal(c.final.finalProtocol.sessionRegistered, "removed"); assert.deepEqual(c.final.close, { requests: 1, events: 1, promise: "resolved" }); assert.equal(f.records[1].closeCalls, 1); assert.equal(f.records.every(row => row.cleanupCalls === 1 && row.aborted), true);
});
test("close resolved and observed without original terminals remains INCONCLUSIVE at the original deadline", async () => {
  const r = await runBrowserActiveCloseProbe(fixture().ports), c = r.cases[1]; assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "ORIGINAL_READ_PENDING"); assert.equal(c.timing.decisionMs, 15000); assert.equal(c.ioZeroAfterClose, false); assert.equal(c.final.counts.pendingRequests, 1); assert.equal(c.final.finalProtocol.terminal, "not-observed"); assert.equal(c.final.close.promise, "resolved");
});
test("manager absence and session removal do not synthesize any terminal", async () => {
  const r = await runBrowserActiveCloseProbe(fixture([{}, { managerAbsentOnly: true }]).ports), c = r.cases[1]; assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.final.finalProtocol.managerEntry, "absent"); assert.equal(c.final.counts.pendingRequests, 1); assert.equal(c.final.finalProtocol.terminal, "not-observed");
});
test("public terminal without matching original CDP stays inconclusive", async () => {
  const r = await runBrowserActiveCloseProbe(fixture([{}, { publicOnly: true }]).ports), c = r.cases[1]; assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "PROTOCOL_UNAVAILABLE"); assert.equal(c.final.counts.pendingRequests, 0); assert.equal(c.final.finalProtocol.terminal, "not-observed"); assert.equal(c.final.finalProtocol.publicTerminal, "failed"); assert.equal(c.ioZeroAfterClose, false);
});
test("close promise resolution without its own event cannot qualify", async () => {
  const r = await runBrowserActiveCloseProbe(fixture([{}, { terminal: true, noCloseEvent: true }]).ports), c = r.cases[1]; assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "OWNED_CLOSE_UNCONFIRMED"); assert.equal(c.final.close.events, 0);
});
test("original terminal or close event may settle after the promise, but both are required", async () => {
  for (const delayed of ["terminal", "event"]) { const f = fixture([{}, { terminal: delayed === "event", noCloseEvent: delayed === "event", onSnapshot(row, { terminal }) { if (row.close.promise === "resolved" && !row.queued) { row.queued = true; queueMicrotask(() => { if (delayed === "terminal") terminal(true); else row.close.events++; }); } } }]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.cases[1].outcome, "DRAINED"); assert.equal(r.cases[1].ioZeroBeforeClose, false); assert.equal(r.cases[1].ioZeroAfterClose, true); }
});
test("repeated close events or requests cannot be deduplicated into a certificate", async () => {
  for (const key of ["requests", "events"]) { const f = fixture([{}, { terminal: true, onSnapshot(row) { if (row.close.requests) row.close[key] = 2; } }]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(r.cases[1].code, "TRANSPORT_REFUSED"); }
});
test("the original close promise may remain pending and is never retried", async () => {
  const f = fixture([{}, { hangClose: true }]), r = await runBrowserActiveCloseProbe(f.ports), c = r.cases[1]; assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "OWNED_CLOSE_UNCONFIRMED"); assert.equal(c.final.close.promise, "pending"); assert.equal(f.records[1].closeCalls, 1);
});
test("a rejected close cannot be certified by an earlier close event or terminal", async () => {
  const r = await runBrowserActiveCloseProbe(fixture([{}, { terminal: true, rejectClose: true }]).ports), c = r.cases[1]; assert.equal(c.outcome, "REFUSED"); assert.equal(c.code, "OWNED_CLOSE_UNCONFIRMED"); assert.equal(c.final.close.events, 1); assert.equal(c.final.close.promise, "rejected"); assert.equal(JSON.stringify(r).includes("PRIVATE_CANARY"), false);
});
test("an early 14999 timeout never produces DRAINED or a success-like PENDING", async () => {
  for (const config of [{ early: true }, { early: true, closeMs: 14999, terminal: true }]) { const r = await runBrowserActiveCloseProbe(fixture([{}, config]).ports), c = r.cases[1]; assert.equal(c.timing.decisionMs, 14999); assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "CASE_TIMEOUT"); }
});
test("startup and active close consume the same absolute deadline without renewal", async () => {
  const r = await runBrowserActiveCloseProbe(fixture([{}, { startMs: 4000, closeMs: 11000, terminal: true }]).ports), c = r.cases[1]; assert.equal(c.timing.readyMs, 4000); assert.equal(c.timing.closeRequestedMs, 4000); assert.equal(c.timing.decisionMs, 15000); assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "CASE_TIMEOUT");
});
test("clock rollback veto survives complete terminal and close counters", async () => {
  const f = fixture([{}, { terminal: true }]), original = f.ports.now; let reads = 0; f.ports.now = () => { const at = original(); return f.records.length === 2 && ++reads > 2 ? at - 1 : at; }; const r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(r.cases[1].code, "CLOCK_REFUSED");
});
test("source close without its original server/socket evidence prevents active close", async () => {
  const f = fixture([{}, { terminal: true, openSource: true }]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(f.records[1].closeCalls, 0); assert.equal(r.cases[1].sourceClosedBeforeDecision, false);
});
test("a read already complete before close does not attribute completion to the new factor", async () => {
  const f = fixture([{}, { beforeTerminal: true }]), r = await runBrowserActiveCloseProbe(f.ports), c = r.cases[1]; assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "ORIGINAL_TERMINALS_BEFORE_CLOSE"); assert.equal(c.ioZeroBeforeClose, true); assert.equal(c.final.close.requests, 0); assert.equal(f.records[1].closeCalls, 0);
});
test("veto queued from the pre-close snapshot prevents the close call", async () => {
  const f = fixture([{}, { terminal: true, onSnapshot(row) { if (row.closed && !row.queued) { row.queued = true; queueMicrotask(() => row.options.refuse("REQUEST_REFUSED")); } } }]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.cases[1].outcome, "REFUSED"); assert.equal(r.cases[1].code, "REQUEST_REFUSED"); assert.equal(f.records[1].closeCalls, 0);
});
test("late non-timeout refusal preserves the first timeout and never qualifies", async () => {
  const f = fixture([{}, { onSnapshot(row) { if (row.snapshotAt - row.start >= 15000 && !row.queued) { row.queued = true; queueMicrotask(() => row.options.refuse("TRANSPORT_REFUSED")); } } }]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.cases[1].outcome, "INCONCLUSIVE"); assert.equal(r.cases[1].code, "CASE_TIMEOUT");
});
test("handlers or actions introduced at the final checkpoint remain visible and veto qualification", async () => {
  for (const kind of ["handler", "action"]) { const f = fixture([{}, { terminal: true, onSnapshot(row) { if (row.close.requests && !row.queued) { row.queued = true; queueMicrotask(() => { if (kind === "handler") { row.n.handlersStarted++; row.n.handlersPending++; } else row.actions++; }); } } }]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.cases[1].outcome, "INCONCLUSIVE"); assert.equal(r.cases[1].ioZeroAfterClose, false); }
});
test("cleanup terminals and closed promise cannot rewrite the earlier active decision", async () => {
  const f = fixture([{}, { cleanupTerminal: true }]), r = await runBrowserActiveCloseProbe(f.ports), c = r.cases[1]; assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "ORIGINAL_READ_PENDING"); assert.equal(c.final.counts.pendingRequests, 1); assert.equal(c.beforeClose.counts.pendingRequests, 1); assert.equal(f.records[1].n.pendingRequests, 0);
});
test("control or cleanup failure prevents the candidate and cannot be hidden by later teardown", async () => {
  for (const config of [{ controlPending: true }, { cleanupUnconfirmed: true }]) { const f = fixture([config]), r = await runBrowserActiveCloseProbe(f.ports); assert.equal(r.controlQualified, false); assert.equal(r.cases[1].outcome, "NOT_RUN"); assert.equal(f.records.length, 1); }
});
test("cleanup has a separate five-second limit and cannot renew or rewrite the control decision", async () => {
  const r = await runBrowserActiveCloseProbe(fixture([{ cleanupMs: 5000 }]).ports); assert.equal(r.cases[0].outcome, "CONTROL_PASSED"); assert.equal(r.cases[0].timing.decisionMs, 0); assert.equal(r.cases[0].timing.cleanupMs, 5000); assert.equal(r.controlQualified, false); assert.equal(r.cases[1].outcome, "NOT_RUN");
});
test("native cleanup ownership waits the original context settlement before session/browser, while source may overlap", async () => {
  const calls = []; let resolveContext, resolveSource;
  const originalContext = new Promise(yes => { resolveContext = yes; }), originalSource = new Promise(yes => { resolveSource = yes; });
  const cleanup = settleActiveCloseCleanup({ source() { calls.push("source"); return originalSource; }, context() { calls.push("context"); return originalContext; }, session() { calls.push("session"); }, browser() { calls.push("browser"); } });
  await Promise.resolve(); assert.deepEqual(calls, ["source", "context"]); resolveContext(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  let settled = false; void cleanup.then(() => { settled = true; }); resolveSource(); assert.equal(await cleanup, true); assert.deepEqual(calls, ["source", "context", "session", "browser"]); await Promise.resolve(); assert.equal(settled, true);
});
test("cleanup rejection retains failure while attempting later owned cleanup, without a close retry", async () => {
  for (const failing of ["source", "context", "session", "browser"]) { const calls = [], ports = Object.fromEntries(["source", "context", "session", "browser"].map(key => [key, async () => { calls.push(key); if (key === failing) throw Error("PRIVATE_CANARY"); }])); assert.equal(await settleActiveCloseCleanup(ports), false); assert.deepEqual(calls, ["source", "context", "session", "browser"]); }
});
test("schema rejects forged zero, close certificates, widened data and time/identity inconsistencies", async () => {
  const base = await runBrowserActiveCloseProbe(fixture([{}, { terminal: true }]).ports);
  for (const mutate of [r => { r.applicationAccepted = true; }, r => { r.privateBody = "PRIVATE_CANARY"; }, r => { r.cases[1].ioZeroBeforeClose = true; }, r => { r.cases[1].beforeClose.finalProtocol.managerEntry = "absent"; }, r => { r.cases[1].beforeClose.close.requests = 1; r.cases[1].beforeClose.close.promise = "pending"; }, r => { r.cases[1].final.close.events = 0; }, r => { r.cases[1].final.close.promise = "pending"; }, r => { r.cases[1].final.finalProtocol.terminal = "not-observed"; }, r => { r.cases[1].final.finalProtocol.managerEntry = "same-request"; }, r => { r.cases[1].timing.decisionMs = 15000; }, r => { r.cases[1].timing.closeObservedMs = null; }, r => { r.cases[1].final.counts.pendingRequests = 1; }, r => { r.cases[1].cleanup.secret = "PRIVATE_CANARY"; }]) { const r = clone(base); mutate(r); assert.throws(() => validateActiveCloseReport(r)); }
});
test("closed report arrays reject accessors, sparse slots and proxies without invoking getters", async () => {
  const base = await runBrowserActiveCloseProbe(fixture().ports); let touched = 0;
  for (const mutate of [r => { delete r.cases[1]; }, r => { Object.defineProperty(r.cases, "1", { enumerable: true, get() { touched++; return base.cases[1]; } }); }, r => { r.cases = new Proxy(r.cases, { get() { touched++; throw Error("PRIVATE_CANARY"); } }); }]) { const r = clone(base); mutate(r); assert.throws(() => validateActiveCloseReport(r)); } assert.equal(touched, 0);
});
test("native source uses the shared ledger and one original close promise; workflow is manual and sterile", async () => {
  const source = await readFile(new URL("../../scripts/verification/browser-active-close-probe.mjs", import.meta.url), "utf8"), workflow = await readFile(new URL("../../.github/workflows/browser-active-close-probe.yml", import.meta.url), "utf8");
  assert.equal(source.includes("createRedirectRequestLedger(observer, fail)"), true); assert.equal(source.includes("Promise.prototype.then.call(closePromise"), true); assert.equal(source.includes('context.once("close"'), true); assert.equal(source.includes("response.arrayBuffer()"), true); assert.equal(source.includes("_requestIdToRequest.delete"), false); assert.equal(source.includes("Fetch.failRequest"), false); assert.equal(source.includes("setOffline(true)"), false); assert.equal(source.includes("unrouteAll"), false);
  assert.equal(workflow.includes("workflow_dispatch:"), true); assert.equal(/^\s+(push|pull_request):/m.test(workflow), false); assert.equal(workflow.includes("secrets."), false); assert.equal(workflow.includes("supabase"), false); assert.equal(workflow.includes("pg_restore"), false);
});
