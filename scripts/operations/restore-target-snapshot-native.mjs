import { spawn as nativeSpawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { types } from "node:util";
import { isAbsolute } from "node:path";
import { BackupError } from "./backup-format.mjs";
import { postgresEnvironment } from "./backup-config.mjs";
import { beginTargetSnapshotSql, endTargetSnapshotSql, parseTargetSnapshotStartFrame, parseTargetSnapshotEndFrame, targetSnapshotPublicFacts, TARGET_SNAPSHOT_PROTOCOL_ERROR_CODES } from "./restore-target-snapshot-protocol.mjs";

// Explicit read adapter. No import-time process, connection, SQL, private file,
// restore, mint, comparison or environment access. Injected children never
// become native proof. Root pins executables/profile/certificate before entry.
export const TARGET_SNAPSHOT_NATIVE_LIMITS = Object.freeze({ timeoutMs: 45000, dumpBytes: 64 * 1024 * 1024, frameBytes: 1024 * 1024, stderrBytes: 65536, chunks: 8192 });
export const TARGET_SNAPSHOT_NATIVE_PROJECT = "jvwduowyavpaxssogadn";
export const TARGET_SNAPSHOT_NATIVE_ERROR_CODES = Object.freeze(["INPUT_INVALID", "RUNTIME_REFUSED", "TARGET_REFUSED", "TIMEOUT", "SPAWN_FAILED", "PRODUCER_FAILED", "INPUT_FAILED", "OUTPUT_LIMIT", "PROTOCOL_REFUSED", "REQUIRED", "DISCARDED", "COPY_CLAIMED", "INTEGRITY_FAILED"].map(v => "RESTORE_TARGET_SNAPSHOT_NATIVE_" + v));
const handles = new WeakMap(), diagnostics = new WeakMap(), own = new WeakSet();
const Bytes = Uint8Array, typed = Object.getPrototypeOf(Bytes.prototype);
const size = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "byteLength").get);
const backing = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "buffer").get);
const set = Function.call.bind(typed.set), fill = Function.call.bind(typed.fill);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const noop = () => {};
function failure(suffix) { const error = new BackupError("RESTORE_TARGET_SNAPSHOT_NATIVE_" + suffix); own.add(error); return error; }
function closed(value, keys) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw failure("INPUT_INVALID");
  const d = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(d), out = {};
  if (actual.length !== keys.length || actual.some(k => !keys.includes(k))) throw failure("INPUT_INVALID");
  for (const key of keys) { if (!d[key]?.enumerable || !Object.hasOwn(d[key], "value")) throw failure("INPUT_INVALID"); out[key] = d[key].value; }
  return out;
}
function wipe(value) { try { if (value && !types.isProxy(value) && types.isUint8Array(value)) fill(value, 0); } catch { /* Detached memory is no longer accessible. */ } }
function copy(bytes, maximum = TARGET_SNAPSHOT_NATIVE_LIMITS.dumpBytes) {
  if (!bytes || types.isProxy(bytes) || !types.isUint8Array(bytes) || types.isSharedArrayBuffer(backing(bytes))) throw failure("PRODUCER_FAILED");
  let n; try { new DataView(backing(bytes), 0, 0); n = size(bytes); } catch { throw failure("PRODUCER_FAILED"); }
  if (n > maximum) throw failure("OUTPUT_LIMIT");
  const out = new Bytes(n); set(out, bytes); return out;
}
function deferred() { let yes, no; const promise = new Promise((a, b) => { yes = a; no = b; }); promise.catch(noop); return { promise, yes, no }; }
function scopeAdapter(original) {
  const methods = closed(original, ["check", "remaining", "race", "close"]);
  if (Object.values(methods).some(v => typeof v !== "function")) throw failure("INPUT_INVALID");
  const check = () => { try { Reflect.apply(methods.check, original, []); } catch { throw failure("TIMEOUT"); } };
  return {
    check,
    remaining() { check(); let n; try { n = Reflect.apply(methods.remaining, original, []); } catch { throw failure("TIMEOUT"); } if (!Number.isSafeInteger(n) || n < 1 || n > TARGET_SNAPSHOT_NATIVE_LIMITS.timeoutMs) throw failure("TIMEOUT"); return n; },
    async race(promise) { try { const value = await Reflect.apply(methods.race, original, [promise]); check(); return value; } catch (error) { if (own.has(error)) throw error; throw failure("TIMEOUT"); } },
  };
}
function configuration(options) {
  const c = closed(options, ["projectRef", "psql", "pgDump", "environment"]);
  if (c.projectRef !== TARGET_SNAPSHOT_NATIVE_PROJECT) throw failure("TARGET_REFUSED");
  for (const key of ["psql", "pgDump"]) if (typeof c[key] !== "string" || !isAbsolute(c[key]) || c[key].startsWith("\\\\") || /[\r\n\0~]/.test(c[key])) throw failure("INPUT_INVALID");
  const e = c.environment;
  if (!e || types.isProxy(e) || Object.getPrototypeOf(e) !== Object.prototype) throw failure("INPUT_INVALID");
  const d = Object.getOwnPropertyDescriptors(e), selected = {};
  const allowed = ["PATH", "SystemRoot", "TEMP", "TMP", "HOME", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGSSLROOTCERT"];
  for (const key of Reflect.ownKeys(d)) {
    const field = d[key];
    if (!allowed.includes(key) || !field?.enumerable || !Object.hasOwn(field, "value") || typeof field.value !== "string" || field.value.length > 4096 || /[\r\n\0]/.test(field.value)) throw failure("INPUT_INVALID");
    selected[key] = field.value;
  }
  // Session/direct port only; transaction pooling cannot hold an exported
  // session snapshot. No PGOPTIONS, service/pass files or ambient PG settings.
  if (selected.PGPORT !== "5432") throw failure("TARGET_REFUSED");
  try { c.environment = Object.freeze(postgresEnvironment(selected, c.projectRef)); } catch { throw failure("TARGET_REFUSED"); }
  return c;
}
function initialState(mode) { return { mode, phase: "input", protocolError: null, psql: null, dump: null, firstError: null, data: null, copied: null, discarded: false, copyClaimed: false, fatal: deferred() }; }
function invalidate(state, suffix) {
  if (!state.firstError) state.firstError = failure(suffix);
  wipe(state.data); wipe(state.copied); state.fatal.no(state.firstError); return state.firstError;
}
function check(state) {
  if (state.firstError) throw state.firstError;
  if (state.discarded) throw failure("DISCARDED");
  try { state.scope.check(); } catch { throw invalidate(state, "TIMEOUT"); }
}
function safeProtocolError(error, state) {
  if (!error || types.isProxy(error) || !(error instanceof BackupError)) return;
  const d = Object.getOwnPropertyDescriptor(error, "code");
  if (d && Object.hasOwn(d, "value") && TARGET_SNAPSHOT_PROTOCOL_ERROR_CODES.includes(d.value)) state.protocolError = d.value;
}
function originalChild(state, spawn, executable, argv, env, kind) {
  const record = { spawned: false, stdoutEof: false, stderrEof: false, stdoutClosed: false, stderrClosed: false, stdinClosed: false, exited: false, closed: false, exitZero: false, closeZero: false, stdinFinished: false, callbacks: 0, stdoutBytes: 0, stderrBytes: 0, phase: "start", chunks: [], frame: [], frameBytes: 0, frames: [], done: deferred(), frameReady: deferred(), child: null };
  state[kind] = record;
  const refuse = suffix => { const error = invalidate(state, suffix); record.done.no(error); record.frameReady.no(error); };
  try { record.child = spawn(executable, argv, { env, stdio: [kind === "psql" ? "pipe" : "ignore", "pipe", "pipe"], shell: false, windowsHide: true }); }
  catch { throw invalidate(state, "SPAWN_FAILED"); }
  const child = record.child;
  if (!child || typeof child.on !== "function" || !child.stdout || !child.stderr || typeof child.stdout.on !== "function" || typeof child.stderr.on !== "function" || kind === "psql" && (!child.stdin || typeof child.stdin.on !== "function" || typeof child.stdin.write !== "function" || typeof child.stdin.end !== "function")) { try { child?.kill?.(); } catch { /* Best effort. */ } throw invalidate(state, "SPAWN_FAILED"); }
  child.on("spawn", () => { if (record.spawned || record.closed) refuse("PRODUCER_FAILED"); record.spawned = true; });
  child.on("error", () => refuse("PRODUCER_FAILED"));
  child.on("exit", (code, signal) => {
    if (record.exited || record.closed || !record.spawned || code !== 0 || signal != null || kind === "psql" && record.phase !== "ending") refuse("PRODUCER_FAILED");
    record.exited = true; record.exitZero = code === 0 && signal == null;
  });
  child.on("close", (code, signal) => {
    if (record.closed || !record.exited || !record.exitZero || !record.stdoutEof || !record.stderrEof || code !== 0 || signal != null || kind === "psql" && (!record.stdinFinished || record.callbacks !== 2 || record.frames.length !== 2 || record.frameBytes !== 0)) refuse("PRODUCER_FAILED");
    record.closed = true; record.closeZero = code === 0 && signal == null;
    if (!state.firstError) record.done.yes();
  });
  child.stdout.on("data", bytes => {
    let part;
    try {
      if (state.firstError || state.discarded || record.stdoutEof || record.closed || !record.spawned) { refuse("PRODUCER_FAILED"); return; }
      const maximum = kind === "dump" ? TARGET_SNAPSHOT_NATIVE_LIMITS.dumpBytes : 2 * TARGET_SNAPSHOT_NATIVE_LIMITS.frameBytes;
      part = copy(bytes, maximum - record.stdoutBytes); record.stdoutBytes += size(part);
      if (record.stdoutBytes > maximum) { refuse("OUTPUT_LIMIT"); return; }
      if (kind === "dump") {
        if (record.chunks.length >= TARGET_SNAPSHOT_NATIVE_LIMITS.chunks) { refuse("OUTPUT_LIMIT"); return; }
        record.chunks.push(part); part = null;
      } else {
        // psql JSON is one bounded physical line per phase. A start frame
        // cannot stand in for EOF, COMMIT or successful process termination.
        for (let i = 0; i < size(part); i++) {
          if (record.frames.length === 1 && record.phase !== "ending") { refuse("PROTOCOL_REFUSED"); return; }
          if (record.frameBytes >= TARGET_SNAPSHOT_NATIVE_LIMITS.frameBytes) { refuse("OUTPUT_LIMIT"); return; }
          record.frame.push(part[i]); record.frameBytes++;
          if (part[i] === 10) {
            if (record.frames.length >= 2 || record.frames.length === 1 && record.phase !== "ending") { refuse("PROTOCOL_REFUSED"); return; }
            const frame = new Bytes(record.frame); record.frame.fill(0); record.frame.length = 0; record.frameBytes = 0;
            record.frames.push(frame); record.frameReady.yes(frame);
          }
        }
      }
    } catch (error) { refuse(own.has(error) && error.code.endsWith("OUTPUT_LIMIT") ? "OUTPUT_LIMIT" : "PRODUCER_FAILED"); }
    finally { wipe(part); wipe(bytes); }
  });
  child.stderr.on("data", bytes => {
    try { const part = copy(bytes, TARGET_SNAPSHOT_NATIVE_LIMITS.stderrBytes - record.stderrBytes); record.stderrBytes += size(part); wipe(part); if (record.stderrEof || record.closed) refuse("PRODUCER_FAILED"); }
    catch (error) { refuse(own.has(error) && error.code.endsWith("OUTPUT_LIMIT") ? "OUTPUT_LIMIT" : "PRODUCER_FAILED"); }
    finally { wipe(bytes); }
  });
  for (const [stream, field] of [[child.stdout, "stdoutEof"], [child.stderr, "stderrEof"]]) {
    stream.on("error", () => refuse("PRODUCER_FAILED"));
    stream.on("end", () => { if (record[field] || record.closed || kind === "psql" && record.phase !== "ending") refuse("PRODUCER_FAILED"); record[field] = true; });
    stream.on("close", () => { const closedField = field === "stdoutEof" ? "stdoutClosed" : "stderrClosed"; if (record[closedField] || !record[field]) refuse("PRODUCER_FAILED"); record[closedField] = true; });
  }
  if (kind === "psql") {
    child.stdin.on("error", () => refuse("INPUT_FAILED"));
    child.stdin.on("finish", () => { if (record.stdinFinished || record.phase !== "ending") refuse("INPUT_FAILED"); record.stdinFinished = true; });
    child.stdin.on("close", () => { if (record.stdinClosed || !record.stdinFinished) refuse("INPUT_FAILED"); record.stdinClosed = true; });
  }
  return record;
}
function writeSession(state, record, sql, end) {
  const completion = deferred(); let settled = false;
  const callback = error => {
    if (settled || error) { completion.no(invalidate(state, "INPUT_FAILED")); return; }
    settled = true; record.callbacks++; completion.yes();
  };
  try { if (end) record.child.stdin.end(sql, callback); else record.child.stdin.write(sql, callback); }
  catch { completion.no(invalidate(state, "INPUT_FAILED")); }
  return completion.promise;
}
async function wait(state, value) { check(state); try { const result = await state.scope.race(Promise.race([value, state.fatal.promise])); check(state); return result; } catch (error) { if (!state.firstError) invalidate(state, own.has(error) && error.code.endsWith("TIMEOUT") ? "TIMEOUT" : "PRODUCER_FAILED"); throw state.firstError; } }
function snapshotDiagnostic(state) {
  const facts = r => r === null ? null : Object.freeze({ spawnObserved: r.spawned, stdinFinishObserved: r.stdinFinished, inputCallbacks: r.callbacks, stdoutBytes: Math.min(TARGET_SNAPSHOT_NATIVE_LIMITS.dumpBytes + 1, r.stdoutBytes), stderrBytes: Math.min(TARGET_SNAPSHOT_NATIVE_LIMITS.stderrBytes + 1, r.stderrBytes), stdoutEofObserved: r.stdoutEof, stderrEofObserved: r.stderrEof, producerExitZero: r.exited && r.exitZero, producerCloseZero: r.closed && r.closeZero });
  return Object.freeze({ version: 1, mode: state.mode, phase: state.phase, protocolError: state.protocolError, psql: facts(state.psql), dump: facts(state.dump) });
}
export async function readNativeTargetSnapshot(options, originalScope, injectedPorts) {
  const state = initialState(injectedPorts === undefined ? "native" : "synthetic"); let accepted = false;
  try {
    const config = configuration(options); state.scope = scopeAdapter(originalScope); state.scope.remaining();
    const ports = injectedPorts === undefined ? { spawn: nativeSpawn } : closed(injectedPorts, ["spawn"]);
    if (typeof ports.spawn !== "function") throw failure("INPUT_INVALID");
    if (injectedPorts === undefined && (process.platform !== "win32" || process.arch !== "x64" || !process.versions.node.startsWith("24."))) throw failure("RUNTIME_REFUSED");
    const nonce = randomBytes(16).toString("hex");
    state.phase = "snapshot_start";
    const psql = originalChild(state, ports.spawn, config.psql, ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--file=-"], config.environment, "psql");
    const startWrite = writeSession(state, psql, beginTargetSnapshotSql(nonce), false);
    const [startBytes] = await wait(state, Promise.all([psql.frameReady.promise, startWrite])); let start;
    try { start = parseTargetSnapshotStartFrame(startBytes, nonce); } catch (error) { safeProtocolError(error, state); throw invalidate(state, "PROTOCOL_REFUSED"); }
    check(state); if (psql.frameBytes !== 0 || psql.frames.length !== 1) throw invalidate(state, "PROTOCOL_REFUSED"); state.startFacts = targetSnapshotPublicFacts(start);
    state.phase = "dump";
    const dump = originalChild(state, ports.spawn, config.pgDump, ["--no-password", "--format=custom", "--compress=gzip", "--schema=auth", "--schema=public", "--schema=app_private", "--schema=storage", "--snapshot=" + start.snapshotId], config.environment, "dump");
    await wait(state, dump.done.promise);
    if (psql.closed || psql.exited || psql.stdoutEof || psql.stderrEof || psql.frames.length !== 1) throw invalidate(state, "PRODUCER_FAILED");
    state.data = new Bytes(dump.stdoutBytes); let offset = 0;
    for (const part of dump.chunks) { set(state.data, part, offset); offset += size(part); wipe(part); } dump.chunks.length = 0;
    if (size(state.data) < 5 || state.data[0] !== 80 || state.data[1] !== 71 || state.data[2] !== 68 || state.data[3] !== 77 || state.data[4] !== 80) throw invalidate(state, "PROTOCOL_REFUSED");
    state.phase = "snapshot_end"; psql.phase = "ending"; psql.frameReady = deferred();
    const endWrite = writeSession(state, psql, endTargetSnapshotSql(nonce), true);
    const [endBytes] = await wait(state, Promise.all([psql.frameReady.promise, endWrite, psql.done.promise]));
    try { parseTargetSnapshotEndFrame(endBytes, nonce); } catch (error) { safeProtocolError(error, state); throw invalidate(state, "PROTOCOL_REFUSED"); }
    check(state); state.digest = hash(state.data); check(state); state.phase = "qualified";
    const receipt = Object.freeze({}); handles.set(receipt, state); accepted = true; return receipt;
  } catch (error) {
    if (!state.firstError) state.firstError = own.has(error) ? error : failure("PRODUCER_FAILED");
    diagnostics.set(state.firstError, snapshotDiagnostic(state)); throw state.firstError;
  } finally {
    for (const r of [state.psql, state.dump]) {
      if (!r) continue;
      for (const part of r.chunks) wipe(part); r.chunks.length = 0;
      for (const frame of r.frames) wipe(frame); r.frames.length = 0; r.frame.fill(0); r.frame.length = 0;
      if (!accepted && !r.closed) { try { r.child?.stdin?.destroy(); r.child?.kill(); r.child?.unref?.(); } catch { /* No termination claim on a refused operation. */ } }
    }
    if (!accepted) { wipe(state.data); wipe(state.copied); }
    // Never close/renew Root's inherited scope. Original observers stay attached
    // so late transport faults revoke and wipe an already returned receipt.
  }
}
function stateFor(receipt) {
  const s = handles.get(receipt); if (!s) throw failure("REQUIRED"); check(s);
  if (hash(s.data) !== s.digest || s.copied && hash(s.copied) !== s.digest) throw invalidate(s, "INTEGRITY_FAILED"); return s;
}
export function nativeTargetSnapshotFacts(receipt) {
  const s = stateFor(receipt);
  return Object.freeze({ version: 1, mode: s.mode, projectRef: TARGET_SNAPSHOT_NATIVE_PROJECT, databaseName: "postgres", nativeDumpSha256: s.digest, nativeDumpBytes: size(s.data), snapshot: s.startFacts, psql: snapshotDiagnostic(s).psql, dump: snapshotDiagnostic(s).dump, restoreAccepted: false });
}
export function copyNativeTargetSnapshot(receipt) {
  const s = stateFor(receipt); if (s.copyClaimed) throw failure("COPY_CLAIMED"); s.copyClaimed = true; s.copied = copy(s.data); return s.copied;
}
export function discardNativeTargetSnapshot(receipt) { const s = handles.get(receipt); if (!s) throw failure("REQUIRED"); if (!s.discarded) { s.discarded = true; wipe(s.data); wipe(s.copied); } }
export function nativeTargetSnapshotDiagnostic(error) { return diagnostics.get(error) ?? null; }
