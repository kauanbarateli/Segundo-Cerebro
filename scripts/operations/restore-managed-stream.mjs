import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { performance } from "node:perf_hooks";
import { BackupError } from "./backup-format.mjs";
import { restoreConfiguration } from "./restore-target.mjs";
import { claimManagedRestore } from "./restore-managed-plan.mjs";
import { checkManagedSnapshot, claimManagedSnapshot, discardManagedSnapshot, MANAGED_SNAPSHOT_ERROR_CODES } from "./restore-managed-snapshot-capability.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new BackupError(code); };
const codes = new Set(["ISOLATED_RESTORE_TARGET_REQUIRED", "ISOLATED_STORAGE_CONFIGURATION_REQUIRED", "RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED", "RESTORE_MANAGED_AUTHORIZATION_REQUIRED", "RESTORE_MANAGED_DEPENDENCIES_REQUIRED", "RESTORE_MANAGED_DATABASE_INVALID", "RESTORE_MANAGED_BINDING_INVALID", "RESTORE_MANAGED_LIST_INVALID", "RESTORE_MANAGED_PRODUCER_FAILED", "RESTORE_MANAGED_CONSUMER_FAILED", "RESTORE_MANAGED_INPUT_FAILED", "RESTORE_MANAGED_VALIDATION_FAILED", "RESTORE_MANAGED_TIMEOUT", "RESTORE_MANAGED_OUTPUT_LIMIT", ...MANAGED_SNAPSHOT_ERROR_CODES]);
const now = performance.now.bind(performance);
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); promise.catch(() => {}); return { promise, resolve, reject }; }
function privateList(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("RESTORE_MANAGED_LIST_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = ["path", "sha256", "private"];
  if (Reflect.ownKeys(descriptors).length !== keys.length || Reflect.ownKeys(descriptors).some(key => !keys.includes(key))) fail("RESTORE_MANAGED_LIST_INVALID");
  for (const key of keys) if (!descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], "value")) fail("RESTORE_MANAGED_LIST_INVALID");
  const path = descriptors.path.value;
  if (typeof path !== "string" || !isAbsolute(path) || path.startsWith("\\\\") || descriptors.sha256.value !== expected || descriptors.private.value !== true) fail("RESTORE_MANAGED_LIST_INVALID");
  return path;
}

/**
 * No CLI or default spawn/materializer/SQL validator exists. The future owned
 * integration must supply native spawn, exclusive private TOC files, and an
 * original fixed SQL/reference check INSIDE this psql transaction. Tests use
 * RAM seams. A qualification token validates supplied facts, not their origin.
 * Native SQL stdout is forwarded verbatim and never parsed, edited or reported.
 */
export async function runManagedRestore({ plan, authorization, env, snapshot }, dependencies = {}) {
  const report = { ok: false, operation: "managed_restore_core", error: null, producerSegmentsFinished: 0, commitAckObserved: false, consumerFinished: false, rollbackObserved: false, remoteOutcome: "not_started", restoreAccepted: false };
  const owned = [], fatal = deferred(); let timer, consumer, database, commitRequested = false, outputBytes = 0;
  const refuse = code => fatal.reject(new BackupError(code));
  const race = promise => Promise.race([promise, fatal.promise]);
  const stop = child => { try { child.stdin?.destroy(); child.stdout?.destroy(); child.stderr?.destroy(); child.kill?.(); child.unref?.(); } catch { /* No termination/rollback is inferred from this best effort. */ } };
  const write = bytes => race(new Promise((resolve, reject) => {
    if (!consumer || consumer.stdin.destroyed || consumer.stdin.writableEnded) return reject(new BackupError("RESTORE_MANAGED_CONSUMER_FAILED"));
    consumer.stdin.write(bytes, error => error ? reject(new BackupError("RESTORE_MANAGED_CONSUMER_FAILED")) : resolve());
  }));
  try {
    if (typeof dependencies.spawn !== "function" || typeof dependencies.materializeList !== "function" || typeof dependencies.checkBeforeCommit !== "function" || typeof dependencies.removeLists !== "function") fail("RESTORE_MANAGED_DEPENDENCIES_REQUIRED");
    const config = restoreConfiguration(env);
    // This bound is a transport resource deadline, not a restore acceptance.
    const timeoutMs = dependencies.timeoutMs ?? 45000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 45000) fail("RESTORE_MANAGED_DEPENDENCIES_REQUIRED");
    const deadline = now() + timeoutMs;
    const checkDeadline = () => { if (now() >= deadline) fail("RESTORE_MANAGED_TIMEOUT"); };
    timer = setTimeout(() => refuse("RESTORE_MANAGED_TIMEOUT"), timeoutMs);
    checkManagedSnapshot(plan, snapshot);
    const execution = claimManagedRestore(plan, authorization);
    const databaseSource = claimManagedSnapshot(plan, snapshot);
    // A1 owns the snapshot-to-plan binding; the reviewed inspector alone must
    // authenticate the archive before mint. Copy the view BEFORE the
    // next pull wipes it. One dedicated store, never a pooled Buffer, is shared
    // by every segment and wiped on EVERY exit; no plaintext file is created.
    database = new Uint8Array(new ArrayBuffer(execution.databaseBytes));
    await race((async () => {
      let bytes = 0;
      for await (const chunk of databaseSource) {
        checkDeadline();
        if (!(chunk instanceof Uint8Array)) fail("RESTORE_MANAGED_DATABASE_INVALID");
        if (bytes + chunk.byteLength > execution.databaseBytes) fail("RESTORE_MANAGED_DATABASE_INVALID");
        database.set(chunk, bytes); bytes += chunk.byteLength;
      }
      checkDeadline();
      if (bytes !== execution.databaseBytes || database[0] !== 0x50 || database[1] !== 0x47 || database[2] !== 0x44 || database[3] !== 0x4d || database[4] !== 0x50 || digest(database) !== execution.databaseSha256) fail("RESTORE_MANAGED_DATABASE_INVALID");
    })());
    const paths = [];
    for (const segment of execution.segments) {
      checkDeadline();
      paths.push(privateList(await race(dependencies.materializeList(segment.list)), digest(segment.list)));
      checkDeadline();
    }
    // Timer callbacks cannot run while a synchronous materializer is busy.
    // The same absolute monotonic deadline therefore vetoes native spawn too.
    checkDeadline();
    consumer = dependencies.spawn(config.psql, ["--no-psqlrc", "--no-password", "--set=ON_ERROR_STOP=1", "--no-align", "--tuples-only", "--dbname=postgres", "--file=-"], { env: config.pg, stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true });
    owned.push(consumer); report.remoteOutcome = "unknown";
    const consumerClose = deferred(), consumerEof = deferred();
    let line = "", discardedLine = false, consumerEnded = false;
    consumer.on("error", () => refuse("RESTORE_MANAGED_CONSUMER_FAILED"));
    consumer.stdin.on("error", () => refuse("RESTORE_MANAGED_CONSUMER_FAILED"));
    consumer.stdout.on("error", () => refuse("RESTORE_MANAGED_CONSUMER_FAILED"));
    consumer.stdout.on("close", () => { if (!consumerEnded) refuse("RESTORE_MANAGED_CONSUMER_FAILED"); });
    consumer.stderr?.on("error", () => refuse("RESTORE_MANAGED_CONSUMER_FAILED")); consumer.stderr?.resume();
    consumer.on("close", code => { consumerClose.resolve(code); if (!commitRequested || code !== 0) refuse("RESTORE_MANAGED_CONSUMER_FAILED"); });
    const observeLine = value => {
      if (value === "ROLLBACK") report.rollbackObserved = true;
      if (value === "COMMIT") { if (!commitRequested) refuse("RESTORE_MANAGED_CONSUMER_FAILED"); else report.commitAckObserved = true; }
    };
    consumer.stdout.on("data", chunk => {
      outputBytes += chunk.byteLength;
      if (outputBytes > 1024 * 1024) { refuse("RESTORE_MANAGED_OUTPUT_LIMIT"); return; }
      for (const byte of chunk) {
        if (byte === 10) { if (!discardedLine) observeLine(line.replace(/\r$/, "")); line = ""; discardedLine = false; }
        else if (!discardedLine) { if (line.length === 16) { line = ""; discardedLine = true; } else line += String.fromCharCode(byte); }
      }
    });
    // Native command tags end with a newline. EOF cannot turn a truncated
    // private output fragment into a synthetic COMMIT acknowledgement.
    consumer.stdout.on("end", () => { consumerEnded = true; consumerEof.resolve(); if (!commitRequested) refuse("RESTORE_MANAGED_CONSUMER_FAILED"); });
    await write("BEGIN;\nSET LOCAL session_replication_role = replica;\n");
    for (let index = 0; index < execution.segments.length; index++) {
      const segment = execution.segments[index];
      if (segment.role !== null) await write('SET LOCAL ROLE "' + segment.role + '";\n');
      // Revalidate private RAM before every replay. Role/list names stay private.
      if (digest(database) !== execution.databaseSha256) fail("RESTORE_MANAGED_DATABASE_INVALID");
      checkDeadline();
      const producer = dependencies.spawn(config.pgRestore, ["--exit-on-error", "--use-list=" + paths[index], "--file=-"], { env: config.pg, stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true });
      owned.push(producer);
      const producerClose = deferred(), producerEof = deferred(), inputDone = deferred(); let producerEnded = false, inputError = null;
      producer.on("error", () => refuse("RESTORE_MANAGED_PRODUCER_FAILED"));
      producer.stdout.on("error", () => refuse("RESTORE_MANAGED_PRODUCER_FAILED"));
      producer.stdout.on("close", () => { if (!producerEnded) refuse("RESTORE_MANAGED_PRODUCER_FAILED"); });
      producer.stderr?.on("error", () => refuse("RESTORE_MANAGED_PRODUCER_FAILED")); producer.stderr?.resume();
      producer.on("close", code => { producerClose.resolve(code); if (code !== 0) refuse("RESTORE_MANAGED_PRODUCER_FAILED"); });
      producer.stdin.on("error", error => { inputError = error?.code; inputDone.resolve(false); if (!segment.custom || inputError !== "EPIPE") refuse("RESTORE_MANAGED_INPUT_FAILED"); });
      producer.stdin.on("finish", () => inputDone.resolve(true));
      producer.stdout.on("end", () => { producerEnded = true; producerEof.resolve(); });
      const forward = (async () => { for await (const bytes of producer.stdout) await write(bytes); })();
      forward.catch(() => refuse("RESTORE_MANAGED_PRODUCER_FAILED"));
      producer.stdin.end(database, error => { if (error) { inputError = error.code; inputDone.resolve(false); if (!segment.custom || inputError !== "EPIPE") refuse("RESTORE_MANAGED_INPUT_FAILED"); } });
      await race(Promise.all([producerClose.promise, producerEof.promise, forward]));
      // A custom-DDL-only selection can stop reading a custom dump before its
      // data tail. Only real producer close0+SQL EOF, plus the fully authenticated
      // bound RAM source above, permit discarding that owned stdin. Core/data
      // cannot use this exception; any other stdin error remains a refusal.
      if (segment.custom) {
        if (inputError && inputError !== "EPIPE") fail("RESTORE_MANAGED_INPUT_FAILED");
        producer.stdin.destroy();
      } else if (!(await race(inputDone.promise))) fail("RESTORE_MANAGED_INPUT_FAILED");
      report.producerSegmentsFinished++;
      if (segment.role !== null) await write("RESET ROLE;\n");
    }
    await write("SET LOCAL session_replication_role = origin;\n");
    // Trusted future adapter performs the fixed catalog/FK assertion in THIS
    // connection via write, observes its original result, then returns true.
    // It is deliberately required; a separate connection cannot see this data.
    if (await race(dependencies.checkBeforeCommit({ write, consumer })) !== true) fail("RESTORE_MANAGED_VALIDATION_FAILED");
    checkDeadline();
    commitRequested = true;
    await write("COMMIT;\n");
    consumer.stdin.end();
    await race(Promise.all([consumerClose.promise, consumerEof.promise]));
    if (!report.commitAckObserved || report.rollbackObserved) fail("RESTORE_MANAGED_CONSUMER_FAILED");
    report.consumerFinished = true; report.remoteOutcome = "committed"; report.ok = true;
  } catch (error) {
    report.error = error instanceof BackupError && codes.has(error.code) ? error.code : "RESTORE_MANAGED_UNAVAILABLE";
    for (const child of owned) stop(child);
  } finally {
    clearTimeout(timer);
    database?.fill(0);
    discardManagedSnapshot(snapshot);
    try { await dependencies.removeLists?.(); } catch { report.ok = false; report.error ??= "RESTORE_MANAGED_LIST_CLEANUP_FAILED"; }
  }
  return report;
}
