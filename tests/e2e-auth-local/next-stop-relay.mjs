/** Closed Next stop relay. Import starts no process, query or network operation. */
import { createHash } from "node:crypto";
import { readFile, lstat, realpath } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const SOURCE_PINS = Object.freeze([
  Object.freeze({ path: "src/middleware.ts", bytes: 1809, sha256: "f57cf49d860aa695cac1e16d29a3ec8db8eb7b87c57bc8f5471f68b495ad9c66" }),
  Object.freeze({ path: "node_modules/next/dist/server/lib/router-server.js", bytes: 33199, sha256: "b41301ce6de392d509c0854ee2517191484c31b1d1d907c9f5a1d29a08360eac" }),
  Object.freeze({ path: "node_modules/next/dist/server/lib/start-server.js", bytes: 19579, sha256: "f9d8d1eac95b60325f6b4b2a100942e410ec94aa8c1c760962560c3eceaad234" }),
  Object.freeze({ path: "node_modules/next/dist/cli/next-dev.js", bytes: 14848, sha256: "b46a2850779145ff6913dda7f33ab0616881b02cc9b42080c3d02c4ee4d71be2" }),
  Object.freeze({ path: "node_modules/next/dist/server/base-server.js", bytes: 102431, sha256: "85aaa5018eae0d9f190c894513a8424d80c369f30c6322d3b3e4115f7bc835f2" }),
  Object.freeze({ path: "node_modules/next/dist/server/serve-static.js", bytes: 2110, sha256: "148bfb30120e76d9266159eb777617d9e1c0723ef024d8a3e2e320f46333f2ec" }),
  Object.freeze({ path: "node_modules/next/dist/server/dev/hot-reloader-webpack.js", bytes: 68031, sha256: "82bd1a2c015156abb818e8784606a646ec84d38cc78ba303a0c1c1b6c04b6911" }),
  Object.freeze({ path: "node_modules/next/dist/pages/_error.js", bytes: 6136, sha256: "ba65b78418177d62a947ec15667a6fe60ff0245c0ce4e999e753de1c78fcf666" }),
  Object.freeze({ path: "next.config.ts", bytes: 1830, sha256: "85ccc02b026cf0b4adf579c8cbaa04ca21b0753f63aa04a36e8a679e7487e77a" }),
  Object.freeze({ path: "node_modules/next/dist/server/dev/next-dev-server.js", bytes: 36041, sha256: "80183eaae5a76d20cb8bc5870d75ce743a9682f345ec08eacca67bafb27e678b" }),
  Object.freeze({ path: "node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js", bytes: 47304, sha256: "2c45ef10257d9147051b58d963870d437578c55b9c427c7f287f415c27f36399" }),
  Object.freeze({ path: "node_modules/next/dist/compiled/send/index.js", bytes: 67383, sha256: "f4a53b4bf52bea01dbc91295f2e49e5d65a0d74fc19f923893d9144b3780f3ee" }),
]);
const qualifiedSources = new WeakSet();
const qualifiedLedgers = new WeakSet();
const cases = new Set(["BLOCK_LIVE_BROWSER", "FIRST_FORCED_BROWSER", "RECOVERY"]);
const PREFIX = Buffer.from("SC_NEXT_STOP_V1:", "ascii");
const APP = "http://127.0.0.1:3117";
const object = value => value !== null && (typeof value === "object" || typeof value === "function");
const own = (value, key) => {
  if (!object(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
};
const exactKeys = (value, keys) => object(value) && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const lowerHex = (value, size) => typeof value === "string" && value.length === size && [...value].every(c => "0123456789abcdef".includes(c));

/** A public source pin is a prerequisite, never a terminal request observation. */
export function qualifyReadOnlySources(rows) {
  if (!Array.isArray(rows) || rows.length !== SOURCE_PINS.length) return null;
  for (let index = 0; index < SOURCE_PINS.length; index++) {
    const row = rows[index], pin = SOURCE_PINS[index], bytes = own(row, "bytes");
    if (!exactKeys(row, ["path", "bytes"]) || own(row, "path") !== pin.path || !Buffer.isBuffer(bytes) || bytes.length !== pin.bytes || createHash("sha256").update(bytes).digest("hex") !== pin.sha256) return null;
  }
  const qualification = Object.freeze({ readonlyStatic: true });
  qualifiedSources.add(qualification);
  return qualification;
}

/** Narrow authority: canonical GET under the pinned middleware exclusion only. */
export function isCanonicalStaticGet(url, method) {
  if (method !== "GET" || typeof url !== "string" || url.length > 4096 || !url.startsWith(APP + "/_next/static/")) return false;
  const suffix = url.slice(APP.length), queryAt = suffix.indexOf("?"), path = queryAt < 0 ? suffix : suffix.slice(0, queryAt), query = queryAt < 0 ? "" : suffix.slice(queryAt);
  if (path.length <= "/_next/static/".length || ![...path].every(c => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@%[]()./-".includes(c))) return false;
  if (query && (query.length !== 16 || !query.startsWith("?v=") || ![...query.slice(3)].every(c => "0123456789".includes(c)))) return false;
  try {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("..")) return false;
    for (let index = 0; index < path.length - 2; index++) {
      if (path[index] === "%" && ["2f", "5c", "00"].includes(path.slice(index + 1, index + 3).toLowerCase())) return false;
    }
    const parsed = new URL(url);
    return parsed.origin === APP && !parsed.username && !parsed.password && !parsed.hash && parsed.pathname === path && parsed.search === query;
  } catch { return false; }
}

/** Captures the original request and original registry row; no pending map mutation. */
export function createStaticRequestQualification(sourceQualification) {
  if (!qualifiedSources.has(sourceQualification)) throw new Error("SOURCE_REFUSED");
  const records = new WeakMap();
  const ledger = Object.freeze({
    capture(request, row, observation) {
      if (!object(request) || !object(row) || records.has(request) || !exactKeys(observation, ["method", "url"]) || !isCanonicalStaticGet(own(observation, "url"), own(observation, "method"))) return false;
      records.set(request, row);
      return true;
    },
    eligible(pending) {
      if (!(pending instanceof Map) || pending.size === 0 || pending.size > 4096) return false;
      for (const [request, row] of pending) if (!object(request) || !object(row) || records.get(request) !== row) return false;
      return true;
    },
    replace(request, previousRow, nextRow) {
      if (!object(request) || !object(previousRow) || !object(nextRow) || !records.has(request) || records.get(request) !== previousRow) return false;
      records.set(request, nextRow);
      return true;
    },
  });
  qualifiedLedgers.add(ledger);
  return ledger;
}

function validBinding(binding) {
  return exactKeys(binding, ["nonce", "caseName", "sourceSha", "run", "worker", "test", "result", "stdout"]) && lowerHex(own(binding, "nonce"), 32) && cases.has(own(binding, "caseName")) && lowerHex(own(binding, "sourceSha"), 40) && ["run", "worker", "test", "result", "stdout"].every(key => object(own(binding, key)));
}
function snapshotBinding(binding) {
  if (!validBinding(binding)) throw new Error("BINDING_REFUSED");
  return Object.freeze(Object.fromEntries(["nonce", "caseName", "sourceSha", "run", "worker", "test", "result", "stdout"].map(key => [key, own(binding, key)])));
}
function frame(binding, command) {
  return Buffer.from("SC_NEXT_STOP_V1:" + own(binding, "nonce") + ":" + own(binding, "caseName") + ":" + command + "\n", "ascii");
}
function gateAllows(gate) {
  return exactKeys(gate, ["stagePassed", "ui", "sdk", "sql", "nonRead", "unknown"]) && own(gate, "stagePassed") === true && own(gate, "unknown") === false && ["ui", "sdk", "sql", "nonRead"].every(key => own(gate, key) === 0);
}

/** Uses the existing absolute close deadline. An emitted frame is never EOF. */
export function createWorkerStopEmitter({ binding, qualification, pending, readGate, now, startedAt, deadlineMs, minimumAt = startedAt, write }) {
  binding = snapshotBinding(binding);
  if (!qualifiedLedgers.has(qualification) || !(pending instanceof Map) || typeof readGate !== "function" || typeof now !== "function" || typeof write !== "function" || !Number.isFinite(startedAt) || deadlineMs !== startedAt + 15000 || !Number.isFinite(minimumAt) || minimumAt < startedAt || minimumAt >= deadlineMs) throw new Error("BINDING_REFUSED");
  let attempted = false, previousAt = minimumAt;
  return Object.freeze({
    request(identity) {
      if (attempted) return "REFUSED";
      let at, gate;
      try { at = now(); gate = readGate(); } catch { return "INELIGIBLE"; }
      if (!Number.isFinite(at) || at < previousAt || at >= deadlineMs) return "INELIGIBLE";
      previousAt = at;
      if (!object(identity) || ["run", "worker", "test", "result"].some(key => own(identity, key) !== own(binding, key)) || !gateAllows(gate) || !qualification.eligible(pending)) return "INELIGIBLE";
      let dispatchAt;
      try { dispatchAt = now(); } catch { return "INELIGIBLE"; }
      if (!Number.isFinite(dispatchAt) || dispatchAt < previousAt || dispatchAt >= deadlineMs) return "INELIGIBLE";
      previousAt = dispatchAt;
      attempted = true;
      try { return write(frame(binding, "STOP_NEXT_STATIC_GET")) === true ? "EMITTED" : "REFUSED"; }
      catch { return "REFUSED"; }
    },
  });
}

/** Constant-space byte parser. Normal output and candidate contents are not stored. */
function createFrameParser(binding, onStop, onRefusal) {
  const expected = [frame(binding, "STOP_NEXT_STATIC_GET"), frame(binding, "REFUSE")];
  let mode = "prefix", offset = 0, candidates = 3, seen = false, refused = false;
  const refuse = () => { if (!refused) { refused = true; onRefusal(); } };
  const reset = () => { mode = "prefix"; offset = 0; candidates = 3; };
  return Object.freeze({
    feed(chunk) {
      if (refused) return false;
      if (!Buffer.isBuffer(chunk) && typeof chunk !== "string") { refuse(); return false; }
      for (let index = 0; index < chunk.length; index++) {
        const byte = typeof chunk === "string" ? chunk.charCodeAt(index) : chunk[index];
        if (refused) return false;
        if (mode === "drop") { if (byte === 10) reset(); continue; }
        if (mode === "prefix") {
          if (byte !== PREFIX[offset]) { mode = "drop"; if (byte === 10) reset(); continue; }
          offset++;
          if (offset === PREFIX.length) mode = "frame";
          continue;
        }
        for (let candidate = 0; candidate < 2; candidate++) if ((candidates & (1 << candidate)) && expected[candidate][offset] !== byte) candidates &= ~(1 << candidate);
        offset++;
        if (candidates === 0 || offset > 128) { refuse(); continue; }
        if (byte === 10) {
          if (seen || candidates !== 1 || offset !== expected[0].length) { refuse(); continue; }
          seen = true;
          reset();
          onStop();
        }
      }
      return !refused;
    },
    finish() { if (mode === "frame") refuse(); return !refused; },
    refused: () => refused,
  });
}

/** Reporter seam: original test/result, one worker; stdout output is closed frames only. */
export function createMinimalReporterRelay(binding, writeStdout) {
  binding = snapshotBinding(binding);
  if (typeof writeStdout !== "function" || own(own(binding, "result"), "workerIndex") !== 0) throw new Error("BINDING_REFUSED");
  let refusalSent = false, outputFailed = false;
  const emit = command => { try { if (writeStdout(frame(binding, command)) !== true) outputFailed = true; } catch { outputFailed = true; } };
  const refuse = () => { if (!refusalSent) { refusalSent = true; emit("REFUSE"); } };
  const parser = createFrameParser(binding, () => emit("STOP_NEXT_STATIC_GET"), refuse);
  return Object.freeze({
    onStdOut(chunk, test, result) {
      if (test !== own(binding, "test") || result !== own(binding, "result") || own(result, "workerIndex") !== 0 || own(result, "retry") !== 0) { refuse(); return false; }
      return parser.feed(chunk);
    },
    onEnd() { parser.finish(); return refusalSent || outputFailed ? { status: "failed" } : undefined; },
  });
}

/** Parent owns Next.stop() and its original Promise. No child group ACK is emitted. */
export function createParentStopRelay(binding, nextOwner) {
  binding = snapshotBinding(binding);
  const stop = own(nextOwner, "stop"), metadata = own(nextOwner, "metadata");
  if (typeof stop !== "function" || typeof metadata !== "function") throw new Error("BINDING_REFUSED");
  let firstFailure = null, stopRequested = false, originalPromise = null, settled = false, stopResult = false;
  const fail = code => { firstFailure ??= code; };
  const callOwnedStop = () => {
    stopRequested = true;
    try {
      originalPromise = Reflect.apply(stop, nextOwner, []);
      if (!(originalPromise instanceof Promise)) { settled = true; fail("PROCESS_UNCONFIRMED"); return; }
      originalPromise.then(value => { settled = true; stopResult = value === true; if (!stopResult) fail("PROCESS_UNCONFIRMED"); }, () => { settled = true; fail("PROCESS_UNCONFIRMED"); });
    } catch { settled = true; fail("PROCESS_UNCONFIRMED"); }
  };
  const startStop = () => { if (firstFailure || stopRequested) { fail("RELAY_REFUSED"); return; } callOwnedStop(); };
  const parser = createFrameParser(binding, startStop, () => fail("RELAY_REFUSED"));
  return Object.freeze({
    onStdOut(chunk, originalStdout) { if (originalStdout !== own(binding, "stdout")) { fail("RELAY_REFUSED"); return false; } return parser.feed(chunk); },
    onStdoutClosed() { return parser.finish(); },
    stopPromise: () => originalPromise,
    stopAtFinally() { if (!stopRequested) callOwnedStop(); return originalPromise; },
    snapshot() {
      let nextQuiet = false;
      if (settled && stopResult && !firstFailure) {
        try {
          const current = Reflect.apply(metadata, nextOwner, []);
          nextQuiet = exactKeys(current, ["closed", "failed", "groupConfirmed", "signal"]) && own(current, "closed") === true && own(current, "failed") === false && own(current, "groupConfirmed") === true && ["SIGTERM", "SIGKILL"].includes(own(current, "signal"));
          if (!nextQuiet) fail("PROCESS_UNCONFIRMED");
        } catch { fail("PROCESS_UNCONFIRMED"); }
      }
      return Object.freeze({ stopRequested, stopPending: stopRequested && !settled, nextQuiet, firstFailure });
    },
    refuse(code) { if (!["PROCESS_UNCONFIRMED", "WRITE_OUTCOME_UNCERTAIN", "QUIESCENCE_HTTP_PENDING"].includes(code)) throw new Error("CODE_REFUSED"); fail(code); },
  });
}

export const NEXT_STOP_INVENTORY_ABSENT = Object.freeze([
  "pages", "src/pages", ...["instrumentation", "src/instrumentation"].flatMap(path => ["js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts"].map(extension => path + "." + extension)),
]);

/** Runtime reads only these public pins/inventory, before fixtures or Next start. */
export async function qualifyNextStaticRuntime(dependencies = {}) {
  const stat = dependencies.lstat ?? lstat, read = dependencies.readFile ?? readFile, real = dependencies.realpath ?? realpath;
  for (const path of NEXT_STOP_INVENTORY_ABSENT) {
    try { await stat(resolve(ROOT, path)); throw new Error("SOURCE_REFUSED"); }
    catch (error) { if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw new Error("SOURCE_REFUSED"); }
  }
  const rows = [];
  for (const pin of SOURCE_PINS) {
    const path = resolve(ROOT, pin.path);
    if (relative(ROOT, path).startsWith("..")) throw new Error("SOURCE_REFUSED");
    const details = await stat(path);
    if (!details.isFile() || details.isSymbolicLink() || details.size !== pin.bytes || await real(path) !== path) throw new Error("SOURCE_REFUSED");
    rows.push({ path: pin.path, bytes: await read(path) });
  }
  const qualification = qualifyReadOnlySources(rows);
  if (!qualification) throw new Error("SOURCE_REFUSED");
  return qualification;
}

export function nextStopEnvironment(env, expectedCase) {
  const selected = { nonce: env.SC_NEXT_STOP_NONCE, caseName: env.SC_NEXT_STOP_CASE, sourceSha: env.GITHUB_SHA };
  if (!lowerHex(selected.nonce, 32) || !lowerHex(selected.sourceSha, 40) || !cases.has(selected.caseName) || expectedCase !== undefined && selected.caseName !== expectedCase) throw new Error("ENVIRONMENT_REFUSED");
  return Object.freeze(selected);
}

/** Actual worker TestInfo identity stays local; it is never serialized. */
export async function prepareWorkerNextStop({ env, caseName, testInfo, pending, readGate, dependencies = {} }) {
  const selected = nextStopEnvironment(env, caseName);
  if (!object(testInfo) || testInfo.workerIndex !== 0 || testInfo.retry !== 0) throw new Error("ENVIRONMENT_REFUSED");
  const qualification = createStaticRequestQualification(await qualifyNextStaticRuntime(dependencies));
  const stdout = dependencies.stdout ?? process.stdout;
  const binding = Object.freeze({ ...selected, run: selected, worker: testInfo, test: testInfo, result: testInfo, stdout });
  let attempted = false;
  return Object.freeze({
    capture: (request, row, observation) => qualification.capture(request, row, observation),
    replace: (request, previousRow, nextRow) => qualification.replace(request, previousRow, nextRow),
    request(deadlineMs, minimumAt) {
      if (attempted) return "REFUSED";
      attempted = true;
      if (pending.size === 0) return "NOT_NEEDED";
      const emitter = createWorkerStopEmitter({ binding, qualification, pending, readGate, now: dependencies.now ?? (() => performance.now()), startedAt: deadlineMs - 15000, deadlineMs, minimumAt, write: chunk => stdout.write(chunk) });
      return emitter.request({ run: selected, worker: testInfo, test: testInfo, result: testInfo });
    },
  });
}

/** The bounded-process owner supplies the original child and stdout channel. */
export function createRunnerNextStopRelay(selected, nextOwner, runIdentity) {
  if (!object(runIdentity) || !lowerHex(selected?.nonce, 32) || !lowerHex(selected?.sourceSha, 40) || !cases.has(selected?.caseName)) throw new Error("BINDING_REFUSED");
  selected = Object.freeze({ nonce: selected.nonce, caseName: selected.caseName, sourceSha: selected.sourceSha });
  let originalChild = null, originalStdout = null, parent = null, finallyPromise = null, finallyStarted = false, firstFailure = null, ended = false;
  const refuse = () => { firstFailure ??= "PROCESS_UNCONFIRMED"; return false; };
  return Object.freeze({
    observer: Object.freeze({
      start(child) {
        if (originalChild || !object(child) || !object(child.stdout)) return refuse();
        originalChild = child; originalStdout = child.stdout;
        parent = createParentStopRelay({ ...selected, run: runIdentity, worker: child, test: runIdentity, result: child, stdout: originalStdout }, nextOwner);
        return true;
      },
      data(chunk, stdout) { if (!parent || ended || stdout !== originalStdout) return refuse(); const accepted = parent.onStdOut(chunk, stdout); if (!accepted) refuse(); return accepted; },
      end(stdout) { if (!parent || stdout !== originalStdout || ended) return refuse(); ended = true; const accepted = parent.onStdoutClosed(); if (!accepted) refuse(); return accepted; },
    }),
    stopOnce() {
      if (!finallyStarted) { finallyStarted = true; finallyPromise = parent ? parent.stopAtFinally() : Reflect.apply(own(nextOwner, "stop"), nextOwner, []); }
      return finallyPromise;
    },
    snapshot() {
      const observed = parent?.snapshot();
      if (observed?.firstFailure) refuse();
      return Object.freeze({ firstFailure, stopPending: observed?.stopPending ?? false });
    },
  });
}

/** Reporter binds the original filtered TestCase/TestResult from Playwright. */
export function createNextStopReporter(env, stdout = process.stdout) {
  const selected = nextStopEnvironment(env), expectedTitle = selected.caseName === "RECOVERY" ? "EMAIL_RECOVERY_SAME_BROWSER_PKCE" : selected.caseName;
  let originalTest = null, originalResult = null, originalConfig = null, relay = null, failed = false, refusalSent = false;
  const write = chunk => { try { return stdout.write(chunk) === true; } catch { failed = true; return false; } };
  const refuse = () => { failed = true; if (!refusalSent) { refusalSent = true; write(frame(selected, "REFUSE")); } };
  const foreign = createFrameParser(selected, refuse, refuse);
  return Object.freeze({
    printsToStdio: () => true,
    onBegin(config, suite) {
      const tests = suite.allTests();
      if (originalConfig || config.workers !== 1 || config.fullyParallel !== false || tests.length !== 1 || tests[0].title !== expectedTitle) { refuse(); return; }
      originalConfig = config; originalTest = tests[0];
    },
    onTestBegin(test, result) {
      if (failed || !originalConfig || test !== originalTest || originalResult || own(result, "workerIndex") !== 0 || own(result, "retry") !== 0) { refuse(); return; }
      originalResult = result;
      relay = createMinimalReporterRelay({ ...selected, run: originalConfig, worker: result, test, result, stdout }, write);
    },
    onStdOut(chunk, test, result) { if (relay && test === originalTest && result === originalResult) relay.onStdOut(chunk, test, result); else foreign.feed(chunk); },
    onStdErr() {},
    onError() {},
    onEnd() { foreign.finish(); const result = relay?.onEnd(); return failed || result?.status === "failed" ? { status: "failed" } : undefined; },
  });
}
