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
  const calls = [], chunks = [], borrowed = [], children = {}; let session, nonce;
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
      const c = child(); c.stdin.destroy = () => {};
      c.stdin.end = (bytes, callback) => {
        const source = hash(bytes) === hash(ctx.vectors.source.database), label = source ? "source-toc" : "target-toc"; children[label] = c; calls.push(label); borrowed.push(bytes);
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
    assert.equal(JSON.stringify(out).includes("ECONNRESET"), false); assert.equal(JSON.stringify(out).includes("EPIPE"), false);
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
