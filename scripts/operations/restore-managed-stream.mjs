import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { BackupError } from "./backup-format.mjs";
import { restoreConfiguration } from "./restore-target.mjs";
import { claimManagedRestore } from "./restore-managed-plan.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new BackupError(code); };
const codes = new Set(["ISOLATED_RESTORE_TARGET_REQUIRED", "ISOLATED_STORAGE_CONFIGURATION_REQUIRED", "RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED", "RESTORE_MANAGED_AUTHORIZATION_REQUIRED", "RESTORE_MANAGED_DEPENDENCIES_REQUIRED", "RESTORE_MANAGED_DATABASE_INVALID", "RESTORE_MANAGED_BINDING_INVALID", "RESTORE_MANAGED_LIST_INVALID", "RESTORE_MANAGED_PRODUCER_FAILED", "RESTORE_MANAGED_CONSUMER_FAILED", "RESTORE_MANAGED_INPUT_FAILED", "RESTORE_MANAGED_VALIDATION_FAILED", "RESTORE_MANAGED_TIMEOUT", "RESTORE_MANAGED_OUTPUT_LIMIT"]);
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
export async function runManagedRestore({ plan, authorization, env, databaseSource }, dependencies = {}) {
  const report = { ok: false, operation: "managed_restore_core", error: null, producerSegmentsFinished: 0, commitAckObserved: false, consumerFinished: false, rollbackObserved: false, remoteOutcome: "not_started", restoreAccepted: false };
  const owned = [], fatal = deferred(); let timer, consumer, commitRequested = false, outputBytes = 0;
  const refuse = code => fatal.reject(new BackupError(code));
  const race = promise => Promise.race([promise, fatal.promise]);
  const stop = child => { try { child.stdin?.destroy(); child.stdout?.destroy(); child.stderr?.destroy(); child.kill?.(); child.unref?.(); } catch { /* No termination/rollback is inferred from this best effort. */ } };
  const write = bytes => race(new Promise((resolve, reject) => {
    if (!consumer || consumer.stdin.destroyed || consumer.stdin.writableEnded) return reject(new BackupError("RESTORE_MANAGED_CONSUMER_FAILED"));
    consumer.stdin.write(bytes, error => error ? reject(new BackupError("RESTORE_MANAGED_CONSUMER_FAILED")) : resolve());
  }));
  try {
    if (typeof dependencies.spawn !== "function" || typeof dependencies.materializeList !== "function" || typeof dependencies.checkBeforeCommit !== "function" || typeof dependencies.removeLists !== "function") fail("RESTORE_MANAGED_DEPENDENCIES_REQUIRED");
    const config = restoreConfiguration(env), execution = claimManagedRestore(plan, authorization);
    // This bound is a transport resource deadline, not a restore acceptance.
    const timeoutMs = dependencies.timeoutMs ?? 45000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 45000) fail("RESTORE_MANAGED_DEPENDENCIES_REQUIRED");
    timer = setTimeout(() => refuse("RESTORE_MANAGED_TIMEOUT"), timeoutMs);
    // Entire original database source is checked in private RAM BEFORE spawn.
    // The caller must already have authenticated the entire encrypted snapshot.
    // Each segment uses the SAME bytes; no plaintext file is created.
    const database = await race((async () => {
      const chunks = []; let bytes = 0;
      for await (const chunk of databaseSource) {
        if (!(chunk instanceof Uint8Array)) fail("RESTORE_MANAGED_DATABASE_INVALID");
        bytes += chunk.byteLength;
        if (bytes > execution.databaseBytes) fail("RESTORE_MANAGED_DATABASE_INVALID");
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks, bytes);
      if (bytes !== execution.databaseBytes || buffer.subarray(0, 5).toString("ascii") !== "PGDMP" || digest(buffer) !== execution.databaseSha256) fail("RESTORE_MANAGED_DATABASE_INVALID");
      return buffer;
    })());
    const paths = [];
    for (const segment of execution.segments) paths.push(privateList(await race(dependencies.materializeList(segment.list)), digest(segment.list)));
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
    try { await dependencies.removeLists?.(); } catch { report.ok = false; report.error ??= "RESTORE_MANAGED_LIST_CLEANUP_FAILED"; }
  }
  return report;
}
