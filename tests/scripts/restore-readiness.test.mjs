import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { runRestoreReadiness } from "../../scripts/operations/restore-readiness.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { EMPTY_TARGET_SQL, MANAGED_OWNER_PREFLIGHT_SQL } from "../../scripts/operations/restore-target.mjs";

const ref = "abcdefghijklmnopqrst", canary = "PRIVATE_CANARY_NEVER_PRINT";
const env = { SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + canary, SC_RESTORE_PG_RESTORE: resolve("fake-pg_restore"), SC_RESTORE_PSQL: resolve("fake-psql"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: canary, SC_RESTORE_PGSSLMODE: "require" };
const owners = overrides => ({ version: 1, serverVersionNum: 170011, sameActor: true, isSuperuser: false, schemas: 2, schemaOwnerAvailable: 2, schemaOwnerUnavailable: 0, tables: 35, tableOwnerAvailable: 35, tableOwnerUnavailable: 0, tableDropOwnerOrSchemaAvailable: 35, tableDropOwnerOrSchemaUnavailable: 0, ...overrides });
const result = async (query, selectedEnv = env, argv = ["restore-preflight"]) => { const output = []; const exit = await runRestoreReadiness(argv, selectedEnv, value => output.push(value), { query }); return { exit, output }; };

test("preflight uses only the two canonical readonly queries and preserves a necessary-only result", async () => {
  const calls = [];
  const { exit, output } = await result(async (request, options) => { calls.push([request, options]); return request.sql === EMPTY_TARGET_SQL ? { empty: true } : owners(); });
  assert.equal(exit, 0); assert.equal(output.length, 1); assert.equal(output[0].ok, true);
  assert.deepEqual(calls, [[{ sql: EMPTY_TARGET_SQL }, { timeoutMs: 15000 }], [{ sql: MANAGED_OWNER_PREFLIGHT_SQL }, { timeoutMs: 15000 }]]);
  assert.deepEqual(output[0].managedOwners, owners());
  for (const field of ["archiveRead", "remoteMutation", "restoreAccepted", "historicalCauseEstablished"]) assert.equal(output[0][field], false);
  assert.equal(JSON.stringify(output).includes(canary), false);
});
test("current owner refusal keeps validated counts without authorizing a full restore or claiming historical cause", async () => {
  const refused = owners({ schemaOwnerAvailable: 0, schemaOwnerUnavailable: 2, tableOwnerAvailable: 0, tableOwnerUnavailable: 35, tableDropOwnerOrSchemaAvailable: 0, tableDropOwnerOrSchemaUnavailable: 35 });
  const { exit, output } = await result(async request => request.sql === EMPTY_TARGET_SQL ? { empty: true } : refused);
  assert.equal(exit, 1); assert.equal(output[0].error, "RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED"); assert.deepEqual(output[0].managedOwners, refused); assert.equal(output[0].restoreAccepted, false); assert.equal(output[0].historicalCauseEstablished, false);
});
test("nonempty target stops before querying owners; personal or unconfirmed targets and archive arguments stop before any query", async () => {
  let calls = 0; const query = async () => { calls++; return { empty: false }; };
  const nonempty = await result(query); assert.equal(nonempty.output[0].error, "RESTORE_TARGET_NOT_EMPTY"); assert.equal(calls, 1);
  for (const [selectedEnv, argv] of [[{ ...env, SC_RESTORE_PROJECT_REF: PERSONAL_REF, SC_RESTORE_CONFIRM_PROJECT: PERSONAL_REF }, ["restore-preflight"]], [{ ...env, SC_RESTORE_CONFIRM_PROJECT: "different" }, ["restore-preflight"]], [env, ["restore-preflight", "private.scbackup"]], [env, ["restore"]]]) {
    const refused = await result(query, selectedEnv, argv); assert.equal(refused.exit, 1); assert.equal(refused.output[0].managedOwners, null); assert.equal(calls, 1);
  }
});
test("malformed/getter/extra reports never enter output or invoke report getters", async () => {
  let getters = 0;
  const emptyGetter = { get empty() { getters++; return true; } };
  const ownerGetter = owners(); Object.defineProperty(ownerGetter, "tables", { enumerable: true, get() { getters++; throw new Error(canary); } });
  for (const [empty, managed] of [[emptyGetter, owners()], [{ empty: true, secret: canary }, owners()], [{ empty: true }, { ...owners(), secret: canary }], [{ empty: true }, ownerGetter], [{ empty: true }, owners({ tables: canary })], [{ empty: true }, owners({ tableOwnerAvailable: 34 })]]) {
    const { exit, output } = await result(async request => request.sql === EMPTY_TARGET_SQL ? empty : managed);
    assert.equal(exit, 1); assert.equal(output[0].managedOwners, null); assert.equal(JSON.stringify(output).includes(canary), false);
  }
  assert.equal(getters, 0);
});
test("transport failures, credentials and arbitrary exception text produce only closed errors", async () => {
  for (const error of [new BackupError("PSQL_TIMEOUT"), new BackupError(canary), new Error(canary)]) {
    const { exit, output } = await result(async () => { throw error; }); assert.equal(exit, 1); assert.equal(JSON.stringify(output).includes(canary), false); assert.equal(output[0].targetEmpty, null); assert.equal(output[0].managedOwners, null);
  }
});
test("actual psql transport selects only a readonly SQL argv and credential env; no restore child or HTTP is provided", async () => {
  const children = [], output = [];
  const spawn = (executable, args, options) => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    children.push({ executable, args, options });
    queueMicrotask(() => { child.stderr.end(canary); child.stdout.end(JSON.stringify(children.length === 1 ? { empty: true } : owners())); child.emit("close", 0); });
    return child;
  };
  assert.equal(await runRestoreReadiness(["restore-preflight"], env, value => output.push(value), { spawn }), 0);
  assert.equal(children.length, 2);
  for (const child of children) { assert.equal(child.executable, env.SC_RESTORE_PSQL); assert.equal(child.options.env.PGPASSWORD, canary); assert.equal(child.options.shell, false); assert.equal(JSON.stringify(child.args).includes(canary), false); assert.equal(child.args.includes("--set=ON_ERROR_STOP=1"), true); assert.equal(child.args.some(arg => arg.startsWith("--command=begin transaction")), true); }
  assert.equal(JSON.stringify(output).includes(canary), false);
});
