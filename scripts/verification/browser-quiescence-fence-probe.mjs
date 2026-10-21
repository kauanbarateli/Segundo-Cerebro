/** Public, isolated experiment. Import/help do not inspect env or open services. */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createServer } from "node:http";
import { readFile, readdir, lstat, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { types } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const nativePorts = new WeakSet();
export const FENCE_PROBE_LIMITS = Object.freeze({ caseMs: 15000, cleanupMs: 5000, maxRequests: 16, maxSockets: 16, reportBytes: 16384, maxCases: 5 });
export const FENCE_PROBE_BINDING = Object.freeze({ node: "v24.19.0", platform: "linux", arch: "x64", playwright: "1.63.0", chromium: "153.0.8010.12", revision: "1243" });
export const FENCE_PUBLIC_PINS = Object.freeze([
  ["node_modules/playwright-core/package.json", 876, "f061c58427e47e843e26d201f0a57076c734e57c734ecbbd87d4a23b7a20db9b"],
  ["node_modules/playwright-core/browsers.json", 1137, "545d52f8382c391e605562c330e9c1c534a16045898203037a49bb8bd769a946"],
  ["node_modules/playwright-core/lib/coreBundle.js", 3477183, "549070af3acabb3efcc4f55bfe6210f9f7c2fcf633cf7eaa59bfe60719969171"],
  ["tests/e2e-auth-local/admin-browser-support.mjs", 71483, "253d9c68c33bc05f581116a112c7a9aeb1d103a91d1e6b18e24415abf78a6448"],
].map(Object.freeze));
const CASES = Object.freeze([
  { kind: "control", guardRetained: true, sourceClosed: false },
  { kind: "retained-open", guardRetained: true, sourceClosed: false },
  { kind: "retained-closed", guardRetained: true, sourceClosed: true },
  { kind: "removed-open", guardRetained: false, sourceClosed: false },
  { kind: "removed-closed", guardRetained: false, sourceClosed: true },
].map(Object.freeze));
const COUNT_KEYS = Object.freeze(["requestsStarted", "routeAcks", "serverReceived", "responsesFinished", "socketsCreated", "socketsClosed", "socketsLive", "publicFinished", "publicFailed", "pendingRequests", "cdpFinished", "cdpFailed", "cdpNoTerminal", "managerSame", "managerAbsent", "sessionRegistered", "sessionRemoved", "protocolUnavailable", "handlersStarted", "handlersSettled", "handlersPending", "fenceReadAborts", "fenceAbortAcks", "unknownRequests", "downloads", "popups"]);
const CLEAN_KEYS = Object.freeze(["server", "context", "browser", "session", "socketsClosed", "startupSettled", "handlersSettled"]);
const CODES = new Set(["CONTROL_PASSED", "ORIGINAL_TERMINALS", "ORIGINAL_PENDING_AT_DEADLINE", "CONTROL_REQUIRED", "CLEANUP_REQUIRED", "CASE_TIMEOUT", "CLOCK_REFUSED", "REQUEST_REFUSED", "LIMIT_REFUSED", "SOURCE_REFUSED", "STARTUP_REFUSED", "TRANSPORT_REFUSED", "CLEANUP_UNCONFIRMED", "ENVIRONMENT_REFUSED", "ARGUMENTS_REFUSED", "FENCE_PROBE_UNAVAILABLE"]);
const refuse = code => { const error = new Error(CODES.has(code) ? code : "FENCE_PROBE_UNAVAILABLE"); error.code = error.message; throw error; };
const safeCode = error => { try { if (types.isProxy(error)) return "FENCE_PROBE_UNAVAILABLE"; const descriptor = error && Object.getOwnPropertyDescriptor(error, "code"); return descriptor && Object.hasOwn(descriptor, "value") && CODES.has(descriptor.value) ? descriptor.value : "FENCE_PROBE_UNAVAILABLE"; } catch { return "FENCE_PROBE_UNAVAILABLE"; } };
function record(value, keys) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) refuse("FENCE_PROBE_UNAVAILABLE");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || Reflect.ownKeys(descriptors).some(key => !keys.includes(key))) refuse("FENCE_PROBE_UNAVAILABLE");
  const result = {};
  for (const key of keys) { const d = descriptors[key]; if (!d?.enumerable || !Object.hasOwn(d, "value")) refuse("FENCE_PROBE_UNAVAILABLE"); result[key] = d.value; }
  return result;
}
function closedArray(value, length) {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) refuse("FENCE_PROBE_UNAVAILABLE");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (descriptors.length?.value !== length || Reflect.ownKeys(descriptors).length !== length + 1) refuse("FENCE_PROBE_UNAVAILABLE");
  return Array.from({ length }, (_, index) => { const d = descriptors[index]; if (!d?.enumerable || !Object.hasOwn(d, "value")) refuse("FENCE_PROBE_UNAVAILABLE"); return d.value; });
}
const emptyCounts = () => Object.fromEntries(COUNT_KEYS.map(key => [key, 0]));
const emptyCleanup = () => ({ server: "unconfirmed", context: "unconfirmed", browser: "unconfirmed", session: "unconfirmed", socketsClosed: false, startupSettled: false, handlersSettled: false });
function readCounts(value) { const result = record(value, COUNT_KEYS); if (Object.values(result).some(n => !Number.isSafeInteger(n) || n < 0 || n > FENCE_PROBE_LIMITS.maxRequests)) refuse("LIMIT_REFUSED"); return result; }
function readCleanup(value) { const result = record(value, CLEAN_KEYS); if (["server", "context", "browser", "session"].some(key => !["absent", "close_observed", "unconfirmed"].includes(result[key])) || ["socketsClosed", "startupSettled", "handlersSettled"].some(key => typeof result[key] !== "boolean")) refuse("FENCE_PROBE_UNAVAILABLE"); return result; }
const allClean = c => ["server", "context", "browser", "session"].every(key => ["absent", "close_observed"].includes(c[key])) && c.socketsClosed && c.startupSettled && c.handlersSettled;
const relative = (at, start, limit) => Number.isFinite(at) && Number.isFinite(start) && at >= start ? Math.min(limit + 1, Math.floor(at - start)) : null;
const blankCase = (definition, code = "CONTROL_REQUIRED") => ({ kind: definition.kind, guardRetained: definition.guardRetained, sourceClosedRequested: definition.sourceClosed, offline: false, fetchCommands: true, outcome: "NOT_RUN", code, fenceArmed: false, guardRemovedBeforeDecision: false, sourceClosedBeforeDecision: false, sourceListenerAlive: false, counts: emptyCounts(), timing: { readyMs: null, fenceMs: null, sourceClosedMs: null, decisionMs: null, cleanupMs: null }, cleanup: emptyCleanup() });
const originalPending = n => n.requestsStarted === 1 && n.routeAcks === 1 && n.serverReceived === 1 && n.responsesFinished === 0 && n.pendingRequests === 1 && n.publicFinished + n.publicFailed === 0 && n.cdpNoTerminal === 1 && n.managerSame === 1 && n.sessionRegistered === 1 && n.sessionRemoved === 0 && n.protocolUnavailable === 0;
const originalDrained = n => n.requestsStarted === 1 && n.routeAcks === 1 && n.serverReceived === 1 && n.pendingRequests === 0 && n.publicFinished + n.publicFailed === 1 && n.cdpFinished + n.cdpFailed === 1 && n.publicFinished === n.cdpFinished && n.publicFailed === n.cdpFailed && n.cdpNoTerminal === 0 && n.managerSame === 0 && n.managerAbsent === 1 && n.sessionRegistered === 1 && n.sessionRemoved === 0 && n.protocolUnavailable === 0 && n.handlersPending === 0;

/** A caller supplies existing authority; parking can only reduce it. No ledger is mutated here. */
export function createQuiescenceFence({ allowed, readCancellation, onRefusal }) {
  if ([allowed, readCancellation, onRefusal].some(value => typeof value !== "function")) refuse("ARGUMENTS_REFUSED");
  const handlers = new Set();
  let armed = false, started = 0, settled = 0, reads = 0, abortAcks = 0, continueAcks = 0, unknown = 0;
  const flag = code => onRefusal(code);
  const unknownRequest = () => { unknown++; flag("REQUEST_REFUSED"); };
  const safeRead = request => {
    if (request.method() !== "GET" || readCancellation(request) !== true) return false;
    const url = new URL(request.url());
    return !["/sair", "/auth/callback", "/auth/v1/verify"].includes(url.pathname);
  };
  return Object.freeze({
    arm() { armed = true; },
    snapshot() { return Object.freeze({ armed, handlersStarted: started, handlersSettled: settled, handlersPending: handlers.size, readsAborted: reads, abortAcks, continueAcks, unknownRequests: unknown }); },
    handle(route) {
      if (started >= FENCE_PROBE_LIMITS.maxRequests) { flag("LIMIT_REFUSED"); return Promise.resolve(); }
      started++;
      let operation;
      operation = Promise.resolve().then(async () => {
        const request = route.request();
        if (allowed(request) !== true) { unknownRequest(); await route.abort(); abortAcks++; return; }
        if (!armed) { await route.continue(); continueAcks++; return; }
        if (!safeRead(request)) { unknownRequest(); await route.abort(); abortAcks++; return; }
        reads++; await route.abort(); abortAcks++;
      }).catch(() => { flag("TRANSPORT_REFUSED"); }).finally(() => { handlers.delete(operation); settled++; });
      handlers.add(operation);
      return operation;
    },
  });
}

/** Only original public events delete a pending request. Commands/ACKs have no such method. */
export function createOriginalRequestLedger(observer, onRefusal) {
  if (!observer || ["request", "terminal", "snapshot"].some(key => typeof observer[key] !== "function") || typeof onRefusal !== "function") refuse("ARGUMENTS_REFUSED");
  const retained = new Set(), ended = new Set(), pending = new Set(), continued = new Set();
  let finished = 0, failed = 0;
  return Object.freeze({
    begin(request, page) { if (retained.has(request) || retained.size >= 1) { onRefusal("LIMIT_REFUSED"); return; } retained.add(request); pending.add(request); observer.request(request, page); },
    continued(request) { if (!retained.has(request)) return; if (continued.has(request)) { onRefusal("TRANSPORT_REFUSED"); return; } continued.add(request); },
    terminal(request, kind) { if (!retained.has(request)) return; if (ended.has(request) || !["finished", "failed"].includes(kind)) { onRefusal("TRANSPORT_REFUSED"); return; } ended.add(request); observer.terminal(request, kind); pending.delete(request); if (kind === "finished") finished++; else failed++; },
    snapshot() {
      const n = { requestsStarted: retained.size, routeAcks: continued.size, publicFinished: finished, publicFailed: failed, pendingRequests: pending.size, cdpFinished: 0, cdpFailed: 0, cdpNoTerminal: 0, managerSame: 0, managerAbsent: 0, sessionRegistered: 0, sessionRemoved: 0, protocolUnavailable: 0 };
      for (const request of retained) {
        const observation = observer.snapshot([request]);
        if (!observation || observation.identity !== "exact-server-request") { n.protocolUnavailable++; continue; }
        if (observation.terminal === "finished") n.cdpFinished++; else if (observation.terminal === "failed") n.cdpFailed++; else n.cdpNoTerminal++;
        if (observation.managerEntry === "same-request") n.managerSame++; else if (observation.managerEntry === "absent") n.managerAbsent++;
        if (observation.sessionRegistered === "registered") n.sessionRegistered++; else if (observation.sessionRegistered === "removed") n.sessionRemoved++;
      }
      return n;
    },
  });
}

export function parseFenceProbeArguments(argv) {
  if (!Array.isArray(argv) || types.isProxy(argv) || argv.length !== 1 || !["--help", "--execute"].includes(argv[0])) refuse("ARGUMENTS_REFUSED");
  return { execute: argv[0] === "--execute" };
}
export function validateFenceProbeEnvironment(env, runtime) {
  if (!env || runtime.platform !== FENCE_PROBE_BINDING.platform || runtime.arch !== FENCE_PROBE_BINDING.arch || runtime.node !== FENCE_PROBE_BINDING.node || env.CI !== "true" || env.GITHUB_ACTIONS !== "true" || env.SC_BROWSER_QUIESCENCE_FENCE_PROBE_RUN !== "1" || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")) refuse("ENVIRONMENT_REFUSED");
  const allowed = new Set(["CI", "GITHUB_ACTIONS", "SC_BROWSER_QUIESCENCE_FENCE_PROBE_RUN", "GITHUB_SHA", "PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"]);
  if (Object.keys(env).some(key => !allowed.has(key))) refuse("ENVIRONMENT_REFUSED");
  const child = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"]) if (env[key] !== undefined) { if (typeof env[key] !== "string" || env[key].length > 4096 || env[key].includes("\0")) refuse("ENVIRONMENT_REFUSED"); child[key] = env[key]; }
  if (!child.PATH || !child.HOME || !isAbsolute(child.HOME) || child.TMPDIR && !isAbsolute(child.TMPDIR)) refuse("ENVIRONMENT_REFUSED");
  child.TZ = "UTC";
  return Object.freeze(child);
}
export function validateFenceProbeReport(input) {
  const r = record(input, ["schemaVersion", "scenario", "mode", "sourceSha", "diagnosticOnly", "applicationAccepted", "controlQualified", "cases"]);
  if (r.schemaVersion !== 1 || r.scenario !== "browser-quiescence-fence-probe" || !["synthetic", "native"].includes(r.mode) || (r.mode === "synthetic" ? r.sourceSha !== null : typeof r.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(r.sourceSha)) || r.diagnosticOnly !== true || r.applicationAccepted !== false || typeof r.controlQualified !== "boolean") refuse("FENCE_PROBE_UNAVAILABLE");
  r.cases = closedArray(r.cases, CASES.length).map((value, index) => {
    const c = record(value, ["kind", "guardRetained", "sourceClosedRequested", "offline", "fetchCommands", "outcome", "code", "fenceArmed", "guardRemovedBeforeDecision", "sourceClosedBeforeDecision", "sourceListenerAlive", "counts", "timing", "cleanup"]), definition = CASES[index];
    if (c.kind !== definition.kind || c.guardRetained !== definition.guardRetained || c.sourceClosedRequested !== definition.sourceClosed || c.offline !== false || c.fetchCommands !== true || !["CONTROL_PASSED", "DRAINED", "PENDING", "INCONCLUSIVE", "REFUSED", "NOT_RUN"].includes(c.outcome) || !CODES.has(c.code) || ["fenceArmed", "guardRemovedBeforeDecision", "sourceClosedBeforeDecision", "sourceListenerAlive"].some(key => typeof c[key] !== "boolean")) refuse("FENCE_PROBE_UNAVAILABLE");
    c.counts = readCounts(c.counts); c.cleanup = readCleanup(c.cleanup); c.timing = record(c.timing, ["readyMs", "fenceMs", "sourceClosedMs", "decisionMs", "cleanupMs"]);
    const n = c.counts, t = c.timing;
    for (const [key, at] of Object.entries(t)) if (!(at === null || Number.isSafeInteger(at) && at >= 0 && at <= (key === "cleanupMs" ? FENCE_PROBE_LIMITS.cleanupMs : FENCE_PROBE_LIMITS.caseMs) + 1)) refuse("FENCE_PROBE_UNAVAILABLE");
    if (n.requestsStarted > 1 || n.publicFinished + n.publicFailed + n.pendingRequests !== n.requestsStarted || n.routeAcks > n.requestsStarted || n.responsesFinished > n.serverReceived || n.socketsClosed + n.socketsLive !== n.socketsCreated || n.cdpFinished + n.cdpFailed + n.cdpNoTerminal + n.protocolUnavailable !== n.requestsStarted || n.managerSame + n.managerAbsent > n.requestsStarted || n.sessionRegistered + n.sessionRemoved > n.requestsStarted || n.handlersSettled + n.handlersPending !== n.handlersStarted || n.fenceAbortAcks > n.handlersStarted || n.fenceReadAborts > n.handlersStarted || c.sourceClosedBeforeDecision && c.sourceListenerAlive || c.sourceClosedBeforeDecision !== (t.sourceClosedMs !== null)) refuse("FENCE_PROBE_UNAVAILABLE");
    if (t.fenceMs !== null && (t.readyMs === null || t.fenceMs < t.readyMs) || t.sourceClosedMs !== null && (t.fenceMs === null || t.sourceClosedMs < t.fenceMs) || t.decisionMs !== null && [t.readyMs, t.fenceMs, t.sourceClosedMs].some(at => at !== null && at > t.decisionMs)) refuse("FENCE_PROBE_UNAVAILABLE");
    if (c.outcome === "NOT_RUN") {
      if (!["CONTROL_REQUIRED", "CLEANUP_REQUIRED"].includes(c.code) || Object.values(n).some(Boolean) || Object.values(t).some(at => at !== null) || [c.fenceArmed, c.guardRemovedBeforeDecision, c.sourceClosedBeforeDecision, c.sourceListenerAlive].some(Boolean) || JSON.stringify(c.cleanup) !== JSON.stringify(emptyCleanup())) refuse("FENCE_PROBE_UNAVAILABLE");
    } else if (["CONTROL_PASSED", "DRAINED", "PENDING"].includes(c.outcome)) {
      if (!c.fenceArmed || c.guardRemovedBeforeDecision !== !definition.guardRetained || c.sourceClosedBeforeDecision !== definition.sourceClosed || c.sourceListenerAlive !== !definition.sourceClosed || t.readyMs === null || t.fenceMs === null || t.decisionMs === null || n.unknownRequests || n.downloads || n.popups || n.handlersPending || c.sourceClosedBeforeDecision && (n.socketsLive || t.sourceClosedMs >= FENCE_PROBE_LIMITS.caseMs)) refuse("FENCE_PROBE_UNAVAILABLE");
      if (c.outcome === "CONTROL_PASSED" && (index !== 0 || c.code !== "CONTROL_PASSED" || !originalDrained(n) || n.publicFinished !== 1 || n.cdpFinished !== 1 || n.responsesFinished !== 1 || t.decisionMs >= FENCE_PROBE_LIMITS.caseMs)) refuse("FENCE_PROBE_UNAVAILABLE");
      if (c.outcome === "DRAINED" && (index === 0 || c.code !== "ORIGINAL_TERMINALS" || !originalDrained(n) || n.responsesFinished !== 0 || t.decisionMs >= FENCE_PROBE_LIMITS.caseMs)) refuse("FENCE_PROBE_UNAVAILABLE");
      if (c.outcome === "PENDING" && (index === 0 || c.code !== "ORIGINAL_PENDING_AT_DEADLINE" || !originalPending(n) || t.decisionMs < FENCE_PROBE_LIMITS.caseMs)) refuse("FENCE_PROBE_UNAVAILABLE");
    } else if (["CONTROL_PASSED", "ORIGINAL_TERMINALS", "ORIGINAL_PENDING_AT_DEADLINE", "CONTROL_REQUIRED", "CLEANUP_REQUIRED"].includes(c.code)) refuse("FENCE_PROBE_UNAVAILABLE");
    return c;
  });
  if (r.controlQualified !== (r.cases[0].outcome === "CONTROL_PASSED" && allClean(r.cases[0].cleanup)) || !r.controlQualified && r.cases.slice(1).some(c => c.outcome !== "NOT_RUN")) refuse("FENCE_PROBE_UNAVAILABLE");
  for (let index = 2; index < r.cases.length; index++) if (!allClean(r.cases[index - 1].cleanup) && r.cases[index].outcome !== "NOT_RUN") refuse("FENCE_PROBE_UNAVAILABLE");
  if (Buffer.byteLength(JSON.stringify(r)) > FENCE_PROBE_LIMITS.reportBytes) refuse("LIMIT_REFUSED");
  return r;
}

async function observeCase(definition, ports) {
  const result = blankCase(definition), controller = new AbortController();
  let lease, started, previous, timer, first = null;
  let rejectVeto; const veto = new Promise((_yes, no) => { rejectVeto = no; }); veto.catch(() => {});
  const stop = code => { if (first === null) { first = CODES.has(code) ? code : "FENCE_PROBE_UNAVAILABLE"; const error = new Error(first); error.code = first; rejectVeto(error); } };
  const now = () => { const at = ports.now(); if (!Number.isFinite(at) || previous !== undefined && at < previous) { stop("CLOCK_REFUSED"); refuse(first); } previous = at; return at; };
  const alive = () => { if (first) refuse(first); const at = now(); if (at >= started + FENCE_PROBE_LIMITS.caseMs) { stop("CASE_TIMEOUT"); refuse(first); } return at; };
  const bounded = async operation => { alive(); const pending = Promise.resolve().then(() => { alive(); return operation(); }); const value = await Promise.race([pending, veto]); alive(); return value; };
  const snapshot = () => readCounts(lease.snapshot());
  const sourceFacts = () => {
    const s = record(lease.sourceFacts(), ["closed", "listenerAlive"]);
    if (typeof s.closed !== "boolean" || typeof s.listenerAlive !== "boolean" || s.closed && s.listenerAlive) refuse("TRANSPORT_REFUSED");
    result.sourceClosedBeforeDecision = s.closed; result.sourceListenerAlive = s.listenerAlive;
    if (s.closed && result.timing.sourceClosedMs === null) result.timing.sourceClosedMs = relative(now(), started, FENCE_PROBE_LIMITS.caseMs);
  };
  const drain = async predicate => { for (let polls = 0; polls <= 601; polls++) { alive(); const n = snapshot(); if (n.unknownRequests || n.downloads || n.popups) refuse("REQUEST_REFUSED"); if (predicate(n)) return; await bounded(() => ports.pause(Math.min(25, started + FENCE_PROBE_LIMITS.caseMs - now()))); } refuse("LIMIT_REFUSED"); };
  try {
    started = now(); timer = ports.schedule(() => stop("CASE_TIMEOUT"), FENCE_PROBE_LIMITS.caseMs);
    lease = ports.createCase({ kind: definition.kind, signal: controller.signal, refuse: stop });
    await bounded(() => lease.start(() => Math.max(1, Math.floor(started + FENCE_PROBE_LIMITS.caseMs - alive()))));
    result.timing.readyMs = relative(now(), started, FENCE_PROBE_LIMITS.caseMs);
    await bounded(() => lease.trigger());
    await drain(n => originalPending(n) && n.handlersPending === 0);
    // Fence only after this exact held fetch was continued and received. It is
    // the already-installed handler, not a later route with wider authority.
    await bounded(() => lease.armFence()); result.fenceArmed = true; result.timing.fenceMs = relative(now(), started, FENCE_PROBE_LIMITS.caseMs);
    if (definition.kind === "control") await bounded(() => lease.releaseResponse());
    else {
      await bounded(() => lease.stopLoading());
      await bounded(() => lease.blank());
      if (!definition.guardRetained) { await bounded(() => lease.unroute()); result.guardRemovedBeforeDecision = true; }
      if (definition.sourceClosed) { await bounded(() => lease.closeSource()); sourceFacts(); }
    }
    sourceFacts();
    if (result.sourceClosedBeforeDecision !== definition.sourceClosed || result.sourceListenerAlive !== !definition.sourceClosed) refuse("TRANSPORT_REFUSED");
    await drain(n => originalDrained(n) && (definition.kind === "control" ? n.responsesFinished === 1 && n.publicFinished === 1 && n.cdpFinished === 1 : n.responsesFinished === 0));
    alive();
    result.outcome = definition.kind === "control" ? "CONTROL_PASSED" : "DRAINED";
    result.code = definition.kind === "control" ? "CONTROL_PASSED" : "ORIGINAL_TERMINALS";
  } catch (error) {
    first ??= safeCode(error); result.outcome = first === "CASE_TIMEOUT" ? "INCONCLUSIVE" : "REFUSED"; result.code = first;
  } finally {
    // Snapshot callbacks may queue their veto as a microtask while returning
    // valid counters. Settle that checkpoint before sealing the decision; the
    // same original deadline stays armed throughout, without a new budget.
    try { result.counts = snapshot(); sourceFacts(); } catch { stop("TRANSPORT_REFUSED"); }
    await Promise.resolve();
    try { const decidedAt = now(); result.timing.decisionMs = relative(decidedAt, started, FENCE_PROBE_LIMITS.caseMs); if (decidedAt >= started + FENCE_PROBE_LIMITS.caseMs) stop("CASE_TIMEOUT"); } catch { stop("CLOCK_REFUSED"); }
    await Promise.resolve();
    // Checkpoints can start a new authorized handler without raising a veto.
    // Recapture after them, then perform every final check and seal in this
    // synchronous turn. No await may separate this copy from the seal below.
    try { result.counts = snapshot(); sourceFacts(); } catch { stop("TRANSPORT_REFUSED"); }
    try { const decidedAt = now(); result.timing.decisionMs = relative(decidedAt, started, FENCE_PROBE_LIMITS.caseMs); if (decidedAt >= started + FENCE_PROBE_LIMITS.caseMs) stop("CASE_TIMEOUT"); } catch { stop("CLOCK_REFUSED"); }
    const finalCounts = result.counts;
    const factorsMatch = result.fenceArmed && result.guardRemovedBeforeDecision === !definition.guardRetained && result.sourceClosedBeforeDecision === definition.sourceClosed && result.sourceListenerAlive === !definition.sourceClosed && (!definition.sourceClosed || finalCounts.socketsLive === 0 && result.timing.sourceClosedMs !== null && result.timing.sourceClosedMs < FENCE_PROBE_LIMITS.caseMs);
    if (finalCounts.unknownRequests || finalCounts.downloads || finalCounts.popups) stop("REQUEST_REFUSED");
    if (!factorsMatch) stop("TRANSPORT_REFUSED");
    if (first !== null) { result.outcome = first === "CASE_TIMEOUT" ? "INCONCLUSIVE" : "REFUSED"; result.code = first; }
    else if (originalDrained(finalCounts) && (definition.kind === "control" ? finalCounts.responsesFinished === 1 && finalCounts.publicFinished === 1 && finalCounts.cdpFinished === 1 : finalCounts.responsesFinished === 0)) { result.outcome = definition.kind === "control" ? "CONTROL_PASSED" : "DRAINED"; result.code = definition.kind === "control" ? "CONTROL_PASSED" : "ORIGINAL_TERMINALS"; }
    else { result.outcome = "INCONCLUSIVE"; result.code = "TRANSPORT_REFUSED"; }
    // A timer callback alone is not proof that the absolute deadline elapsed.
    // An early callback stays INCONCLUSIVE; it must not create an invalid PENDING.
    if (first === "CASE_TIMEOUT" && result.timing.decisionMs >= FENCE_PROBE_LIMITS.caseMs && definition.kind !== "control" && factorsMatch && originalPending(finalCounts) && finalCounts.handlersPending === 0 && finalCounts.unknownRequests === 0 && finalCounts.downloads === 0 && finalCounts.popups === 0) { result.outcome = "PENDING"; result.code = "ORIGINAL_PENDING_AT_DEADLINE"; }
    // Decision sealed: cancellation and owned cleanup below cannot qualify or
    // erase the copied request/failure facts, even if they produce later events.
    ports.cancel(timer);
    controller.abort();
    if (lease) {
      let cleanupTimer, expired = false; const cleanupStart = ports.now();
      try {
        const timeout = new Promise((_yes, no) => { cleanupTimer = ports.schedule(() => { expired = true; no(new Error("CLEANUP_UNCONFIRMED")); }, FENCE_PROBE_LIMITS.cleanupMs); });
        const facts = await Promise.race([lease.cleanup(), timeout]), completed = ports.now();
        if (expired || !Number.isFinite(completed) || completed < cleanupStart || completed >= cleanupStart + FENCE_PROBE_LIMITS.cleanupMs) refuse("CLEANUP_UNCONFIRMED");
        result.cleanup = readCleanup(facts);
      } catch { /* Unconfirmed owned cleanup blocks the next case. */ }
      finally { ports.cancel(cleanupTimer); result.timing.cleanupMs = relative(ports.now(), cleanupStart, FENCE_PROBE_LIMITS.cleanupMs); }
    }
  }
  return result;
}

export async function runBrowserQuiescenceFenceProbe(ports) {
  if (!ports || ["now", "pause", "schedule", "cancel", "createCase"].some(key => typeof ports[key] !== "function")) refuse("ARGUMENTS_REFUSED");
  const native = nativePorts.has(ports), report = { schemaVersion: 1, scenario: "browser-quiescence-fence-probe", mode: native ? "native" : "synthetic", sourceSha: native ? ports.sourceSha : null, diagnosticOnly: true, applicationAccepted: false, controlQualified: false, cases: CASES.map(definition => blankCase(definition)) };
  report.cases[0] = await observeCase(CASES[0], ports);
  report.controlQualified = report.cases[0].outcome === "CONTROL_PASSED" && allClean(report.cases[0].cleanup);
  if (report.controlQualified) for (let index = 1; index < CASES.length; index++) {
    if (!allClean(report.cases[index - 1].cleanup)) { report.cases[index].code = "CLEANUP_REQUIRED"; continue; }
    if (index > 1 && report.cases[index - 1].outcome === "NOT_RUN") { report.cases[index].code = "CLEANUP_REQUIRED"; continue; }
    report.cases[index] = await observeCase(CASES[index], ports);
  }
  return validateFenceProbeReport(report);
}

async function verifyPublicSources() {
  if ((await readdir(ROOT)).some(name => name !== ".env.example" && /^\.env(?:\.|$)/.test(name))) refuse("ENVIRONMENT_REFUSED");
  for (const [relativePath, bytes, sha] of FENCE_PUBLIC_PINS) {
    const path = resolve(ROOT, relativePath), stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes || await realpath(path) !== path || createHash("sha256").update(await readFile(path)).digest("hex") !== sha) refuse("SOURCE_REFUSED");
  }
}

function createHttpCase({ chromium, createBrowserProtocolObserver, environment }, options) {
  const paths = new Set(["/fence.html", "/favicon.ico", "/held-fetch"]), sockets = new Set(), responses = new Set(), n = emptyCounts();
  let browser, context, page, session, observer, ledger, fence, origin, remaining, closing = false, startupStarted = false, startupSettled = false, serverStarted = false, serverClosed = false, listeningPromise, sourcePromise, browserClosed = false, contextClosed = false, sessionDetached = false;
  const fail = code => options.refuse(code), live = () => { if (closing || options.signal.aborted) refuse("TRANSPORT_REFUSED"); };
  const accepted = request => { const url = new URL(request.url()); return url.origin === origin && !url.username && !url.password && !url.search && !url.hash && paths.has(url.pathname) && request.method() === "GET"; };
  const server = createServer((request, response) => {
    if (request.method !== "GET" || !paths.has(request.url)) { response.destroy(); fail("REQUEST_REFUSED"); return; }
    if (request.url === "/fence.html") { response.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); response.end("<!doctype html><html><head><title>Public fence control</title></head><body>Public synthetic fixture</body></html>"); return; }
    if (request.url === "/favicon.ico") { response.writeHead(204); response.end(); return; }
    if (closing || options.signal.aborted || n.serverReceived >= 1) { response.destroy(); fail("LIMIT_REFUSED"); return; }
    n.serverReceived++; responses.add(response); response.once("finish", () => { n.responsesFinished++; });
  });
  server.on("connection", socket => { if (closing || options.signal.aborted || n.socketsCreated >= FENCE_PROBE_LIMITS.maxSockets) { socket.destroy(); if (!closing && !options.signal.aborted) fail("LIMIT_REFUSED"); return; } sockets.add(socket); n.socketsCreated++; socket.once("close", () => { sockets.delete(socket); n.socketsClosed++; }); });
  server.on("error", () => fail("TRANSPORT_REFUSED"));
  server.on("clientError", (_error, socket) => { socket.destroy(); fail("REQUEST_REFUSED"); });
  server.on("listening", () => { serverStarted = true; }); server.on("close", () => { serverClosed = true; });
  const closeSource = () => sourcePromise ??= (async () => {
    if (listeningPromise) await listeningPromise.catch(() => {});
    if (server.listening) await new Promise((yes, no) => { server.close(error => error ? no(error) : yes()); for (const socket of sockets) socket.destroy(); });
    while (sockets.size) await new Promise(yes => setTimeout(yes, 1));
    if (serverStarted && !serverClosed) refuse("TRANSPORT_REFUSED");
  })();
  const snapshot = () => {
    const f = fence?.snapshot(), counts = { ...n, ...ledger?.snapshot(), socketsLive: sockets.size };
    if (f) Object.assign(counts, { handlersStarted: f.handlersStarted, handlersSettled: f.handlersSettled, handlersPending: f.handlersPending, fenceReadAborts: f.readsAborted, fenceAbortAcks: f.abortAcks, unknownRequests: f.unknownRequests });
    return counts;
  };
  return Object.freeze({
    snapshot,
    sourceFacts: () => ({ closed: serverStarted && serverClosed && !server.listening, listenerAlive: serverStarted && server.listening && !serverClosed }),
    async start(budget) {
      remaining = budget; startupStarted = true;
      try {
        live(); listeningPromise = new Promise((yes, no) => { const failed = () => no(new Error("TRANSPORT_REFUSED")); server.once("error", failed); server.listen(0, "127.0.0.1", () => { server.off("error", failed); yes(); }); }); await listeningPromise; live();
        origin = "http://127.0.0.1:" + server.address().port;
        browser = await chromium.launch({ headless: true, timeout: remaining(), env: environment });
        if (closing || options.signal.aborted) { await browser.close(); browserClosed = true; refuse("TRANSPORT_REFUSED"); }
        if (browser.version() !== FENCE_PROBE_BINDING.chromium) refuse("SOURCE_REFUSED");
        context = await browser.newContext({ baseURL: origin, serviceWorkers: "block", acceptDownloads: false });
        if (closing || options.signal.aborted) { await context.close(); contextClosed = true; refuse("TRANSPORT_REFUSED"); }
        await context.setOffline(false); live();
        observer = createBrowserProtocolObserver({ fetchCommands: true });
        ledger = createOriginalRequestLedger(observer, fail);
        fence = createQuiescenceFence({ allowed: accepted, readCancellation: accepted, onRefusal: fail });
        context.on("request", request => { try { if (!accepted(request)) { fail("REQUEST_REFUSED"); return; } if (new URL(request.url()).pathname === "/held-fetch") ledger.begin(request, page); } catch { fail("REQUEST_REFUSED"); } });
        context.on("requestfinished", request => ledger.terminal(request, "finished"));
        context.on("requestfailed", request => ledger.terminal(request, "failed"));
        await context.route("**/*", route => fence.handle({ request: () => route.request(), abort: () => route.abort(), async continue() { await route.continue(); ledger.continued(route.request()); } })); live();
        page = await context.newPage(); live(); observer.observePage(page);
        page.on("download", download => { n.downloads++; fail("REQUEST_REFUSED"); void download.cancel().catch(() => {}); });
        page.on("popup", () => { n.popups++; fail("REQUEST_REFUSED"); });
        await page.goto(origin + "/fence.html", { waitUntil: "domcontentloaded", timeout: remaining() }); live();
      } finally { startupSettled = true; }
    },
    async trigger() { live(); await page.evaluate(() => { void fetch("/held-fetch").then(response => response.arrayBuffer()).catch(() => {}); }); },
    armFence() { live(); fence.arm(); },
    async releaseResponse() { live(); if (n.serverReceived !== 1 || responses.size !== 1) refuse("TRANSPORT_REFUSED"); for (const response of responses) { remaining(); response.writeHead(200, { "content-type": "application/octet-stream", "cache-control": "no-store" }); response.end("public synthetic body"); } },
    async stopLoading() { live(); session = await context.newCDPSession(page); if (closing || options.signal.aborted) { await session.detach(); sessionDetached = true; refuse("TRANSPORT_REFUSED"); } await session.send("Page.stopLoading"); },
    blank() { live(); return page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: remaining() }); },
    unroute() { live(); return context.unrouteAll({ behavior: "wait" }); },
    closeSource,
    async cleanup() {
      closing = true; observer?.dispose();
      const clean = async (operation, done) => { try { await operation(); done(); } catch { /* Owned cleanup fact remains unconfirmed. */ } };
      await Promise.all([clean(closeSource, () => {}), (async () => {
        await clean(async () => { if (session) await session.detach(); }, () => { if (session) sessionDetached = true; });
        await clean(async () => { if (context) await context.close(); }, () => { if (context) contextClosed = true; });
        await clean(async () => { if (browser) await browser.close(); }, () => { if (browser) browserClosed = true; });
      })()]);
      return { server: serverClosed ? "close_observed" : serverStarted ? "unconfirmed" : "absent", context: contextClosed ? "close_observed" : context ? "unconfirmed" : "absent", browser: browserClosed ? "close_observed" : browser ? "unconfirmed" : "absent", session: sessionDetached ? "close_observed" : session ? "unconfirmed" : "absent", socketsClosed: sockets.size === 0 && n.socketsClosed === n.socketsCreated, startupSettled: !startupStarted || startupSettled, handlersSettled: !fence || fence.snapshot().handlersPending === 0 };
    },
  });
}
async function createNativePorts(env) {
  const environment = validateFenceProbeEnvironment(env, { platform: process.platform, arch: process.arch, node: process.version });
  await verifyPublicSources();
  const { chromium } = await import("playwright-core"), { createBrowserProtocolObserver } = await import("../../tests/e2e-auth-local/admin-browser-support.mjs");
  const ports = { sourceSha: env.GITHUB_SHA, now: performance.now.bind(performance), pause: ms => new Promise(yes => setTimeout(yes, ms)), schedule: (callback, ms) => setTimeout(callback, ms), cancel: clearTimeout, createCase: options => createHttpCase({ chromium, createBrowserProtocolObserver, environment }, options) };
  nativePorts.add(ports); return ports;
}
export async function main(argv = process.argv.slice(2), env = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  try {
    const options = parseFenceProbeArguments(argv);
    if (!options.execute) { output({ schemaVersion: 1, scenario: "browser-quiescence-fence-probe", code: "NO_SERVICE_STARTED", applicationAccepted: false }); return 0; }
    const report = await runBrowserQuiescenceFenceProbe(await createNativePorts(env)); output(report);
    return report.controlQualified && report.cases.every(c => ["CONTROL_PASSED", "DRAINED", "PENDING"].includes(c.outcome) && allClean(c.cleanup)) ? 0 : 1;
  } catch (error) { output({ schemaVersion: 1, scenario: "browser-quiescence-fence-probe", code: safeCode(error), diagnosticOnly: true, applicationAccepted: false }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
