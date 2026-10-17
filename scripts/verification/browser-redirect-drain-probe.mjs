/** Public GET-only experiment. Import/help starts no browser, server or process. */
import { performance } from "node:perf_hooks";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, readdir, lstat, realpath } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types } from "node:util";
import { FENCE_PROBE_BINDING, FENCE_PUBLIC_PINS, createQuiescenceFence } from "./browser-quiescence-fence-probe.mjs";
import { acceptsBrowserProtocolObservation } from "../../tests/e2e-auth-local/admin-browser-contract.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url)), nativePorts = new WeakSet();
export const REDIRECT_PROBE_BINDING = FENCE_PROBE_BINDING;
export const REDIRECT_PROBE_LIMITS = Object.freeze({ caseMs: 15000, cleanupMs: 5000, requests: 16, reportBytes: 16384 });
export const REDIRECT_PROBE_CASES = Object.freeze(["control", "direct", "redirect"]);
const CODES = new Set(["CONTROL_PASSED", "ORIGINAL_TERMINALS", "ORIGINAL_PENDING_AT_DEADLINE", "CONTROL_REQUIRED", "CLEANUP_REQUIRED", "CASE_TIMEOUT", "CLOCK_REFUSED", "REQUEST_REFUSED", "LIMIT_REFUSED", "SOURCE_REFUSED", "ENVIRONMENT_REFUSED", "ARGUMENTS_REFUSED", "TRANSPORT_REFUSED", "PROTOCOL_UNAVAILABLE", "CLEANUP_UNCONFIRMED", "PROBE_REFUSED"]);
export const REDIRECT_COUNT_KEYS = Object.freeze(["requestsStarted", "targetRequests", "redirectRoots", "redirectLinks", "lineageAmbiguous", "rootRouteCallbacks", "targetRouteCallbacks", "rootRouteAcks", "targetRouteAcks", "serverReceived", "redirectReceived", "redirectResponsesFinished", "responsesFinished", "publicFinished", "publicFailed", "pendingRequests", "socketsCreated", "socketsClosed", "socketsLive", "handlersStarted", "handlersSettled", "handlersPending", "fenceReadAborts", "fenceAbortAcks", "unknownRequests", "downloads", "popups"]);
const refuse = code => { const e = Error(CODES.has(code) ? code : "PROBE_REFUSED"); e.code = e.message; throw e; };
const safeCode = error => { try { if (!error || types.isProxy(error)) return "PROBE_REFUSED"; const d = Object.getOwnPropertyDescriptor(error, "code"); return d && Object.hasOwn(d, "value") && CODES.has(d.value) ? d.value : "PROBE_REFUSED"; } catch { return "PROBE_REFUSED"; } };
function record(value, keys) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) refuse("PROBE_REFUSED");
  const d = Object.getOwnPropertyDescriptors(value); if (Reflect.ownKeys(d).length !== keys.length || Reflect.ownKeys(d).some(key => !keys.includes(key))) refuse("PROBE_REFUSED");
  return Object.fromEntries(keys.map(key => { if (!d[key]?.enumerable || !Object.hasOwn(d[key], "value")) refuse("PROBE_REFUSED"); return [key, d[key].value]; }));
}
function closedArray(value, length) {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) refuse("PROBE_REFUSED");
  const d = Object.getOwnPropertyDescriptors(value);
  if (d.length?.value !== length || Reflect.ownKeys(d).length !== length + 1) refuse("PROBE_REFUSED");
  return Array.from({ length }, (_, index) => { const slot = d[String(index)]; if (!slot?.enumerable || !Object.hasOwn(slot, "value")) refuse("PROBE_REFUSED"); return slot.value; });
}
function counts(value) { const n = record(value, REDIRECT_COUNT_KEYS); if (Object.values(n).some(v => !Number.isSafeInteger(v) || v < 0 || v > REDIRECT_PROBE_LIMITS.requests)) refuse("LIMIT_REFUSED"); return n; }
const emptyCounts = () => Object.fromEntries(REDIRECT_COUNT_KEYS.map(key => [key, 0]));
const emptyCleanup = () => ({ server: "unconfirmed", context: "unconfirmed", browser: "unconfirmed", session: "unconfirmed", socketsClosed: false, startupSettled: false, handlersSettled: false });
function cleanup(value) { const c = record(value, Object.keys(emptyCleanup())); if (["server", "context", "browser", "session"].some(k => !["absent", "close_observed", "unconfirmed"].includes(c[k])) || ["socketsClosed", "startupSettled", "handlersSettled"].some(k => typeof c[k] !== "boolean")) refuse("PROBE_REFUSED"); return c; }
const clean = c => ["server", "context", "browser", "session"].every(k => ["absent", "close_observed"].includes(c[k])) && c.socketsClosed && c.startupSettled && c.handlersSettled;
const absentProtocol = () => ({ identity: "unavailable", order: "unavailable", terminal: "unavailable", publicTerminal: "unavailable", managerEntry: "unavailable", sessionRegistered: "unavailable", fetchCommand: "unavailable", fetchOutcome: "unavailable" });
function protocol(value) { if (!acceptsBrowserProtocolObservation(value) || value === null || Reflect.ownKeys(value).length !== 8) refuse("PROBE_REFUSED"); return { ...value }; }
const relative = (now, start, limit) => Number.isFinite(now) && Number.isFinite(start) && now >= start ? Math.min(limit + 1, Math.floor(now - start)) : null;
const blank = (kind, code = "CONTROL_REQUIRED") => ({ kind, outcome: "NOT_RUN", code, fenceArmed: false, sourceClosedBeforeDecision: false, sourceListenerAlive: false, counts: emptyCounts(), finalProtocol: absentProtocol(), timing: { readyMs: null, fenceMs: null, sourceClosedMs: null, decisionMs: null, cleanupMs: null }, cleanup: emptyCleanup() });
function lineage(n, kind) { return n.targetRequests === 1 && n.lineageAmbiguous === 0 && n.targetRouteCallbacks === n.targetRouteAcks && (kind === "redirect" ? n.requestsStarted === 2 && n.redirectRoots === 1 && n.redirectLinks === 1 && n.redirectReceived === 1 && n.redirectResponsesFinished === 1 && n.rootRouteCallbacks === 1 && n.rootRouteAcks === 1 && n.targetRouteCallbacks <= 1 : n.requestsStarted === 1 && n.redirectRoots + n.redirectLinks + n.redirectReceived + n.redirectResponsesFinished + n.rootRouteCallbacks + n.rootRouteAcks === 0 && n.targetRouteCallbacks === 1); }
const exactProtocol = p => p.identity === "exact-server-request" && p.sessionRegistered === "registered";
function finished(n, p, kind) { return lineage(n, kind) && n.pendingRequests === 0 && n.publicFinished + n.publicFailed === n.requestsStarted && exactProtocol(p) && ["finished", "failed"].includes(p.terminal) && p.publicTerminal === p.terminal && p.managerEntry === "absent"; }
function pending(n, p, kind) { return lineage(n, kind) && n.pendingRequests === 1 && n.publicFinished + n.publicFailed === n.requestsStarted - 1 && exactProtocol(p) && p.terminal === "not-observed" && p.publicTerminal === "not-observed" && p.managerEntry === "same-request"; }
function factors(c) { const n = c.counts; return c.fenceArmed && c.sourceClosedBeforeDecision && !c.sourceListenerAlive && c.timing.sourceClosedMs !== null && c.timing.sourceClosedMs < 15000 && n.serverReceived === 1 && n.socketsLive === 0 && n.socketsClosed === n.socketsCreated && n.handlersPending === 0 && !n.unknownRequests && !n.downloads && !n.popups; }

/** Original Request objects own lineage and terminals. URLs only select public roles. */
export function createRedirectRequestLedger(observer, onRefusal) {
  if (!observer || ["request", "terminal", "snapshot"].some(k => typeof observer[k] !== "function") || typeof onRefusal !== "function") refuse("ARGUMENTS_REFUSED");
  const rows = new Map(); let root, target, links = 0, ambiguous = 0;
  const fail = () => { ambiguous++; onRefusal("TRANSPORT_REFUSED"); };
  return Object.freeze({
    begin(request, page, role) {
      if (!request || typeof request !== "object" || rows.has(request) || !["root", "target"].includes(role) || rows.size >= 2) { fail(); return; }
      rows.set(request, { role, terminal: null, callbacks: 0, acks: 0 }); observer.request(request, page);
      try {
        const from = request.redirectedFrom();
        if (role === "root") { if (root || from !== null) fail(); else root = request; }
        else { if (target) { fail(); return; } target = request; if (from !== null) { if (from !== root || !rows.has(from) || from.redirectedTo() !== request) fail(); else links++; } else if (root) fail(); }
      } catch { fail(); }
    },
    route(request, ack) { const r = rows.get(request); if (!r) return; if (ack) { if (r.acks >= r.callbacks) fail(); else r.acks++; } else { if (r.callbacks) fail(); else r.callbacks++; } },
    terminal(request, kind) { const r = rows.get(request); if (!r) return; if (r.terminal || !["finished", "failed"].includes(kind)) { fail(); return; } r.terminal = kind; observer.terminal(request, kind); },
    snapshot() {
      const n = { requestsStarted: rows.size, targetRequests: target ? 1 : 0, redirectRoots: root ? 1 : 0, redirectLinks: links, lineageAmbiguous: ambiguous, rootRouteCallbacks: 0, targetRouteCallbacks: 0, rootRouteAcks: 0, targetRouteAcks: 0, publicFinished: 0, publicFailed: 0, pendingRequests: 0 };
      for (const r of rows.values()) { n[r.role + "RouteCallbacks"] += r.callbacks; n[r.role + "RouteAcks"] += r.acks; if (r.terminal === "finished") n.publicFinished++; else if (r.terminal === "failed") n.publicFailed++; else n.pendingRequests++; }
      return { counts: n, finalProtocol: target ? observer.snapshot([target]) ?? absentProtocol() : absentProtocol() };
    },
  });
}

export function validateRedirectDrainReport(input) {
  const r = record(input, ["schemaVersion", "scenario", "mode", "sourceSha", "diagnosticOnly", "applicationAccepted", "controlQualified", "cases"]);
  if (r.schemaVersion !== 1 || r.scenario !== "browser-redirect-drain-probe" || !["native", "synthetic"].includes(r.mode) || (r.mode === "native" ? typeof r.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(r.sourceSha) : r.sourceSha !== null) || r.diagnosticOnly !== true || r.applicationAccepted !== false || typeof r.controlQualified !== "boolean" || !Array.isArray(r.cases) || types.isProxy(r.cases) || r.cases.length !== 3) refuse("PROBE_REFUSED");
  r.cases = closedArray(r.cases, 3).map((value, index) => {
    const c = record(value, ["kind", "outcome", "code", "fenceArmed", "sourceClosedBeforeDecision", "sourceListenerAlive", "counts", "finalProtocol", "timing", "cleanup"]);
    if (c.kind !== REDIRECT_PROBE_CASES[index] || !["NOT_RUN", "CONTROL_PASSED", "DRAINED", "PENDING", "INCONCLUSIVE", "REFUSED"].includes(c.outcome) || !CODES.has(c.code) || ["fenceArmed", "sourceClosedBeforeDecision", "sourceListenerAlive"].some(k => typeof c[k] !== "boolean")) refuse("PROBE_REFUSED");
    c.counts = counts(c.counts); c.finalProtocol = protocol(c.finalProtocol); c.cleanup = cleanup(c.cleanup); c.timing = record(c.timing, ["readyMs", "fenceMs", "sourceClosedMs", "decisionMs", "cleanupMs"]);
    const n = c.counts, t = c.timing;
    if (Object.entries(t).some(([key, at]) => !(at === null || Number.isSafeInteger(at) && at >= 0 && at <= (key === "cleanupMs" ? 5001 : 15001))) || n.publicFinished + n.publicFailed + n.pendingRequests !== n.requestsStarted || n.socketsClosed + n.socketsLive !== n.socketsCreated || n.handlersSettled + n.handlersPending !== n.handlersStarted || n.rootRouteAcks > n.rootRouteCallbacks || n.targetRouteAcks > n.targetRouteCallbacks || c.sourceClosedBeforeDecision && c.sourceListenerAlive || c.sourceClosedBeforeDecision !== (t.sourceClosedMs !== null) || t.decisionMs !== null && [t.readyMs, t.fenceMs, t.sourceClosedMs].some(at => at !== null && at > t.decisionMs)) refuse("PROBE_REFUSED");
    if (t.fenceMs !== null && (t.readyMs === null || t.fenceMs < t.readyMs) || t.sourceClosedMs !== null && (t.fenceMs === null || t.sourceClosedMs < t.fenceMs)) refuse("PROBE_REFUSED");
    if (c.outcome === "NOT_RUN") { if (!["CONTROL_REQUIRED", "CLEANUP_REQUIRED"].includes(c.code) || Object.values(n).some(Boolean) || Object.values(t).some(at => at !== null) || c.fenceArmed || c.sourceClosedBeforeDecision || c.sourceListenerAlive || JSON.stringify(c.cleanup) !== JSON.stringify(emptyCleanup()) || JSON.stringify(c.finalProtocol) !== JSON.stringify(absentProtocol())) refuse("PROBE_REFUSED"); }
    else if (["CONTROL_PASSED", "DRAINED", "PENDING"].includes(c.outcome)) {
      if (!factors(c) || t.readyMs === null || t.fenceMs === null || t.decisionMs === null) refuse("PROBE_REFUSED");
      if (c.outcome === "CONTROL_PASSED" && (index !== 0 || c.code !== "CONTROL_PASSED" || !finished(n, c.finalProtocol, c.kind) || n.responsesFinished !== 1 || n.publicFinished !== 1 || c.finalProtocol.terminal !== "finished" || t.decisionMs >= 15000)) refuse("PROBE_REFUSED");
      if (c.outcome === "DRAINED" && (index === 0 || c.code !== "ORIGINAL_TERMINALS" || !finished(n, c.finalProtocol, c.kind) || n.responsesFinished !== 0 || t.decisionMs >= 15000)) refuse("PROBE_REFUSED");
      if (c.outcome === "PENDING" && (index === 0 || c.code !== "ORIGINAL_PENDING_AT_DEADLINE" || !pending(n, c.finalProtocol, c.kind) || n.responsesFinished !== 0 || t.decisionMs < 15000)) refuse("PROBE_REFUSED");
    } else if (["CONTROL_PASSED", "ORIGINAL_TERMINALS", "ORIGINAL_PENDING_AT_DEADLINE", "CONTROL_REQUIRED", "CLEANUP_REQUIRED"].includes(c.code)) refuse("PROBE_REFUSED");
    return c;
  });
  if (r.controlQualified !== (r.cases[0].outcome === "CONTROL_PASSED" && clean(r.cases[0].cleanup)) || !r.controlQualified && r.cases.slice(1).some(c => c.outcome !== "NOT_RUN") || !clean(r.cases[1].cleanup) && r.cases[2].outcome !== "NOT_RUN" || Buffer.byteLength(JSON.stringify(r)) > 16384) refuse("PROBE_REFUSED");
  return r;
}

async function observe(kind, ports) {
  const c = blank(kind), controller = new AbortController(); let first = null, nonTimeoutFailure = false, started, previous, lease, timer, rejectVeto;
  const veto = new Promise((_yes, no) => { rejectVeto = no; }); veto.catch(() => {});
  const stop = code => { const safe = CODES.has(code) ? code : "PROBE_REFUSED"; if (safe !== "CASE_TIMEOUT") nonTimeoutFailure = true; if (first === null) { first = safe; const e = Error(first); e.code = first; rejectVeto(e); } };
  const now = () => { const at = ports.now(); if (!Number.isFinite(at) || previous !== undefined && at < previous) { stop("CLOCK_REFUSED"); refuse(first); } previous = at; return at; };
  const alive = () => { if (first) refuse(first); const at = now(); if (at >= started + 15000) { stop("CASE_TIMEOUT"); refuse(first); } return at; };
  const bounded = async operation => { alive(); const value = await Promise.race([Promise.resolve().then(() => { alive(); return operation(); }), veto]); alive(); return value; };
  const snapshot = () => { const value = record(lease.snapshot(), ["counts", "finalProtocol"]); c.counts = counts(value.counts); c.finalProtocol = protocol(value.finalProtocol); const s = record(lease.sourceFacts(), ["closed", "listenerAlive"]); if (typeof s.closed !== "boolean" || typeof s.listenerAlive !== "boolean" || s.closed && s.listenerAlive) refuse("TRANSPORT_REFUSED"); c.sourceClosedBeforeDecision = s.closed; c.sourceListenerAlive = s.listenerAlive; if (s.closed && c.timing.sourceClosedMs === null) c.timing.sourceClosedMs = relative(now(), started, 15000); };
  const drain = async predicate => { for (let i = 0; i <= 601; i++) { alive(); snapshot(); if (c.counts.unknownRequests || c.counts.downloads || c.counts.popups) refuse("REQUEST_REFUSED"); if (predicate()) return; await bounded(() => ports.pause(Math.min(25, started + 15000 - now()))); } refuse("LIMIT_REFUSED"); };
  try {
    started = now(); timer = ports.schedule(() => stop("CASE_TIMEOUT"), 15000); lease = ports.createCase({ kind, signal: controller.signal, refuse: stop });
    await bounded(() => lease.start(() => Math.max(1, Math.floor(started + 15000 - alive())))); c.timing.readyMs = relative(now(), started, 15000);
    await bounded(() => lease.trigger());
    await drain(() => lineage(c.counts, kind) && c.counts.serverReceived === 1 && c.counts.handlersPending === 0);
    await bounded(() => lease.armFence()); c.fenceArmed = true; c.timing.fenceMs = relative(now(), started, 15000);
    if (kind === "control") { await bounded(() => lease.releaseResponse()); await drain(() => finished(c.counts, c.finalProtocol, kind)); }
    else { await bounded(() => lease.stopLoading()); await bounded(() => lease.blank()); }
    await bounded(() => lease.closeSource()); snapshot(); if (!c.sourceClosedBeforeDecision || c.sourceListenerAlive || c.counts.socketsLive) refuse("TRANSPORT_REFUSED");
    await drain(() => finished(c.counts, c.finalProtocol, kind));
  } catch (error) { stop(safeCode(error)); }
  finally {
    try { snapshot(); } catch { stop("TRANSPORT_REFUSED"); }
    await Promise.resolve();
    try { now(); } catch { stop("CLOCK_REFUSED"); }
    await Promise.resolve();
    // Final copy, clock and decision remain in the same synchronous turn.
    try { snapshot(); const at = now(); c.timing.decisionMs = relative(at, started, 15000); if (at >= started + 15000) stop("CASE_TIMEOUT"); } catch { stop("CLOCK_REFUSED"); }
    if (c.counts.unknownRequests || c.counts.downloads || c.counts.popups) stop("REQUEST_REFUSED");
    c.outcome = first === "CASE_TIMEOUT" ? "INCONCLUSIVE" : first ? "REFUSED" : "INCONCLUSIVE"; c.code = first ?? "TRANSPORT_REFUSED";
    if (!first && factors(c) && finished(c.counts, c.finalProtocol, kind) && (kind === "control" ? c.counts.responsesFinished === 1 && c.counts.publicFinished === 1 && c.finalProtocol.terminal === "finished" : c.counts.responsesFinished === 0)) { c.outcome = kind === "control" ? "CONTROL_PASSED" : "DRAINED"; c.code = kind === "control" ? "CONTROL_PASSED" : "ORIGINAL_TERMINALS"; }
    if (first === "CASE_TIMEOUT" && !nonTimeoutFailure && c.timing.decisionMs >= 15000 && kind !== "control" && factors(c) && pending(c.counts, c.finalProtocol, kind) && c.counts.responsesFinished === 0) { c.outcome = "PENDING"; c.code = "ORIGINAL_PENDING_AT_DEADLINE"; }
    else if (first === "CASE_TIMEOUT" && c.finalProtocol.identity !== "exact-server-request" && c.sourceClosedBeforeDecision) c.code = "PROTOCOL_UNAVAILABLE";
    // Cleanup never rewrites the sealed counts/protocol/outcome above.
    ports.cancel(timer); controller.abort();
    if (lease) { const cleanupStart = ports.now(); let cleanupTimer, expired = false; try { const timeout = new Promise((_yes, no) => { cleanupTimer = ports.schedule(() => { expired = true; no(Error("CLEANUP_UNCONFIRMED")); }, 5000); }); const value = await Promise.race([lease.cleanup(), timeout]), at = ports.now(); if (expired || !Number.isFinite(at) || at < cleanupStart || at >= cleanupStart + 5000) refuse("CLEANUP_UNCONFIRMED"); c.cleanup = cleanup(value); } catch { /* Remains unconfirmed; next case is gated. */ } finally { ports.cancel(cleanupTimer); c.timing.cleanupMs = relative(ports.now(), cleanupStart, 5000); } }
  }
  return c;
}
export async function runBrowserRedirectDrainProbe(ports) {
  if (!ports || ["now", "pause", "schedule", "cancel", "createCase"].some(k => typeof ports[k] !== "function")) refuse("ARGUMENTS_REFUSED");
  const r = { schemaVersion: 1, scenario: "browser-redirect-drain-probe", mode: nativePorts.has(ports) ? "native" : "synthetic", sourceSha: nativePorts.has(ports) ? ports.sourceSha : null, diagnosticOnly: true, applicationAccepted: false, controlQualified: false, cases: REDIRECT_PROBE_CASES.map(kind => blank(kind)) };
  r.cases[0] = await observe("control", ports); r.controlQualified = r.cases[0].outcome === "CONTROL_PASSED" && clean(r.cases[0].cleanup);
  if (r.controlQualified) for (let i = 1; i < 3; i++) { if (!clean(r.cases[i - 1].cleanup)) { r.cases[i].code = "CLEANUP_REQUIRED"; continue; } r.cases[i] = await observe(REDIRECT_PROBE_CASES[i], ports); }
  return validateRedirectDrainReport(r);
}

function createHttpCase({ chromium, observerFactory, environment }, options) {
  const allowedPaths = new Set(["/fixture.html", "/favicon.ico", "/entry", "/held"]), sockets = new Set(), held = new Set(), n = emptyCounts();
  let origin, browser, context, page, session, observer, ledger, fence, remaining, closing = false, sourcePromise, listeningPromise, serverStarted = false, serverClosed = false, startupStarted = false, startupSettled = false, browserClosed = false, contextClosed = false, sessionDetached = false;
  const fail = code => options.refuse(code), live = () => { if (closing || options.signal.aborted) refuse("TRANSPORT_REFUSED"); };
  const accepted = request => { const u = new URL(request.url()); return u.origin === origin && !u.username && !u.password && !u.search && !u.hash && allowedPaths.has(u.pathname) && request.method() === "GET"; };
  const server = createServer((request, response) => {
    if (request.method !== "GET" || !allowedPaths.has(request.url)) { response.destroy(); fail("REQUEST_REFUSED"); return; }
    if (request.url === "/fixture.html") { response.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); response.end("<!doctype html><html><head><title>Public redirect fixture</title></head><body>Public fixture</body></html>"); return; }
    if (request.url === "/favicon.ico") { response.writeHead(204); response.end(); return; }
    if (closing || options.signal.aborted) { response.destroy(); return; }
    if (request.url === "/entry") { if (options.kind !== "redirect" || ++n.redirectReceived > 1) { response.destroy(); fail("REQUEST_REFUSED"); return; } response.once("finish", () => n.redirectResponsesFinished++); response.writeHead(303, { location: "/held", "content-length": "0", "cache-control": "no-store" }); response.end(); return; }
    if (++n.serverReceived > 1) { response.destroy(); fail("LIMIT_REFUSED"); return; } held.add(response); response.once("finish", () => n.responsesFinished++);
  });
  server.on("connection", socket => { if (closing || options.signal.aborted || n.socketsCreated >= 16) { socket.destroy(); if (!closing && !options.signal.aborted) fail("LIMIT_REFUSED"); return; } sockets.add(socket); n.socketsCreated++; socket.once("close", () => { sockets.delete(socket); n.socketsClosed++; }); });
  server.on("error", () => fail("TRANSPORT_REFUSED")); server.on("clientError", (_error, socket) => { socket.destroy(); fail("REQUEST_REFUSED"); }); server.on("listening", () => { serverStarted = true; }); server.on("close", () => { serverClosed = true; });
  const closeSource = () => sourcePromise ??= (async () => { if (listeningPromise) await listeningPromise.catch(() => {}); if (server.listening) await new Promise((yes, no) => { server.close(e => e ? no(e) : yes()); for (const socket of sockets) socket.destroy(); }); while (sockets.size) await new Promise(yes => setTimeout(yes, 1)); if (serverStarted && !serverClosed) refuse("TRANSPORT_REFUSED"); })();
  return Object.freeze({
    snapshot() { const l = ledger?.snapshot(), f = fence?.snapshot(); return { counts: { ...n, ...l?.counts, socketsLive: sockets.size, ...(f ? { handlersStarted: f.handlersStarted, handlersSettled: f.handlersSettled, handlersPending: f.handlersPending, fenceReadAborts: f.readsAborted, fenceAbortAcks: f.abortAcks, unknownRequests: f.unknownRequests } : {}) }, finalProtocol: l?.finalProtocol ?? absentProtocol() }; },
    sourceFacts: () => ({ closed: serverStarted && serverClosed && !server.listening, listenerAlive: serverStarted && server.listening && !serverClosed }),
    async start(budget) {
      remaining = budget; startupStarted = true;
      try { live(); listeningPromise = new Promise((yes, no) => { const failed = () => no(Error("TRANSPORT_REFUSED")); server.once("error", failed); server.listen(0, "127.0.0.1", () => { server.off("error", failed); yes(); }); }); await listeningPromise; live(); origin = "http://127.0.0.1:" + server.address().port;
        browser = await chromium.launch({ headless: true, timeout: remaining(), env: environment }); if (closing || options.signal.aborted) { await browser.close(); browserClosed = true; refuse("TRANSPORT_REFUSED"); } if (browser.version() !== REDIRECT_PROBE_BINDING.chromium) refuse("SOURCE_REFUSED");
        context = await browser.newContext({ baseURL: origin, serviceWorkers: "block", acceptDownloads: false }); if (closing || options.signal.aborted) { await context.close(); contextClosed = true; refuse("TRANSPORT_REFUSED"); } await context.setOffline(false); live();
        observer = observerFactory({ fetchCommands: true }); ledger = createRedirectRequestLedger(observer, fail); fence = createQuiescenceFence({ allowed: accepted, readCancellation: accepted, onRefusal: fail });
        context.on("request", request => { try { if (!accepted(request)) { fail("REQUEST_REFUSED"); return; } const path = new URL(request.url()).pathname; if (path === "/entry" || path === "/held") ledger.begin(request, page, path === "/entry" ? "root" : "target"); } catch { fail("REQUEST_REFUSED"); } });
        context.on("requestfinished", request => ledger.terminal(request, "finished")); context.on("requestfailed", request => ledger.terminal(request, "failed"));
        await context.route("**/*", route => { ledger.route(route.request(), false); return fence.handle({ request: () => route.request(), async abort() { await route.abort(); }, async continue() { await route.continue(); ledger.route(route.request(), true); } }); }); live();
        page = await context.newPage(); live(); observer.observePage(page); page.on("download", download => { n.downloads++; fail("REQUEST_REFUSED"); void download.cancel().catch(() => {}); }); page.on("popup", () => { n.popups++; fail("REQUEST_REFUSED"); }); await page.goto(origin + "/fixture.html", { waitUntil: "domcontentloaded", timeout: remaining() }); live();
      } finally { startupSettled = true; }
    },
    async trigger() { live(); await page.evaluate(redirect => { void fetch(redirect ? "/entry" : "/held").then(response => response.arrayBuffer()).catch(() => {}); }, options.kind === "redirect"); },
    armFence() { live(); fence.arm(); },
    async releaseResponse() { live(); if (held.size !== 1 || n.serverReceived !== 1) refuse("TRANSPORT_REFUSED"); for (const response of held) { remaining(); response.writeHead(200, { "content-type": "application/octet-stream", "cache-control": "no-store" }); response.end("public fixture body"); } },
    async stopLoading() { live(); session = await context.newCDPSession(page); if (closing || options.signal.aborted) { await session.detach(); sessionDetached = true; refuse("TRANSPORT_REFUSED"); } await session.send("Page.stopLoading"); },
    blank() { live(); return page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: remaining() }); }, closeSource,
    async cleanup() { closing = true; observer?.dispose(); const owned = async (operation, done) => { try { await operation(); done(); } catch { /* No cleanup certificate. */ } }; await Promise.all([owned(closeSource, () => {}), (async () => { await owned(async () => { if (session) await session.detach(); }, () => { if (session) sessionDetached = true; }); await owned(async () => { if (context) await context.close(); }, () => { if (context) contextClosed = true; }); await owned(async () => { if (browser) await browser.close(); }, () => { if (browser) browserClosed = true; }); })()]); return { server: serverClosed ? "close_observed" : serverStarted ? "unconfirmed" : "absent", context: contextClosed ? "close_observed" : context ? "unconfirmed" : "absent", browser: browserClosed ? "close_observed" : browser ? "unconfirmed" : "absent", session: sessionDetached ? "close_observed" : session ? "unconfirmed" : "absent", socketsClosed: sockets.size === 0 && n.socketsClosed === n.socketsCreated, startupSettled: !startupStarted || startupSettled, handlersSettled: !fence || fence.snapshot().handlersPending === 0 }; },
  });
}
export function validateRedirectProbeEnvironment(env, runtime) {
  if (!env || runtime.platform !== "linux" || runtime.arch !== "x64" || runtime.node !== REDIRECT_PROBE_BINDING.node || env.CI !== "true" || env.GITHUB_ACTIONS !== "true" || env.SC_BROWSER_REDIRECT_DRAIN_PROBE_RUN !== "1" || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")) refuse("ENVIRONMENT_REFUSED");
  const keys = new Set(["CI", "GITHUB_ACTIONS", "SC_BROWSER_REDIRECT_DRAIN_PROBE_RUN", "GITHUB_SHA", "PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"]); if (Object.keys(env).some(k => !keys.has(k))) refuse("ENVIRONMENT_REFUSED");
  const child = {}; for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"]) if (env[key] !== undefined) { if (typeof env[key] !== "string" || env[key].length > 4096 || env[key].includes("\0")) refuse("ENVIRONMENT_REFUSED"); child[key] = env[key]; } if (!child.PATH || !child.HOME || !isAbsolute(child.HOME) || child.TMPDIR && !isAbsolute(child.TMPDIR)) refuse("ENVIRONMENT_REFUSED"); child.TZ = "UTC"; return Object.freeze(child);
}
async function createNativePorts(env) {
  const environment = validateRedirectProbeEnvironment(env, { platform: process.platform, arch: process.arch, node: process.version });
  if ((await readdir(ROOT)).some(name => name !== ".env.example" && /^\.env(?:\.|$)/.test(name))) refuse("ENVIRONMENT_REFUSED");
  for (const [relativePath, bytes, sha] of FENCE_PUBLIC_PINS) { const path = resolve(ROOT, relativePath), info = await lstat(path); if (!info.isFile() || info.isSymbolicLink() || info.size !== bytes || await realpath(path) !== path || createHash("sha256").update(await readFile(path)).digest("hex") !== sha) refuse("SOURCE_REFUSED"); }
  const { chromium } = await import("playwright-core"), { createBrowserProtocolObserver: observerFactory } = await import("../../tests/e2e-auth-local/admin-browser-support.mjs");
  const p = { sourceSha: env.GITHUB_SHA, now: performance.now.bind(performance), pause: ms => new Promise(yes => setTimeout(yes, ms)), schedule: (callback, ms) => setTimeout(callback, ms), cancel: clearTimeout, createCase: options => createHttpCase({ chromium, observerFactory, environment }, options) }; nativePorts.add(p); return p;
}
export async function main(argv = process.argv.slice(2), env = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  try { let action; try { [action] = closedArray(argv, 1); } catch { refuse("ARGUMENTS_REFUSED"); } if (!["--help", "--execute"].includes(action)) refuse("ARGUMENTS_REFUSED"); if (action === "--help") { output({ schemaVersion: 1, scenario: "browser-redirect-drain-probe", code: "NO_SERVICE_STARTED", diagnosticOnly: true, applicationAccepted: false }); return 0; } const r = await runBrowserRedirectDrainProbe(await createNativePorts(env)); output(r); return r.controlQualified && r.cases.every(c => ["CONTROL_PASSED", "DRAINED", "PENDING"].includes(c.outcome) && clean(c.cleanup)) ? 0 : 1; }
  catch (error) { output({ schemaVersion: 1, scenario: "browser-redirect-drain-probe", code: safeCode(error), diagnosticOnly: true, applicationAccepted: false }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
