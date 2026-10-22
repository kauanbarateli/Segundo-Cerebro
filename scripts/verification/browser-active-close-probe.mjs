/** Public-only active context close. Import/help opens no service or process. */
import { performance } from "node:perf_hooks";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, readdir, lstat, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types } from "node:util";
import { FENCE_PROBE_BINDING, FENCE_PUBLIC_PINS, createQuiescenceFence } from "./browser-quiescence-fence-probe.mjs";
import { createRedirectRequestLedger, REDIRECT_COUNT_KEYS, validateRedirectProbeEnvironment } from "./browser-redirect-drain-probe.mjs";
import { acceptsBrowserProtocolObservation } from "../../tests/e2e-auth-local/admin-browser-contract.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url)), nativePorts = new WeakSet();
export const ACTIVE_CLOSE_BINDING = FENCE_PROBE_BINDING;
export const ACTIVE_CLOSE_CASES = Object.freeze(["control", "direct-active-close"]);
export const ACTIVE_CLOSE_LIMITS = Object.freeze({ caseMs: 15000, cleanupMs: 5000, counts: 16, reportBytes: 16384 });
export const ACTIVE_CLOSE_PUBLIC_PINS = Object.freeze([...FENCE_PUBLIC_PINS,
  ["scripts/verification/browser-redirect-drain-probe.mjs", 30674, "925cea876490f0977c91a85e8dca01042a100ec662b72c3684b8618e5529d5b7"],
  ["scripts/verification/browser-quiescence-fence-probe.mjs", 36807, "b92b67266842cbdfd3195652edf908d0f6c1ffc7cf1c8a04ee539cb58c123ec3"],
  ["tests/e2e-auth-local/admin-browser-contract.mjs", 19354, "f1d369db2ae600022f77661e9f187f18f24722e95898a3b23ba7f69cda4039da"],
].map(Object.freeze));
const CODES = new Set(["CONTROL_PASSED", "ORIGINAL_TERMINALS_AFTER_OWNED_CLOSE", "ORIGINAL_TERMINALS_BEFORE_CLOSE", "CONTROL_REQUIRED", "CASE_TIMEOUT", "ORIGINAL_READ_PENDING", "PROTOCOL_UNAVAILABLE", "OWNED_CLOSE_UNCONFIRMED", "ARGUMENTS_REFUSED", "ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "TRANSPORT_REFUSED", "REQUEST_REFUSED", "CLOCK_REFUSED", "LIMIT_REFUSED", "CLEANUP_UNCONFIRMED", "PROBE_REFUSED"]);
const refuse = code => { const error = Error(CODES.has(code) ? code : "PROBE_REFUSED"); error.code = error.message; throw error; };
const safeCode = error => { try { if (!error || types.isProxy(error)) return "PROBE_REFUSED"; const d = Object.getOwnPropertyDescriptor(error, "code"); return d && Object.hasOwn(d, "value") && CODES.has(d.value) ? d.value : "PROBE_REFUSED"; } catch { return "PROBE_REFUSED"; } };
function record(input, keys) {
  if (!input || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) refuse("PROBE_REFUSED");
  const d = Object.getOwnPropertyDescriptors(input); if (Reflect.ownKeys(d).length !== keys.length || Reflect.ownKeys(d).some(key => !keys.includes(key))) refuse("PROBE_REFUSED");
  return Object.fromEntries(keys.map(key => { const slot = d[key]; if (!slot?.enumerable || !Object.hasOwn(slot, "value")) refuse("PROBE_REFUSED"); return [key, slot.value]; }));
}
function array(input, length) { if (types.isProxy(input) || !Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) refuse("PROBE_REFUSED"); const d = Object.getOwnPropertyDescriptors(input); if (d.length?.value !== length || Reflect.ownKeys(d).length !== length + 1) refuse("PROBE_REFUSED"); return Array.from({ length }, (_, i) => { const slot = d[String(i)]; if (!slot?.enumerable || !Object.hasOwn(slot, "value")) refuse("PROBE_REFUSED"); return slot.value; }); }
const integer = (value, limit = 16) => Number.isSafeInteger(value) && value >= 0 && value <= limit;
const emptyCounts = () => Object.fromEntries(REDIRECT_COUNT_KEYS.map(key => [key, 0]));
function counts(input) { const n = record(input, REDIRECT_COUNT_KEYS); if (!Object.values(n).every(v => integer(v))) refuse("LIMIT_REFUSED"); if (n.publicFinished + n.publicFailed + n.pendingRequests !== n.requestsStarted || n.socketsClosed + n.socketsLive !== n.socketsCreated || n.handlersSettled + n.handlersPending !== n.handlersStarted || n.rootRouteCallbacks || n.rootRouteAcks || n.redirectRoots || n.redirectLinks || n.redirectReceived || n.redirectResponsesFinished || n.lineageAmbiguous) refuse("TRANSPORT_REFUSED"); return n; }
const absentProtocol = () => ({ identity: "unavailable", order: "unavailable", terminal: "unavailable", publicTerminal: "unavailable", managerEntry: "unavailable", sessionRegistered: "unavailable", fetchCommand: "unavailable", fetchOutcome: "unavailable" });
function protocol(input) { if (!input || !acceptsBrowserProtocolObservation(input) || Reflect.ownKeys(input).length !== 8) refuse("PROBE_REFUSED"); return { ...input }; }
const emptyClose = () => ({ requests: 0, events: 0, promise: "not-requested" });
function closeFacts(input) { const c = record(input, ["requests", "events", "promise"]); if (!integer(c.requests, 1) || !integer(c.events, 1) || !["not-requested", "pending", "resolved", "rejected"].includes(c.promise) || (c.requests === 0) !== (c.promise === "not-requested")) refuse("TRANSPORT_REFUSED"); return c; }
const ownedClose = c => c.requests === 1 && c.events === 1 && c.promise === "resolved";
const emptyCleanup = () => ({ server: "unconfirmed", context: "unconfirmed", browser: "unconfirmed", session: "unconfirmed", socketsClosed: false, startupSettled: false, actionsSettled: false, handlersSettled: false });
function cleanup(input) { const c = record(input, Object.keys(emptyCleanup())); if (["server", "context", "browser", "session"].some(k => !["absent", "close_observed", "unconfirmed"].includes(c[k])) || ["socketsClosed", "startupSettled", "actionsSettled", "handlersSettled"].some(k => typeof c[k] !== "boolean")) refuse("PROBE_REFUSED"); return c; }
const clean = c => ["server", "context", "browser", "session"].every(k => ["absent", "close_observed"].includes(c[k])) && c.socketsClosed && c.startupSettled && c.actionsSettled && c.handlersSettled;
/** Shared RAM seam, not a resource certificate. The native caller retains
 * every original handle/event. A rejected operation never becomes success. */
export async function settleActiveCloseCleanup(input) {
  const ports = record(input, ["source", "context", "session", "browser"]); if (Object.values(ports).some(fn => typeof fn !== "function")) refuse("ARGUMENTS_REFUSED");
  let failed = false; const owned = async fn => { try { await fn(); } catch { failed = true; } };
  const source = owned(ports.source);
  await owned(ports.context); await owned(ports.session); await owned(ports.browser);
  await source; return !failed;
}
const snapshotKeys = ["counts", "finalProtocol", "close", "actionsPending"];
const blankSnapshot = () => ({ counts: emptyCounts(), finalProtocol: absentProtocol(), close: emptyClose(), actionsPending: 0 });
function snapshot(input) { const s = record(input, snapshotKeys); s.counts = counts(s.counts); s.finalProtocol = protocol(s.finalProtocol); s.close = closeFacts(s.close); if (!integer(s.actionsPending)) refuse("LIMIT_REFUSED"); return s; }
const originalRead = n => n.requestsStarted === 1 && n.targetRequests === 1 && n.targetRouteCallbacks === 1 && n.targetRouteAcks === 1 && n.serverReceived === 1;
function originalDrained(s) { const n = s.counts, p = s.finalProtocol; return originalRead(n) && n.pendingRequests === 0 && n.publicFinished + n.publicFailed === 1 && n.handlersPending === 0 && s.actionsPending === 0 && !n.unknownRequests && !n.downloads && !n.popups && p.identity === "exact-server-request" && ["finished", "failed"].includes(p.terminal) && p.publicTerminal === p.terminal && p.managerEntry === "absent" && ["registered", "removed"].includes(p.sessionRegistered); }
function originalPending(s) { const n = s.counts, p = s.finalProtocol; return originalRead(n) && n.pendingRequests === 1 && n.publicFinished + n.publicFailed === 0 && p.identity === "exact-server-request" && p.terminal === "not-observed" && p.publicTerminal === "not-observed"; }
const preCloseRead = s => originalPending(s) && s.finalProtocol.managerEntry === "same-request" && s.finalProtocol.sessionRegistered === "registered" && s.counts.handlersPending === 0 && s.actionsPending === 0 && !s.counts.unknownRequests && !s.counts.downloads && !s.counts.popups && JSON.stringify(s.close) === JSON.stringify(emptyClose());
const relative = (at, start, limit) => Number.isFinite(at) && Number.isFinite(start) && at >= start ? Math.min(limit + 1, Math.floor(at - start)) : null;
const blank = kind => ({ kind, outcome: "NOT_RUN", code: "CONTROL_REQUIRED", fenceArmed: false, sourceClosedBeforeDecision: false, sourceListenerAlive: false, beforeCloseObserved: false, beforeClose: blankSnapshot(), final: blankSnapshot(), ioZeroBeforeClose: false, ioZeroAfterClose: false, timing: { readyMs: null, fenceMs: null, sourceClosedMs: null, closeRequestedMs: null, closeObservedMs: null, decisionMs: null, cleanupMs: null }, cleanup: emptyCleanup() });
function factors(c) { const s = c.final, n = s.counts; return c.fenceArmed && c.sourceClosedBeforeDecision && !c.sourceListenerAlive && c.timing.sourceClosedMs !== null && c.timing.sourceClosedMs < 15000 && n.socketsLive === 0 && n.socketsClosed === n.socketsCreated && n.handlersPending === 0 && s.actionsPending === 0 && !n.unknownRequests && !n.downloads && !n.popups; }

export function validateActiveCloseReport(input) {
  const r = record(input, ["schemaVersion", "scenario", "mode", "sourceSha", "diagnosticOnly", "applicationAccepted", "controlQualified", "cases"]);
  if (r.schemaVersion !== 1 || r.scenario !== "browser-active-close-probe" || !["native", "synthetic"].includes(r.mode) || (r.mode === "native" ? typeof r.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(r.sourceSha) : r.sourceSha !== null) || r.diagnosticOnly !== true || r.applicationAccepted !== false || typeof r.controlQualified !== "boolean") refuse("PROBE_REFUSED");
  r.cases = array(r.cases, 2).map((input, index) => {
    const c = record(input, Object.keys(blank(ACTIVE_CLOSE_CASES[index]))); if (c.kind !== ACTIVE_CLOSE_CASES[index] || !["NOT_RUN", "CONTROL_PASSED", "DRAINED", "INCONCLUSIVE", "REFUSED"].includes(c.outcome) || !CODES.has(c.code) || ["fenceArmed", "sourceClosedBeforeDecision", "sourceListenerAlive", "beforeCloseObserved", "ioZeroBeforeClose", "ioZeroAfterClose"].some(k => typeof c[k] !== "boolean")) refuse("PROBE_REFUSED");
    c.beforeClose = snapshot(c.beforeClose); c.final = snapshot(c.final); c.cleanup = cleanup(c.cleanup); c.timing = record(c.timing, Object.keys(blank(c.kind).timing)); const t = c.timing;
    if (Object.entries(t).some(([key, at]) => !(at === null || integer(at, key === "cleanupMs" ? 5001 : 15001))) || c.sourceClosedBeforeDecision && c.sourceListenerAlive || c.sourceClosedBeforeDecision !== (t.sourceClosedMs !== null) || t.closeRequestedMs !== null && !c.beforeCloseObserved || !c.beforeCloseObserved && JSON.stringify(c.beforeClose) !== JSON.stringify(blankSnapshot()) || c.ioZeroBeforeClose !== (c.beforeCloseObserved && originalDrained(c.beforeClose)) || c.ioZeroAfterClose !== originalDrained(c.final)) refuse("PROBE_REFUSED");
    if (t.fenceMs !== null && (t.readyMs === null || t.fenceMs < t.readyMs) || t.sourceClosedMs !== null && (t.fenceMs === null || t.sourceClosedMs < t.fenceMs) || t.closeRequestedMs !== null && (t.sourceClosedMs === null || t.closeRequestedMs < t.sourceClosedMs) || t.closeObservedMs !== null && (t.closeRequestedMs === null || t.closeObservedMs < t.closeRequestedMs) || t.decisionMs !== null && [t.readyMs, t.fenceMs, t.sourceClosedMs, t.closeRequestedMs, t.closeObservedMs].some(at => at !== null && at > t.decisionMs)) refuse("PROBE_REFUSED");
    if (c.outcome === "NOT_RUN") { if (c.code !== "CONTROL_REQUIRED" || JSON.stringify(c) !== JSON.stringify(blank(c.kind))) refuse("PROBE_REFUSED"); }
    else if (["CONTROL_PASSED", "DRAINED"].includes(c.outcome)) {
      if (!factors(c) || !c.beforeCloseObserved || t.readyMs === null || t.fenceMs === null || t.decisionMs === null || t.decisionMs >= 15000 || !c.ioZeroAfterClose) refuse("PROBE_REFUSED");
      if (index === 0 ? c.outcome !== "CONTROL_PASSED" || c.code !== "CONTROL_PASSED" || !c.ioZeroBeforeClose || c.final.counts.responsesFinished !== 1 || c.final.counts.publicFinished !== 1 || c.final.finalProtocol.terminal !== "finished" || JSON.stringify(c.beforeClose.close) !== JSON.stringify(emptyClose()) || JSON.stringify(c.final.close) !== JSON.stringify(emptyClose()) || t.closeRequestedMs !== null || t.closeObservedMs !== null : c.outcome !== "DRAINED" || c.code !== "ORIGINAL_TERMINALS_AFTER_OWNED_CLOSE" || !preCloseRead(c.beforeClose) || c.ioZeroBeforeClose || c.final.counts.responsesFinished !== 0 || !ownedClose(c.final.close) || t.closeRequestedMs === null || t.closeObservedMs === null) refuse("PROBE_REFUSED");
    } else if (["CONTROL_PASSED", "ORIGINAL_TERMINALS_AFTER_OWNED_CLOSE", "CONTROL_REQUIRED"].includes(c.code)) refuse("PROBE_REFUSED");
    return c;
  });
  if (r.controlQualified !== (r.cases[0].outcome === "CONTROL_PASSED" && clean(r.cases[0].cleanup)) || !r.controlQualified && r.cases[1].outcome !== "NOT_RUN" || Buffer.byteLength(JSON.stringify(r)) > 16384) refuse("PROBE_REFUSED"); return r;
}

async function observe(kind, ports) {
  const c = blank(kind), controller = new AbortController(); let first = null, nonTimeoutFailure = false, started, previous, lease, timer, rejectVeto;
  const veto = new Promise((_yes, no) => { rejectVeto = no; }); veto.catch(() => {});
  const stop = code => { const safe = CODES.has(code) ? code : "PROBE_REFUSED"; if (safe !== "CASE_TIMEOUT") nonTimeoutFailure = true; if (first === null) { first = safe; const error = Error(first); error.code = first; rejectVeto(error); } };
  const now = () => { const at = ports.now(); if (!Number.isFinite(at) || previous !== undefined && at < previous) { stop("CLOCK_REFUSED"); refuse(first); } previous = at; return at; };
  const alive = () => { if (first) refuse(first); const at = now(); if (at >= started + 15000) { stop("CASE_TIMEOUT"); refuse(first); } return at; };
  const bounded = async operation => { alive(); const result = await Promise.race([Promise.resolve().then(() => { alive(); return operation(); }), veto]); alive(); return result; };
  const copy = () => { c.final = snapshot(lease.snapshot()); const s = record(lease.sourceFacts(), ["closed", "listenerAlive"]); if (typeof s.closed !== "boolean" || typeof s.listenerAlive !== "boolean" || s.closed && s.listenerAlive) refuse("TRANSPORT_REFUSED"); c.sourceClosedBeforeDecision = s.closed; c.sourceListenerAlive = s.listenerAlive; if (s.closed && c.timing.sourceClosedMs === null) c.timing.sourceClosedMs = relative(now(), started, 15000); if (c.final.close.requests === 1 && c.final.close.events === 1 && c.timing.closeObservedMs === null) c.timing.closeObservedMs = relative(now(), started, 15000); };
  const drain = async predicate => { for (let i = 0; i <= 601; i++) { alive(); copy(); if (c.final.counts.unknownRequests || c.final.counts.downloads || c.final.counts.popups) refuse("REQUEST_REFUSED"); if (predicate()) return; await bounded(() => ports.pause(Math.min(25, started + 15000 - now()))); } refuse("LIMIT_REFUSED"); };
  try {
    started = now(); timer = ports.schedule(() => stop("CASE_TIMEOUT"), 15000); lease = ports.createCase({ kind, signal: controller.signal, refuse: stop });
    await bounded(() => lease.start(() => Math.max(1, Math.floor(started + 15000 - alive())))); c.timing.readyMs = relative(now(), started, 15000);
    await bounded(() => lease.trigger()); await drain(() => preCloseRead(c.final));
    await bounded(() => lease.armFence()); c.fenceArmed = true; c.timing.fenceMs = relative(now(), started, 15000);
    if (kind === "control") { await bounded(() => lease.releaseResponse()); await drain(() => originalDrained(c.final)); }
    else { await bounded(() => lease.stopLoading()); await bounded(() => lease.blank()); }
    await bounded(() => lease.closeSource()); copy(); if (!factors(c)) refuse("TRANSPORT_REFUSED");
    c.beforeClose = snapshot(lease.snapshot()); c.beforeCloseObserved = true; c.ioZeroBeforeClose = originalDrained(c.beforeClose);
    if (kind !== "control") { if (originalDrained(c.beforeClose)) refuse("ORIGINAL_TERMINALS_BEFORE_CLOSE"); if (!preCloseRead(c.beforeClose)) refuse("TRANSPORT_REFUSED"); await bounded(() => { c.timing.closeRequestedMs = relative(now(), started, 15000); return lease.closeContext(); }); copy(); }
    await drain(() => originalDrained(c.final) && (kind === "control" || ownedClose(c.final.close)));
  } catch (error) { stop(safeCode(error)); }
  finally {
    try { copy(); } catch { stop("TRANSPORT_REFUSED"); }
    await Promise.resolve(); try { now(); } catch { stop("CLOCK_REFUSED"); } await Promise.resolve();
    // Final copied facts and decision share one synchronous turn; cleanup is later.
    try { copy(); const at = now(); c.timing.decisionMs = relative(at, started, 15000); if (at >= started + 15000) stop("CASE_TIMEOUT"); } catch { stop("CLOCK_REFUSED"); }
    c.ioZeroAfterClose = originalDrained(c.final); if (c.final.counts.unknownRequests || c.final.counts.downloads || c.final.counts.popups) stop("REQUEST_REFUSED");
    c.outcome = ["CASE_TIMEOUT", "ORIGINAL_TERMINALS_BEFORE_CLOSE"].includes(first) ? "INCONCLUSIVE" : first ? "REFUSED" : "INCONCLUSIVE"; c.code = first ?? "TRANSPORT_REFUSED";
    if (!first && factors(c) && c.ioZeroAfterClose && c.beforeCloseObserved && (kind === "control" ? c.ioZeroBeforeClose && c.final.counts.responsesFinished === 1 && c.final.counts.publicFinished === 1 && c.final.finalProtocol.terminal === "finished" : preCloseRead(c.beforeClose) && ownedClose(c.final.close) && c.final.counts.responsesFinished === 0)) { c.outcome = kind === "control" ? "CONTROL_PASSED" : "DRAINED"; c.code = kind === "control" ? "CONTROL_PASSED" : "ORIGINAL_TERMINALS_AFTER_OWNED_CLOSE"; }
    // Close without original terminals is diagnostic failure, never PENDING/PASS.
    if (first === "CASE_TIMEOUT" && !nonTimeoutFailure && c.timing.decisionMs >= 15000 && kind !== "control" && factors(c)) c.code = !ownedClose(c.final.close) ? "OWNED_CLOSE_UNCONFIRMED" : originalPending(c.final) ? "ORIGINAL_READ_PENDING" : !originalDrained(c.final) ? "PROTOCOL_UNAVAILABLE" : "CASE_TIMEOUT";
    ports.cancel(timer); controller.abort();
    if (lease) { const cleanupStart = ports.now(); let cleanupTimer, expired = false; try { const timeout = new Promise((_yes, no) => { cleanupTimer = ports.schedule(() => { expired = true; no(Error("CLEANUP_UNCONFIRMED")); }, 5000); }); const value = await Promise.race([lease.cleanup(), timeout]), at = ports.now(); if (expired || !Number.isFinite(at) || at < cleanupStart || at >= cleanupStart + 5000) refuse("CLEANUP_UNCONFIRMED"); c.cleanup = cleanup(value); } catch { /* No cleanup certificate; matrix stays gated. */ } finally { ports.cancel(cleanupTimer); c.timing.cleanupMs = relative(ports.now(), cleanupStart, 5000); } }
  }
  return c;
}
export async function runBrowserActiveCloseProbe(ports) {
  if (!ports || ["now", "pause", "schedule", "cancel", "createCase"].some(k => typeof ports[k] !== "function")) refuse("ARGUMENTS_REFUSED");
  const report = { schemaVersion: 1, scenario: "browser-active-close-probe", mode: nativePorts.has(ports) ? "native" : "synthetic", sourceSha: nativePorts.has(ports) ? ports.sourceSha : null, diagnosticOnly: true, applicationAccepted: false, controlQualified: false, cases: ACTIVE_CLOSE_CASES.map(blank) };
  report.cases[0] = await observe("control", ports); report.controlQualified = report.cases[0].outcome === "CONTROL_PASSED" && clean(report.cases[0].cleanup); if (report.controlQualified) report.cases[1] = await observe("direct-active-close", ports); return validateActiveCloseReport(report);
}

function createHttpCase({ chromium, observerFactory, environment }, options) {
  const paths = new Set(["/fixture.html", "/favicon.ico", "/held"]), sockets = new Set(), responses = new Set(), actions = new Set(), n = emptyCounts(), close = emptyClose();
  let origin, browser, context, page, session, observer, ledger, fence, budget, closing = false, listening, sourcePromise, closePromise, serverStarted = false, serverClosed = false, browserClosed = false, sessionDetached = false, startupStarted = false, startupSettled = false;
  const fail = code => options.refuse(code), live = () => { if (closing || options.signal.aborted) refuse("TRANSPORT_REFUSED"); };
  const action = fn => { const promise = Promise.resolve().then(fn); actions.add(promise); void promise.then(() => actions.delete(promise), error => { actions.delete(promise); fail(safeCode(error)); }); return promise; };
  const allowed = request => { const u = new URL(request.url()); return u.origin === origin && !u.username && !u.password && !u.search && !u.hash && paths.has(u.pathname) && request.method() === "GET"; };
  const server = createServer((request, response) => {
    if (request.method !== "GET" || !paths.has(request.url)) { response.destroy(); fail("REQUEST_REFUSED"); return; }
    if (request.url === "/fixture.html") { response.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); response.end("<!doctype html><html><head><title>Public active close</title></head><body>Public fixture</body></html>"); return; }
    if (request.url === "/favicon.ico") { response.writeHead(204); response.end(); return; }
    if (closing || options.signal.aborted) { response.destroy(); return; } if (++n.serverReceived > 1) { response.destroy(); fail("LIMIT_REFUSED"); return; }
    responses.add(response); response.once("finish", () => n.responsesFinished++);
  });
  server.on("connection", socket => { if (closing || options.signal.aborted || n.socketsCreated >= 16) { socket.destroy(); if (!closing && !options.signal.aborted) fail("LIMIT_REFUSED"); return; } sockets.add(socket); n.socketsCreated++; socket.once("close", () => { sockets.delete(socket); n.socketsClosed++; }); });
  server.on("error", () => fail("TRANSPORT_REFUSED")); server.on("clientError", (_error, socket) => { socket.destroy(); fail("REQUEST_REFUSED"); }); server.on("listening", () => { serverStarted = true; }); server.on("close", () => { serverClosed = true; });
  const closeSource = () => sourcePromise ??= (async () => { if (listening) await listening.catch(() => {}); if (server.listening) await new Promise((yes, no) => { server.close(error => error ? no(error) : yes()); for (const socket of sockets) socket.destroy(); }); while (sockets.size) await new Promise(yes => setTimeout(yes, 1)); if (serverStarted && !serverClosed) refuse("TRANSPORT_REFUSED"); })();
  // Only this function calls context.close. Listener is installed at acquisition.
  // The exact original promise is returned, observed once and retained for cleanup.
  const requestClose = () => {
    if (!context || close.requests !== 0 || closePromise) refuse("OWNED_CLOSE_UNCONFIRMED"); close.requests = 1; close.promise = "pending";
    try { closePromise = context.close({ reason: "PUBLIC_ACTIVE_CLOSE_PROBE" }); if (!closePromise || typeof closePromise.then !== "function") refuse("OWNED_CLOSE_UNCONFIRMED"); void Promise.prototype.then.call(closePromise, () => { close.promise = "resolved"; }, () => { close.promise = "rejected"; fail("OWNED_CLOSE_UNCONFIRMED"); }); return closePromise; }
    catch { close.promise = "rejected"; refuse("OWNED_CLOSE_UNCONFIRMED"); }
  };
  return Object.freeze({
    snapshot() { const l = ledger?.snapshot(), f = fence?.snapshot(); return { counts: { ...n, ...l?.counts, socketsLive: sockets.size, ...(f ? { handlersStarted: f.handlersStarted, handlersSettled: f.handlersSettled, handlersPending: f.handlersPending, fenceReadAborts: f.readsAborted, fenceAbortAcks: f.abortAcks, unknownRequests: f.unknownRequests } : {}) }, finalProtocol: l?.finalProtocol ?? absentProtocol(), close: { ...close }, actionsPending: actions.size }; },
    sourceFacts: () => ({ closed: serverStarted && serverClosed && !server.listening, listenerAlive: serverStarted && server.listening && !serverClosed }),
    start: remaining => action(async () => {
      budget = remaining; startupStarted = true;
      try { live(); listening = new Promise((yes, no) => { const failed = () => no(Error("TRANSPORT_REFUSED")); server.once("error", failed); server.listen(0, "127.0.0.1", () => { server.off("error", failed); yes(); }); }); await listening; live(); origin = "http://127.0.0.1:" + server.address().port;
        browser = await chromium.launch({ headless: true, timeout: budget(), env: environment }); browser.once("disconnected", () => { browserClosed = true; }); if (closing || options.signal.aborted) { await browser.close(); refuse("TRANSPORT_REFUSED"); } if (browser.version() !== ACTIVE_CLOSE_BINDING.chromium) refuse("SOURCE_REFUSED");
        context = await browser.newContext({ baseURL: origin, serviceWorkers: "block", acceptDownloads: false }); context.once("close", () => { close.events++; if (close.requests !== 1) fail("OWNED_CLOSE_UNCONFIRMED"); }); if (closing || options.signal.aborted) { await requestClose(); refuse("TRANSPORT_REFUSED"); } await context.setOffline(false); live();
        observer = observerFactory({ fetchCommands: true }); ledger = createRedirectRequestLedger(observer, fail); fence = createQuiescenceFence({ allowed, readCancellation: allowed, onRefusal: fail });
        context.on("request", request => { try { if (!allowed(request)) { fail("REQUEST_REFUSED"); return; } if (new URL(request.url()).pathname === "/held") ledger.begin(request, page, "target"); } catch { fail("REQUEST_REFUSED"); } }); context.on("requestfinished", request => ledger.terminal(request, "finished")); context.on("requestfailed", request => ledger.terminal(request, "failed"));
        await context.route("**/*", route => { ledger.route(route.request(), false); return fence.handle({ request: () => route.request(), async abort() { await route.abort(); }, async continue() { await route.continue(); ledger.route(route.request(), true); } }); }); live();
        page = await context.newPage(); live(); observer.observePage(page); page.on("download", download => { n.downloads++; fail("REQUEST_REFUSED"); void download.cancel().catch(() => {}); }); page.on("popup", () => { n.popups++; fail("REQUEST_REFUSED"); }); await page.goto(origin + "/fixture.html", { waitUntil: "domcontentloaded", timeout: budget() }); live();
      } finally { startupSettled = true; }
    }),
    trigger: () => action(async () => { live(); await page.evaluate(() => { void fetch("/held").then(response => response.arrayBuffer()).catch(() => {}); }); }),
    armFence() { live(); fence.arm(); },
    releaseResponse: () => action(async () => { live(); if (responses.size !== 1 || n.serverReceived !== 1) refuse("TRANSPORT_REFUSED"); for (const response of responses) { budget(); response.writeHead(200, { "content-type": "application/octet-stream", "cache-control": "no-store" }); response.end("public finite body"); } }),
    stopLoading: () => action(async () => { live(); session = await context.newCDPSession(page); session.once("disconnected", () => { sessionDetached = true; }); live(); await session.send("Page.stopLoading"); }),
    blank: () => action(async () => { live(); await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: budget() }); if (page.url() !== "about:blank") refuse("TRANSPORT_REFUSED"); }),
    closeSource, closeContext() { live(); return requestClose(); },
    async cleanup() { closing = true; observer?.dispose(); const completed = await settleActiveCloseCleanup({ source: closeSource, context: async () => { if (context) await (closePromise ?? requestClose()); }, session: async () => { if (session && !sessionDetached) await session.detach(); }, browser: async () => { if (browser) await browser.close(); } }); return { server: serverClosed ? "close_observed" : serverStarted ? "unconfirmed" : "absent", context: ownedClose(close) ? "close_observed" : context ? "unconfirmed" : "absent", browser: browserClosed ? "close_observed" : browser ? "unconfirmed" : "absent", session: sessionDetached ? "close_observed" : session ? "unconfirmed" : "absent", socketsClosed: sockets.size === 0 && n.socketsCreated === n.socketsClosed, startupSettled: !startupStarted || startupSettled, actionsSettled: actions.size === 0 && completed, handlersSettled: !fence || fence.snapshot().handlersPending === 0 }; },
  });
}
export function validateActiveCloseEnvironment(input, runtime) {
  if (!input || types.isProxy(input)) refuse("ENVIRONMENT_REFUSED"); const descriptors = Object.getOwnPropertyDescriptors(input), allowed = ["CI", "GITHUB_ACTIONS", "SC_BROWSER_ACTIVE_CLOSE_PROBE_RUN", "GITHUB_SHA", "PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"];
  if (Reflect.ownKeys(descriptors).some(key => !allowed.includes(key) || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) refuse("ENVIRONMENT_REFUSED"); const env = Object.fromEntries(Object.entries(descriptors).map(([key, d]) => [key, d.value]));
  if (env.SC_BROWSER_ACTIVE_CLOSE_PROBE_RUN !== "1") refuse("ENVIRONMENT_REFUSED"); delete env.SC_BROWSER_ACTIVE_CLOSE_PROBE_RUN; env.SC_BROWSER_REDIRECT_DRAIN_PROBE_RUN = "1";
  try { return validateRedirectProbeEnvironment(env, runtime); } catch { refuse("ENVIRONMENT_REFUSED"); }
}
async function createNativePorts(env) {
  const environment = validateActiveCloseEnvironment(env, { platform: process.platform, arch: process.arch, node: process.version }); if ((await readdir(ROOT)).some(name => name !== ".env.example" && /^\.env(?:\.|$)/.test(name))) refuse("ENVIRONMENT_REFUSED");
  for (const [relativePath, length, sha] of ACTIVE_CLOSE_PUBLIC_PINS) { const path = resolve(ROOT, relativePath), info = await lstat(path); if (!info.isFile() || info.isSymbolicLink() || info.size !== length || await realpath(path) !== path || createHash("sha256").update(await readFile(path)).digest("hex") !== sha) refuse("SOURCE_REFUSED"); }
  const { chromium } = await import("playwright-core"), { createBrowserProtocolObserver: observerFactory } = await import("../../tests/e2e-auth-local/admin-browser-support.mjs"); const ports = { sourceSha: env.GITHUB_SHA, now: performance.now.bind(performance), pause: ms => new Promise(yes => setTimeout(yes, ms)), schedule: (callback, ms) => setTimeout(callback, ms), cancel: clearTimeout, createCase: options => createHttpCase({ chromium, observerFactory, environment }, options) }; nativePorts.add(ports); return ports;
}
export async function main(argv = process.argv.slice(2), env = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  try { let action; try { [action] = array(argv, 1); } catch { refuse("ARGUMENTS_REFUSED"); } if (!["--help", "--execute"].includes(action)) refuse("ARGUMENTS_REFUSED"); if (action === "--help") { output({ schemaVersion: 1, scenario: "browser-active-close-probe", code: "NO_SERVICE_STARTED", diagnosticOnly: true, applicationAccepted: false }); return 0; } const report = await runBrowserActiveCloseProbe(await createNativePorts(env)); output(report); return report.controlQualified && report.cases.every(c => ["CONTROL_PASSED", "DRAINED"].includes(c.outcome) && clean(c.cleanup)) ? 0 : 1; }
  catch (error) { output({ schemaVersion: 1, scenario: "browser-active-close-probe", code: safeCode(error), diagnosticOnly: true, applicationAccepted: false }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
