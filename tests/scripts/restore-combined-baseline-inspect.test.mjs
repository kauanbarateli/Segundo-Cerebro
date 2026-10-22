import test, { after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, lstat, readdir, rmdir, unlink, writeFile, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInspectedBaselineFixture } from "./fixtures/restore-inspected-baseline-fixture.mjs";
import { writeBackup } from "../../scripts/operations/backup-format.mjs";
import { DATABASE_METADATA } from "../../scripts/operations/backup-sources.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { inspectionMigrationHistoryFacts } from "../../scripts/operations/restore-migration-history.mjs";
import { defaultInspectionTemporaryRoot, runManagedInspect, PRIVATE_PATH_ACL_SCRIPT } from "../../scripts/operations/restore-managed-inspect.mjs";
import { TARGET_SNAPSHOT_NATIVE_PROJECT } from "../../scripts/operations/restore-target-snapshot-native.mjs";

// Public synthetic CUSTOM/COPY bytes, original AES-GCM on exclusive temporary
// files, and RAM child ports only. No profile/archive/PG/SQL/HTTP is accessed.
const CANARY = "COMBINED_PRIVATE_CANARY", hash = b => createHash("sha256").update(b).digest("hex");
const originalFetch = globalThis.fetch; let networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw Error("NETWORK_FORBIDDEN"); };
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });
const child = () => Object.assign(new EventEmitter(), { stdin: new EventEmitter(), stdout: new PassThrough(), stderr: new PassThrough(), kill() { return true; }, unref() {} });
function finish(c, code = 0) { c.stdout.end(); c.stderr.end(); setImmediate(() => { c.emit("exit", code, null); c.emit("close", code, null); }); }
function configuration(directory, key) {
  const ref = TARGET_SNAPSHOT_NATIVE_PROJECT;
  return { SystemRoot: process.env.SystemRoot ?? resolve("RAM/Windows"), PATH: process.env.PATH, SC_BACKUP_ENCRYPTION_KEY: key.toString("base64"), SC_BACKUP_KEY_ID: "synthetic-combined-v1",
    SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + CANARY,
    SC_RESTORE_PG_RESTORE: resolve("RAM-not-installed/pg_restore.exe"), SC_RESTORE_PSQL: resolve("RAM-not-installed/psql.exe"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGPORT: "5432", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: CANARY, SC_RESTORE_PGSSLMODE: "require", SC_BACKUP_WORK_ROOT: join(directory, "not-serving") };
}
async function fixture(action, options = {}) {
  const vectors = createInspectedBaselineFixture(options), key = randomBytes(32), temporary = await defaultInspectionTemporaryRoot(), directory = await mkdtemp(join(temporary, "sc-combined-fixture-")), lease = await lstat(directory), archive = join(directory, "fixture.scbackup");
  try {
    await writeBackup(archive, key, { project_ref: PERSONAL_REF, key_id: "synthetic-combined-v1", created_at: "2026-10-17T00:00:00Z" }, (async function* () { yield { metadata: DATABASE_METADATA, stream: Readable.from([vectors.source.database]) }; })());
    return await action({ vectors, directory, archive, env: configuration(directory, key) });
  } finally {
    key.fill(0); vectors.discard();
    const current = await lstat(directory); assert.equal(current.dev, lease.dev); assert.equal(current.ino, lease.ino); assert.equal(current.birthtimeMs, lease.birthtimeMs);
    // Explicit nonrecursive cleanup is confined to this new fixture directory.
    for (const name of await readdir(directory)) {
      const path = join(directory, name), item = await lstat(path); assert.equal(dirname(path), directory); assert.equal(item.isSymbolicLink(), false);
      if (item.isDirectory()) {
        assert.match(name, /^sc-inspect-(?:cipher|target)-/);
        for (const entry of await readdir(path)) { assert.equal(["snapshot.scbackup", "unexpected-owned.txt"].includes(entry), true); const owned = join(path, entry); assert.equal((await lstat(owned)).isFile(), true); await unlink(owned); }
        await rmdir(path);
      } else { assert.equal(name, "fixture.scbackup"); await unlink(path); }
    }
    await rmdir(directory);
  }
}
function harness(ctx, controls = {}) {
  const calls = [], chunks = [], borrowed = [], children = {}; let session, nonce, listRequests = 0;
  const output = value => { const b = Buffer.from(value); chunks.push(b); return b; };
  const historyPorts = (side, label) => ({
    async createLists(options, remaining) { calls.push(label + "-list"); assert.ok(remaining > 0 && remaining <= 45000); return { async materializeList(text) { return { path: join(options.privateRoot, "synthetic.toc"), sha256: hash(text), private: true }; }, async removeLists() { calls.push(label + "-cleanup"); if (controls.cleanupFault === label) children[label].emit("error", Error(CANARY)); } }; },
    spawn(executable, args, settings) {
      calls.push(label); assert.equal(executable, ctx.env.SC_RESTORE_PG_RESTORE); assert.equal(settings.shell, false); assert.equal(Object.keys(settings.env).some(k => /PG|KEY|PASSWORD/.test(k)), false); assert.ok(args.includes("--restrict-key=SCBaselineV1"));
      const c = child(); children[label] = c; c.stdin.destroy = () => {};
      c.stdin.end = (bytes, callback) => { borrowed.push(bytes); queueMicrotask(() => { c.emit("spawn"); c.stdin.emit("finish"); callback(); c.stdout.write(output(side.stdout)); finish(c, controls.historyExit === label ? 1 : 0); }); };
      return c;
    },
  });
  const targetHistory = inspectionMigrationHistoryFacts(ctx.vectors.target.historyHandle).history;
  const startFrame = () => {
    const relation = (oid, schema, name, rows) => ({ oid, schemaOid: schema === "auth" ? 10 : 20, schema, name, kind: "r", extensionMember: false, extensionConfig: false, isPartition: false, hasInheritance: false, rowSecurityActive: false, rows });
    const frame = { version: 1, kind: "target-snapshot-start", nonce, snapshotId: "00000001-00000001-1", databaseName: "postgres", actor: "postgres", sessionActor: "postgres", readOnly: true, isolation: "repeatable read", rowSecurityOff: true, rlsBypass: true, catalogueComplete: true, catalogueCount: 5,
      schemas: [{ name: "auth", oid: 10 }, { name: "storage", oid: 20 }, { name: "public", oid: 30 }, { name: "app_private", oid: null }],
      relations: [relation(100, "auth", "schema_migrations", targetHistory.auth.length), relation(101, "auth", "users", controls.nonempty ? 1 : 0), relation(102, "storage", "migrations", targetHistory.storage.length + (controls.historyCountMismatch ? 1 : 0)), relation(103, "storage", "objects", 0), relation(104, "storage", "buckets", 0)] };
    return frame;
  };
  const dependencies = { temporaryRoot: ctx.directory, timeoutMs: controls.timeoutMs ?? 3000,
    spawnAcl(executable, args) { calls.push("acl"); assert.equal(Buffer.from(args[3], "base64").toString("utf16le"), PRIVATE_PATH_ACL_SCRIPT); const c = child(); queueMicrotask(() => { c.stdout.write(output('{"private":true}')); finish(c); }); return c; },
    spawnList(executable, args, settings) {
      assert.equal(executable, ctx.env.SC_RESTORE_PG_RESTORE); assert.deepEqual(args, ["--list", "--verbose"]); assert.equal(Object.keys(settings.env).some(k => /PG|KEY|PASSWORD/.test(k)), false);
      if (++listRequests === 1 && controls.sourceSpawnError) throw controls.sourceSpawnError;
      const c = child(); c.stdin.destroy = () => {};
      c.stdin.end = (bytes, callback) => {
        const source = hash(bytes) === hash(ctx.vectors.source.database), label = source ? "source-toc" : "target-toc"; children[label] = c; calls.push(label); borrowed.push(bytes);
        if (source && controls.sourceToc) return controls.sourceToc(c, callback, () => c.stdout.write(output(ctx.vectors.source.toc)));
        queueMicrotask(async () => {
          c.emit("spawn");
          const mode = source ? controls.sourceInputMode : null;
          if (mode === "callback_other") callback(Object.assign(Error(CANARY), { code: "ECONNRESET" }));
          else if (mode === "epipe" || mode === "epipe_then_other") callback(Object.assign(Error(CANARY), { code: "EPIPE" }));
          else callback();
          if (mode === "stream_other" || mode === "epipe_then_other") c.stdin.emit("error", Object.assign(Error(CANARY), { code: "ECONNRESET" }));
          if (controls.listDelayMs) await new Promise(yes => setTimeout(yes, controls.listDelayMs));
          c.stdout.write(output(source ? ctx.vectors.source.toc : ctx.vectors.target.toc));
          finish(c, controls.listExit === label ? 1 : 0);
        });
      }; return c;
    },
    nativeHistoryPorts: historyPorts(ctx.vectors.source, "source-history"),
    nativeInspectionHistoryPorts: historyPorts(ctx.vectors.target, "target-history"),
    targetSnapshotPorts: { spawn(executable, args, settings) {
      const psql = executable === ctx.env.SC_RESTORE_PSQL, c = child(); c.stdin.destroy = () => {}; calls.push(psql ? "target-session" : "target-dump");
      assert.equal(settings.env.PGPASSWORD, CANARY); assert.equal(settings.shell, false); assert.equal(JSON.stringify(args).includes(CANARY), false);
      if (psql) {
        session = c; children.session = c;
        c.stdin.write = (sql, callback) => { nonce = /'nonce','([a-f0-9]{32})'/.exec(sql)?.[1]; assert.equal(nonce?.length, 32); queueMicrotask(() => { c.emit("spawn"); callback(); c.stdout.write(output(JSON.stringify(startFrame()) + "\n")); }); };
        c.stdin.end = (sql, callback) => { assert.match(sql, /COMMIT;/); queueMicrotask(() => { c.stdin.emit("finish"); callback(); c.stdout.write(output(JSON.stringify({ version: 1, kind: "target-snapshot-end", nonce, committed: true, databaseName: "postgres", actor: "postgres", sessionActor: "postgres" }) + "\n")); finish(c); }); };
      } else {
        assert.ok(session); assert.ok(borrowed[0].some(v => v !== 0), "source dump stays owned during target acquisition");
        queueMicrotask(() => { c.emit("spawn"); c.stdout.write(output(ctx.vectors.target.database)); finish(c); });
      } return c;
    } },
  };
  return { dependencies, calls, chunks, borrowed, children };
}
function hidden(out, ctx) { const text = JSON.stringify(out); for (const value of [CANARY, ctx.directory, TARGET_SNAPSHOT_NATIVE_PROJECT, "observed_function", "supabase_auth_admin", "PGDMP", "COPY auth", '"dumpIds"', '"definition"', '"owner"']) assert.equal(text.includes(value), false); }
async function execute(ctx, controls = {}, argv = ["inspect-baseline", ctx.archive]) { const fake = harness(ctx, controls), output = []; const exit = await runManagedInspect(argv, ctx.env, value => output.push(value), fake.dependencies); hidden(output, ctx); return { fake, output, exit }; }
const SOURCE_TOC_EVENTS = ["spawnRequested", "spawn", "spawnThrow", "stdinEndRequested", "stdinCallback", "stdinFinish", "stdinError", "stdinEndThrow", "childError", "stdoutError", "stderrError", "stdoutEOF", "stdoutClose", "stderrEOF", "stderrClose", "exit", "close", "stdinDestroyRequested", "stdoutDestroyRequested", "stderrDestroyRequested", "killRequested", "unrefRequested"];
const SOURCE_TOC_ERRORS = ["spawnThrow", "stdinCallback", "stdinError", "stdinEndThrow", "childError", "stdoutError", "stderrError"];
const nativeError = code => Object.assign(Error(CANARY), { code, path: CANARY, pid: 987654, sql: CANARY });
function sourceTocFacts(out) {
  const facts = out.sourceTocDiagnostic;
  assert.deepEqual(Object.keys(facts).sort(), ["finalCleanup", "firstRefusal", "observer", "version"]);
  assert.equal(facts.version, 1); assert.equal(facts.observer, "source_toc_original"); assert.equal(Object.isFrozen(facts), true);
  if (facts.firstRefusal) {
    assert.deepEqual(Object.keys(facts.firstRefusal).sort(), ["code", "state"]); assert.equal(Object.isFrozen(facts.firstRefusal), true);
    assert.equal(["INSPECTION_NATIVE_UNAVAILABLE", "INSPECTION_NATIVE_FAILED", "INSPECTION_INPUT_FAILED", "INSPECTION_UNAVAILABLE", "INSPECTION_TIMEOUT", "INSPECTION_LIMIT", "INSPECTION_TOC_INVALID"].includes(facts.firstRefusal.code), true);
  }
  for (const state of [facts.firstRefusal?.state, facts.finalCleanup].filter(Boolean)) {
    assert.deepEqual(Object.keys(state).sort(), ["events", "firstError", "lastError", "overflow", "sequence"]); assert.equal(Object.isFrozen(state), true);
    assert.equal(Number.isSafeInteger(state.sequence) && state.sequence >= 0 && state.sequence <= 64, true); assert.equal(typeof state.overflow, "boolean");
    assert.deepEqual(Object.keys(state.events), SOURCE_TOC_EVENTS); assert.equal(Object.isFrozen(state.events), true);
    for (const [name, event] of Object.entries(state.events)) if (event) {
      assert.equal(Object.isFrozen(event), true); assert.equal(Number.isSafeInteger(event.sequence) && event.sequence >= 1 && event.sequence <= state.sequence, true);
      if (name === "stdinCallback") { assert.deepEqual(Object.keys(event).sort(), ["code", "outcome", "sequence"]); assert.equal(["ok", "error"].includes(event.outcome), true); assert.equal(["none", "EPIPE", "ERR_STREAM_DESTROYED", "other", "unavailable"].includes(event.code), true); }
      else if (SOURCE_TOC_ERRORS.includes(name)) { assert.deepEqual(Object.keys(event).sort(), ["code", "sequence"]); assert.equal(["EPIPE", "ERR_STREAM_DESTROYED", "other", "unavailable"].includes(event.code), true); }
      else if (["exit", "close"].includes(name)) { assert.deepEqual(Object.keys(event).sort(), ["code", "sequence", "signal"]); assert.equal(["zero", "nonzero", "unavailable"].includes(event.code), true); assert.equal(["none", "SIGKILL", "SIGTERM", "SIGINT", "other"].includes(event.signal), true); }
      else assert.deepEqual(Object.keys(event), ["sequence"]);
    }
    for (const error of [state.firstError, state.lastError].filter(Boolean)) { assert.deepEqual(Object.keys(error).sort(), ["code", "origin", "sequence"]); assert.equal(Object.isFrozen(error), true); assert.equal(SOURCE_TOC_ERRORS.includes(error.origin), true); assert.equal(["EPIPE", "ERR_STREAM_DESTROYED", "other", "unavailable"].includes(error.code), true); assert.equal(Number.isSafeInteger(error.sequence) && error.sequence >= 1 && error.sequence <= state.sequence, true); }
  }
  assert.ok(facts.finalCleanup); return facts;
}

test("one combined acquisition authenticates first, compares live full facts and wipes all borrowed sources", async () => fixture(async ctx => {
  const result = await execute(ctx); assert.equal(result.exit, 0); const out = result.output[0]; assert.equal(out.operation, "managed_restore_combined_baseline_inspect"); assert.equal(out.authenticatedSource, true); assert.equal(out.transportMode, "synthetic"); assert.equal(out.targetQueried, false); assert.equal(out.comparisonCompleted, true); assert.equal(out.comparison.managed.matches, true); assert.equal(out.comparison.existingApp.matches, true); assert.equal(out.comparison.coverage.coverageComplete, true);
  for (const flag of ["baselineQualified", "restoreAccepted", "remoteMutation"]) assert.equal(out[flag], false);
  assert.ok(result.fake.calls.indexOf("source-history-cleanup") < result.fake.calls.indexOf("target-session")); assert.ok(result.fake.calls.indexOf("target-toc") < result.fake.calls.indexOf("target-history"));
  for (const bytes of [...result.fake.chunks, ...result.fake.borrowed]) assert.equal(bytes.every(v => v === 0), true);
  assert.deepEqual(await readdir(ctx.directory), ["fixture.scbackup"]);
}));
test("an extra Storage migration remains a full-content A2 mismatch without import authority", async () => fixture(async ctx => {
  const result = await execute(ctx); assert.equal(result.exit, 0); assert.equal(result.output[0].comparison.managed.matches, false); assert.ok(result.output[0].comparison.managed.reasons.includes("storage_history_mismatch")); assert.equal(result.output[0].target.migrationHistory.storageRows, 2); assert.equal(result.output[0].restoreAccepted, false);
}, { targetHistories: { auth: [{ version: "20240101" }], storage: [{ id: 0, name: "initial", hash: "a".repeat(40), executed_at: null }, { id: 1, name: "next", hash: "b".repeat(40), executed_at: null }] } }));
test("ciphertext rejection cannot start any target or native source phase", async () => fixture(async ctx => {
  const bytes = await readFile(ctx.archive); bytes[bytes.length - 1] ^= 1; await writeFile(ctx.archive, bytes); const result = await execute(ctx); assert.equal(result.exit, 1); assert.equal(result.fake.calls.includes("source-toc"), false); assert.equal(result.fake.calls.includes("target-session"), false); assert.equal(result.output[0].comparisonCompleted, false);
}));
test("source failure prevents target and retained resources are still cleaned", async () => fixture(async ctx => {
  const result = await execute(ctx, { listExit: "source-toc" }); assert.equal(result.exit, 1); assert.equal(result.fake.calls.includes("target-session"), false); assert.deepEqual(await readdir(ctx.directory), ["fixture.scbackup"]);
}));
test("first original source stdin refusal retains the nominal source envelope without provider text", async () => {
  for (const sourceInputMode of ["callback_other", "stream_other", "epipe_then_other"]) await fixture(async ctx => {
    // A subsequent producer close1 must not replace the earlier input code.
    const result = await execute(ctx, { sourceInputMode, listExit: "source-toc" });
    assert.equal(result.exit, 1); const out = result.output[0];
    assert.equal(out.error, "INSPECTION_INPUT_FAILED"); assert.equal(out.stage, "source");
    assert.deepEqual(out.sourceDiagnostic, { stage: "native_toc", authComplete: true, listStarted: true, tocDiagnostic: null, tocPlanDiagnostic: null, inventory: null, nativeHistoryDiagnostic: null });
    assert.equal(Object.isFrozen(out.sourceDiagnostic), true);
    assert.equal(out.targetDiagnostic, null); assert.equal(out.nativeHistoryDiagnostic, null);
    assert.equal(out.comparisonCompleted, false); assert.equal(out.baselineCompared, false); assert.equal(out.restoreAccepted, false);
    assert.equal(result.fake.calls.includes("source-history"), false); assert.equal(result.fake.calls.includes("target-session"), false);
    assert.equal(Object.hasOwn(out, "comparison"), false);
    assert.equal(JSON.stringify(out).includes("ECONNRESET"), false); assert.equal(JSON.stringify({ ...out, sourceTocDiagnostic: null }).includes("EPIPE"), false);
    const facts = sourceTocFacts(out); assert.equal(facts.firstRefusal.code, "INSPECTION_INPUT_FAILED");
    assert.equal(Object.hasOwn(out, "message"), false); assert.equal(Object.hasOwn(out, "cause"), false);
    // stdout queued by the fake AFTER its refusal may remain producer-owned;
    // only the database views actually borrowed from the inspector must wipe.
    for (const bytes of result.fake.borrowed) assert.equal(bytes.every(v => v === 0), true);
    assert.deepEqual(await readdir(ctx.directory), ["fixture.scbackup"]);
  });
});
test("source TOC-only original EPIPE exception is unchanged and grants no native authority", async () => fixture(async ctx => {
  const result = await execute(ctx, { sourceInputMode: "epipe" });
  assert.equal(result.exit, 0); assert.equal(result.output[0].transportMode, "synthetic");
  assert.equal(result.output[0].targetQueried, false); assert.equal(result.output[0].baselineQualified, false); assert.equal(result.output[0].restoreAccepted, false);
}));
test("SourceTOC observes callback/event ordering and discordant codes without replacing the first refusal", async () => {
  for (const order of ["callback-first", "event-first"]) for (const firstCode of ["EPIPE", "ERR_STREAM_DESTROYED"]) await fixture(async ctx => {
    const secondCode = firstCode === "EPIPE" ? "ERR_STREAM_DESTROYED" : "EPIPE";
    const sourceToc = (c, callback) => queueMicrotask(() => {
      c.emit("spawn"); c.stdin.emit("finish");
      if (order === "callback-first") { callback(nativeError(firstCode)); c.stdin.emit("error", nativeError(secondCode)); }
      else { c.stdin.emit("error", nativeError(firstCode)); callback(nativeError(secondCode)); }
    });
    const result = await execute(ctx, { sourceToc }); const out = result.output[0], facts = sourceTocFacts(out), before = facts.firstRefusal.state, after = facts.finalCleanup;
    assert.equal(result.exit, 1); assert.equal(out.error, "INSPECTION_INPUT_FAILED"); assert.equal(facts.firstRefusal.code, out.error);
    assert.deepEqual(before.firstError, { origin: order === "callback-first" ? "stdinCallback" : "stdinError", code: firstCode, sequence: before.firstError.sequence });
    assert.equal(after.events.stdinCallback.code, order === "callback-first" ? firstCode : secondCode); assert.equal(after.events.stdinError.code, order === "event-first" ? firstCode : secondCode);
    assert.equal(after.events.stdinCallback.sequence < after.events.stdinError.sequence, order === "callback-first");
    if (firstCode === "ERR_STREAM_DESTROYED") assert.equal(before.events[order === "callback-first" ? "stdinError" : "stdinCallback"], null);
    assert.equal(before.events.stdinDestroyRequested, null); assert.ok(after.events.stdinDestroyRequested); assert.ok(after.events.killRequested);
    assert.equal(result.fake.calls.includes("target-session"), false); assert.equal(out.restoreAccepted, false);
  });
});
test("SourceTOC keeps its first refusal separate from errors and terminal events induced by local cleanup", async () => fixture(async ctx => {
  const calls = [];
  const result = await execute(ctx, { sourceToc(c, callback) {
    c.stdin.destroy = () => { calls.push("destroy"); c.stdin.emit("error", nativeError("ERR_STREAM_DESTROYED")); };
    c.kill = () => { calls.push("kill"); c.emit("exit", null, "SIGKILL"); c.emit("close", null, "SIGKILL"); return true; };
    c.unref = () => { calls.push("unref"); };
    queueMicrotask(() => { c.emit("spawn"); callback(nativeError("ECONNRESET")); });
  } });
  const out = result.output[0], facts = sourceTocFacts(out), before = facts.firstRefusal.state, after = facts.finalCleanup;
  assert.equal(out.error, "INSPECTION_INPUT_FAILED"); assert.deepEqual(calls, ["destroy", "kill", "unref"]);
  assert.equal(before.firstError.origin, "stdinCallback"); assert.equal(before.firstError.code, "other");
  for (const name of ["stdinError", "stdinDestroyRequested", "killRequested", "unrefRequested", "exit", "close"]) assert.equal(before.events[name], null);
  assert.equal(after.events.stdinError.code, "ERR_STREAM_DESTROYED"); assert.equal(after.events.stdinDestroyRequested.sequence < after.events.stdinError.sequence, true);
  assert.equal(after.events.killRequested.sequence < after.events.exit.sequence, true); assert.equal(after.events.exit.code, "unavailable"); assert.equal(after.events.exit.signal, "SIGKILL");
  assert.equal(after.events.close.signal, "SIGKILL"); assert.equal(after.firstError, before.firstError);
  const frozen = JSON.stringify(facts);
  result.fake.children["source-toc"].stdin.emit("error", nativeError("EPIPE"));
  assert.equal(JSON.stringify(facts), frozen); assert.equal(result.output.length, 1); assert.equal(out.comparisonCompleted, false); assert.equal(out.baselineQualified, false);
}));
test("SourceTOC records missing callback, finish, spawn, stderr EOF and exit as absent without adding DATA gates", async () => fixture(async ctx => {
  const result = await execute(ctx, { nonempty: true, sourceToc(c, _callback, writeToc) {
    queueMicrotask(() => { writeToc(); c.stdout.end(); setImmediate(() => { c.emit("close", 0, null); }); });
  } });
  const out = result.output[0], facts = sourceTocFacts(out);
  assert.equal(out.stage, "target"); assert.equal(result.fake.calls.includes("source-history"), true); assert.equal(result.fake.calls.includes("target-session"), true); assert.equal(result.fake.calls.includes("target-dump"), false);
  assert.equal(facts.firstRefusal, null);
  for (const name of ["spawn", "stdinCallback", "stdinFinish", "stderrEOF", "exit"]) assert.equal(facts.finalCleanup.events[name], null);
  assert.ok(facts.finalCleanup.events.stdoutEOF); assert.equal(facts.finalCleanup.events.close.code, "zero"); assert.ok(facts.finalCleanup.events.stdinDestroyRequested);
  assert.equal(facts.finalCleanup.events.killRequested, null); assert.equal(out.restoreAccepted, false);
}));
test("SourceTOC close0 cannot substitute for missing stdout EOF", async () => fixture(async ctx => {
  const result = await execute(ctx, { sourceToc(c, callback) { queueMicrotask(() => { c.emit("spawn"); callback(); c.emit("close", 0, null); c.stdout.destroy(); }); } });
  const out = result.output[0], facts = sourceTocFacts(out);
  assert.equal(out.error, "INSPECTION_NATIVE_FAILED"); assert.equal(facts.firstRefusal.state.events.stdoutEOF, null); assert.ok(facts.firstRefusal.state.events.stdoutClose);
  assert.equal(facts.finalCleanup.events.stdinFinish, null); assert.equal(facts.finalCleanup.events.stderrEOF, null); assert.equal(facts.finalCleanup.events.exit, null);
  assert.equal(result.fake.calls.includes("target-session"), false);
}));
test("SourceTOC synchronous stdin.end throws stay distinct from its callback and error event", async () => fixture(async ctx => {
  const result = await execute(ctx, { sourceToc(c) {
    // Isolate the synchronous exception from PassThrough's artificial close
    // scheduling. The separate cleanup control emits late faults/terminals.
    c.stdout.destroy = () => {}; c.stderr.destroy = () => {};
    c.emit("spawn"); throw nativeError("ERR_STREAM_DESTROYED");
  } });
  const out = result.output[0], facts = sourceTocFacts(out), before = facts.firstRefusal.state;
  // The pre-existing envelope cannot promote an arbitrary provider Error to
  // BackupError authority. The diagnostic code does not change that outcome.
  assert.equal(out.error, "INSPECTION_UNAVAILABLE"); assert.equal(facts.firstRefusal.code, out.error);
  assert.equal(before.firstError.origin, "stdinEndThrow"); assert.equal(before.firstError.code, "ERR_STREAM_DESTROYED");
  assert.equal(before.events.stdinCallback, null); assert.equal(before.events.stdinError, null); assert.ok(facts.finalCleanup.events.killRequested);
  for (const name of ["stdoutEOF", "stderrEOF", "exit", "close"]) assert.equal(facts.finalCleanup.events[name], null);
}));
test("SourceTOC synchronous spawn refusal has no invented child or terminal, and metadata getters/proxies are not read", async () => {
  let getters = 0, traps = 0;
  const accessor = Object.defineProperties(Error(CANARY), { code: { get() { getters++; throw Error(CANARY); } }, path: { get() { getters++; throw Error(CANARY); } } });
  const proxy = new Proxy(Error(CANARY), { getOwnPropertyDescriptor() { traps++; throw Error(CANARY); }, get() { traps++; throw Error(CANARY); } });
  const inherited = Object.create({ code: "ERR_STREAM_DESTROYED", message: CANARY });
  for (const sourceSpawnError of [accessor, proxy, inherited, nativeError("EPIPE")]) await fixture(async ctx => {
    const result = await execute(ctx, { sourceSpawnError }); const out = result.output[0], facts = sourceTocFacts(out), before = facts.firstRefusal.state;
    assert.equal(out.error, "INSPECTION_NATIVE_UNAVAILABLE"); assert.equal(out.sourceDiagnostic.listStarted, false);
    assert.equal(before.firstError.origin, "spawnThrow"); assert.equal(before.firstError.code, sourceSpawnError === accessor || sourceSpawnError === proxy || sourceSpawnError === inherited ? "unavailable" : "EPIPE");
    assert.ok(before.events.spawnRequested); assert.equal(result.fake.children["source-toc"], undefined);
    for (const name of ["spawn", "stdinEndRequested", "stdinCallback", "stdinFinish", "stdinError", "exit", "close", "killRequested"]) assert.equal(facts.finalCleanup.events[name], null);
    assert.equal(result.fake.calls.includes("target-session"), false);
  });
  assert.equal(getters, 0); assert.equal(traps, 0);
});
test("SourceTOC diagnostic does not add getter reads to the unchanged stdin error qualifier", async () => fixture(async ctx => {
  let reads = 0;
  const input = Object.defineProperty(Error(CANARY), "code", { get() { reads++; return "ECONNRESET"; } });
  const result = await execute(ctx, { sourceToc(c, callback) { queueMicrotask(() => { c.emit("spawn"); callback(input); }); } });
  const out = result.output[0], facts = sourceTocFacts(out);
  assert.equal(reads, 1); assert.equal(out.error, "INSPECTION_INPUT_FAILED"); assert.equal(facts.firstRefusal.state.events.stdinCallback.code, "unavailable"); assert.equal(facts.firstRefusal.state.events.stdinCallback.outcome, "error");
}));
test("SourceTOC child/stdout/stderr errors remain original refusals even when their diagnostic code is EPIPE", async () => {
  for (const origin of ["childError", "stdoutError", "stderrError"]) await fixture(async ctx => {
    const result = await execute(ctx, { sourceToc(c) { queueMicrotask(() => { c.emit("spawn"); (origin === "childError" ? c : origin === "stdoutError" ? c.stdout : c.stderr).emit("error", nativeError("EPIPE")); c.emit("exit", 0, null); c.emit("close", 0, null); }); } });
    const out = result.output[0], facts = sourceTocFacts(out);
    assert.equal(out.error, origin === "childError" ? "INSPECTION_NATIVE_UNAVAILABLE" : "INSPECTION_NATIVE_FAILED"); assert.equal(facts.firstRefusal.code, out.error);
    assert.equal(facts.firstRefusal.state.firstError.origin, origin); assert.equal(facts.firstRefusal.state.firstError.code, "EPIPE");
    assert.equal(facts.firstRefusal.state.events.exit, null); assert.equal(facts.finalCleanup.events.exit.code, "zero"); assert.equal(out.restoreAccepted, false);
    assert.equal(result.fake.calls.includes("target-session"), false);
  });
});
test("SourceTOC stderr diagnostic cannot invoke provider accessor/proxy metadata", async () => {
  let reads = 0;
  const accessor = Object.defineProperty(Error(CANARY), "code", { get() { reads++; throw Error(CANARY); } });
  const proxy = new Proxy(Error(CANARY), { getOwnPropertyDescriptor() { reads++; throw Error(CANARY); }, get() { reads++; throw Error(CANARY); } });
  for (const error of [accessor, proxy]) await fixture(async ctx => {
    const result = await execute(ctx, { sourceToc(c) { queueMicrotask(() => { c.emit("spawn"); c.stderr.emit("error", error); }); } });
    const facts = sourceTocFacts(result.output[0]); assert.equal(facts.firstRefusal.state.events.stderrError.code, "unavailable"); assert.equal(result.output[0].error, "INSPECTION_NATIVE_FAILED");
  });
  assert.equal(reads, 0);
});
test("SourceTOC sequence storage is bounded and retains the first observed EPIPE before a later refusal", async () => fixture(async ctx => {
  const result = await execute(ctx, { sourceToc(c) { queueMicrotask(() => { c.emit("spawn"); for (let index = 0; index < 80; index++) c.stdin.emit("error", nativeError("EPIPE")); c.stdin.emit("error", nativeError("ERR_STREAM_DESTROYED")); }); } });
  const out = result.output[0], facts = sourceTocFacts(out);
  assert.equal(out.error, "INSPECTION_INPUT_FAILED"); assert.equal(facts.firstRefusal.state.overflow, true); assert.equal(facts.finalCleanup.sequence, 64);
  assert.equal(facts.firstRefusal.state.firstError.code, "EPIPE"); assert.equal(facts.firstRefusal.state.events.stdinError.code, "EPIPE");
  assert.equal(facts.firstRefusal.state.lastError.code, "ERR_STREAM_DESTROYED"); assert.equal(facts.firstRefusal.state.lastError.origin, "stdinError");
  assert.equal(facts.finalCleanup.events.stdinCallback, null); assert.equal(out.restoreAccepted, false);
}));
test("target nonempty gate remains before dump even after source authentication", async () => fixture(async ctx => {
  const result = await execute(ctx, { nonempty: true }); assert.equal(result.exit, 1); assert.equal(result.fake.calls.includes("source-history"), true); assert.equal(result.fake.calls.includes("target-dump"), false); assert.equal(result.output[0].stage, "target");
}));
test("target COPY rows must match its own exported snapshot before comparing", async () => fixture(async ctx => {
  const result = await execute(ctx, { historyCountMismatch: true }); assert.equal(result.exit, 1); assert.equal(result.output[0].error, "INSPECTION_SNAPSHOT_CHANGED"); assert.equal(result.output[0].stage, "target_history"); assert.equal(result.output[0].comparisonCompleted, false);
}));
test("original history failures refuse instead of publishing partial comparison", async () => fixture(async ctx => {
  const result = await execute(ctx, { historyExit: "target-history" }); assert.equal(result.exit, 1); assert.equal(result.output[0].comparisonCompleted, false); assert.equal(Object.hasOwn(result.output[0], "comparison"), false); assert.deepEqual(await readdir(ctx.directory), ["fixture.scbackup"]);
}));
test("late source history fault during cleanup cannot be hidden by a later successful target", async () => fixture(async ctx => {
  const result = await execute(ctx, { cleanupFault: "source-history" }); assert.equal(result.exit, 1); assert.equal(result.fake.calls.includes("target-session"), false); assert.equal(result.output[0].comparisonCompleted, false);
}));
test("one absolute deadline covers both acquisitions and no new result appears after expiry", async () => fixture(async ctx => {
  const result = await execute(ctx, { timeoutMs: 100, listDelayMs: 130 }); assert.equal(result.exit, 1); assert.equal(result.fake.calls.includes("target-session"), false); await new Promise(yes => setTimeout(yes, 80)); assert.equal(result.output.length, 1); assert.equal(result.output[0].restoreAccepted, false);
}));
test("combined CLI requires exactly one absolute archive and never accepts an extra mode", async () => {
  for (const argv of [["inspect-baseline"], ["inspect-baseline", "relative.scbackup"], ["inspect-baseline", resolve("DO_NOT_OPEN"), "extra"]]) { const output = []; assert.equal(await runManagedInspect(argv, {}, value => output.push(value)), 1); assert.equal(output[0].comparisonCompleted, false); assert.equal(output[0].restoreAccepted, false); }
});
