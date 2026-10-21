/** Isolated synthetic qualification. Import/--help performs no I/O or launch. */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const HERE = dirname(fileURLToPath(import.meta.url)), BODY = "hello world";
const CODES = new Set(["ARGUMENTS_REFUSED", "MANIFEST_REFUSED", "SDK_REFUSED", "BROWSER_REFUSED", "DEADLINE", "CASE_REFUSED", "CLEANUP_UNCONFIRMED", "INTERNAL_REFUSED", "REPORT_REFUSED"]);
export const QUALIFICATION_CASES = Object.freeze(["positive-1", "positive-2", "positive-3", "abort", "truncate"]);
const DRIVER_HASHES = Object.freeze({ playwrightPackage: "8bc2ddebe8d9b051b9ecb87d62c6c63877e59d08617f32c3215681ca8bb70998", corePackage: "f061c58427e47e843e26d201f0a57076c734e57c734ecbbd87d4a23b7a20db9b", coreBundle: "549070af3acabb3efcc4f55bfe6210f9f7c2fcf633cf7eaa59bfe60719969171", browsers: "545d52f8382c391e605562c330e9c1c534a16045898203037a49bb8bd769a946" });
const VERSIONS = Object.freeze({ old: "153.0.8010.12", candidate: "157.0.8103.6" });
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const codeOf = e => { try { const d = Object.getOwnPropertyDescriptor(e, "code"); return d && Object.hasOwn(d, "value") && CODES.has(d.value) ? d.value : "INTERNAL_REFUSED"; } catch { return "INTERNAL_REFUSED"; } };
const closed = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const below = (root, target) => { const r = relative(root, target); return r !== "" && !isAbsolute(r) && r !== ".." && !r.startsWith(".." + sep); };
export const timerPromise = (promise, deadline, code = "DEADLINE", clock = () => performance.now(), schedule = setTimeout, cancel = clearTimeout) => new Promise((yes, no) => {
  let timer; const refuse = () => no(Object.assign(new Error(code), { code })), now = clock(), left = deadline - now;
  if (!Number.isFinite(now) || !Number.isFinite(deadline) || left <= 0) refuse(); else timer = schedule(refuse, left);
  try { Promise.prototype.then.call(promise, value => { cancel(timer); const at = clock(); if (!Number.isFinite(at) || at >= deadline) refuse(); else yes(value); }, () => { cancel(timer); refuse(); }); } catch { cancel(timer); refuse(); }
});
async function manifestEntry(mode, deadline) {
  const root = await realpath(HERE), path = resolve(HERE, "manifest.json"), info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 8192 || !below(root, await realpath(path))) fail("MANIFEST_REFUSED");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  if (!closed(manifest, ["schemaVersion", "old", "candidate"]) || manifest.schemaVersion !== 1) fail("MANIFEST_REFUSED");
  for (const item of [manifest.old, manifest.candidate]) if (!closed(item, ["executablePath", "expectedVersion", "sha256"]) || typeof item.executablePath !== "string" || !isAbsolute(item.executablePath) || !/^\d{1,3}(?:\.\d{1,6}){3}$/.test(item.expectedVersion) || !/^[a-f0-9]{64}$/.test(item.sha256)) fail("MANIFEST_REFUSED");
  const item = manifest[mode], canonical = await realpath(item.executablePath), stat = await lstat(item.executablePath);
  if (!below(root, canonical) || !stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 1073741824 || resolve(item.executablePath).toLowerCase() !== canonical.toLowerCase()) fail("MANIFEST_REFUSED");
  const abort = new AbortController(), stream = createReadStream(canonical, { signal: abort.signal }), hash = createHash("sha256");
  try { await timerPromise((async () => { for await (const bytes of stream) hash.update(bytes); })(), deadline); } finally { abort.abort(); stream.destroy(); }
  if (hash.digest("hex") !== item.sha256) fail("MANIFEST_REFUSED");
  if (item.expectedVersion !== VERSIONS[mode]) fail("MANIFEST_REFUSED");
  return { executablePath: canonical, expectedVersion: item.expectedVersion, sha256: item.sha256 };
}
function browserEnvironment() {
  const env = {};
  for (const key of ["PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "LOCALAPPDATA", "LANG", "DISPLAY"]) {
    const v = process.env[key]; if (v !== undefined) { if (typeof v !== "string" || v.length > 4096 || v.includes("\0")) fail("BROWSER_REFUSED"); env[key] = v; }
  }
  return env;
}
const newCase = (kind, interception) => ({ kind, bytesRead: 0, body: "unobserved", publicStarted: 0, publicResponses: 0, publicFinished: 0, publicFailed: 0, response: "unobserved", responseFinished: "unobserved", cdpStarted: 0, cdpResponses: 0, cdpFinished: 0, cdpFailed: 0, cdpResponse: "unobserved", serverReceived: 0, serverFinished: 0, serverPrematureClose: 0, routeStarted: 0, routeSettled: 0, routeRejected: 0, fetchContinueStarted: 0, fetchContinueResolved: 0, fetchContinueRejected: 0, requestIdentity: interception === "off" ? "not-applicable" : "unobserved", protocolIdentity: interception === "off" ? "not-applicable" : "unobserved", result: "REFUSED" });
// In this driver requestfailed does not settle Response.finished(). Observe the
// original waiter without synthesising completion or waiting for cleanup to do it.
const terminalReady = (r, interception) => r.publicFinished + r.publicFailed >= 1 && r.cdpFinished + r.cdpFailed >= 1 && r.responseFinished !== "unobserved" && (r.publicFailed > 0 || r.responseFinished !== "pending") && r.serverFinished + r.serverPrematureClose >= 1 && (interception === "off" || r.routeSettled + r.routeRejected >= 1);
function decide(r, interception) {
  const routing = interception === "off" ? [r.routeStarted, r.routeSettled, r.routeRejected, r.fetchContinueStarted, r.fetchContinueResolved, r.fetchContinueRejected].every(n => n === 0) && r.requestIdentity === "not-applicable" && r.protocolIdentity === "not-applicable" : r.routeStarted === 1 && r.routeSettled === 1 && r.routeRejected === 0 && r.fetchContinueStarted === 1 && r.fetchContinueResolved === 1 && r.fetchContinueRejected === 0 && r.requestIdentity === "exact" && r.protocolIdentity === "exact";
  const common = routing && r.publicStarted === 1 && r.publicResponses === 1 && r.cdpStarted === 1 && r.cdpResponses === 1 && r.serverReceived === 1 && r.response === "200" && r.cdpResponse === "200";
  const finished = common && r.publicFinished === 1 && r.publicFailed === 0 && r.cdpFinished === 1 && r.cdpFailed === 0 && r.responseFinished === "finished" && r.serverFinished === 1 && r.serverPrematureClose === 0;
  const failed = common && r.publicFinished === 0 && r.publicFailed === 1 && r.cdpFinished === 0 && r.cdpFailed === 1 && ["pending", "failed"].includes(r.responseFinished);
  if (r.kind.startsWith("positive")) return r.body === "complete" && r.bytesRead === 11 && finished ? "NATURAL_FINISHED" : r.body === "complete" && r.bytesRead === 11 && failed && r.serverFinished === 1 && r.serverPrematureClose === 0 ? "REPRODUCED" : "REFUSED";
  return failed && r.serverFinished === 0 && r.serverPrematureClose === 1 && (r.kind === "abort" ? r.body === "aborted" && r.bytesRead > 0 && r.bytesRead < 11 : r.body === "incomplete" && r.bytesRead <= 11) ? "NEGATIVE_PASSED" : "REFUSED";
}

const data = (object, key) => { const d = object && Object.getOwnPropertyDescriptor(object, key); if (!d || !Object.hasOwn(d, "value")) fail("BROWSER_REFUSED"); return d.value; };
const method = (object, key) => { for (let i = 0; object && i < 12; i++, object = Object.getPrototypeOf(object)) { const d = Object.getOwnPropertyDescriptor(object, key); if (d) { if (!Object.hasOwn(d, "value") || typeof d.value !== "function") fail("BROWSER_REFUSED"); return d.value; } } fail("BROWSER_REFUSED"); };
const identifier = value => { if (typeof value !== "string" || value.length < 1 || value.length > 256) fail("BROWSER_REFUSED"); return value; };
/** Exact SDK1.63 object bridge; identifiers are returned only to local RAM. */
export function observeOriginalContinue(route, request, page, record, track, live) {
  record.requestIdentity = "unavailable";
  const connection = data(page, "_connection"), bridge = data(connection, "toImpl");
  if (typeof bridge !== "function" || typeof track !== "function" || typeof live !== "function") fail("BROWSER_REFUSED");
  const impl = client => { if (data(client, "_connection") !== connection) fail("BROWSER_REFUSED"); identifier(data(client, "_guid")); return bridge.call(connection, client); };
  const serverPage = impl(page), serverRequest = impl(request), serverRoute = impl(route), manager = data(data(serverPage, "delegate"), "_networkManager");
  if (data(manager, "_page") !== serverPage || data(serverRoute, "_request") !== serverRequest) fail("BROWSER_REFUSED");
  const delegate = data(serverRoute, "_delegate"), session = data(delegate, "_session"), interception = identifier(data(delegate, "_interceptionId"));
  const map = data(manager, "_requestIdToRequest"), sessions = data(manager, "_sessions");
  if (Object.getOwnPropertyDescriptor(Map.prototype, "size").get.call(map) > 32 || !Map.prototype.has.call(sessions, session) || data(Map.prototype.get.call(sessions, session), "session") !== session) fail("BROWSER_REFUSED");
  const matches = [...Map.prototype.entries.call(map)].filter(([, entry]) => data(entry, "request") === serverRequest);
  if (matches.length !== 1) fail("BROWSER_REFUSED"); const [key, entry] = matches[0], networkId = identifier(key);
  if (data(entry, "_requestId") !== networkId || data(entry, "session") !== session || data(entry, "_interceptionId") !== interception || data(entry, "_originalRequestRoute") !== delegate) fail("BROWSER_REFUSED");
  const original = method(session, "send"), own = Object.getOwnPropertyDescriptor(session, "send"); if (own && (!Object.hasOwn(own, "value") || !own.configurable)) fail("BROWSER_REFUSED");
  const wrapper = function (...args) {
    let matched = false;
    if (live() && this === session && args[0] === "Fetch.continueRequest") { try { matched = data(args[1], "requestId") === interception; if (matched) record.fetchContinueStarted++; } catch { record.requestIdentity = "unavailable"; } }
    let result; try { result = Reflect.apply(original, this, args); } catch (error) { if (matched && live()) record.fetchContinueRejected++; throw error; }
    if (matched) { try { track(result); Promise.prototype.then.call(result, () => { if (live()) record.fetchContinueResolved++; }, () => { if (live()) record.fetchContinueRejected++; }); } catch { record.requestIdentity = "unavailable"; } }
    return result;
  };
  Object.defineProperty(session, "send", { value: wrapper, writable: true, configurable: true, enumerable: own?.enumerable ?? false }); record.requestIdentity = "exact";
  let restored = false;
  const restore = () => { try { const now = Object.getOwnPropertyDescriptor(session, "send"); if (!restored) { if (!now || !Object.hasOwn(now, "value") || now.value !== wrapper) return false; if (own) Object.defineProperty(session, "send", own); else Reflect.deleteProperty(session, "send"); restored = true; } const after = Object.getOwnPropertyDescriptor(session, "send"); return own ? !!after && Reflect.ownKeys(own).every(k => after[k] === own[k]) && Reflect.ownKeys(after).length === Reflect.ownKeys(own).length : after === undefined && method(session, "send") === original; } catch { return false; } };
  return Object.freeze({ networkId, restore });
}

export function parseQualificationArguments(argv) {
  if (!Array.isArray(argv) || argv.some(v => typeof v !== "string")) fail("ARGUMENTS_REFUSED");
  if (argv.length === 1 && argv[0] === "--help") return Object.freeze({ execute: false });
  if (argv.length !== 2 || !["old", "candidate"].includes(argv[0]) || !["off", "continue"].includes(argv[1])) fail("ARGUMENTS_REFUSED");
  return Object.freeze({ execute: true, mode: argv[0], interception: argv[1] });
}

const reportRecord = (value, keys) => { if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail("REPORT_REFUSED"); const descriptors = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(descriptors); if (own.length !== keys.length || own.some(k => !keys.includes(k))) fail("REPORT_REFUSED"); return Object.fromEntries(keys.map(k => { const d = descriptors[k]; if (!d?.enumerable || !Object.hasOwn(d, "value")) fail("REPORT_REFUSED"); return [k, d.value]; })); };
const reportArray = (value, min, max) => { if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("REPORT_REFUSED"); const d = Object.getOwnPropertyDescriptors(value), n = d.length?.value; if (!Number.isSafeInteger(n) || n < min || n > max || Reflect.ownKeys(d).length !== n + 1) fail("REPORT_REFUSED"); return Array.from({ length: n }, (_, i) => { const item = d[String(i)]; if (!item?.enumerable || !Object.hasOwn(item, "value")) fail("REPORT_REFUSED"); return item.value; }); };
const number = (value, max) => { if (!Number.isSafeInteger(value) || value < 0 || value > max) fail("REPORT_REFUSED"); return value; };
const isHash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
/** Closed artefact boundary. No getter, free-form error, body, URL or opaque ID. */
export function validateQualificationReport(input) {
  try {
    const r = reportRecord(input, ["schemaVersion", "mode", "interception", "diagnosticOnly", "applicationAccepted", "platform", "nodeVersion", "driverVersion", "browserVersion", "cdpBrowserVersion", "cdpProtocolVersion", "binding", "status", "code", "executionStopped", "phases", "unexpectedRequests", "popups", "downloads", "cases", "cleanup"]);
    if (r.schemaVersion !== 1 || !["old", "candidate"].includes(r.mode) || !["off", "continue"].includes(r.interception) || r.diagnosticOnly !== true || r.applicationAccepted !== false || !["win32", "linux"].includes(r.platform) || typeof r.nodeVersion !== "string" || !/^v\d{1,3}\.\d{1,4}\.\d{1,4}$/.test(r.nodeVersion) || ![null, "1.63.0"].includes(r.driverVersion)) fail("REPORT_REFUSED");
    if (![null, VERSIONS[r.mode]].includes(r.browserVersion) || ![null, VERSIONS[r.mode]].includes(r.cdpBrowserVersion) || r.cdpProtocolVersion !== null && (typeof r.cdpProtocolVersion !== "string" || !/^\d{1,3}\.\d{1,3}$/.test(r.cdpProtocolVersion))) fail("REPORT_REFUSED");
    if (r.binding !== null) { r.binding = reportRecord(r.binding, ["binarySha256", "expectedVersion", "harnessSha256", "sdkHashes"]); if (!isHash(r.binding.binarySha256) || r.binding.expectedVersion !== VERSIONS[r.mode] || r.binding.harnessSha256 !== null && !isHash(r.binding.harnessSha256)) fail("REPORT_REFUSED"); if (r.binding.sdkHashes !== null) { r.binding.sdkHashes = reportRecord(r.binding.sdkHashes, Object.keys(DRIVER_HASHES)); if (Object.values(r.binding.sdkHashes).some(v => !isHash(v))) fail("REPORT_REFUSED"); } }
    if (!["QUALIFIED", "REPRODUCED", "NOT_REPRODUCED", "REFUSED"].includes(r.status) || (r.status === "REFUSED" ? !CODES.has(r.code) : r.code !== "OBSERVED")) fail("REPORT_REFUSED");
    for (const key of ["unexpectedRequests", "popups", "downloads"]) number(r[key], 64);
    r.cleanup = reportRecord(r.cleanup, ["server", "context", "browser", "session", "sockets", "startup", "operations", "hooks"]); if (Object.values(r.cleanup).some(v => typeof v !== "boolean")) fail("REPORT_REFUSED");
    const allClean = Object.values(r.cleanup).every(Boolean); if (!allClean && (r.status !== "REFUSED" || r.code !== "CLEANUP_UNCONFIRMED") || allClean && r.code === "CLEANUP_UNCONFIRMED") fail("REPORT_REFUSED");
    r.cases = reportArray(r.cases, 5, 5).map((value, index) => { const row = reportRecord(value, Object.keys(newCase(QUALIFICATION_CASES[index], r.interception))); if (row.kind !== QUALIFICATION_CASES[index]) fail("REPORT_REFUSED"); for (const key of Object.keys(row).filter(k => !["kind", "body", "response", "responseFinished", "cdpResponse", "requestIdentity", "protocolIdentity", "result"].includes(k))) number(row[key], key === "bytesRead" ? 22 : 64); if (!["unobserved", "complete", "aborted", "incomplete", "invalid"].includes(row.body) || !["unobserved", "200", "other"].includes(row.response) || !["unobserved", "pending", "finished", "failed"].includes(row.responseFinished) || !["unobserved", "200", "other"].includes(row.cdpResponse) || [row.requestIdentity, row.protocolIdentity].some(v => !["not-applicable", "unobserved", "exact", "unavailable"].includes(v)) || !["REFUSED", "NATURAL_FINISHED", "REPRODUCED", "NEGATIVE_PASSED"].includes(row.result) || row.result !== "REFUSED" && row.result !== decide(row, r.interception)) fail("REPORT_REFUSED"); return row; });
    const phases = [["manifest", null], ["sdk", null], ["browser", null], ["document", null], ...QUALIFICATION_CASES.map(k => ["case", k])];
    r.phases = reportArray(r.phases, 2, 10).map((value, index, rows) => { const row = reportRecord(value, ["phase", "case", "enteredMs", "settledMs"]), expected = index === rows.length - 1 ? ["cleanup", null] : phases[index]; if (row.phase !== expected[0] || row.case !== expected[1]) fail("REPORT_REFUSED"); number(row.enteredMs, 25001); if (row.settledMs !== null) { number(row.settledMs, 25001); if (row.settledMs < row.enteredMs) fail("REPORT_REFUSED"); } return row; });
    for (let i = 1; i < r.phases.length; i++) if (r.phases[i].enteredMs < (r.phases[i - 1].settledMs ?? r.phases[i - 1].enteredMs)) fail("REPORT_REFUSED");
    r.executionStopped = reportRecord(r.executionStopped, ["phase", "case", "elapsedMs"]); const stopped = r.phases.at(-2), cleanup = r.phases.at(-1); number(r.executionStopped.elapsedMs, 25001); if (r.executionStopped.phase !== stopped.phase || r.executionStopped.case !== stopped.case || r.executionStopped.elapsedMs < stopped.enteredMs || r.executionStopped.elapsedMs > cleanup.enteredMs || cleanup.settledMs === null) fail("REPORT_REFUSED");
    if (r.status !== "REFUSED") { const positive = r.cases.slice(0, 3), negative = r.cases.slice(3); if (!allClean || r.unexpectedRequests || r.popups || r.downloads || r.phases.length !== 10 || r.phases.some(p => p.settledMs === null) || r.executionStopped.elapsedMs >= 20000 || cleanup.settledMs - cleanup.enteredMs > 5000 || cleanup.settledMs > 25000 || !r.nodeVersion.startsWith("v24.") || r.driverVersion !== "1.63.0" || !r.binding?.sdkHashes || !r.binding.harnessSha256 || Object.entries(DRIVER_HASHES).some(([k, v]) => r.binding.sdkHashes[k] !== v) || r.browserVersion !== VERSIONS[r.mode] || r.cdpBrowserVersion !== VERSIONS[r.mode] || r.cdpProtocolVersion === null || negative.some(c => c.result !== "NEGATIVE_PASSED")) fail("REPORT_REFUSED"); if (r.mode === "candidate" ? r.status !== "QUALIFIED" || positive.some(c => c.result !== "NATURAL_FINISHED") : r.status === "REPRODUCED" ? !positive.some(c => c.result === "REPRODUCED") || positive.some(c => !["REPRODUCED", "NATURAL_FINISHED"].includes(c.result)) : r.status !== "NOT_REPRODUCED" || positive.some(c => c.result !== "NATURAL_FINISHED")) fail("REPORT_REFUSED"); }
    return r;
  } catch { fail("REPORT_REFUSED"); }
}

export async function qualify(mode, interception) {
  if (!["old", "candidate"].includes(mode) || !["off", "continue"].includes(interception)) fail("ARGUMENTS_REFUSED");
  const started = performance.now(), deadline = started + 20000, cases = QUALIFICATION_CASES.map(k => newCase(k, interception));
  const report = { schemaVersion: 1, mode, interception, diagnosticOnly: true, applicationAccepted: false, platform: process.platform, nodeVersion: process.version, driverVersion: null, browserVersion: null, cdpBrowserVersion: null, cdpProtocolVersion: null, binding: null, status: "REFUSED", code: "INTERNAL_REFUSED", executionStopped: null, phases: [], unexpectedRequests: 0, popups: 0, downloads: 0, cases, cleanup: { server: false, context: false, browser: false, session: false, sockets: false, startup: false, operations: false, hooks: false } };
  let server, browser, context, session, launch, origin, observing = true, hookUncertain = false;
  let currentPhase;
  const elapsed = () => Math.min(25001, Math.max(0, Math.floor(performance.now() - started)));
  // Observational only. No clock row supplies readiness or renews a deadline.
  const enter = (phase, kind = null) => { currentPhase = { phase, case: kind, enteredMs: elapsed(), settledMs: null }; report.phases.push(currentPhase); };
  const settled = () => { currentPhase.settledMs = elapsed(); };
  const sockets = new Set(), timers = new Set(), paths = new Map(cases.map(r => ["/" + r.kind, r])), requests = new WeakMap(), protocol = new Map(), operations = new Set(), hooks = new Set(), nativeIds = new WeakMap(), bridgedIds = new WeakMap();
  const own = promise => { const p = Promise.resolve(promise); operations.add(p); void p.then(() => operations.delete(p), () => operations.delete(p)); return p; };
  const bounded = (promise, end = deadline, code) => timerPromise(own(promise), end, code);
  try {
    enter("manifest");
    if (!["win32", "linux"].includes(process.platform) || process.arch !== "x64") fail("BROWSER_REFUSED");
    if (!/^v24\.\d+\.\d+$/.test(process.version)) fail("SDK_REFUSED");
    const entry = await bounded(manifestEntry(mode, deadline), deadline, "MANIFEST_REFUSED");
    report.binding = { binarySha256: entry.sha256, expectedVersion: entry.expectedVersion, harnessSha256: null, sdkHashes: null };
    settled(); enter("sdk");
    const [sdkBytes, coreBytes, bundleBytes, browsersBytes, ownBytes] = await bounded(Promise.all([readFile(new URL("../../node_modules/playwright/package.json", import.meta.url)), readFile(new URL("../../node_modules/playwright-core/package.json", import.meta.url)), readFile(new URL("../../node_modules/playwright-core/lib/coreBundle.js", import.meta.url)), readFile(new URL("../../node_modules/playwright-core/browsers.json", import.meta.url)), readFile(fileURLToPath(import.meta.url))]));
    const hash = bytes => createHash("sha256").update(bytes).digest("hex"), sdk = JSON.parse(sdkBytes.toString("utf8")), core = JSON.parse(coreBytes.toString("utf8"));
    report.binding.harnessSha256 = hash(ownBytes); report.binding.sdkHashes = { playwrightPackage: hash(sdkBytes), corePackage: hash(coreBytes), coreBundle: hash(bundleBytes), browsers: hash(browsersBytes) };
    if (Object.entries(DRIVER_HASHES).some(([k, v]) => report.binding.sdkHashes[k] !== v)) fail("SDK_REFUSED");
    if (sdk.name !== "playwright" || sdk.version !== "1.63.0" || core.name !== "playwright-core" || core.version !== "1.63.0") fail("SDK_REFUSED"); report.driverVersion = sdk.version;
    const { chromium } = await bounded(import("../../node_modules/playwright/index.mjs"));
    settled(); enter("browser");
    server = createServer((req, res) => {
      if (req.method !== "GET") { report.unexpectedRequests++; res.writeHead(405).end(); return; }
      if (req.url === "/") { res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" }); res.end('<!doctype html><link rel="icon" href="data:,"><title>Synthetic qualification</title>'); return; }
      const r = paths.get(req.url); if (!r || ++r.serverReceived !== 1) { report.unexpectedRequests++; res.writeHead(404).end(); return; }
      res.on("finish", () => { if (observing) r.serverFinished++; });
      let second;
      res.on("close", () => { if (second) { clearTimeout(second); timers.delete(second); } if (observing && !res.writableFinished) r.serverPrematureClose++; });
      res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store", ...(r.kind === "truncate" ? { "Content-Length": "22" } : {}) }); res.write(BODY.slice(0, 6));
      second = setTimeout(() => { timers.delete(second); if (res.destroyed) return; res.write(BODY.slice(6)); if (r.kind === "truncate") { const end = setTimeout(() => { timers.delete(end); res.destroy(); }, 10); timers.add(end); } else res.end(); }, r.kind === "abort" ? 400 : 20); timers.add(second);
    });
    server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
    await bounded(new Promise((yes, no) => { server.once("error", no); server.listen(0, "127.0.0.1", yes); })); const address = server.address(); if (!address || typeof address === "string") fail("BROWSER_REFUSED"); origin = "http://127.0.0.1:" + address.port;
    launch = chromium.launch({ executablePath: entry.executablePath, headless: true, env: browserEnvironment(), timeout: Math.max(1, deadline - performance.now()) });
    browser = await bounded(launch, deadline, "BROWSER_REFUSED"); report.cleanup.startup = true;
    const browserVersion = browser.version(); if (browserVersion !== entry.expectedVersion) fail("BROWSER_REFUSED"); report.browserVersion = browserVersion;
    context = await bounded(browser.newContext({ acceptDownloads: false, serviceWorkers: "block" })); const page = await bounded(context.newPage());
    context.on("page", p => { if (p !== page) { report.popups++; void own(p.close()).catch(() => {}); } }); page.on("download", () => report.downloads++);
    page.on("request", request => { if (!observing) return; const url = request.url(), r = paths.get(url.slice(origin.length)); if (!url.startsWith(origin + "/") || request.method() !== "GET" || request.frame() !== page.mainFrame()) { report.unexpectedRequests++; return; } if (r) { r.publicStarted++; requests.set(request, r); } else if (url !== origin + "/") report.unexpectedRequests++; });
    page.on("response", response => { const r = observing && requests.get(response.request()); if (!r) return; if (++r.publicResponses !== 1) { report.unexpectedRequests++; return; } r.response = response.status() === 200 ? "200" : "other"; r.responseFinished = "pending"; void own(response.finished()).then(v => { if (observing) r.responseFinished = v === null ? "finished" : "failed"; }, () => { if (observing) r.responseFinished = "failed"; }); });
    page.on("requestfinished", request => { if (observing) { const r = requests.get(request); if (r) r.publicFinished++; } }); page.on("requestfailed", request => { if (observing) { const r = requests.get(request); if (r) r.publicFailed++; } });
    if (interception === "continue") await bounded(context.route("**/*", route => own((async () => {
      if (!observing) fail("CASE_REFUSED"); const request = route.request(), url = request.url(), row = paths.get(url.slice(origin.length));
      if (!url.startsWith(origin + "/") || request.method() !== "GET" || request.frame() !== page.mainFrame() || !row && url !== origin + "/") { report.unexpectedRequests++; fail("CASE_REFUSED"); }
      if (!row) { await own(route.continue()); return; }
      if (requests.get(request) !== row || ++row.routeStarted !== 1) fail("CASE_REFUSED");
      let hook;
      try { hook = observeOriginalContinue(route, request, page, row, own, () => observing); hooks.add(hook); bridgedIds.set(row, hook.networkId); if (nativeIds.has(row)) row.protocolIdentity = nativeIds.get(row) === hook.networkId ? "exact" : "unavailable"; await own(route.continue()); if (observing) row.routeSettled++; }
      catch { if (observing) row.routeRejected++; }
      finally { if (hook && !hook.restore()) hookUncertain = true; }
    })())));
    session = await bounded(context.newCDPSession(page)); const version = await bounded(session.send("Browser.getVersion"));
    const product = /^(?:HeadlessChrome|Chrome)\/(\d{1,3}(?:\.\d{1,6}){3})$/.exec(version.product); if (!product || product[1] !== entry.expectedVersion || !/^\d{1,3}\.\d{1,3}$/.test(version.protocolVersion)) fail("BROWSER_REFUSED"); report.cdpBrowserVersion = product[1]; report.cdpProtocolVersion = version.protocolVersion;
    session.on("Network.requestWillBeSent", event => { if (!observing || !event.request.url.startsWith(origin + "/")) return; const r = paths.get(event.request.url.slice(origin.length)); if (!r) return; if (event.request.method !== "GET" || event.type !== "Fetch" || protocol.has(event.requestId)) { report.unexpectedRequests++; return; } r.cdpStarted++; protocol.set(event.requestId, r); nativeIds.set(r, event.requestId); if (interception === "continue" && bridgedIds.has(r)) r.protocolIdentity = bridgedIds.get(r) === event.requestId ? "exact" : "unavailable"; });
    session.on("Network.responseReceived", event => { const r = observing && protocol.get(event.requestId); if (r) { if (++r.cdpResponses !== 1) { report.unexpectedRequests++; return; } r.cdpResponse = event.response.status === 200 ? "200" : "other"; } }); session.on("Network.loadingFinished", event => { const r = observing && protocol.get(event.requestId); if (r) r.cdpFinished++; }); session.on("Network.loadingFailed", event => { const r = observing && protocol.get(event.requestId); if (r) r.cdpFailed++; });
    await bounded(session.send("Network.enable")); settled(); enter("document");
    await bounded(page.goto(origin + "/", { waitUntil: "load", timeout: Math.max(1, deadline - performance.now()) })); settled();
    for (const r of cases) {
      enter("case", r.kind);
      const client = await bounded(page.evaluate(async ({ path, abort }) => {
        const controller = new AbortController(), expected = [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]; let bytes = 0, matches = true, eof = false, failed = false;
        try { const response = await fetch(path, abort ? { signal: controller.signal } : undefined), reader = response.body.getReader(); for (;;) { const part = await reader.read(); if (part.done) { eof = true; break; } for (const byte of part.value) { if (byte !== expected[bytes]) matches = false; bytes++; if (bytes > 22) throw 0; } if (abort) controller.abort(); } } catch { failed = true; }
        return { bytes, matches, eof, failed, aborted: controller.signal.aborted };
      }, { path: "/" + r.kind, abort: r.kind === "abort" }));
      if (!closed(client, ["bytes", "matches", "eof", "failed", "aborted"]) || !Number.isSafeInteger(client.bytes) || client.bytes < 0 || client.bytes > 22 || [client.matches, client.eof, client.failed, client.aborted].some(v => typeof v !== "boolean")) fail("CASE_REFUSED");
      r.bytesRead = client.bytes; r.body = client.eof && !client.failed && client.matches && client.bytes === 11 ? "complete" : client.failed && client.matches && client.aborted ? "aborted" : client.failed && client.matches && !client.eof ? "incomplete" : "invalid";
      while (!terminalReady(r, interception)) await bounded(new Promise(yes => setTimeout(yes, 10)));
      settled();
    }
    if (performance.now() >= deadline) fail("DEADLINE");
    for (const r of cases) r.result = decide(r, interception);
    if (report.unexpectedRequests || report.popups || report.downloads || cases.some(r => r.result === "REFUSED")) fail("CASE_REFUSED");
    const reproduced = cases.slice(0, 3).some(r => r.result === "REPRODUCED"); report.status = mode === "old" ? reproduced ? "REPRODUCED" : "NOT_REPRODUCED" : reproduced ? "REFUSED" : "QUALIFIED"; report.code = reproduced && mode === "candidate" ? "CASE_REFUSED" : "OBSERVED";
    if (performance.now() >= deadline) fail("DEADLINE");
  } catch (error) { report.status = "REFUSED"; report.code = codeOf(error); }
  finally {
    report.executionStopped = { phase: currentPhase.phase, case: currentPhase.case, elapsedMs: elapsed() };
    const cleanupDeadline = performance.now() + 5000;
    enter("cleanup");
    observing = false; for (const timer of timers) clearTimeout(timer); timers.clear();
    let restored = !hookUncertain; for (const hook of hooks) if (!hook.restore()) restored = false; report.cleanup.hooks = restored;
    try { if (!browser && launch) browser = await bounded(launch, cleanupDeadline, "CLEANUP_UNCONFIRMED"); report.cleanup.startup = !launch || !!browser; } catch { /* Original launch remains unconfirmed. */ }
    try { if (session) await bounded(session.detach(), cleanupDeadline, "CLEANUP_UNCONFIRMED"); report.cleanup.session = true; } catch { /* No synthetic close acknowledgement. */ }
    try { if (context) await bounded(context.close(), cleanupDeadline, "CLEANUP_UNCONFIRMED"); report.cleanup.context = true; } catch { /* No synthetic close acknowledgement. */ }
    try { if (browser) await bounded(browser.close(), cleanupDeadline, "CLEANUP_UNCONFIRMED"); report.cleanup.browser = true; } catch { /* No synthetic close acknowledgement. */ }
    try { if (server) { const close = new Promise((yes, no) => server.close(error => error ? no(error) : yes())); server.closeAllConnections(); await bounded(close, cleanupDeadline, "CLEANUP_UNCONFIRMED"); } report.cleanup.server = true; } catch { /* No synthetic close acknowledgement. */ }
    try { while (operations.size) await timerPromise(new Promise(yes => setTimeout(yes, 10)), cleanupDeadline, "CLEANUP_UNCONFIRMED"); } catch { /* Owned original operations did not settle. */ }
    report.cleanup.operations = operations.size === 0;
    report.cleanup.sockets = sockets.size === 0;
    if (!Object.values(report.cleanup).every(Boolean)) { report.status = "REFUSED"; report.code = "CLEANUP_UNCONFIRMED"; }
    settled();
    if (performance.now() >= cleanupDeadline && report.code !== "CLEANUP_UNCONFIRMED") { report.status = "REFUSED"; report.code = "DEADLINE"; }
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = parseQualificationArguments(process.argv.slice(2)); if (!args.execute) process.stdout.write("Usage: node qualify.mjs old|candidate off|continue (fixed sibling manifest; synthetic only)\n"); else { const report = validateQualificationReport(await qualify(args.mode, args.interception)); process.stdout.write(JSON.stringify(report) + "\n"); process.exitCode = report.status === "REFUSED" ? 1 : 0; } }
  catch { process.exitCode = 1; }
}
