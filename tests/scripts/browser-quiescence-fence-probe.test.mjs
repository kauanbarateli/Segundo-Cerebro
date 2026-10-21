// RAM-only ports. This suite does not launch Chromium, HTTP, Next or Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { Script } from "node:vm";
import ts from "typescript";
import { main, parseFenceProbeArguments, validateFenceProbeEnvironment, validateFenceProbeReport, runBrowserQuiescenceFenceProbe, createQuiescenceFence, createOriginalRequestLedger, FENCE_PROBE_LIMITS, FENCE_PROBE_BINDING, FENCE_PUBLIC_PINS } from "../../scripts/verification/browser-quiescence-fence-probe.mjs";

const COUNT_KEYS = ["requestsStarted", "routeAcks", "serverReceived", "responsesFinished", "socketsCreated", "socketsClosed", "socketsLive", "publicFinished", "publicFailed", "pendingRequests", "cdpFinished", "cdpFailed", "cdpNoTerminal", "managerSame", "managerAbsent", "sessionRegistered", "sessionRemoved", "protocolUnavailable", "handlersStarted", "handlersSettled", "handlersPending", "fenceReadAborts", "fenceAbortAcks", "unknownRequests", "downloads", "popups"];
const clean = () => ({ server: "close_observed", context: "close_observed", browser: "close_observed", session: "close_observed", socketsClosed: true, startupSettled: true, handlersSettled: true });
const env = () => ({ PATH: "/usr/bin:/bin", HOME: "/home/runner", CI: "true", GITHUB_ACTIONS: "true", SC_BROWSER_QUIESCENCE_FENCE_PROBE_RUN: "1", GITHUB_SHA: "a".repeat(40) });
const runtime = () => ({ platform: "linux", arch: "x64", node: "v24.19.0" });
const clone = value => JSON.parse(JSON.stringify(value));
const refuses = (operation, code = "FENCE_PROBE_UNAVAILABLE") => assert.throws(operation, error => error.code === code && error.message === code);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

function fixture(configurations = []) {
  let at = 0, nextId = 0, current;
  const timers = new Map(), records = [];
  const advance = ms => {
    const target = at + ms;
    while (true) {
      const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      timers.delete(due[0]); at = due[1].at; due[1].callback();
    }
    at = target;
  };
  const ports = {
    sourceSha: "f".repeat(40), now: () => at,
    schedule(callback, ms) { const id = ++nextId, early = ms === FENCE_PROBE_LIMITS.caseMs && configurations[records.length]?.earlyDeadline === true; timers.set(id, { at: at + ms - (early ? 1 : 0), callback }); return id; },
    cancel(id) { timers.delete(id); },
    async pause(ms) {
      if (current?.config.earlyDeadline && !current.earlyPause && at + ms >= current.createdAt + FENCE_PROBE_LIMITS.caseMs - 1) {
        current.earlyPause = true; ms = current.createdAt + FENCE_PROBE_LIMITS.caseMs - 1 - at;
      }
      advance(ms); current?.config.onPause?.(current, { advance, now: () => at });
    },
    createCase(options) {
      const config = configurations[records.length] ?? {}, record = { config, options, calls: [], counts: Object.fromEntries(COUNT_KEYS.map(key => [key, 0])), source: { closed: false, listenerAlive: false }, createdAt: at, cleanupCalls: 0 };
      current = record; records.push(record);
      const n = record.counts, note = name => record.calls.push(name);
      const end = kind => { n.pendingRequests = 0; n[kind === "finished" ? "publicFinished" : "publicFailed"] = 1; n.cdpNoTerminal = 0; n[kind === "finished" ? "cdpFinished" : "cdpFailed"] = 1; n.managerSame = 0; n.managerAbsent = 1; };
      record.end = end;
      return {
        snapshot() {
          if (config.snapshotError) throw new Error("PRIVATE_SNAPSHOT_CANARY");
          if (n.publicFinished + n.publicFailed === 1) {
            record.terminalSnapshots = (record.terminalSnapshots ?? 0) + 1;
            const inject = config.snapshotRefusal === "drain-microtask" && record.terminalSnapshots === 1 || ["final-sync", "final-microtask"].includes(config.snapshotRefusal) && record.terminalSnapshots === 2;
            if (inject) {
              const fire = () => options.refuse("TRANSPORT_REFUSED");
              if (config.snapshotRefusal === "final-sync") fire(); else queueMicrotask(fire);
            }
            if (record.terminalSnapshots === 2 && config.startHandlerInFinalMicrotask) queueMicrotask(() => {
              record.lateAck = deferred();
              record.lateFence = createQuiescenceFence({ allowed: () => true, readCancellation: () => true, onRefusal: options.refuse });
              record.lateFence.arm();
              record.lateHandler = record.lateFence.handle({ request: () => request("GET", "/known-read"), abort: () => record.lateAck.promise, continue() { throw new Error("LATE_CONTINUE_FORBIDDEN"); } });
            });
            if (record.terminalSnapshots === 2 && config.loseListenerInFinalMicrotask) queueMicrotask(() => { record.source.listenerAlive = false; });
          }
          const value = { ...n }, late = record.lateFence?.snapshot();
          if (late) { value.handlersStarted += late.handlersStarted; value.handlersSettled += late.handlersSettled; value.handlersPending += late.handlersPending; value.fenceReadAborts += late.readsAborted; value.fenceAbortAcks += late.abortAcks; value.unknownRequests += late.unknownRequests; }
          return value;
        },
        sourceFacts() { return { ...record.source }; },
        async start(budget) { note("start"); record.initialBudget = budget(); advance(config.startMs ?? 0); record.source.listenerAlive = config.listenerAlive !== false; if (config.startError) throw config.startError; },
        async trigger() { note("trigger"); Object.assign(n, { requestsStarted: 1, routeAcks: 1, serverReceived: 1, socketsCreated: 1, socketsLive: 1, pendingRequests: 1, cdpNoTerminal: 1, managerSame: 1, sessionRegistered: 1, handlersStarted: 2, handlersSettled: 2 }); if (config.triggerRefusal) options.refuse(config.triggerRefusal); },
        armFence() { note("armFence"); },
        async releaseResponse() { note("releaseResponse"); n.responsesFinished = 1; end("finished"); if (config.controlMissingCDP) { n.cdpFinished = 0; n.cdpNoTerminal = 1; } },
        async stopLoading() { note("stopLoading"); },
        async blank() { note("blank"); if (config.result !== "pending") end("failed"); if (config.publicOnly) { n.cdpFailed = 0; n.cdpNoTerminal = 1; } if (config.lateUnknown) { n.unknownRequests = 1; options.refuse("REQUEST_REFUSED"); } if (config.handlersPending) { n.handlersStarted++; n.handlersPending++; } },
        async unroute() { note("unroute"); },
        async closeSource() { note("closeSource"); advance(config.closeMs ?? 0); if (config.closeNotObserved) return; record.source.closed = true; record.source.listenerAlive = false; n.socketsClosed = n.socketsCreated; n.socketsLive = 0; },
        async cleanup() { note("cleanup"); record.cleanupCalls++; record.abortedAtCleanup = options.signal.aborted; if (config.cleanupRefusal) options.refuse("TRANSPORT_REFUSED"); if (record.lateAck) { record.lateAck.resolve(); await record.lateHandler; } if (config.cleanupMs) advance(config.cleanupMs); if (config.cleanupError) throw new Error("PRIVATE_CLEANUP_CANARY"); if (config.terminalInCleanup) end("failed"); record.source.closed = true; record.source.listenerAlive = false; n.socketsClosed = n.socketsCreated; n.socketsLive = 0; const facts = clean(); if (config.unclean) facts.browser = "unconfirmed"; if (config.cleanupHandlersPending) facts.handlersSettled = false; return facts; },
      };
    },
  };
  return { ports, records, timers, advance, get now() { return at; } };
}

test("import/help never inspect environment, files, processes or service ports", async () => {
  const original = { createServer: http.createServer, spawn: childProcess.spawn, readFile: fs.readFile, readdir: fs.readdir, lstat: fs.lstat, realpath: fs.realpath, fetch: globalThis.fetch };
  let attempts = 0;
  const forbidden = () => { attempts++; throw new Error("NATIVE_IO_FORBIDDEN"); };
  try {
    http.createServer = forbidden; childProcess.spawn = forbidden;
    for (const key of ["readFile", "readdir", "lstat", "realpath"]) fs[key] = forbidden;
    globalThis.fetch = forbidden; syncBuiltinESMExports();
    const inert = await import("../../scripts/verification/browser-quiescence-fence-probe.mjs?ram-inert");
    const output = [], unreadEnv = new Proxy({}, { get: forbidden, ownKeys: forbidden });
    assert.equal(await inert.main(["--help"], unreadEnv, value => output.push(value)), 0);
    assert.deepEqual(output, [{ schemaVersion: 1, scenario: "browser-quiescence-fence-probe", code: "NO_SERVICE_STARTED", applicationAccepted: false }]);
    assert.equal(attempts, 0);
  } finally { http.createServer = original.createServer; childProcess.spawn = original.spawn; for (const key of ["readFile", "readdir", "lstat", "realpath"]) fs[key] = original[key]; globalThis.fetch = original.fetch; syncBuiltinESMExports(); }
});

test("execution requires a new explicit opt-in and exact sterile binding", async () => {
  assert.deepEqual(parseFenceProbeArguments(["--execute"]), { execute: true });
  for (const args of [[], ["--variants"], ["--help", "--execute"], ["--execute", "--variants"], [1], new Proxy(["--help"], {})]) refuses(() => parseFenceProbeArguments(args), "ARGUMENTS_REFUSED");
  assert.deepEqual(validateFenceProbeEnvironment(env(), runtime()), { PATH: "/usr/bin:/bin", HOME: "/home/runner", TZ: "UTC" });
  for (const key of ["GH_TOKEN", "SUPABASE_URL", "GOOGLE_CLIENT_ID", "VERCEL_ENV", "PGHOST", "NODE_OPTIONS", "HTTP_PROXY", "LD_PRELOAD", "SC_BROWSER_TRANSPORT_PROBE_RUN"]) refuses(() => validateFenceProbeEnvironment({ ...env(), [key]: "SYNTHETIC_SECRET_CANARY" }, runtime()), "ENVIRONMENT_REFUSED");
  for (const [key, value] of [["node", "v24.18.0"], ["platform", "win32"], ["arch", "arm64"]]) refuses(() => validateFenceProbeEnvironment(env(), { ...runtime(), [key]: value }), "ENVIRONMENT_REFUSED");
  for (const changed of [{ CI: "1" }, { GITHUB_ACTIONS: "false" }, { SC_BROWSER_QUIESCENCE_FENCE_PROBE_RUN: "0" }, { GITHUB_SHA: "HEAD" }, { HOME: "relative" }, { TMPDIR: "relative" }, { PATH: "" }]) refuses(() => validateFenceProbeEnvironment({ ...env(), ...changed }, runtime()), "ENVIRONMENT_REFUSED");
  const output = []; assert.equal(await main(["--execute"], { ...env(), GH_TOKEN: "SYNTHETIC_SECRET_CANARY" }, value => output.push(value)), 1);
  assert.equal(output[0].code, "ENVIRONMENT_REFUSED"); assert.equal(JSON.stringify(output).includes("SYNTHETIC_SECRET_CANARY"), false);
  assert.equal(FENCE_PROBE_BINDING.playwright, "1.63.0"); assert.equal(FENCE_PUBLIC_PINS.length, 4);
});

test("actual serialized client starts one held fetch and consumes its eventual body", async () => {
  const source = await fs.readFile(new URL("../../scripts/verification/browser-quiescence-fence-probe.mjs", import.meta.url), "utf8");
  const file = ts.createSourceFile("fence-probe.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), candidates = [];
  const visit = node => { if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(file) === "page" && node.expression.name.text === "evaluate") candidates.push(node); ts.forEachChild(node, visit); };
  visit(file); assert.equal(candidates.length, 1); assert.equal(candidates[0].arguments.length, 1); assert.equal(ts.isArrowFunction(candidates[0].arguments[0]), true);
  const client = new Script("(" + candidates[0].arguments[0].getText(file) + ")()"), held = deferred(), urls = [];
  let bodies = 0;
  assert.equal(client.runInNewContext({ fetch(url) { urls.push(url); return held.promise; } }, { timeout: 1000 }), undefined);
  assert.deepEqual(urls, ["/held-fetch"]); assert.equal(bodies, 0);
  held.resolve({ arrayBuffer() { bodies++; return Promise.resolve(new ArrayBuffer(0)); } });
  await Promise.resolve(); await Promise.resolve(); assert.equal(bodies, 1);
});

test("the online live-source control precedes the exact four-case matrix", async () => {
  const f = fixture(), report = await runBrowserQuiescenceFenceProbe(f.ports);
  assert.equal(report.mode, "synthetic"); assert.equal(report.sourceSha, null); assert.equal(report.applicationAccepted, false); assert.equal(report.controlQualified, true);
  assert.deepEqual(report.cases.map(c => [c.kind, c.guardRetained, c.sourceClosedRequested, c.offline, c.fetchCommands]), [["control", true, false, false, true], ["retained-open", true, false, false, true], ["retained-closed", true, true, false, true], ["removed-open", false, false, false, true], ["removed-closed", false, true, false, true]]);
  assert.deepEqual(report.cases.map(c => c.outcome), ["CONTROL_PASSED", "DRAINED", "DRAINED", "DRAINED", "DRAINED"]);
  assert.deepEqual(f.records[0].calls, ["start", "trigger", "armFence", "releaseResponse", "cleanup"]);
  assert.deepEqual(f.records[1].calls, ["start", "trigger", "armFence", "stopLoading", "blank", "cleanup"]);
  assert.deepEqual(f.records[2].calls, ["start", "trigger", "armFence", "stopLoading", "blank", "closeSource", "cleanup"]);
  assert.deepEqual(f.records[3].calls, ["start", "trigger", "armFence", "stopLoading", "blank", "unroute", "cleanup"]);
  assert.deepEqual(f.records[4].calls, ["start", "trigger", "armFence", "stopLoading", "blank", "unroute", "closeSource", "cleanup"]);
  for (const [index, c] of report.cases.entries()) { assert.equal(c.sourceListenerAlive, !c.sourceClosedRequested); assert.equal(c.sourceClosedBeforeDecision, c.sourceClosedRequested); assert.equal(c.guardRemovedBeforeDecision, !c.guardRetained); assert.equal(f.records[index].cleanupCalls, 1); assert.equal(f.records[index].abortedAtCleanup, true); }
  assert.equal(f.timers.size, 0);
});

test("source-open PENDING remains observable at 15000ms despite later cleanup terminals", async () => {
  const f = fixture([{}, { result: "pending", terminalInCleanup: true }]), report = await runBrowserQuiescenceFenceProbe(f.ports), c = report.cases[1];
  assert.equal(c.outcome, "PENDING"); assert.equal(c.code, "ORIGINAL_PENDING_AT_DEADLINE"); assert.equal(c.timing.decisionMs, 15000);
  assert.equal(c.sourceListenerAlive, true); assert.equal(c.sourceClosedBeforeDecision, false); assert.equal(c.timing.sourceClosedMs, null);
  assert.equal(c.counts.pendingRequests, 1); assert.equal(c.counts.publicFailed, 0); assert.equal(c.counts.cdpNoTerminal, 1); assert.equal(c.counts.managerSame, 1);
  assert.equal(f.records[1].counts.pendingRequests, 0); assert.equal(f.records[1].source.closed, true); assert.equal(c.cleanup.server, "close_observed");
  assert.equal(report.cases[2].outcome, "DRAINED");
});

test("source-closed PENDING uses original events and has independent close evidence", async () => {
  const report = await runBrowserQuiescenceFenceProbe(fixture([{}, {}, { result: "pending" }]).ports), c = report.cases[2];
  assert.equal(c.outcome, "PENDING"); assert.equal(c.sourceClosedBeforeDecision, true); assert.equal(c.sourceListenerAlive, false); assert.equal(c.counts.socketsLive, 0); assert.equal(c.counts.pendingRequests, 1); assert.equal(c.counts.publicFailed, 0); assert.equal(c.counts.cdpFailed, 0); assert.equal(c.timing.sourceClosedMs, 0); assert.equal(c.timing.decisionMs, 15000);
});

test("an early timer callback cannot promote original pending counters before the absolute deadline", async () => {
  for (const index of [1, 2, 3, 4]) {
    const configurations = Array.from({length:index+1},()=>({}));
    configurations[index] = { result:"pending", earlyDeadline:true };
    const f = fixture(configurations), report = await runBrowserQuiescenceFenceProbe(f.ports), c = report.cases[index];
    assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "CASE_TIMEOUT");
    assert.equal(c.timing.decisionMs, FENCE_PROBE_LIMITS.caseMs - 1);
    assert.equal(c.counts.pendingRequests, 1); assert.equal(c.counts.publicFinished + c.counts.publicFailed, 0);
    assert.equal(c.counts.cdpNoTerminal, 1); assert.equal(c.counts.managerSame, 1); assert.equal(c.counts.handlersPending, 0);
    assert.equal(c.sourceClosedBeforeDecision, index === 2 || index === 4);
    assert.equal(report.controlQualified, true); assert.equal(report.applicationAccepted, false);
    assert.equal(f.records[index].cleanupCalls, 1); assert.equal(f.records[index].abortedAtCleanup, true);
  }
});

test("one absolute deadline includes startup and does not get renewed for drain", async () => {
  const f = fixture([{}, { startMs: 4000, result: "pending" }]), report = await runBrowserQuiescenceFenceProbe(f.ports);
  assert.equal(report.cases[1].timing.readyMs, 4000); assert.equal(report.cases[1].timing.decisionMs, 15000); assert.equal(report.cases[1].outcome, "PENDING");
  assert.equal(f.records[1].initialBudget, 15000); assert.equal(FENCE_PROBE_LIMITS.caseMs, 15000);
});

test("control missing an original CDP terminal cannot authorize the matrix", async () => {
  const f = fixture([{ controlMissingCDP: true }]), report = await runBrowserQuiescenceFenceProbe(f.ports);
  assert.equal(report.controlQualified, false); assert.equal(report.cases[0].outcome, "INCONCLUSIVE"); assert.equal(report.cases[0].counts.publicFinished, 1); assert.equal(report.cases[0].counts.cdpFinished, 0);
  assert.equal(f.records.length, 1); assert.equal(report.cases.slice(1).every(c => c.outcome === "NOT_RUN"), true);
});

test("public terminal without its CDP terminal is inconclusive, never DRAINED", async () => {
  const report = await runBrowserQuiescenceFenceProbe(fixture([{}, { publicOnly: true }]).ports), c = report.cases[1];
  assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.counts.pendingRequests, 0); assert.equal(c.counts.publicFailed, 1); assert.equal(c.counts.cdpNoTerminal, 1); assert.equal(c.timing.decisionMs, 15000);
});

test("unroute, stopLoading and close ACKs do not remove pending requests", async () => {
  const f = fixture([{}, {}, {}, {}, { result: "pending" }]), report = await runBrowserQuiescenceFenceProbe(f.ports), c = report.cases[4];
  assert.equal(c.outcome, "PENDING"); assert.equal(c.guardRemovedBeforeDecision, true); assert.equal(c.sourceClosedBeforeDecision, true); assert.equal(c.counts.pendingRequests, 1); assert.equal(c.counts.publicFailed + c.counts.publicFinished, 0); assert.equal(c.counts.managerSame, 1);
});

test("listener must be positively alive in open-source cases", async () => {
  const report = await runBrowserQuiescenceFenceProbe(fixture([{}, { listenerAlive: false }]).ports), c = report.cases[1];
  assert.equal(c.outcome, "REFUSED"); assert.equal(c.code, "TRANSPORT_REFUSED"); assert.equal(c.sourceListenerAlive, false); assert.equal(c.sourceClosedBeforeDecision, false);
});

test("a source-close ACK without its own close observation is refused", async () => {
  const report = await runBrowserQuiescenceFenceProbe(fixture([{}, {}, { closeNotObserved: true }]).ports), c = report.cases[2];
  assert.equal(c.outcome, "REFUSED"); assert.equal(c.code, "TRANSPORT_REFUSED"); assert.equal(c.sourceClosedBeforeDecision, false); assert.equal(c.sourceListenerAlive, true);
});

test("cleanup owns a separate 5s budget and unconfirmed cleanup stops later cases", async () => {
  const f = fixture([{}, { result: "pending", cleanupMs: 5000 }]), report = await runBrowserQuiescenceFenceProbe(f.ports);
  assert.equal(report.cases[1].outcome, "PENDING"); assert.equal(report.cases[1].timing.decisionMs, 15000); assert.equal(report.cases[1].timing.cleanupMs, 5000); assert.equal(report.cases[1].cleanup.server, "unconfirmed");
  assert.equal(report.cases.slice(2).every(c => c.outcome === "NOT_RUN" && c.code === "CLEANUP_REQUIRED"), true); assert.equal(f.records.length, 2); assert.equal(f.timers.size, 0);
});

test("control cleanup must also qualify before any matrix startup", async () => {
  const f = fixture([{ unclean: true }]), report = await runBrowserQuiescenceFenceProbe(f.ports);
  assert.equal(report.cases[0].outcome, "CONTROL_PASSED"); assert.equal(report.controlQualified, false); assert.equal(f.records.length, 1);
});

test("route handlers count as pending independently of HTTP request terminals", async () => {
  const report = await runBrowserQuiescenceFenceProbe(fixture([{}, { handlersPending: true, cleanupHandlersPending: true }]).ports), c = report.cases[1];
  assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.counts.pendingRequests, 0); assert.equal(c.counts.handlersPending, 1); assert.equal(c.counts.handlersStarted, c.counts.handlersSettled + 1); assert.equal(c.cleanup.handlersSettled, false); assert.equal(report.cases[2].outcome, "NOT_RUN");
});

test("unknown late traffic refuses the case even when held request terminals arrived", async () => {
  const report = await runBrowserQuiescenceFenceProbe(fixture([{}, { lateUnknown: true }]).ports), c = report.cases[1];
  assert.equal(c.outcome, "REFUSED"); assert.equal(c.code, "REQUEST_REFUSED"); assert.equal(c.counts.unknownRequests, 1); assert.equal(c.counts.pendingRequests, 0);
});

function request(method, path) { return { method: () => method, url: () => "http://127.0.0.1:1234" + path }; }
test("the real fence aborts an already-authorized late GET and tracks its handler until ACK", async () => {
  const ack = deferred(), failures = [], q = request("GET", "/known-read"), observerState = { terminal: "not-observed", managerEntry: "same-request" };
  const observer = { request() {}, terminal() {}, snapshot() { return { identity: "exact-server-request", terminal: observerState.terminal, managerEntry: observerState.managerEntry, sessionRegistered: "registered" }; } };
  const ledger = createOriginalRequestLedger(observer, code => failures.push(code)); ledger.begin(q, {}); ledger.continued(q);
  const fence = createQuiescenceFence({ allowed: candidate => candidate === q, readCancellation: candidate => candidate === q, onRefusal: code => failures.push(code) });
  let aborts = 0, continues = 0; fence.arm();
  const pending = fence.handle({ request: () => q, abort() { aborts++; return ack.promise; }, continue() { continues++; } });
  assert.equal(fence.snapshot().handlersPending, 1); await Promise.resolve(); assert.equal(aborts, 1); assert.equal(continues, 0); assert.equal(fence.snapshot().readsAborted, 1); assert.equal(fence.snapshot().abortAcks, 0);
  assert.equal(ledger.snapshot().pendingRequests, 1); ack.resolve(); await pending;
  assert.equal(fence.snapshot().handlersPending, 0); assert.equal(fence.snapshot().handlersSettled, 1); assert.equal(fence.snapshot().abortAcks, 1);
  assert.equal(ledger.snapshot().pendingRequests, 1); assert.equal(ledger.snapshot().publicFailed, 0); assert.equal(ledger.snapshot().managerSame, 1);
  observerState.terminal = "failed"; observerState.managerEntry = "absent"; ledger.terminal(q, "failed");
  assert.equal(ledger.snapshot().pendingRequests, 0); assert.equal(ledger.snapshot().publicFailed, 1); assert.equal(ledger.snapshot().cdpFailed, 1); assert.deepEqual(failures, []);
});

test("explicit finite-read continuation retains the original handler and ledger until separate original settlement", async () => {
  const ack=deferred(),failures=[],q=request("GET","/known-read"),observed={terminal:"not-observed",managerEntry:"same-request"};
  const observer={request(){},terminal(){},snapshot(){return{identity:"exact-server-request",terminal:observed.terminal,managerEntry:observed.managerEntry,sessionRegistered:"registered"};}},ledger=createOriginalRequestLedger(observer,code=>failures.push(code));ledger.begin(q,{});
  const fence=createQuiescenceFence({allowed:value=>value===q,readCancellation:value=>value===q,continueRead:value=>value===q,onRefusal:code=>failures.push(code)});fence.arm();let continues=0,aborts=0;
  const handler=fence.handle({request:()=>q,continue(){continues++;return ack.promise;},async abort(){aborts++;}});await Promise.resolve();assert.equal(continues,1);assert.equal(aborts,0);assert.equal(fence.snapshot().handlersPending,1);assert.equal(ledger.snapshot().pendingRequests,1);
  ack.resolve();await handler;ledger.continued(q);assert.equal(fence.snapshot().continueAcks,1);assert.equal(fence.snapshot().abortAcks,0);assert.equal(fence.snapshot().readsAborted,0);assert.equal(fence.snapshot().handlersPending,0);assert.equal(ledger.snapshot().pendingRequests,1);assert.equal(ledger.snapshot().publicFinished,0);assert.equal(ledger.snapshot().cdpNoTerminal,1);
  observed.terminal="finished";observed.managerEntry="absent";ledger.terminal(q,"finished");assert.equal(ledger.snapshot().pendingRequests,0);assert.equal(ledger.snapshot().publicFinished,1);assert.equal(ledger.snapshot().cdpFinished,1);assert.deepEqual(failures,[]);
});

test("finite-read continuation cannot widen allowed/cancellable authority or authorize callbacks and writes", async () => {
  for(const [method,path,allowed,read]of[["GET","/unknown",false,true],["POST","/known-write",true,true],["GET","/auth/callback",true,true],["GET","/auth/v1/verify",true,true],["GET","/sair",true,true],["GET","/known-but-not-cancellable",true,false]]){
    const failures=[];let decisions=0,continues=0,aborts=0;const fence=createQuiescenceFence({allowed:()=>allowed,readCancellation:()=>read,continueRead:()=>{decisions++;return true;},onRefusal:code=>failures.push(code)});fence.arm();await fence.handle({request:()=>request(method,path),async continue(){continues++;},async abort(){aborts++;}});
    assert.equal(decisions,0);assert.equal(continues,0);assert.equal(aborts,1);assert.deepEqual(failures,["REQUEST_REFUSED"]);assert.equal(fence.snapshot().handlersPending,0);
  }
  for(const value of[null,true,"true",{}])refuses(()=>createQuiescenceFence({allowed:()=>true,readCancellation:()=>true,continueRead:value,onRefusal:()=>{}}),"ARGUMENTS_REFUSED");
});

test("finite-read refusal or rejected continue never becomes an ACK or an original terminal", async () => {
  for(const denied of["predicate","continue"]){const failures=[],q=request("GET","/known-read");let calls=0;const fence=createQuiescenceFence({allowed:()=>true,readCancellation:()=>true,continueRead:()=>{if(denied==="predicate")throw Error("PRIVATE_CANARY");return true;},onRefusal:code=>failures.push(code)});fence.arm();await fence.handle({request:()=>q,async continue(){calls++;throw Error("PRIVATE_CANARY");},async abort(){assert.fail("No fallback command may replace the original failed command");}});assert.equal(calls,denied==="continue"?1:0);assert.equal(fence.snapshot().continueAcks,0);assert.equal(fence.snapshot().handlersPending,0);assert.deepEqual(failures,["TRANSPORT_REFUSED"]);assert.equal(JSON.stringify(failures).includes("PRIVATE_CANARY"),false);}
});

test("parking cannot widen existing authority and POST/callback remain unknown", async () => {
  for (const [method, path, allowed, read] of [["GET", "/unknown", false, true], ["POST", "/known-write", true, true], ["GET", "/auth/callback", true, true], ["GET", "/auth/v1/verify", true, true], ["GET", "/sair", true, true], ["GET", "/known-but-not-cancellable", true, false]]) {
    const failures = [], fence = createQuiescenceFence({ allowed: () => allowed, readCancellation: () => read, onRefusal: code => failures.push(code) });
    let aborts = 0, continues = 0; fence.arm(); await fence.handle({ request: () => request(method, path), async abort() { aborts++; }, async continue() { continues++; } });
    assert.deepEqual(failures, ["REQUEST_REFUSED"]); assert.equal(aborts, 1); assert.equal(continues, 0); assert.equal(fence.snapshot().unknownRequests, 1); assert.equal(fence.snapshot().readsAborted, 0); assert.equal(fence.snapshot().handlersPending, 0);
  }
});

test("existing authority can continue before arm but never becomes wider after arm", async () => {
  const failures = [], fence = createQuiescenceFence({ allowed: () => true, readCancellation: () => false, onRefusal: code => failures.push(code) });
  let continues = 0, aborts = 0; const route = { request: () => request("POST", "/known-write"), async continue() { continues++; }, async abort() { aborts++; } };
  await fence.handle(route); assert.equal(continues, 1); assert.deepEqual(failures, []); fence.arm(); await fence.handle(route);
  assert.equal(continues, 1); assert.equal(aborts, 1); assert.deepEqual(failures, ["REQUEST_REFUSED"]); assert.equal(fence.snapshot().handlersStarted, 2); assert.equal(fence.snapshot().handlersSettled, 2);
});

test("original ledger refuses duplicate terminals and does not infer CDP from public events", () => {
  const failures = [], q = {}, observer = { request() {}, terminal() {}, snapshot() { return { identity: "exact-server-request", terminal: "not-observed", managerEntry: "same-request", sessionRegistered: "registered" }; } };
  const ledger = createOriginalRequestLedger(observer, code => failures.push(code)); ledger.begin(q, {}); ledger.continued(q); ledger.terminal({}, "failed"); assert.equal(ledger.snapshot().pendingRequests, 1);
  ledger.terminal(q, "failed"); assert.equal(ledger.snapshot().publicFailed, 1); assert.equal(ledger.snapshot().cdpFailed, 0); assert.equal(ledger.snapshot().cdpNoTerminal, 1); assert.equal(ledger.snapshot().managerSame, 1);
  ledger.terminal(q, "failed"); assert.deepEqual(failures, ["TRANSPORT_REFUSED"]); assert.equal(ledger.snapshot().publicFailed, 1);
});

test("closed report rejects widened authority, fabricated source proof and ACK-as-terminal", async () => {
  const valid = await runBrowserQuiescenceFenceProbe(fixture([{}, { result: "pending" }]).ports);
  const changes = [r => { r.applicationAccepted = true; }, r => { r.privatePayload = "CANARY"; }, r => { r.cases[1].sourceListenerAlive = false; }, r => { r.cases[1].sourceClosedBeforeDecision = true; }, r => { r.cases[1].offline = true; }, r => { r.cases[1].counts.pendingRequests = 0; }, r => { r.cases[1].counts.handlersPending = 1; }, r => { r.cases[1].counts.serverReceived = 0; }, r => { r.cases[1].outcome = "DRAINED"; r.cases[1].code = "ORIGINAL_TERMINALS"; }, r => { r.cases[1].guardRemovedBeforeDecision = true; }, r => { r.cases[1].timing.decisionMs = 14999; }, r => { r.cases[1].counts.socketsCreated = 0.5; }, r => { r.cases[1].counts.socketsCreated = 17; }];
  for (const mutate of changes) { const changed = clone(valid); mutate(changed); assert.throws(() => validateFenceProbeReport(changed)); }
  let touched = 0; const accessor = clone(valid); Object.defineProperty(accessor.cases[1], "sourceListenerAlive", { enumerable: true, get() { touched++; return true; } }); refuses(() => validateFenceProbeReport(accessor)); assert.equal(touched, 0);
  const proxy = new Proxy(valid, { ownKeys() { throw new Error("PRIVATE_PROXY_CANARY"); } }); refuses(() => validateFenceProbeReport(proxy));
  const sparse = clone(valid); delete sparse.cases[3]; refuses(() => validateFenceProbeReport(sparse));
  const mismatched = clone(valid); mismatched.cases[2].counts.cdpFailed = 0; mismatched.cases[2].counts.cdpFinished = 1; refuses(() => validateFenceProbeReport(mismatched));
});

test("arbitrary startup errors export only a closed code and still clean owned handles", async () => {
  const f = fixture([{ startError: new Error("PRIVATE_STARTUP_CANARY") }]), report = await runBrowserQuiescenceFenceProbe(f.ports);
  assert.equal(report.cases[0].code, "FENCE_PROBE_UNAVAILABLE"); assert.equal(report.cases[0].outcome, "REFUSED"); assert.equal(f.records[0].cleanupCalls, 1); assert.equal(report.controlQualified, false); assert.equal(JSON.stringify(report).includes("PRIVATE_STARTUP_CANARY"), false);
});

test("a refusal at the final control drain/snapshot vetoes unchanged successful counters", async () => {
  for (const snapshotRefusal of ["drain-microtask", "final-sync", "final-microtask"]) {
    const f = fixture([{ snapshotRefusal }]), report = await runBrowserQuiescenceFenceProbe(f.ports), c = report.cases[0];
    assert.equal(c.outcome, "REFUSED", snapshotRefusal); assert.equal(c.code, "TRANSPORT_REFUSED"); assert.equal(report.controlQualified, false);
    assert.equal(c.counts.publicFinished, 1); assert.equal(c.counts.cdpFinished, 1); assert.equal(c.counts.pendingRequests, 0); assert.equal(c.counts.unknownRequests, 0);
    assert.equal(c.cleanup.server, "close_observed"); assert.equal(f.records.length, 1); assert.equal(report.cases.slice(1).every(item => item.outcome === "NOT_RUN"), true);
  }
});

test("a refusal at the final matrix drain/snapshot vetoes unchanged successful counters", async () => {
  for (const snapshotRefusal of ["drain-microtask", "final-sync", "final-microtask"]) {
    const f = fixture([{}, { snapshotRefusal }]), report = await runBrowserQuiescenceFenceProbe(f.ports), c = report.cases[1];
    assert.equal(report.controlQualified, true); assert.equal(c.outcome, "REFUSED", snapshotRefusal); assert.equal(c.code, "TRANSPORT_REFUSED");
    assert.equal(c.counts.publicFailed, 1); assert.equal(c.counts.cdpFailed, 1); assert.equal(c.counts.pendingRequests, 0); assert.equal(c.counts.unknownRequests, 0);
    assert.equal(c.cleanup.server, "close_observed"); assert.equal(c.sourceListenerAlive, true); assert.equal(c.sourceClosedBeforeDecision, false);
  }
});

test("refusals beginning inside cleanup cannot rewrite the already-sealed decision", async () => {
  const f = fixture([{ cleanupRefusal: true }, { cleanupRefusal: true }]), report = await runBrowserQuiescenceFenceProbe(f.ports);
  assert.equal(report.cases[0].outcome, "CONTROL_PASSED"); assert.equal(report.controlQualified, true); assert.equal(report.cases[1].outcome, "DRAINED");
  assert.equal(report.cases[0].sourceListenerAlive, true); assert.equal(report.cases[1].sourceListenerAlive, true); assert.equal(report.cases[0].sourceClosedBeforeDecision, false); assert.equal(report.cases[1].sourceClosedBeforeDecision, false);
  assert.equal(report.cases[0].counts.publicFinished, 1); assert.equal(report.cases[1].counts.publicFailed, 1); assert.equal(f.records[0].abortedAtCleanup, true); assert.equal(f.records[1].abortedAtCleanup, true);
});

test("an authorized handler starting in the final microtask without a veto prevents control/matrix success", async () => {
  for (const index of [0, 1]) {
    const configurations = Array.from({ length: index + 1 }, () => ({})); configurations[index].startHandlerInFinalMicrotask = true;
    const f = fixture(configurations), report = await runBrowserQuiescenceFenceProbe(f.ports), c = report.cases[index];
    assert.equal(c.outcome, "INCONCLUSIVE"); assert.equal(c.code, "TRANSPORT_REFUSED"); assert.equal(c.counts.pendingRequests, 0); assert.equal(c.counts.unknownRequests, 0);
    assert.equal(c.counts.handlersStarted, 3); assert.equal(c.counts.handlersSettled, 2); assert.equal(c.counts.handlersPending, 1); assert.equal(c.counts.fenceReadAborts, 1); assert.equal(c.counts.fenceAbortAcks, 0);
    assert.equal(c.cleanup.handlersSettled, true); assert.equal(f.records[index].lateFence.snapshot().handlersPending, 0); assert.equal(f.records[index].lateFence.snapshot().abortAcks, 1);
    assert.equal(report.controlQualified, index !== 0);
  }
});

test("a listener lost in the final microtask without a veto prevents control/matrix success", async () => {
  for (const index of [0, 1]) {
    const configurations = Array.from({ length: index + 1 }, () => ({})); configurations[index].loseListenerInFinalMicrotask = true;
    const report = await runBrowserQuiescenceFenceProbe(fixture(configurations).ports), c = report.cases[index];
    assert.equal(c.outcome, "REFUSED"); assert.equal(c.code, "TRANSPORT_REFUSED"); assert.equal(c.sourceListenerAlive, false); assert.equal(c.sourceClosedBeforeDecision, false);
    assert.equal(c.counts.pendingRequests, 0); assert.equal(c.counts.handlersPending, 0); assert.equal(c.counts.unknownRequests, 0); assert.equal(c.counts.publicFinished + c.counts.publicFailed, 1); assert.equal(c.cleanup.server, "close_observed");
    assert.equal(report.controlQualified, index !== 0);
  }
});
