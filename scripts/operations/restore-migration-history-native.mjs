import { spawn as nativeSpawn } from "node:child_process";
import { createHash } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { types } from "node:util";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BackupError } from "./backup-format.mjs";
import { customArchiveTocFacts } from "./restore-custom-toc.mjs";
import { migrationHistoryCopySelection, extractMigrationHistory, migrationHistoryFacts, discardMigrationHistory, MIGRATION_HISTORY_ERROR_CODES } from "./restore-migration-history.mjs";
import { createManagedRestoreAdapters } from "./restore-managed-native-adapters.mjs";

// Explicit local read adapter only. Import/help never accesses a file/process.
// These receipts prove this adapter's original transport, not AEAD, executable
// provenance, authorized target, baseline equality or permission to restore.
const receipts = new WeakMap(), ownErrors = new WeakSet(), stoppedChildren = new WeakSet(), diagnostics = new WeakMap();
const Bytes = Uint8Array, Store = ArrayBuffer, typed = Object.getPrototypeOf(Bytes.prototype);
const byteLength = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "byteLength").get);
const backing = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "buffer").get);
const setBytes = Function.call.bind(Bytes.prototype.set), fillBytes = Function.call.bind(Bytes.prototype.fill);
const hash = value => createHash("sha256").update(value).digest("hex");
const noOp = () => {};
export const NATIVE_HISTORY_LIMITS = Object.freeze({ timeoutMs: 45000, databaseBytes: 64 * 1024 * 1024, stdoutBytes: 20 * 1024 * 1024, stderrBytes: 65536, tocBytes: 4 * 1024 * 1024, listBytes: 65536 });
export const NATIVE_HISTORY_ERROR_CODES = Object.freeze(["RESTORE_MIGRATION_HISTORY_NATIVE_INPUT_INVALID", "RESTORE_MIGRATION_HISTORY_NATIVE_TOC_REFUSED", "RESTORE_MIGRATION_HISTORY_NATIVE_BINDING_INVALID", "RESTORE_MIGRATION_HISTORY_NATIVE_LIST_FAILED", "RESTORE_MIGRATION_HISTORY_NATIVE_SPAWN_FAILED", "RESTORE_MIGRATION_HISTORY_NATIVE_OUTPUT_LIMIT", "RESTORE_MIGRATION_HISTORY_NATIVE_INPUT_FAILED", "RESTORE_MIGRATION_HISTORY_NATIVE_TIMEOUT", "RESTORE_MIGRATION_HISTORY_NATIVE_PRODUCER_FAILED", "RESTORE_MIGRATION_HISTORY_NATIVE_PARSER_REFUSED", "RESTORE_MIGRATION_HISTORY_NATIVE_CLEANUP_FAILED", "RESTORE_MIGRATION_HISTORY_NATIVE_REQUIRED", "RESTORE_MIGRATION_HISTORY_NATIVE_DISCARDED", "RESTORE_MIGRATION_HISTORY_NATIVE_UNAVAILABLE"]);
function failure(suffix) { const error = new BackupError("RESTORE_MIGRATION_HISTORY_NATIVE_" + suffix); ownErrors.add(error); return error; }
const fail = suffix => { throw failure(suffix); };
const initialState = () => ({ phase: "input", parserError: null, stdoutBytes: 0, stderrBytes: 0, spawnObserved: false, stdinFinishObserved: false, stdinCallbackSettled: false, stdinError: "none", stdinCallbackError: "pending", stdoutEofObserved: false, stderrEofObserved: false, producerExit: "not_observed", producerClose: "not_observed", cleanup: "not_started" });
function remember(error, state) {
  if (!ownErrors.has(error) || diagnostics.has(error)) return;
  diagnostics.set(error, Object.freeze({ version: 1, phase: state.phase, parserError: state.parserError, stdoutBytes: Math.min(NATIVE_HISTORY_LIMITS.stdoutBytes + 1, state.stdoutBytes), stderrBytes: Math.min(NATIVE_HISTORY_LIMITS.stderrBytes + 1, state.stderrBytes), spawnObserved: state.spawnObserved, stdinFinishObserved: state.stdinFinishObserved, stdinCallbackSettled: state.stdinCallbackSettled, stdinError: state.stdinError, stdinCallbackError: state.stdinCallbackError, stdoutEofObserved: state.stdoutEofObserved, stderrEofObserved: state.stderrEofObserved, producerExit: state.producerExit, producerClose: state.producerClose, cleanup: state.cleanup }));
}
// Read only at the catch of a direct, trusted B3 call below. Provider failures
// and caller diagnostics never enter this field, even with a matching code.
function captureParserError(error, state) {
  if (state.parserError !== null) return;
  try {
    if (!error || types.isProxy(error) || !(error instanceof BackupError)) return;
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    if (descriptor && Object.hasOwn(descriptor, "value") && MIGRATION_HISTORY_ERROR_CODES.includes(descriptor.value)) state.parserError = descriptor.value;
  } catch { /* Never read message, cause, accessors or provider data. */ }
}
const wipe = value => { try { if (value && !types.isProxy(value) && types.isUint8Array(value)) fillBytes(value, 0); } catch { /* Detached stores are no longer owned here. */ } };
function length(value) { try { if (!value || types.isProxy(value) || !types.isUint8Array(value) || types.isSharedArrayBuffer(backing(value))) fail("INPUT_INVALID"); new DataView(backing(value), 0, 0); return byteLength(value); } catch (error) { if (ownErrors.has(error)) throw error; fail("INPUT_INVALID"); } }
function closed(value, fields) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("INPUT_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(k => !fields.includes(k))) fail("INPUT_INVALID");
  const result = {};
  for (const key of fields) { const d = descriptors[key]; if (!d?.enumerable || !Object.hasOwn(d, "value")) fail("INPUT_INVALID"); result[key] = d.value; }
  return result;
}
function array(value, limit = 32) {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INPUT_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(value), n = descriptors.length?.value;
  if (!Number.isSafeInteger(n) || n < 0 || n > limit || Reflect.ownKeys(descriptors).length !== n + 1) fail("INPUT_INVALID");
  return Array.from({ length: n }, (_v, i) => { const d = descriptors[i]; if (!d?.enumerable || !Object.hasOwn(d, "value")) fail("INPUT_INVALID"); return d.value; });
}
const path = value => typeof value === "string" && isAbsolute(value) && !value.startsWith("\\\\") && !/[\r\n\0~]/.test(value);
function configuration(options) {
  const result = closed(options, ["tocHandle", "database", "nativeTocText", "pgRestore", "environment", "listOptions"]);
  if (!path(result.pgRestore) || typeof result.nativeTocText !== "string" || !result.nativeTocText || Buffer.byteLength(result.nativeTocText) > NATIVE_HISTORY_LIMITS.tocBytes || /[^\x09\x0a\x0d\x20-\x7e]/.test(result.nativeTocText)) fail("INPUT_INVALID");
  const environment = result.environment;
  if (!environment || types.isProxy(environment) || Object.getPrototypeOf(environment) !== Object.prototype) fail("INPUT_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(environment), env = {};
  for (const name of Reflect.ownKeys(descriptors)) {
    const d = descriptors[name];
    if (!["PATH", "SystemRoot", "TEMP", "TMP"].includes(name) || !d?.enumerable || !Object.hasOwn(d, "value") || typeof d.value !== "string" || d.value.length > 4096 || /[\0\r\n]/.test(d.value)) fail("INPUT_INVALID"); env[name] = d.value;
  }
  const list = closed(result.listOptions, ["privateRoot", "powerShellExecutable", "systemRoot", "forbiddenRoots", "syncRoots"]);
  for (const key of ["privateRoot", "powerShellExecutable", "systemRoot"]) if (!path(list[key])) fail("INPUT_INVALID");
  for (const key of ["forbiddenRoots", "syncRoots"]) { list[key] = Object.freeze(array(list[key])); if (list[key].some(v => !path(v))) fail("INPUT_INVALID"); }
  result.environment = Object.freeze(env); result.listOptions = Object.freeze(list); return result;
}
function inheritedScope(scope) {
  const methods = closed(scope, ["check", "remaining", "race", "close"]);
  if (Object.values(methods).some(v => typeof v !== "function")) fail("INPUT_INVALID");
  const check = () => { try { Reflect.apply(methods.check, scope, []); } catch { fail("TIMEOUT"); } };
  const remaining = () => { check(); let n; try { n = Reflect.apply(methods.remaining, scope, []); } catch { fail("TIMEOUT"); } if (!Number.isSafeInteger(n) || n < 1 || n > NATIVE_HISTORY_LIMITS.timeoutMs) fail("TIMEOUT"); return n; };
  const race = async promise => { try { const result = await Reflect.apply(methods.race, scope, [promise]); check(); return result; } catch (error) { if (ownErrors.has(error)) throw error; fail("TIMEOUT"); } };
  return { check, remaining, race };
}
function original(tocHandle, state) {
  let facts, ids;
  try { facts = customArchiveTocFacts(tocHandle); } catch { fail("TOC_REFUSED"); }
  try { ids = migrationHistoryCopySelection(tocHandle); }
  catch (error) { captureParserError(error, state); fail("TOC_REFUSED"); }
  if (ids.length !== 2 || new Set(ids).size !== 2) fail("TOC_REFUSED");
  return { facts, ids };
}
function boundDatabase(facts) {
  const b = facts.binding;
  if (b.side === "archive") return { sha256: b.databaseSha256, bytes: b.databaseBytes };
  if (b.side === "target") return { sha256: b.nativeDumpSha256, bytes: b.nativeDumpBytes };
  fail("BINDING_INVALID");
}
function originalList(text, facts, ids) {
  if (hash(text) !== facts.binding.tocSha256) fail("BINDING_INVALID");
  const selected = new Map();
  for (const match of text.matchAll(/^([1-9]\d*);[^\n]*\n/gm)) {
    const id = Number(match[1]); if (!ids.includes(id)) continue;
    if (selected.has(id)) fail("BINDING_INVALID"); selected.set(id, match[0]);
  }
  if (selected.size !== 2) fail("BINDING_INVALID");
  const result = ids.map(id => selected.get(id)).join("");
  if (Buffer.byteLength(result) > NATIVE_HISTORY_LIMITS.listBytes) fail("OUTPUT_LIMIT");
  return result;
}
function pipeCode(error) {
  try { if (error && !types.isProxy(error)) { const d = Object.getOwnPropertyDescriptor(error, "code"); if (d && Object.hasOwn(d, "value") && d.value === "EPIPE") return "EPIPE"; } } catch { /* Provider text is never evaluated. */ }
  return "OTHER";
}
function deferred() { let yes, no; const promise = new Promise((resolvePromise, rejectPromise) => { yes = resolvePromise; no = rejectPromise; }); promise.catch(noOp); return { promise, yes, no }; }
function persistentGuard(state) {
  const fatal = deferred(); let first = null, invalidate = noOp;
  return {
    fatal: fatal.promise,
    capture(error) {
      if (!first) { first = ownErrors.has(error) ? error : failure("UNAVAILABLE"); remember(first, state); try { invalidate(); } catch { /* First refusal cannot be replaced by discard. */ } fatal.no(first); }
      return first;
    },
    refuse(suffix) { return this.capture(failure(suffix)); },
    check() { if (first) throw first; },
    onFailure(callback) { invalidate = callback; if (first) try { invalidate(); } catch { /* No promotion of a failed operation. */ } },
  };
}
function cancel(child) {
  if (!child || typeof child !== "object" || stoppedChildren.has(child)) return;
  stoppedChildren.add(child);
  for (const stream of [child?.stdin, child?.stdout, child?.stderr]) try { stream?.destroy?.(); } catch { /* Requests are not EOF. */ }
  try { child?.kill?.("SIGKILL"); } catch { /* No termination claim. */ }
  try { child?.unref?.(); } catch { /* Original failure remains first. */ }
}

// Native subset extraction does not promise to drain unselected DATA blocks.
// The conditional EPIPE path below is exclusive to this read adapter. It never
// changes the restore stream's full DATA stdin requirements.
async function collect(child, database, scope, inputLease, state, guard) {
  const terminal = deferred(), input = deferred();
  const chunks = []; let total = 0, stderrBytes = 0, ended = false, errEnded = false, closeZero = false, spawned = false, done = false;
  let finish = false, callbackSettled = false, callbackError = null, stdinError = null;
  const refuse = suffix => guard.refuse(suffix);
  const inputReady = () => {
    if (finish && callbackSettled && callbackError === null && stdinError === null) input.yes("finish");
    else if (!finish && callbackSettled && callbackError === "EPIPE" && stdinError === "EPIPE") input.yes("selected_tail_unconsumed");
    else if (finish && (stdinError !== null || callbackError !== null)) refuse("INPUT_FAILED");
  };
  const terminalReady = () => { if (spawned && ended && errEnded && closeZero) terminal.yes(); };
  const outData = chunk => {
    try { if (done) { if (length(chunk)) refuse("PRODUCER_FAILED"); return; } scope.check(); const n = length(chunk); state.stdoutBytes = Math.min(NATIVE_HISTORY_LIMITS.stdoutBytes + 1, total + n); if (n > NATIVE_HISTORY_LIMITS.stdoutBytes - total) { refuse("OUTPUT_LIMIT"); return; } const copy = new Bytes(new Store(n)); setBytes(copy, chunk); chunks.push(copy); total += n; }
    catch (error) { if (ownErrors.has(error)) guard.capture(error); else refuse("PRODUCER_FAILED"); }
    finally { wipe(chunk); }
  };
  const errData = chunk => { try { if (done) { if (length(chunk)) refuse("PRODUCER_FAILED"); return; } scope.check(); stderrBytes += length(chunk); state.stderrBytes = Math.min(NATIVE_HISTORY_LIMITS.stderrBytes + 1, stderrBytes); if (stderrBytes > NATIVE_HISTORY_LIMITS.stderrBytes) refuse("OUTPUT_LIMIT"); } catch (error) { if (ownErrors.has(error)) guard.capture(error); else refuse("PRODUCER_FAILED"); } finally { wipe(chunk); } };
  const outEnd = () => { ended = true; state.stdoutEofObserved = true; terminalReady(); }, errEnd = () => { errEnded = true; state.stderrEofObserved = true; terminalReady(); };
  const outClose = () => { if (!ended) refuse("PRODUCER_FAILED"); }, errClose = () => { if (!errEnded) refuse("PRODUCER_FAILED"); };
  const stdinFailure = error => { const code = pipeCode(error); state.stdinError = code === "EPIPE" ? "EPIPE" : "other"; if (code !== "EPIPE" || stdinError !== null) { refuse("INPUT_FAILED"); return; } stdinError = code; inputReady(); };
  const inputFinish = () => { finish = true; state.stdinFinishObserved = true; inputReady(); };
  const childError = () => refuse("SPAWN_FAILED"), childExit = code => { state.producerExit = code === 0 ? "zero" : "nonzero"; if (code !== 0) refuse("PRODUCER_FAILED"); };
  const streamError = () => refuse("PRODUCER_FAILED");
  const childClose = code => { state.producerClose = code === 0 ? "zero" : "nonzero"; if (code !== 0 || closeZero) refuse("PRODUCER_FAILED"); else { closeZero = true; terminalReady(); } };
  const childSpawn = () => { if (spawned) refuse("SPAWN_FAILED"); spawned = true; state.spawnObserved = true; terminalReady(); };
  let output, accepted = false;
  try {
    if (!child?.on || !child.stdin?.on || !child.stdin?.end || !child.stdout?.on || !child.stderr?.on) fail("SPAWN_FAILED");
    child.on("spawn", childSpawn); child.on("error", childError); child.on("exit", childExit); child.on("close", childClose);
    child.stdout.on("data", outData); child.stdout.on("end", outEnd); child.stdout.on("close", outClose); child.stdout.on("error", streamError);
    child.stderr.on("data", errData); child.stderr.on("end", errEnd); child.stderr.on("close", errClose); child.stderr.on("error", streamError);
    child.stdin.on("error", stdinFailure); child.stdin.on("finish", inputFinish);
    scope.check();
    try {
      inputLease.writeCalled = true;
      child.stdin.end(database, error => {
        if (callbackSettled) { refuse("INPUT_FAILED"); return; }
        callbackSettled = true; inputLease.callbackSettled = true; state.stdinCallbackSettled = true;
        callbackError = error ? pipeCode(error) : null;
        state.stdinCallbackError = callbackError === null ? "none" : callbackError === "EPIPE" ? "EPIPE" : "other";
        if (inputLease.wipeRequested) wipe(database);
        if (callbackError === "OTHER") refuse("INPUT_FAILED"); inputReady();
      });
    } catch { inputLease.endThrew = true; fail("INPUT_FAILED"); }
    const waiting = Promise.all([terminal.promise, input.promise]); waiting.catch(noOp);
    const results = await scope.race(Promise.race([waiting, guard.fatal])); scope.check(); guard.check();
    const inputTerminal = results[1];
    output = new Bytes(new Store(total)); let offset = 0; for (const part of chunks) { setBytes(output, part, offset); offset += byteLength(part); }
    if (!isUtf8(output)) fail("PARSER_REFUSED");
    accepted = true; return { output, inputTerminal, stdinFinishObserved: finish, inputCallbackError: callbackError, stderrBytes };
  } catch (error) { guard.check(); throw guard.capture(ownErrors.has(error) ? error : failure("PRODUCER_FAILED")); }
  finally {
    done = true;
    if (!accepted) { cancel(child); wipe(output); }
    for (const part of chunks) wipe(part); chunks.length = 0;
    // Original observers stay attached after settlement. The guard is checked
    // during cleanup and retained with the receipt. A late original error must
    // revoke B3 even when the earlier Promise.race has already settled. Late
    // chunks are wiped and veto rather than appended or silently certified.
  }
}
const defaultPorts = Object.freeze({
  async createLists(options, timeoutMs) { const adapter = await createManagedRestoreAdapters(options, { timeoutMs }); return { materializeList: adapter.materializeList, removeLists: adapter.removeLists }; },
  spawn: nativeSpawn,
});

/** Root supplies its original inspection scope and original qualified bytes.
 * Test ports always produce SYNTHETIC receipts, even if their metadata matches.
 * No callback/input boolean can mint native mode or archive authentication.
 */
async function readNativeMigrationHistoryCore(options, originalScope, testPorts, state, guard) {
  const config = configuration(options), scope = inheritedScope(originalScope), supplied = testPorts === undefined ? defaultPorts : closed(testPorts, ["createLists", "spawn"]);
  if (Object.values(supplied).some(v => typeof v !== "function")) fail("INPUT_INVALID");
  const mode = testPorts === undefined ? "native" : "synthetic", initial = original(config.tocHandle, state), bound = boundDatabase(initial.facts);
  scope.check(); const count = length(config.database);
  if (count < 12 || count > NATIVE_HISTORY_LIMITS.databaseBytes || count !== bound.bytes || hash(config.database) !== bound.sha256) fail("BINDING_INVALID");
  const list = originalList(config.nativeTocText, initial.facts, initial.ids), listSha256 = hash(list);
  const database = new Bytes(new Store(count)); setBytes(database, config.database);
  const inputLease = { writeCalled: false, callbackSettled: false, endThrew: false, wipeRequested: false };
  let lists, historyHandle, child, stdout, first = null, completed = false, stopped = false, collection;
  guard.onFailure(() => { if (historyHandle) discardMigrationHistory(historyHandle); });
  const recheck = () => { guard.check(); scope.check(); const current = original(config.tocHandle, state); if (current.facts !== initial.facts || current.ids.some((id, i) => id !== initial.ids[i]) || length(database) !== count || hash(database) !== bound.sha256) fail("BINDING_INVALID"); guard.check(); };
  const bounded = async (operation, suffix) => {
    recheck(); const pending = Promise.resolve().then(() => { recheck(); return operation(); }).catch(error => { if (ownErrors.has(error)) throw error; throw failure(suffix); }); pending.catch(noOp);
    return scope.race(pending);
  };
  try {
    if (hash(database) !== bound.sha256 || hash(config.database) !== bound.sha256) fail("BINDING_INVALID");
    state.phase = "list";
    const factory = Promise.resolve().then(() => supplied.createLists(config.listOptions, scope.remaining())).then(value => {
      const methods = closed(value, ["materializeList", "removeLists"]); if (Object.values(methods).some(v => typeof v !== "function")) fail("LIST_FAILED");
      if (stopped) { Promise.resolve().then(() => methods.removeLists()).catch(noOp); fail("TIMEOUT"); } lists = methods; return methods;
    }).catch(error => { if (ownErrors.has(error)) throw error; throw failure("LIST_FAILED"); }); factory.catch(noOp);
    await scope.race(factory); recheck();
    const materialized = closed(await bounded(() => lists.materializeList(list), "LIST_FAILED"), ["path", "sha256", "private"]);
    if (!path(materialized.path) || materialized.sha256 !== listSha256 || materialized.private !== true) fail("LIST_FAILED");
    // The boolean is only the existing helper's shape, not provenance. Native
    // mode comes exclusively from this module's non-injected default ports.
    recheck();
    state.phase = "spawn";
    try { child = supplied.spawn(config.pgRestore, ["--data-only", "--use-list=" + materialized.path, "--file=-", "--restrict-key=SCBaselineV1"], { env: config.environment, stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true }); } catch { fail("SPAWN_FAILED"); }
    state.phase = "collect";
    collection = await collect(child, database, scope, inputLease, state, guard); stdout = collection.output; recheck();
    state.phase = "parse";
    try { historyHandle = extractMigrationHistory(config.tocHandle, stdout); }
    catch (error) { captureParserError(error, state); fail("PARSER_REFUSED"); }
    try { const facts = migrationHistoryFacts(historyHandle); if (facts.blocks.length !== 2 || facts.binding !== initial.facts.binding) fail("PARSER_REFUSED"); }
    catch { guard.check(); fail("PARSER_REFUSED"); }
    recheck(); completed = true;
  } catch (error) { first = guard.capture(ownErrors.has(error) ? error : failure("UNAVAILABLE")); }
  finally {
    stopped = true;
    if (!completed && child) cancel(child);
    if (lists) {
      state.phase = "cleanup"; state.cleanup = "pending";
      // Invoke owned cleanup once even after expiry, but NEVER grant a fresh
      // budget or certify a late cleanup result. Scope timeout still vetoes.
      const cleaning = Promise.resolve().then(() => lists.removeLists()).catch(error => { if (ownErrors.has(error)) throw error; throw failure("CLEANUP_FAILED"); }); cleaning.catch(noOp);
      try { await scope.race(cleaning); scope.check(); guard.check(); state.cleanup = "completed"; } catch (error) { state.cleanup = "failed"; first = guard.capture(ownErrors.has(error) ? error : failure("CLEANUP_FAILED")); }
    }
    // Never overwrite bytes still borrowed by an original pending stdin write.
    // A cancelled late callback owns the deferred wipe; it cannot qualify a
    // receipt or extend the original deadline. If it never settles, no wipe or
    // native-completion guarantee is asserted for that borrowed store.
    if (!inputLease.writeCalled || inputLease.callbackSettled || inputLease.endThrew) wipe(database); else inputLease.wipeRequested = true;
    wipe(stdout);
    if (first && historyHandle) discardMigrationHistory(historyHandle);
  }
  if (first) throw first;
  guard.check();
  if (!completed || !historyHandle) fail("UNAVAILABLE");
  try { guard.check(); scope.check(); const facts = migrationHistoryFacts(historyHandle); if (customArchiveTocFacts(config.tocHandle) !== initial.facts || facts.binding !== initial.facts.binding) fail("BINDING_INVALID"); guard.check(); }
  catch (error) { discardMigrationHistory(historyHandle); if (ownErrors.has(error)) throw error; fail("BINDING_INVALID"); }
  const nativeFacts = Object.freeze({ version: 1, mode, binding: initial.facts.binding, dumpIds: Object.freeze([...initial.ids]), databaseSha256: bound.sha256, databaseBytes: count, listSha256,
    stdoutSha256: migrationHistoryFacts(historyHandle).stdoutSha256, stdoutBytes: migrationHistoryFacts(historyHandle).stdoutBytes,
    inputTerminal: collection.inputTerminal, tailUnconsumed: collection.inputTerminal === "selected_tail_unconsumed", stdinFinishObserved: collection.stdinFinishObserved, stdinCallbackSettled: true, stdinCallbackError: collection.inputCallbackError,
    stdoutEofObserved: true, stderrEofObserved: true, producerCloseCode: 0, cleanupCompleted: true });
  try { scope.check(); guard.check(); } catch (error) { discardMigrationHistory(historyHandle); throw error; }
  const handle = Object.freeze({}); state.phase = "retained"; receipts.set(handle, { historyHandle, tocHandle: config.tocHandle, tocFacts: initial.facts, nativeFacts, guard, discarded: false }); return handle;
}

export async function readNativeMigrationHistory(options, originalScope, testPorts) {
  const state = initialState(), guard = persistentGuard(state);
  try { return await readNativeMigrationHistoryCore(options, originalScope, testPorts, state, guard); }
  catch (error) { throw guard.capture(ownErrors.has(error) ? error : failure("UNAVAILABLE")); }
}

/** Original-error-only closed snapshot taken at the first refusal, not after
 * cancellation. No caller fields/getters, SQL, names, paths or bytes are read. */
export function nativeMigrationHistoryDiagnostic(error) { return diagnostics.get(error) ?? null; }

/** Private getter. JSON/clones are not receipts; no decoded rows are reported. */
export function nativeMigrationHistoryFacts(handle) {
  const record = receipts.get(handle); if (!record) fail("REQUIRED"); if (record.discarded) fail("DISCARDED");
  try { record.guard.check(); } catch (error) { discardNativeMigrationHistory(handle); throw error; }
  try { const facts = migrationHistoryFacts(record.historyHandle); if (customArchiveTocFacts(record.tocHandle) !== record.tocFacts || facts.binding !== record.tocFacts.binding) fail("BINDING_INVALID"); }
  catch { discardNativeMigrationHistory(handle); fail("BINDING_INVALID"); }
  record.guard.check(); return Object.freeze({ historyHandle: record.historyHandle, nativeFacts: record.nativeFacts });
}
export function discardNativeMigrationHistory(handle) {
  const record = receipts.get(handle); if (!record || record.discarded) return false;
  let result = false; try { result = discardMigrationHistory(record.historyHandle); } finally { record.discarded = true; record.historyHandle = null; record.tocFacts = null; record.nativeFacts = null; } return result;
}
export async function main(argv = process.argv.slice(2), output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  let help = false; try { const args = array(argv, 1); help = args.length === 1 && args[0] === "--help"; } catch { /* Fixed refusal only. */ }
  output({ operation: "native_migration_history_reader", code: help ? "NO_NATIVE_EXECUTION" : "ROOT_IN_PROCESS_ONLY", readonly: true, restoreAccepted: false }); return help ? 0 : 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
