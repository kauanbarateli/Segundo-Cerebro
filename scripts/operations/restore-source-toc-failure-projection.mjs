import { types } from "node:util";

// Pure, deliberately narrow public wire projection for PR98 / #41. Import and
// parse perform no IO, environment read, native attestation or restore action.
// Other combined phases, successes and operator errors need their own schemas.
const MAX_BYTES = 64 * 1024, MAX_DEPTH = 12, MAX_TOKENS = 4096;
const REFUSED = "SOURCE_TOC_FAILURE_REFUSED";
const CODES = ["INSPECTION_NATIVE_UNAVAILABLE", "INSPECTION_NATIVE_FAILED", "INSPECTION_INPUT_FAILED", "INSPECTION_TIMEOUT", "INSPECTION_LIMIT", "INSPECTION_TOC_INVALID", "INSPECTION_UNAVAILABLE"];
const ERROR_CODES = ["EPIPE", "ERR_STREAM_DESTROYED", "EOF", "other", "unavailable"];
const ERROR_EVENTS = ["spawnThrow", "stdinCallback", "stdinError", "stdinEndThrow", "childError", "stdoutError", "stderrError"];
const EVENTS = ["spawnRequested", "spawn", "spawnThrow", "stdinEndRequested", "stdinCallback", "stdinFinish", "stdinError", "stdinEndThrow", "childError", "stdoutError", "stderrError", "stdoutEOF", "stdoutClose", "stderrEOF", "stderrClose", "exit", "close", "stdinDestroyRequested", "stdoutDestroyRequested", "stderrDestroyRequested", "killRequested", "unrefRequested"];
const TOP_KEYS = ["ok", "operation", "error", "stage", "sourceDiagnostic", "targetDiagnostic", "nativeHistoryDiagnostic", "sourceTocDiagnostic", "comparisonCompleted", "inspectionOnly", "baselineQualified", "baselineCompared", "remoteMutation", "restoreAccepted"];
const SOURCE_KEYS = ["stage", "authComplete", "listStarted", "tocDiagnostic", "tocPlanDiagnostic", "inventory", "nativeHistoryDiagnostic"];
const Bytes = Uint8Array, View = DataView, typed = Object.getPrototypeOf(Bytes.prototype);
const byteLength = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "byteLength").get);
const backing = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "buffer").get);
const setBytes = Function.call.bind(typed.set), fillBytes = Function.call.bind(typed.fill);
const bad = () => { const error = new Error(REFUSED); error.code = REFUSED; throw error; };
const integer = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
function record(value, keys) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) bad();
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) bad();
}

// Adapted from the private scanner in restore-target-snapshot-protocol.mjs.
// Reuse only its bounded token algorithm, not that module's SQL/WeakMap API or
// backup-format dependency. Decoded key equality catches escaped duplicates.
function uniqueJson(text) {
  let at = 0, tokens = 0;
  const space = () => { while ([" ", "\t", "\r", "\n"].includes(text[at])) at++; };
  const string = () => {
    const begin = at++;
    while (at < text.length) {
      const code = text.charCodeAt(at++);
      if (code === 34) { try { return JSON.parse(text.slice(begin, at)); } catch { bad(); } }
      if (code < 32) bad();
      if (code === 92) {
        const escape = text[at++];
        if (escape === "u") { if (!/^[a-fA-F0-9]{4}$/.test(text.slice(at, at + 4))) bad(); at += 4; }
        else if (!["\"", "\\", "/", "b", "f", "n", "r", "t"].includes(escape)) bad();
      }
    }
    bad();
  };
  const value = depth => {
    if (depth > MAX_DEPTH || ++tokens > MAX_TOKENS) bad();
    space(); const first = text[at];
    if (first === "{") {
      at++; space(); const keys = new Set(); if (text[at] === "}") { at++; return; }
      while (at < text.length) {
        space(); if (text[at] !== "\"") bad(); const key = string();
        if (keys.has(key)) bad(); keys.add(key); space(); if (text[at++] !== ":") bad(); value(depth + 1); space();
        const separator = text[at++]; if (separator === "}") return; if (separator !== ",") bad();
      }
      bad();
    }
    if (first === "[") {
      at++; space(); if (text[at] === "]") { at++; return; }
      while (at < text.length) { value(depth + 1); space(); const separator = text[at++]; if (separator === "]") return; if (separator !== ",") bad(); }
      bad();
    }
    if (first === "\"") { string(); return; }
    const literal = /^(?:null|true|false|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at));
    if (!literal) bad(); at += literal[0].length;
  };
  value(0); space(); if (at !== text.length) bad();
}
function sameFact(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && left[key] === right[key]);
}
function snapshot(state) {
  record(state, ["sequence", "overflow", "firstError", "lastError", "events"]);
  if (!integer(state.sequence, 1, 64) || typeof state.overflow !== "boolean" || (state.overflow && state.sequence !== 64)) bad();
  record(state.events, EVENTS); const sequences = new Set();
  for (const name of EVENTS) {
    const event = state.events[name]; if (event === null) continue;
    const callback = name === "stdinCallback", error = ERROR_EVENTS.includes(name), terminal = name === "exit" || name === "close";
    record(event, callback ? ["sequence", "outcome", "code"] : error ? ["sequence", "code"] : terminal ? ["sequence", "code", "signal"] : ["sequence"]);
    if (!integer(event.sequence, 1, state.sequence) || (sequences.has(event.sequence) && !(state.overflow && event.sequence === 64))) bad();
    sequences.add(event.sequence);
    if (callback) { if (!((event.outcome === "ok" && event.code === "none") || (event.outcome === "error" && ERROR_CODES.includes(event.code)))) bad(); }
    else if (error) { if (!ERROR_CODES.includes(event.code)) bad(); }
    else if (terminal && (!["zero", "nonzero", "unavailable"].includes(event.code) || !["none", "SIGKILL", "SIGTERM", "SIGINT", "other"].includes(event.signal))) bad();
  }
  if (state.events.spawnRequested?.sequence !== 1) bad();
  if ((state.firstError === null) !== (state.lastError === null)) bad();
  if (ERROR_EVENTS.some(name => state.events[name] !== null && (name !== "stdinCallback" || state.events[name].outcome === "error")) && state.firstError === null) bad();
  for (const error of [state.firstError, state.lastError]) if (error !== null) {
    record(error, ["origin", "code", "sequence"]);
    if (!ERROR_EVENTS.includes(error.origin) || !ERROR_CODES.includes(error.code) || !integer(error.sequence, 1, state.sequence) || !state.events[error.origin] || state.events[error.origin].sequence > error.sequence) bad();
    const event = state.events[error.origin];
    if (event.sequence === error.sequence && !(state.overflow && error.sequence === 64) && (event.code !== error.code || (error.origin === "stdinCallback" && event.outcome !== "error"))) bad();
  }
  if (state.firstError && state.firstError.sequence > state.lastError.sequence) bad();
  if (state.firstError && ERROR_EVENTS.some(name => state.events[name] !== null && (name !== "stdinCallback" || state.events[name].outcome === "error") && (state.events[name].sequence < state.firstError.sequence || state.events[name].sequence > state.lastError.sequence))) bad();
}
function diagnostic(value) {
  record(value, ["version", "observer", "firstRefusal", "finalCleanup"]);
  if (value.version !== 1 || value.observer !== "source_toc_original") bad();
  // This export handles a Source/native_toc failure only, not a later Target
  // failure following a successful Source (where firstRefusal may be null).
  record(value.firstRefusal, ["code", "state"]);
  if (!CODES.includes(value.firstRefusal.code)) bad();
  snapshot(value.firstRefusal.state); snapshot(value.finalCleanup);
  const first = value.firstRefusal.state, final = value.finalCleanup;
  if (first.sequence > final.sequence || (first.overflow && !final.overflow)) bad();
  // These are explicit wire-order contradictions only. A saturated 64 cannot
  // distinguish a later occurrence once final.overflow records saturation.
  const later = sequence => sequence > first.sequence || (sequence === 64 && first.sequence === 64 && final.overflow);
  for (const name of EVENTS) {
    if (first.events[name] !== null) { if (!sameFact(first.events[name], final.events[name])) bad(); }
    else if (final.events[name] !== null && !later(final.events[name].sequence)) bad();
  }
  if (first.firstError !== null && !sameFact(first.firstError, final.firstError)) bad();
  if (first.firstError === null && final.firstError !== null && !later(final.firstError.sequence)) bad();
  if (!sameFact(first.lastError, final.lastError) && (final.lastError === null || !later(final.lastError.sequence))) bad();
}
function envelope(value) {
  record(value, TOP_KEYS);
  if (value.ok !== false || value.operation !== "managed_restore_combined_baseline_inspect" || value.stage !== "source" || !CODES.includes(value.error) || value.inspectionOnly !== true) bad();
  for (const flag of ["comparisonCompleted", "baselineQualified", "baselineCompared", "remoteMutation", "restoreAccepted"]) if (value[flag] !== false) bad();
  if (value.targetDiagnostic !== null || value.nativeHistoryDiagnostic !== null) bad();
  record(value.sourceDiagnostic, SOURCE_KEYS);
  if (value.sourceDiagnostic.stage !== "native_toc" || value.sourceDiagnostic.authComplete !== true || typeof value.sourceDiagnostic.listStarted !== "boolean") bad();
  for (const field of ["tocDiagnostic", "tocPlanDiagnostic", "inventory", "nativeHistoryDiagnostic"]) if (value.sourceDiagnostic[field] !== null) bad();
  diagnostic(value.sourceTocDiagnostic);
}
function freeze(value) {
  if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
/** Return only a closed diagnostic DTO. Shape cannot attest native origin,
 * first-error causality, quiescence, completed cleanup or import authority.
 * No dispatcher/preparation imports this module automatically. A future NEW
 * preparation must review and pin this file and its own original transports. */
export function parseSourceTocFailure(bytes) {
  let copy;
  try {
    if (!bytes || types.isProxy(bytes) || !types.isUint8Array(bytes)) bad();
    const buffer = backing(bytes); if (types.isSharedArrayBuffer(buffer)) bad();
    // Intrinsics reject detached and out-of-bounds views without reading any
    // caller buffer/length/iterator/method property or performing conversion.
    new View(buffer, 0, 0);
    const size = byteLength(bytes); if (!integer(size, 1, MAX_BYTES)) bad();
    copy = new Bytes(size); setBytes(copy, bytes);
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy);
    uniqueJson(text); const value = JSON.parse(text); envelope(value);
    return freeze(value);
  } catch { bad(); }
  finally { if (copy) fillBytes(copy, 0); }
}
