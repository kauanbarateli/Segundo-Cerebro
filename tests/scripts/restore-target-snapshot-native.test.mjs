import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { resolve } from "node:path";
import { inspect } from "node:util";
import { readNativeTargetSnapshot, nativeTargetSnapshotFacts, copyNativeTargetSnapshot, discardNativeTargetSnapshot, nativeTargetSnapshotDiagnostic, TARGET_SNAPSHOT_NATIVE_PROJECT, TARGET_SNAPSHOT_NATIVE_ERROR_CODES } from "../../scripts/operations/restore-target-snapshot-native.mjs";

// Artificial RAM only: no database, profile, filesystem, executable or network.
const CANARY = "PRIVATE_TARGET_SNAPSHOT_CANARY";
const DUMP = Buffer.from("PGDMP_ARTIFICIAL_" + CANARY);
function startFrame(nonce) {
  const relation = (oid, schema, name, rows) => ({ oid, schemaOid: schema === "auth" ? 10 : 20, schema, name, kind: "r", extensionMember: false, extensionConfig: false, isPartition: false, hasInheritance: false, rowSecurityActive: false, rows });
  return { version: 1, kind: "target-snapshot-start", nonce, snapshotId: "00000001-00000001-1", databaseName: "postgres", actor: "postgres", sessionActor: "postgres", readOnly: true, isolation: "repeatable read", rowSecurityOff: true, rlsBypass: true, catalogueComplete: true, catalogueCount: 3, schemas: [{ name: "auth", oid: 10 }, { name: "storage", oid: 20 }, { name: "public", oid: 30 }, { name: "app_private", oid: null }], relations: [relation(100, "auth", "schema_migrations", 82), relation(101, "auth", "users", 0), relation(102, "storage", "migrations", 73)] };
}
function scenario(control = {}) {
  let expired = false, rejectDeadline, closeCalls = 0, nonce, session, dumped = false;
  const deadline = new Promise((_yes, no) => { rejectDeadline = no; }); deadline.catch(() => {});
  const scope = { check() { if (expired) throw Error(CANARY); }, remaining() { this.check(); return 45000; }, race(value) { return Promise.race([value, deadline]); }, close() { closeCalls++; } };
  const expire = () => { expired = true; rejectDeadline(Error(CANARY)); };
  const children = [], calls = [], buffers = [];
  const options = { projectRef: TARGET_SNAPSHOT_NATIVE_PROJECT, psql: resolve("RAM/psql.exe"), pgDump: resolve("RAM/pg_dump.exe"), environment: { PGHOST: "db." + TARGET_SNAPSHOT_NATIVE_PROJECT + ".supabase.co", PGPORT: "5432", PGDATABASE: "postgres", PGUSER: "postgres", PGPASSWORD: CANARY, PGSSLMODE: "require" } };
  function spawn(executable, argv, settings) {
    const isSession = executable === options.psql;
    calls.push(isSession ? "session" : "dump");
    assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true);
    assert.equal(JSON.stringify(argv).includes(CANARY), false);
    assert.equal(settings.env.PGPASSWORD, CANARY);
    if (!isSession) {
      assert.equal(session.exited ?? false, false); assert.equal(session.stdout.readableEnded, false);
      assert.deepEqual(argv, ["--no-password", "--format=custom", "--compress=gzip", "--schema=auth", "--schema=public", "--schema=app_private", "--schema=storage", "--snapshot=00000001-00000001-1"]);
      assert.equal(control.invalidStart, undefined);
    } else assert.deepEqual(argv, ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--file=-"]);
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new EventEmitter();
    child.kill = () => { calls.push("kill"); return true; }; child.unref = () => {}; child.stdin.destroy = () => {};
    const terminal = (code = 0) => {
      child.stdout.end(); child.stderr.end();
      // close is an original process event following both original EOFs.
      setImmediate(() => { if (!control.noExit || isSession) { child.exited = true; child.emit("exit", code, null); } if (!control.noClose || isSession) child.emit("close", code, null); });
    };
    child.stdin.write = (sql, callback) => {
      calls.push("begin"); nonce = /'nonce','([a-f0-9]{32})'/.exec(sql)?.[1]; assert.equal(nonce?.length, 32);
      queueMicrotask(() => {
        if (!control.noSpawn) child.emit("spawn");
        const frame = startFrame(nonce); if (control.invalidStart) control.invalidStart(frame);
        if (control.startCallbackError) callback(Error(CANARY)); else if (!control.noStartCallback) callback();
        const bytes = Buffer.from(JSON.stringify(frame) + (control.crlf ? "\r\n" : "\n")); buffers.push(bytes);
        if (control.splitFrame) { child.stdout.write(bytes.subarray(0, 11)); child.stdout.write(bytes.subarray(11)); } else child.stdout.write(bytes);
        if (control.earlyEof) child.stdout.end();
        if (control.extraStart) child.stdout.write(bytes);
        if (control.partialAfterStart) child.stdout.write("X");
        if (control.expireStart) setImmediate(expire);
      }); return true;
    };
    child.stdin.end = (sql, callback) => {
      calls.push("commit"); assert.equal(dumped, true); assert.match(sql, /COMMIT;/); assert.match(sql, /\\quit/);
      queueMicrotask(() => {
        const end = { version: 1, kind: "target-snapshot-end", nonce, committed: true, databaseName: "postgres", actor: "postgres", sessionActor: "postgres" };
        if (control.invalidEnd) control.invalidEnd(end);
        if (control.endError) child.stdin.emit("error", Error(CANARY));
        if (!control.noFinish) child.stdin.emit("finish");
        if (!control.noEndCallback) callback(control.endCallbackError ? Error(CANARY) : undefined);
        child.stdout.write(JSON.stringify(end) + "\n"); terminal(control.sessionCode ?? 0);
        if (control.expireEnd) setImmediate(expire);
      });
    };
    if (isSession) session = child;
    else queueMicrotask(() => {
      if (!control.noDumpSpawn) child.emit("spawn");
      const bytes = Buffer.from(control.dump ?? DUMP); buffers.push(bytes); child.stdout.write(bytes); dumped = true;
      if (control.exporterExitDuringDump) session.emit("exit", 0, null);
      if (control.dumpError) child.emit("error", Error(CANARY));
      if (control.stderr) child.stderr.write(control.stderr);
      terminal(control.dumpCode ?? 0);
      if (control.expireDump || control.noExit || control.noClose) setImmediate(expire);
    });
    children.push(child); return child;
  }
  return { options, scope, ports: { spawn }, calls, children, buffers, expire, get closeCalls() { return closeCalls; } };
}
async function reject(s, suffix) {
  let captured;
  await assert.rejects(readNativeTargetSnapshot(s.options, s.scope, s.ports), error => {
    captured = error; assert.equal(error.code, "RESTORE_TARGET_SNAPSHOT_NATIVE_" + suffix); assert.equal(error.message, error.code);
    for (const text of [error.stack, JSON.stringify(error), inspect(error)]) assert.equal(text.includes(CANARY), false);
    assert.equal(Object.hasOwn(error, "cause"), false); return true;
  });
  assert.equal(s.closeCalls, 0); return nativeTargetSnapshotDiagnostic(captured);
}
const turn = () => new Promise(yes => setImmediate(yes));

test("synthetic receipt binds one CUSTOM dump to a held readonly snapshot with original terminals", async () => {
  for (const splitFrame of [false, true]) {
    const s = scenario({ splitFrame, crlf: true }); const receipt = await readNativeTargetSnapshot(s.options, s.scope, s.ports);
    assert.deepEqual(receipt, {}); assert.equal(Object.isFrozen(receipt), true);
    const facts = nativeTargetSnapshotFacts(receipt), bytes = copyNativeTargetSnapshot(receipt);
    assert.equal(facts.mode, "synthetic"); assert.equal(facts.restoreAccepted, false); assert.equal(facts.snapshot.allOtherTableDataEmpty, true);
    assert.equal(facts.snapshot.authHistoryRows, 82); assert.equal(facts.snapshot.storageHistoryRows, 73);
    assert.deepEqual([...bytes], [...DUMP]); assert.deepEqual(s.calls, ["session", "begin", "dump", "commit"]);
    assert.equal(facts.psql.inputCallbacks, 2); assert.equal(facts.psql.stdinFinishObserved, true);
    for (const r of [facts.psql, facts.dump]) for (const key of ["spawnObserved", "stdoutEofObserved", "stderrEofObserved", "producerExitZero", "producerCloseZero"]) assert.equal(r[key], true);
    assert.equal(JSON.stringify(facts).includes(CANARY), false); assert.equal(Object.hasOwn(facts, "snapshotId"), false); assert.equal(s.closeCalls, 0);
    assert.throws(() => copyNativeTargetSnapshot(receipt), { code: "RESTORE_TARGET_SNAPSHOT_NATIVE_COPY_CLAIMED" });
    discardNativeTargetSnapshot(receipt); discardNativeTargetSnapshot(receipt); assert.equal(bytes.every(b => b === 0), true);
    assert.throws(() => nativeTargetSnapshotFacts(receipt), { code: "RESTORE_TARGET_SNAPSHOT_NATIVE_DISCARDED" });
  }
});
test("foreign refs, transaction pooler, unknown env, proxies and accessors refuse before spawn", async () => {
  for (const mutate of [s => { s.options.projectRef = "rishenjoikgmfubmnfiu"; }, s => { s.options.environment.PGPORT = "6543"; }, s => { s.options.environment.PGOPTIONS = CANARY; }, s => { s.options.environment.PGHOST = "db.foreign.supabase.co"; }]) {
    const s = scenario(); mutate(s); await assert.rejects(readNativeTargetSnapshot(s.options, s.scope, s.ports)); assert.equal(s.children.length, 0);
  }
  let touched = 0; const s = scenario(), poison = new Proxy({}, { ownKeys() { touched++; throw Error(CANARY); } });
  await assert.rejects(readNativeTargetSnapshot(poison, s.scope, s.ports), { code: "RESTORE_TARGET_SNAPSHOT_NATIVE_INPUT_INVALID" });
  Object.defineProperty(s.options, "psql", { enumerable: true, get() { touched++; throw Error(CANARY); } });
  await reject(s, "INPUT_INVALID"); assert.equal(touched, 0);
  assert.equal(nativeTargetSnapshotDiagnostic(poison), null); assert.equal(Object.isFrozen(TARGET_SNAPSHOT_NATIVE_ERROR_CODES), true);
});
test("nonempty table, role and RLS frame refusals stop before pg_dump", async () => {
  for (const [mutate, expected] of [[f => { f.relations[1].rows = 1; }, "TARGET_NOT_EMPTY"], [f => { f.actor = "anon"; }, "ACTOR_REFUSED"], [f => { f.rlsBypass = false; }, "RLS_REFUSED"]]) {
    const s = scenario({ invalidStart: mutate }); const diagnostic = await reject(s, "PROTOCOL_REFUSED");
    assert.equal(diagnostic.phase, "snapshot_start"); assert.equal(diagnostic.protocolError, "RESTORE_TARGET_SNAPSHOT_" + expected); assert.equal(s.calls.includes("dump"), false); assert.equal(s.calls.includes("commit"), false);
  }
});
test("early EOF, extra start line or exporter exit during dump invalidates held snapshot", async () => {
  for (const control of [{ earlyEof: true }, { extraStart: true }, { partialAfterStart: true }, { exporterExitDuringDump: true }]) {
    const s = scenario(control); await assert.rejects(readNativeTargetSnapshot(s.options, s.scope, s.ports)); assert.equal(s.calls.includes("commit"), false);
  }
});
test("start write callback and spawn evidence are mandatory", async () => {
  for (const [control, code] of [[{ startCallbackError: true }, "INPUT_FAILED"], [{ noStartCallback: true, expireStart: true }, "TIMEOUT"], [{ noSpawn: true }, "PRODUCER_FAILED"]]) await reject(scenario(control), code);
});
test("pg_dump needs original spawn, both EOFs, exit and close zero before COMMIT", async () => {
  for (const [control, code] of [[{ noDumpSpawn: true }, "PRODUCER_FAILED"], [{ dumpCode: 1 }, "PRODUCER_FAILED"], [{ dumpError: true }, "PRODUCER_FAILED"], [{ noExit: true }, "PRODUCER_FAILED"], [{ noClose: true }, "TIMEOUT"], [{ dump: "plain text" }, "PROTOCOL_REFUSED"]]) {
    const s = scenario(control); await reject(s, code); assert.equal(s.calls.includes("commit"), false);
  }
});
test("COMMIT frame cannot replace input finish/callback, EOFs or process success", async () => {
  for (const [control, code] of [[{ noFinish: true }, "PRODUCER_FAILED"], [{ noEndCallback: true }, "PRODUCER_FAILED"], [{ endError: true }, "INPUT_FAILED"], [{ endCallbackError: true }, "INPUT_FAILED"], [{ sessionCode: 1 }, "PRODUCER_FAILED"], [{ invalidEnd: f => { f.nonce = "0".repeat(32); } }, "PROTOCOL_REFUSED"]]) await reject(scenario(control), code);
});
test("late original events revoke and wipe dedicated retained copy", async () => {
  for (const [late, expected] of [[s => s.children[0].emit("error", Error(CANARY)), "PRODUCER_FAILED"], [s => s.children[1].stdout.emit("data", Buffer.from("late")), "PRODUCER_FAILED"], [s => s.children[1].emit("close", 0, null), "PRODUCER_FAILED"], [s => s.children[0].stdin.emit("error", Error(CANARY)), "INPUT_FAILED"]]) {
    const s = scenario(), receipt = await readNativeTargetSnapshot(s.options, s.scope, s.ports), bytes = copyNativeTargetSnapshot(receipt);
    late(s); assert.throws(() => nativeTargetSnapshotFacts(receipt), { code: "RESTORE_TARGET_SNAPSHOT_NATIVE_" + expected }); assert.equal(bytes.every(b => b === 0), true); discardNativeTargetSnapshot(receipt);
  }
});
test("copied dump mutation and original scope expiry revoke without renewing scope", async () => {
  for (const mutate of [false, true]) {
    const s = scenario(), receipt = await readNativeTargetSnapshot(s.options, s.scope, s.ports), bytes = copyNativeTargetSnapshot(receipt);
    if (mutate) bytes[5] ^= 1; else s.expire();
    assert.throws(() => nativeTargetSnapshotFacts(receipt), { code: "RESTORE_TARGET_SNAPSHOT_NATIVE_" + (mutate ? "INTEGRITY_FAILED" : "TIMEOUT") });
    assert.equal(bytes.every(b => b === 0), true); assert.equal(s.closeCalls, 0); discardNativeTargetSnapshot(receipt);
  }
  await turn();
});
test("original private stream chunks are zeroed after success and refusal", async () => {
  for (const invalidStart of [undefined, f => { f.relations[1].rows = 1; }]) {
    const s = scenario({ invalidStart }); let receipt;
    if (invalidStart) await reject(s, "PROTOCOL_REFUSED"); else receipt = await readNativeTargetSnapshot(s.options, s.scope, s.ports);
    assert.equal(s.buffers.every(b => b.every(v => v === 0)), true);
    if (receipt) discardNativeTargetSnapshot(receipt);
  }
});
test("duplicate stream close and stdin close remain sticky after receipt", async () => {
  for (const which of ["stdout", "stderr", "stdin"]) {
    const s = scenario(), receipt = await readNativeTargetSnapshot(s.options, s.scope, s.ports), bytes = copyNativeTargetSnapshot(receipt), stream = s.children[0][which];
    if (which === "stdin") stream.emit("close");
    stream.emit("close");
    assert.throws(() => nativeTargetSnapshotFacts(receipt), { code: "RESTORE_TARGET_SNAPSHOT_NATIVE_" + (which === "stdin" ? "INPUT_FAILED" : "PRODUCER_FAILED") });
    assert.equal(bytes.every(b => b === 0), true); discardNativeTargetSnapshot(receipt);
  }
});
test("stderr quota refuses without disclosing or retaining private original bytes", async () => {
  const s = scenario({ stderr: Buffer.alloc(65537, 65) }); await reject(s, "OUTPUT_LIMIT"); assert.equal(s.calls.includes("commit"), false);
});
