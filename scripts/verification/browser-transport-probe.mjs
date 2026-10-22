/** New isolated transport experiment. Import/help never opens HTTP or Chromium. */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createServer } from "node:http";
import { readFile, readdir, lstat, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const nativePorts = new WeakSet(), hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const PROBE_LIMITS = Object.freeze({ caseMs: 15000, cleanupMs: 5000, maxRequests: 16, maxSockets: 16, reportBytes: 16384, maxCases: 5 });
export const PROBE_BINDING = Object.freeze({ node: "v24.19.0", platform: "linux", arch: "x64", playwright: "1.63.0", chromium: "153.0.8010.12", revision: "1243" });
export const PUBLIC_PINS = Object.freeze([
  ["node_modules/playwright-core/package.json", 876, "f061c58427e47e843e26d201f0a57076c734e57c734ecbbd87d4a23b7a20db9b"],
  ["node_modules/playwright-core/browsers.json", 1137, "545d52f8382c391e605562c330e9c1c534a16045898203037a49bb8bd769a946"],
  ["node_modules/playwright-core/lib/coreBundle.js", 3477183, "549070af3acabb3efcc4f55bfe6210f9f7c2fcf633cf7eaa59bfe60719969171"],
  ["tests/e2e-auth-local/admin-browser-support.mjs", 71914, "3c1c9d0600ffaa8ab39664627181daead2122220022c7b64ff6b6787403a2bb0"],
].map(Object.freeze));
const COUNTS = Object.freeze(["requestsStarted", "routeAcks", "serverReceived", "responsesFinished", "socketsCreated", "socketsClosed", "socketsLive", "publicFinished", "publicFailed", "pendingRequests", "cdpFinished", "cdpFailed", "cdpNoTerminal", "managerSame", "managerAbsent", "sessionRegistered", "sessionRemoved", "protocolUnavailable", "unexpectedRequests", "downloads", "popups"]);
const CLEANUP = Object.freeze(["server", "context", "browser", "session", "socketsClosed", "startupSettled"]);
const KINDS = Object.freeze(["control", "held-fetch", "held-scripts", "variant-online", "variant-observer-off"]);
const OUTCOMES = Object.freeze(["CONTROL_PASSED", "REPRODUCED", "NOT_REPRODUCED", "INCONCLUSIVE", "REFUSED", "NOT_RUN"]);
const CODES = new Set(["CONTROL_PASSED", "NATURAL_TERMINALS", "PENDING_AFTER_SOURCE_CLOSE", "CONTROL_REQUIRED", "CLEANUP_REQUIRED", "CASE_TIMEOUT", "CLOCK_REFUSED", "REQUEST_REFUSED", "LIMIT_REFUSED", "SOURCE_REFUSED", "STARTUP_REFUSED", "TRANSPORT_REFUSED", "CLEANUP_UNCONFIRMED", "ENVIRONMENT_REFUSED", "ARGUMENTS_REFUSED", "PROBE_UNAVAILABLE"]);
const emptyCounts = () => Object.fromEntries(COUNTS.map(key => [key, 0]));
const emptyCleanup = () => ({ server: "unconfirmed", context: "unconfirmed", browser: "unconfirmed", session: "unconfirmed", socketsClosed: false, startupSettled: false });
const refuse = code => { const error = new Error(CODES.has(code) ? code : "PROBE_UNAVAILABLE"); error.code = error.message; throw error; };
const safeCode = error => { try { const value = error && Object.getOwnPropertyDescriptor(error, "code"); return value && Object.hasOwn(value, "value") && CODES.has(value.value) ? value.value : "PROBE_UNAVAILABLE"; } catch { return "PROBE_UNAVAILABLE"; } };
function data(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) refuse("PROBE_UNAVAILABLE");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || Reflect.ownKeys(descriptors).some(key => !keys.includes(key))) refuse("PROBE_UNAVAILABLE");
  const result = {};
  for (const key of keys) { const d = descriptors[key]; if (!d?.enumerable || !Object.hasOwn(d, "value")) refuse("PROBE_UNAVAILABLE"); result[key] = d.value; }
  return result;
}
function counts(value) { const result = data(value, COUNTS); if (Object.values(result).some(n => !Number.isSafeInteger(n) || n < 0 || n > 16)) refuse("LIMIT_REFUSED"); return result; }
function cleanupFacts(value) { const result = data(value, CLEANUP); if (["server", "context", "browser", "session"].some(key => !["absent", "close_observed", "unconfirmed"].includes(result[key])) || typeof result.socketsClosed !== "boolean" || typeof result.startupSettled !== "boolean") refuse("PROBE_UNAVAILABLE"); return result; }
const allClean = value => ["server", "context", "browser", "session"].every(key => ["absent", "close_observed"].includes(value[key])) && value.socketsClosed === true && value.startupSettled === true;
function caseArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) refuse("PROBE_UNAVAILABLE");
  const descriptors = Object.getOwnPropertyDescriptors(value), n = descriptors.length?.value;
  if (![3, 5].includes(n) || Reflect.ownKeys(descriptors).length !== n + 1) refuse("PROBE_UNAVAILABLE");
  const result = [];
  for (let i = 0; i < n; i++) { const d = descriptors[i]; if (!d?.enumerable || !Object.hasOwn(d, "value")) refuse("PROBE_UNAVAILABLE"); result.push(d.value); }
  return result;
}
const relativeTime = (at, start, limit) => Number.isFinite(at) && at >= start ? Math.min(limit + 1, Math.floor(at - start)) : null;
const blankCase = (kind, resource = kind, code = "CONTROL_REQUIRED") => ({ kind, resource, offline: kind !== "control" && kind !== "variant-online", fetchCommands: kind !== "variant-observer-off", outcome: "NOT_RUN", code, expectedRequests: resource === "control" ? 5 : resource === "held-fetch" ? 1 : 4, counts: emptyCounts(), timing: { readyMs: null, sourceClosedMs: null, decisionMs: null, cleanupMs: null }, cleanup: emptyCleanup() });

export function parseProbeArguments(argv) {
  if (!Array.isArray(argv) || argv.some(arg => typeof arg !== "string")) refuse("ARGUMENTS_REFUSED");
  if (argv.length === 1 && argv[0] === "--help") return { execute: false, variants: false };
  if (argv[0] !== "--execute" || argv.length < 1 || argv.length > 2 || argv.length === 2 && argv[1] !== "--variants") refuse("ARGUMENTS_REFUSED");
  return { execute: true, variants: argv.length === 2 };
}
export function validateProbeEnvironment(env, runtime) {
  if (!env || runtime.platform !== PROBE_BINDING.platform || runtime.arch !== PROBE_BINDING.arch || runtime.node !== PROBE_BINDING.node || env.CI !== "true" || env.GITHUB_ACTIONS !== "true" || env.SC_BROWSER_TRANSPORT_PROBE_RUN !== "1" || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")) refuse("ENVIRONMENT_REFUSED");
  const allowed = new Set(["CI", "GITHUB_ACTIONS", "SC_BROWSER_TRANSPORT_PROBE_RUN", "GITHUB_SHA", "PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"]);
  if (Object.keys(env).some(key => !allowed.has(key))) refuse("ENVIRONMENT_REFUSED");
  if (Object.keys(env).some(key => /TOKEN|SECRET|PASSWORD|DATABASE_URL|^(?:SUPABASE_|GOOGLE_|VERCEL_|SENTRY_|AWS_|AZURE_|NEXT_PUBLIC_|PG[A-Z_]|SC_BACKUP_|SC_RESTORE_|NODE_OPTIONS$|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$)/i.test(key))) refuse("ENVIRONMENT_REFUSED");
  const child = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"]) if (env[key] !== undefined) { if (typeof env[key] !== "string" || env[key].length > 4096 || env[key].includes("\0")) refuse("ENVIRONMENT_REFUSED"); child[key] = env[key]; }
  if (!child.PATH || !child.HOME || !isAbsolute(child.HOME) || child.TMPDIR && !isAbsolute(child.TMPDIR)) refuse("ENVIRONMENT_REFUSED");
  child.TZ = "UTC";
  return Object.freeze(child);
}
export function validateProbeReport(input) {
  const r = data(input, ["schemaVersion", "scenario", "mode", "sourceSha", "diagnosticOnly", "applicationAccepted", "controlQualified", "variantsRequested", "variantsExecuted", "cases"]);
  if (r.schemaVersion !== 1 || r.scenario !== "browser-transport-probe" || !["synthetic", "native"].includes(r.mode) || (r.mode === "synthetic" ? r.sourceSha !== null : typeof r.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(r.sourceSha)) || r.diagnosticOnly !== true || r.applicationAccepted !== false || typeof r.controlQualified !== "boolean" || typeof r.variantsRequested !== "boolean" || !Number.isSafeInteger(r.variantsExecuted) || r.variantsExecuted < 0 || r.variantsExecuted > 2) refuse("PROBE_UNAVAILABLE");
  r.cases = caseArray(r.cases).map((value, index) => {
    const c = data(value, ["kind", "resource", "offline", "fetchCommands", "outcome", "code", "expectedRequests", "counts", "timing", "cleanup"]);
    if (c.kind !== KINDS[index] || !["control", "held-fetch", "held-scripts"].includes(c.resource) || index < 3 && c.resource !== c.kind || c.offline !== (c.kind !== "control" && c.kind !== "variant-online") || c.fetchCommands !== (c.kind !== "variant-observer-off") || !OUTCOMES.includes(c.outcome) || !CODES.has(c.code) || c.expectedRequests !== (c.resource === "control" ? 5 : c.resource === "held-fetch" ? 1 : 4)) refuse("PROBE_UNAVAILABLE");
    c.counts = counts(c.counts); c.cleanup = cleanupFacts(c.cleanup); c.timing = data(c.timing, ["readyMs", "sourceClosedMs", "decisionMs", "cleanupMs"]);
    for (const [key, time] of Object.entries(c.timing)) if (!(time === null || Number.isSafeInteger(time) && time >= 0 && time <= (key === "cleanupMs" ? PROBE_LIMITS.cleanupMs : PROBE_LIMITS.caseMs) + 1)) refuse("PROBE_UNAVAILABLE");
    const n = c.counts, t = c.timing, terminals = n.publicFinished + n.publicFailed;
    if (terminals + n.pendingRequests !== n.requestsStarted || n.routeAcks > n.requestsStarted || n.responsesFinished > n.serverReceived || n.socketsClosed + n.socketsLive !== n.socketsCreated || n.cdpFinished + n.cdpFailed + n.cdpNoTerminal + n.protocolUnavailable !== n.requestsStarted || n.managerSame + n.managerAbsent > n.requestsStarted || n.sessionRegistered + n.sessionRemoved > n.requestsStarted || t.sourceClosedMs !== null && (t.readyMs === null || t.sourceClosedMs < t.readyMs) || t.decisionMs !== null && [t.readyMs, t.sourceClosedMs].some(at => at !== null && at > t.decisionMs)) refuse("PROBE_UNAVAILABLE");
    if (c.outcome === "NOT_RUN") {
      if (!["CONTROL_REQUIRED", "CLEANUP_REQUIRED"].includes(c.code) || Object.values(n).some(Boolean) || Object.values(t).some(at => at !== null) || JSON.stringify(c.cleanup) !== JSON.stringify(emptyCleanup())) refuse("PROBE_UNAVAILABLE");
    } else if (c.outcome === "CONTROL_PASSED" || c.outcome === "NOT_REPRODUCED" || c.outcome === "REPRODUCED") {
      if (n.requestsStarted !== c.expectedRequests || n.routeAcks !== c.expectedRequests || n.serverReceived !== c.expectedRequests || n.unexpectedRequests || n.downloads || n.popups || n.socketsLive || t.readyMs === null || t.sourceClosedMs === null || t.sourceClosedMs >= PROBE_LIMITS.caseMs || t.decisionMs === null) refuse("PROBE_UNAVAILABLE");
      if (c.outcome === "CONTROL_PASSED" && (c.kind !== "control" || c.code !== "CONTROL_PASSED" || n.pendingRequests || n.publicFinished !== c.expectedRequests || n.publicFailed || n.cdpFinished !== c.expectedRequests || n.cdpFailed || n.cdpNoTerminal || n.managerSame || n.managerAbsent !== c.expectedRequests || n.sessionRegistered !== c.expectedRequests || n.sessionRemoved || n.protocolUnavailable || n.serverReceived !== c.expectedRequests || n.responsesFinished !== c.expectedRequests || t.decisionMs >= PROBE_LIMITS.caseMs)) refuse("PROBE_UNAVAILABLE");
      if (c.outcome === "NOT_REPRODUCED" && (c.kind === "control" || c.code !== "NATURAL_TERMINALS" || n.pendingRequests || n.responsesFinished || t.decisionMs >= PROBE_LIMITS.caseMs)) refuse("PROBE_UNAVAILABLE");
      if (c.outcome === "REPRODUCED" && (c.kind === "control" || c.code !== "PENDING_AFTER_SOURCE_CLOSE" || !n.pendingRequests || n.serverReceived !== c.expectedRequests || n.responsesFinished || t.decisionMs < PROBE_LIMITS.caseMs)) refuse("PROBE_UNAVAILABLE");
    } else if (["CONTROL_PASSED", "NATURAL_TERMINALS", "PENDING_AFTER_SOURCE_CLOSE", "CONTROL_REQUIRED", "CLEANUP_REQUIRED"].includes(c.code)) refuse("PROBE_UNAVAILABLE");
    return c;
  });
  if (r.cases.length !== (r.variantsRequested ? 5 : 3)) refuse("PROBE_UNAVAILABLE");
  if (r.controlQualified !== (r.cases[0].outcome === "CONTROL_PASSED" && allClean(r.cases[0].cleanup)) || !r.controlQualified && r.cases.slice(1).some(c => c.outcome !== "NOT_RUN") || r.variantsExecuted !== r.cases.slice(3).filter(c => c.outcome !== "NOT_RUN").length || r.variantsExecuted && (!r.variantsRequested || !r.cases.slice(1, 3).some(c => c.outcome === "REPRODUCED"))) refuse("PROBE_UNAVAILABLE");
  for (let index = 2; index < r.cases.length; index++) if (!allClean(r.cases[index - 1].cleanup) && r.cases[index].outcome !== "NOT_RUN") refuse("PROBE_UNAVAILABLE");
  const selected = r.cases.slice(1, 3).find(c => c.outcome === "REPRODUCED");
  if (r.cases.slice(3).some(c => c.resource !== (selected?.resource ?? "held-fetch")) || r.variantsExecuted && r.cases.slice(1, 3).some(c => !allClean(c.cleanup))) refuse("PROBE_UNAVAILABLE");
  if (Buffer.byteLength(JSON.stringify(r)) > PROBE_LIMITS.reportBytes) refuse("LIMIT_REFUSED");
  return r;
}

async function observeCase(kind, resource, ports) {
  const result = blankCase(kind, resource), controller = new AbortController();
  let lease, first = null, previous, started, timer, sourceClosedAt = null;
  let rejectVeto; const veto = new Promise((_yes, no) => { rejectVeto = no; }); veto.catch(() => {});
  const stop = code => { if (first === null) { first = CODES.has(code) ? code : "PROBE_UNAVAILABLE"; controller.abort(); const e = new Error(first); e.code = first; rejectVeto(e); } };
  const now = () => { const at = ports.now(); if (!Number.isFinite(at) || previous !== undefined && at < previous) { stop("CLOCK_REFUSED"); refuse(first); } previous = at; return at; };
  const alive = () => { if (first) refuse(first); const at = now(); if (at >= started + PROBE_LIMITS.caseMs) { stop("CASE_TIMEOUT"); refuse(first); } return at; };
  const bounded = async operation => { alive(); const pending = Promise.resolve().then(() => { alive(); return operation(); }); const value = await Promise.race([pending, veto]); alive(); return value; };
  const snapshot = () => counts(lease.snapshot());
  const drain = async predicate => { for (let polls = 0; polls <= 601; polls++) { alive(); const current = snapshot(); if (predicate(current)) return current; await bounded(() => ports.pause(Math.min(25, started + PROBE_LIMITS.caseMs - now()))); } refuse("LIMIT_REFUSED"); };
  try {
    started = now(); timer = ports.schedule(() => stop("CASE_TIMEOUT"), PROBE_LIMITS.caseMs);
    // The lease exists before startup. Timeout cleanup therefore also owns
    // handles created late by browser launch; it never borrows an existing tab.
    lease = ports.createCase({ resource, offline: result.offline, fetchCommands: result.fetchCommands, signal: controller.signal, refuse: stop });
    await bounded(() => lease.start(() => Math.max(1, Math.floor(started + PROBE_LIMITS.caseMs - alive()))));
    result.timing.readyMs = relativeTime(now(), started, PROBE_LIMITS.caseMs);
    await bounded(() => lease.trigger());
    await drain(c => c.requestsStarted === result.expectedRequests && c.routeAcks === result.expectedRequests && c.serverReceived === result.expectedRequests && c.pendingRequests === result.expectedRequests && c.cdpNoTerminal === result.expectedRequests && c.managerSame === result.expectedRequests && c.sessionRegistered === result.expectedRequests && c.protocolUnavailable === 0);
    if (kind === "control") {
      await bounded(() => lease.releaseResponses());
      await drain(c => c.pendingRequests === 0 && c.publicFinished === result.expectedRequests && c.publicFailed === 0 && c.cdpFinished === result.expectedRequests && c.managerAbsent === result.expectedRequests && c.sessionRegistered === result.expectedRequests && c.sessionRemoved === 0 && c.protocolUnavailable === 0 && c.serverReceived === result.expectedRequests && c.responsesFinished === result.expectedRequests);
    } else {
      if (result.offline) await bounded(() => lease.offline());
      await bounded(() => lease.stopLoading());
      await bounded(() => lease.blank());
      await bounded(() => lease.unroute());
    }
    await bounded(() => lease.closeSource()); sourceClosedAt = now(); result.timing.sourceClosedMs = relativeTime(sourceClosedAt, started, PROBE_LIMITS.caseMs);
    await drain(c => c.pendingRequests === 0);
    result.counts = snapshot(); result.outcome = kind === "control" ? "CONTROL_PASSED" : "NOT_REPRODUCED"; result.code = kind === "control" ? "CONTROL_PASSED" : "NATURAL_TERMINALS";
  } catch (error) {
    first ??= safeCode(error); result.code = first; result.outcome = "REFUSED";
    if (lease) try { result.counts = snapshot(); } catch { /* Retain the original refusal and closed zero counters. */ }
    if (kind !== "control" && first === "CASE_TIMEOUT" && sourceClosedAt !== null && sourceClosedAt < started + PROBE_LIMITS.caseMs && result.counts.pendingRequests > 0 && result.counts.socketsLive === 0) { result.outcome = "REPRODUCED"; result.code = "PENDING_AFTER_SOURCE_CLOSE"; }
    else if (first === "CASE_TIMEOUT") result.outcome = "INCONCLUSIVE";
  } finally {
    ports.cancel(timer); controller.abort();
    try { result.timing.decisionMs = relativeTime(ports.now(), started, PROBE_LIMITS.caseMs); } catch { /* No provider error is exported. */ }
    if (lease) {
      let cleanupTimer, cleanupExpired = false; const cleanupStart = ports.now();
      try {
        const expired = new Promise((_yes, no) => { cleanupTimer = ports.schedule(() => { cleanupExpired = true; no(new Error("CLEANUP_UNCONFIRMED")); }, PROBE_LIMITS.cleanupMs); });
        const observed = await Promise.race([lease.cleanup(), expired]), completed = ports.now();
        if (cleanupExpired || !Number.isFinite(completed) || completed < cleanupStart || completed >= cleanupStart + PROBE_LIMITS.cleanupMs) refuse("CLEANUP_UNCONFIRMED");
        result.cleanup = cleanupFacts(observed);
      } catch { /* Default false facts retain the unconfirmed owned cleanup. */ }
      finally { ports.cancel(cleanupTimer); result.timing.cleanupMs = relativeTime(ports.now(), cleanupStart, PROBE_LIMITS.cleanupMs); }
    }
    if (!allClean(result.cleanup) && first === null) { result.outcome = "INCONCLUSIVE"; result.code = "CLEANUP_UNCONFIRMED"; }
  }
  return result;
}

export async function runBrowserTransportProbe(ports, options = {}) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype) refuse("ARGUMENTS_REFUSED");
  const supplied = Object.getOwnPropertyDescriptors(options);
  if (Reflect.ownKeys(supplied).some(k => k !== "variants" || !supplied[k].enumerable || !Object.hasOwn(supplied[k], "value")) || supplied.variants && typeof supplied.variants.value !== "boolean") refuse("ARGUMENTS_REFUSED");
  if (!ports || ["now", "pause", "schedule", "cancel", "createCase"].some(key => typeof ports[key] !== "function")) refuse("ARGUMENTS_REFUSED");
  const variants = supplied.variants?.value ?? false, report = { schemaVersion: 1, scenario: "browser-transport-probe", mode: nativePorts.has(ports) ? "native" : "synthetic", sourceSha: nativePorts.has(ports) ? ports.sourceSha : null, diagnosticOnly: true, applicationAccepted: false, controlQualified: false, variantsRequested: variants, variantsExecuted: 0, cases: KINDS.slice(0, 3).map(kind => blankCase(kind)) };
  report.cases[0] = await observeCase("control", "control", ports);
  report.controlQualified = report.cases[0].outcome === "CONTROL_PASSED" && allClean(report.cases[0].cleanup);
  if (report.controlQualified) for (let index = 1; index < 3; index++) { if (!allClean(report.cases[index - 1].cleanup)) { report.cases[index].code = "CLEANUP_REQUIRED"; continue; } report.cases[index] = await observeCase(KINDS[index], KINDS[index], ports); }
  if (variants) {
    const selected = report.cases.slice(1, 3).find(c => c.outcome === "REPRODUCED"), clean = report.controlQualified && report.cases.filter(c => c.outcome !== "NOT_RUN").every(c => allClean(c.cleanup));
    for (const kind of KINDS.slice(3)) { const prior = report.cases.at(-1), run = selected && clean && (report.variantsExecuted === 0 || allClean(prior.cleanup)); report.cases.push(run ? await observeCase(kind, selected.resource, ports) : blankCase(kind, selected?.resource ?? "held-fetch", selected && report.controlQualified ? "CLEANUP_REQUIRED" : "CONTROL_REQUIRED")); if (run) report.variantsExecuted++; }
  }
  return validateProbeReport(report);
}

async function verifyPublicSources() {
  // The tracked example is never opened. Any actual local env file closes the
  // native gate before importing the browser producer or the original observer.
  if ((await readdir(ROOT)).some(name => name !== ".env.example" && /^\.env(?:\.|$)/.test(name))) refuse("ENVIRONMENT_REFUSED");
  for (const [relative, bytes, sha] of PUBLIC_PINS) { const path = resolve(ROOT, relative), stat = await lstat(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes || await realpath(path) !== path || hash(await readFile(path)) !== sha) refuse("SOURCE_REFUSED"); }
}
function createHttpCase({ chromium, createBrowserProtocolObserver, environment }, options) {
  const targetPaths = options.resource === "control" ? ["/probe-fetch", ...[1, 2, 3, 4].map(n => "/probe-script-" + n + ".js")] : options.resource === "held-fetch" ? ["/probe-fetch"] : [1, 2, 3, 4].map(n => "/probe-script-" + n + ".js");
  const allowed = new Set(["/probe.html", "/favicon.ico", ...targetPaths]), retained = new Map(), ended = new Set(), pending = new Map(), sockets = new Set(), responses = new Set(), count = emptyCounts();
  let browser, context, page, session, observer, origin, closing = false, startupStarted = false, startupSettled = false, serverClosed = false, serverStarted = false, listeningPromise, sourcePromise, browserClosed = false, contextClosed = false, sessionDetached = false, remaining;
  const fail = code => options.refuse(code), live = () => { if (closing || options.signal.aborted) refuse("TRANSPORT_REFUSED"); };
  const ownedClose = async (value, method) => { if (value) await value[method](); };
  const server = createServer((request, response) => {
    if (request.method !== "GET" || !allowed.has(request.url)) { count.unexpectedRequests = Math.min(PROBE_LIMITS.maxRequests, count.unexpectedRequests + 1); response.destroy(); fail("REQUEST_REFUSED"); return; }
    if (request.url === "/probe.html") { response.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); response.end("<!doctype html><html><head><title>Transport probe</title></head><body>Public synthetic fixture</body></html>"); return; }
    if (request.url === "/favicon.ico") { response.writeHead(204); response.end(); return; }
    if (options.signal.aborted || count.serverReceived >= PROBE_LIMITS.maxRequests || responses.has(response)) { response.destroy(); fail("LIMIT_REFUSED"); return; }
    count.serverReceived++;
    responses.add(response); response.once("finish", () => { count.responsesFinished++; });
  });
  server.on("connection", socket => { if (closing || options.signal.aborted || count.socketsCreated >= PROBE_LIMITS.maxSockets) { socket.destroy(); if (!closing && !options.signal.aborted) fail("LIMIT_REFUSED"); return; } sockets.add(socket); count.socketsCreated++; socket.once("close", () => { sockets.delete(socket); count.socketsClosed++; }); });
  server.on("error", () => fail("TRANSPORT_REFUSED"));
  server.on("clientError", (_error, socket) => { socket.destroy(); fail("REQUEST_REFUSED"); });
  server.on("listening", () => { serverStarted = true; }); server.on("close", () => { serverClosed = true; });
  const closeSource = () => sourcePromise ??= (async () => { if (listeningPromise) await listeningPromise.catch(() => {}); if (server.listening) await new Promise((yes, no) => { server.close(error => error ? no(error) : yes()); for (const socket of sockets) socket.destroy(); }); while (sockets.size) await new Promise(yes => setTimeout(yes, 1)); if (serverStarted && !serverClosed) refuse("TRANSPORT_REFUSED"); })();
  const terminal = (request, kind) => { if (!retained.has(request)) return; if (ended.has(request)) { fail("TRANSPORT_REFUSED"); return; } ended.add(request); observer?.terminal(request, kind); pending.delete(request); count[kind === "finished" ? "publicFinished" : "publicFailed"]++; };
  const snapshot = () => {
    const value = { ...count, socketsLive: sockets.size, pendingRequests: pending.size };
    for (const request of retained.keys()) { const observation = observer?.snapshot([request]); if (!observation || observation.identity !== "exact-server-request") { value.protocolUnavailable++; continue; } if (observation.terminal === "finished") value.cdpFinished++; else if (observation.terminal === "failed") value.cdpFailed++; else value.cdpNoTerminal++; if (observation.managerEntry === "same-request") value.managerSame++; else if (observation.managerEntry === "absent") value.managerAbsent++; if (observation.sessionRegistered === "registered") value.sessionRegistered++; else if (observation.sessionRegistered === "removed") value.sessionRemoved++; }
    return value;
  };
  return Object.freeze({ snapshot,
    async start(budget) {
      remaining = budget; startupStarted = true;
      try {
        live(); listeningPromise = new Promise((yes, no) => { const failed = () => no(new Error("TRANSPORT_REFUSED")); server.once("error", failed); server.listen(0, "127.0.0.1", () => { server.off("error", failed); yes(); }); }); await listeningPromise; live();
        origin = "http://127.0.0.1:" + server.address().port;
        browser = await chromium.launch({ headless: true, timeout: remaining(), env: environment }); if (closing || options.signal.aborted) { await browser.close(); browserClosed = true; refuse("TRANSPORT_REFUSED"); } if (browser.version() !== PROBE_BINDING.chromium) refuse("SOURCE_REFUSED");
        context = await browser.newContext({ baseURL: origin, serviceWorkers: "block", acceptDownloads: false }); if (closing || options.signal.aborted) { await context.close(); contextClosed = true; refuse("TRANSPORT_REFUSED"); }
        observer = createBrowserProtocolObserver({ fetchCommands: options.fetchCommands });
        context.on("request", request => { let path; try { const url = new URL(request.url()); if (url.origin !== origin || url.username || url.password || request.method() !== "GET" || url.search || url.hash || !allowed.has(url.pathname)) { fail("REQUEST_REFUSED"); return; } path = url.pathname; } catch { fail("REQUEST_REFUSED"); return; } if (targetPaths.includes(path)) { if (options.signal.aborted || retained.has(request) || retained.size >= PROBE_LIMITS.maxRequests) { fail("LIMIT_REFUSED"); return; } retained.set(request, path); pending.set(request, true); count.requestsStarted++; observer.request(request, page); } });
        context.on("requestfinished", request => terminal(request, "finished")); context.on("requestfailed", request => terminal(request, "failed"));
        await context.route("**/*", async route => { const request = route.request(); try { const url = new URL(request.url()); if (url.origin !== origin || url.username || url.password || url.search || url.hash || request.method() !== "GET" || !allowed.has(url.pathname)) { count.unexpectedRequests++; fail("REQUEST_REFUSED"); await route.abort(); return; } await route.continue(); if (retained.has(request)) count.routeAcks++; } catch { fail("TRANSPORT_REFUSED"); } }); live();
        page = await context.newPage(); live(); observer.observePage(page); page.on("download", download => { count.downloads++; fail("REQUEST_REFUSED"); void download.cancel().catch(() => {}); }); page.on("popup", () => { count.popups++; fail("REQUEST_REFUSED"); });
        await page.goto(origin + "/probe.html", { waitUntil: "domcontentloaded", timeout: remaining() }); live();
      } finally { startupSettled = true; }
    },
    async trigger() { live(); await page.evaluate(resource => { if (resource === "control" || resource === "held-fetch") void fetch("/probe-fetch").then(response => response.arrayBuffer()).catch(() => {}); if (resource !== "held-fetch") for (let n = 1; n <= 4; n++) { const script = document.createElement("script"); script.async = true; script.src = "/probe-script-" + n + ".js"; document.head.append(script); } }, options.resource); },
    async releaseResponses() { live(); while (count.serverReceived < targetPaths.length) { remaining(); await new Promise(yes => setTimeout(yes, 1)); } for (const response of responses) { remaining(); live(); response.writeHead(200, { "content-type": "application/javascript", "cache-control": "no-store" }); response.end("/* public synthetic response */"); } },
    offline: () => { live(); return context.setOffline(true); },
    async stopLoading() { live(); session = await context.newCDPSession(page); if (closing || options.signal.aborted) { await session.detach(); sessionDetached = true; refuse("TRANSPORT_REFUSED"); } await session.send("Page.stopLoading"); },
    blank: () => { live(); return page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: remaining() }); },
    unroute: () => { live(); return context.unrouteAll({ behavior: "wait" }); },
    closeSource,
    async cleanup() {
      closing = true; observer?.dispose();
      const clean = async (operation, yes) => { try { await operation(); yes(); } catch { /* Individual owned close remains false. */ } };
      // Dispose each browser handle in ownership order. Concurrent context and
      // session closure would make an implicit detach indistinguishable from
      // the original explicit detach result.
      await Promise.all([clean(closeSource, () => {}), (async () => {
        await clean(() => ownedClose(session, "detach"), () => { if (session) sessionDetached = true; });
        await clean(() => ownedClose(context, "close"), () => { if (context) contextClosed = true; });
        await clean(() => ownedClose(browser, "close"), () => { if (browser) browserClosed = true; });
      })()]);
      return { server: serverClosed ? "close_observed" : serverStarted ? "unconfirmed" : "absent", context: contextClosed ? "close_observed" : context ? "unconfirmed" : "absent", browser: browserClosed ? "close_observed" : browser ? "unconfirmed" : "absent", session: sessionDetached ? "close_observed" : session ? "unconfirmed" : "absent", socketsClosed: sockets.size === 0 && count.socketsClosed === count.socketsCreated, startupSettled: !startupStarted || startupSettled };
    },
  });
}
async function createNativePorts(env) {
  const environment = validateProbeEnvironment(env, { platform: process.platform, arch: process.arch, node: process.version });
  await verifyPublicSources();
  const { chromium } = await import("playwright-core"), { createBrowserProtocolObserver } = await import("../../tests/e2e-auth-local/admin-browser-support.mjs");
  const now = performance.now.bind(performance), ports = { sourceSha: env.GITHUB_SHA, now, pause: ms => new Promise(yes => setTimeout(yes, ms)), schedule: (callback, ms) => setTimeout(callback, ms), cancel: clearTimeout, createCase: options => createHttpCase({ chromium, createBrowserProtocolObserver, environment, now }, options) };
  nativePorts.add(ports); return ports;
}
export async function main(argv = process.argv.slice(2), env = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  try { const options = parseProbeArguments(argv); if (!options.execute) { output({ schemaVersion: 1, scenario: "browser-transport-probe", code: "NO_SERVICE_STARTED" }); return 0; } const report = await runBrowserTransportProbe(await createNativePorts(env), { variants: options.variants }); output(report); return report.controlQualified && report.cases.every(c => c.outcome !== "REFUSED" && c.outcome !== "INCONCLUSIVE" && (c.outcome === "NOT_RUN" || allClean(c.cleanup))) ? 0 : 1; }
  catch (error) { output({ schemaVersion: 1, scenario: "browser-transport-probe", code: safeCode(error), diagnosticOnly: true, applicationAccepted: false }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
