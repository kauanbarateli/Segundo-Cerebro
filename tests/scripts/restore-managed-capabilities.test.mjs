import test, { after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { MANAGED_CAPABILITIES_SQL, MANAGED_CAPABILITIES_TIMEOUT_MS, validateManagedCapabilities, runManagedCapabilities } from "../../scripts/operations/restore-managed-capabilities.mjs";

const canary = "PRIVATE_CANARY_NEVER_PRINT", ref = "abcdefghijklmnopqrst";
const env = { SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + canary, SC_RESTORE_PG_RESTORE: resolve("synthetic-pg_restore"), SC_RESTORE_PSQL: resolve("synthetic-psql"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: canary, SC_RESTORE_PGSSLMODE: "require" };
const report = overrides => ({ version: 1, serverVersionNum: 170011, sameActor: true, isSuperuser: false, isBypassRls: false, canSetSessionReplicationRole: false, schemas: 2, schemaOwnerImmediate: 0, schemaOwnerSet: 0, schemaUsage: 2, tables: 35, tableOwnerImmediate: 0, tableOwnerSet: 0, tableSelect: 35, tableInsert: 35, tableRlsEnabled: 3, tableRlsForced: 1, tableRlsActive: 3, tableRlsEnabledInactive: 0, authUsersPresent: true, authUsersTrigger: true, authUsersOwnerImmediate: false, authUsersOwnerSet: false, authCustomTriggersPresent: 0, storagePolicyTables: 2, storagePolicyOwnerImmediate: 0, storagePolicyOwnerSet: 0, storageCustomPoliciesPresent: 0, ...overrides });
const result = async (query, selectedEnv = env, argv = ["check"]) => { const output = []; const exit = await runManagedCapabilities(argv, selectedEnv, value => output.push(value), { query }); return { exit, output }; };
const rejected = value => assert.throws(() => validateManagedCapabilities(value), { code: "RESTORE_MANAGED_CAPABILITIES_REPORT_INVALID" });
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw new Error("EXTERNAL_NETWORK_FORBIDDEN"); };
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });

test("import is inert with child spawning and HTTP forbidden in a separate Node process", () => {
  const moduleUrl = new URL("../../scripts/operations/restore-managed-capabilities.mjs", import.meta.url).href;
  const script = "import cp from 'node:child_process';import https from 'node:https';import{syncBuiltinESMExports}from'node:module';let calls=0;const refuse=()=>{calls++;throw Error('FORBIDDEN')};cp.spawn=refuse;https.request=refuse;syncBuiltinESMExports();globalThis.fetch=refuse;await import(" + JSON.stringify(moduleUrl) + ");if(calls!==0)throw Error('IMPORT_ACTIVE');process.stdout.write('IMPORT_INERT');";
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { SystemRoot: process.env.SystemRoot }, shell: false, windowsHide: true, timeout: 10000, encoding: "utf8" });
  assert.equal(child.status, 0); assert.equal(child.stdout, "IMPORT_INERT"); assert.equal(child.stderr, "");
});

test("descriptor projection copies only exact scalar fields and does not turn SET membership into immediate authority", () => {
  const input = report({ schemaOwnerSet: 2, tableOwnerSet: 35, authUsersOwnerSet: true, storagePolicyOwnerSet: 2 });
  const value = validateManagedCapabilities(input);
  assert.notEqual(value, input); assert.equal(Object.getPrototypeOf(value), null); assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(JSON.parse(JSON.stringify(value)), input);
  assert.equal(value.tableOwnerImmediate, 0); assert.equal(value.tableOwnerSet, 35);
  input.tableOwnerSet = 0; assert.equal(value.tableOwnerSet, 35);
  // Inherit-only membership can be available immediately without SET.
  assert.equal(validateManagedCapabilities(report({ schemaOwnerImmediate: 2, tableOwnerImmediate: 35, authUsersOwnerImmediate: true, storagePolicyOwnerImmediate: 2, tableRlsActive: 1, tableRlsEnabledInactive: 2 })).tableOwnerSet, 0);
  // A TRIGGER grant alone does not imply ownership or policy authority.
  assert.equal(validateManagedCapabilities(report()).authUsersTrigger, true);
});

test("accessors, symbols, nonenumerable fields, inherited fields and hostile traps are refused without invoking getters", () => {
  let getters = 0;
  for (const field of Object.keys(report())) {
    const input = report(); Object.defineProperty(input, field, { enumerable: true, get() { getters++; throw new Error(canary); } }); rejected(input);
    const hidden = report(); Object.defineProperty(hidden, field, { value: hidden[field], enumerable: false }); rejected(hidden);
    const missing = report(); delete missing[field]; rejected(missing);
  }
  const inherited = Object.create(report()); rejected(inherited);
  rejected({ ...report(), privateRole: canary }); rejected({ ...report(), [Symbol("private")]: canary });
  const jsonGetter = report(); Object.defineProperty(jsonGetter, "toJSON", { get() { getters++; throw new Error(canary); } }); rejected(jsonGetter);
  rejected(new Proxy({}, { ownKeys() { throw new Error(canary); } }));
  assert.equal(getters, 0);
});

test("versions, bounds, booleans and every proven count relation fail closed without coercion", () => {
  for (const value of [null, [], 1, canary, { ...report(), version: 2 }, { ...report(), serverVersionNum: 150019 }, { ...report(), serverVersionNum: 1000000 }]) rejected(value);
  for (const [field, value] of Object.entries(report())) {
    if (typeof value === "boolean") for (const bad of [0, 1, "true", null, undefined]) rejected({ ...report(), [field]: bad });
    if (typeof value === "number") for (const bad of [-1, NaN, Infinity, 1.5, "1", null, undefined]) rejected({ ...report(), [field]: bad });
  }
  for (const change of [
    { schemas: 3 }, { schemaOwnerImmediate: 3 }, { schemaOwnerSet: 3 }, { schemaUsage: 3 },
    { tables: 100001 }, { tableOwnerImmediate: 36 }, { tableOwnerSet: 36 }, { tableSelect: 36 }, { tableInsert: 36 },
    { tableRlsEnabled: 36 }, { tableRlsForced: 36 }, { tableRlsActive: 4 }, { tableRlsEnabledInactive: 1 },
    { authCustomTriggersPresent: 3 }, { storagePolicyTables: 3 }, { storagePolicyOwnerImmediate: 3 }, { storagePolicyOwnerSet: 3 }, { storageCustomPoliciesPresent: 3 },
    { authUsersPresent: false }, { authUsersOwnerImmediate: true }, { authUsersOwnerSet: true },
    { storagePolicyOwnerImmediate: 1 }, { storagePolicyOwnerSet: 1 }, { tables: 2, tableSelect: 2, tableInsert: 2, tableRlsEnabled: 2, tableRlsForced: 1, tableRlsActive: 2 },
    { schemas: 1, schemaUsage: 1 }, { isSuperuser: true }, { isBypassRls: true }
  ]) rejected(report(change));
  // FORCE is a separate flag and may remain set after RLS is disabled.
  assert.equal(validateManagedCapabilities(report({ tableRlsEnabled: 0, tableRlsForced: 1, tableRlsActive: 0 })).tableRlsForced, 1);
});

test("a valid capability report neither qualifies the entire restore nor reports arbitrary owner classifications", async () => {
  const calls = []; const { exit, output } = await result(async (request, options) => { calls.push({ request, options }); return report(); });
  assert.equal(exit, 0); assert.equal(output.length, 1); assert.deepEqual(JSON.parse(JSON.stringify(output[0])), report());
  assert.deepEqual(calls, [{ request: { sql: MANAGED_CAPABILITIES_SQL }, options: { timeoutMs: 15000 } }]); assert.equal(MANAGED_CAPABILITIES_TIMEOUT_MS, 15000);
  assert.equal(Object.values(output[0]).every(value => typeof value === "number" || typeof value === "boolean"), true);
  for (const key of ["ok", "restoreAccepted", "allManagedRestoreQualified", "owner", "oid", "acl", "ddl"]) assert.equal(Object.hasOwn(output[0], key), false);
  assert.equal(JSON.stringify(output).includes(canary), false);
});

test("help is inert; archive arguments, personal/unconfirmed targets and incomplete configuration never query", async () => {
  let calls = 0; const query = async () => { calls++; return report(); };
  for (const argv of [[], ["--help"]]) { const { exit, output } = await result(query, {}, argv); assert.equal(exit, 0); assert.deepEqual(output, [{ version: 1, readonly: true, countsOnly: true, archiveRead: false, remoteMutation: false }]); }
  for (const [selectedEnv, argv] of [[env, ["check", "private.scbackup"]], [env, ["restore"]], [env, ["--help", canary]], [env, null], [{ ...env, SC_RESTORE_PROJECT_REF: PERSONAL_REF, SC_RESTORE_CONFIRM_PROJECT: PERSONAL_REF }, ["check"]], [{ ...env, SC_RESTORE_ISOLATED: "NO" }, ["check"]], [{ ...env, SC_RESTORE_SUPABASE_KEY: "" }, ["check"]], [{ ...env, SC_RESTORE_PSQL: "relative" }, ["check"]], [{ ...env, SC_RESTORE_PGPASSWORD: "" }, ["check"]]]) {
    const { exit, output } = await result(query, selectedEnv, argv); assert.equal(exit, 1); assert.equal(output[0].ok, false); assert.equal(JSON.stringify(output).includes(canary), false);
  }
  assert.equal(calls, 0);
});

test("malformed query reports and arbitrary errors never enter output or evaluate an error code getter", async () => {
  let getters = 0; const codeGetter = new BackupError("PSQL_FAILED"); Object.defineProperty(codeGetter, "code", { get() { getters++; throw new Error(canary); } });
  for (const value of [{ ...report(), secret: canary }, report({ tables: canary }), { get version() { getters++; throw new Error(canary); } }]) {
    const { exit, output } = await result(async () => value); assert.equal(exit, 1); assert.equal(output[0].error, "RESTORE_MANAGED_CAPABILITIES_REPORT_INVALID"); assert.equal(JSON.stringify(output).includes(canary), false);
  }
  for (const error of [new BackupError("PSQL_TIMEOUT"), new BackupError(canary), new Error(canary), codeGetter]) {
    const { exit, output } = await result(async () => { throw error; }); assert.equal(exit, 1); assert.equal(Object.keys(output[0]).sort().join(","), "error,ok"); assert.equal(JSON.stringify(output).includes(canary), false);
  }
  assert.equal(getters, 0);
});

test("the original psql transport receives one fixed readonly SQL query, hidden child and no credential argv", async () => {
  const children = [], output = [];
  const spawn = (executable, args, options) => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    children.push({ executable, args, options });
    queueMicrotask(() => { child.stderr.end(canary); child.stdout.end(JSON.stringify(report())); child.emit("close", 0); });
    return child;
  };
  assert.equal(await runManagedCapabilities(["check"], env, value => output.push(value), { spawn }), 0);
  assert.equal(children.length, 1); const child = children[0]; assert.equal(child.executable, env.SC_RESTORE_PSQL); assert.equal(child.options.env.PGPASSWORD, canary);
  assert.equal(child.options.shell, false); assert.equal(child.options.windowsHide, true); assert.equal(JSON.stringify(child.args).includes(canary), false);
  assert.equal(child.args.includes("--command=" + MANAGED_CAPABILITIES_SQL), true); assert.equal(child.args.includes("--no-psqlrc"), true); assert.equal(child.args.includes("--set=ON_ERROR_STOP=1"), true);
  assert.equal(JSON.stringify(output).includes(canary), false);
});

async function fixture({ membership = "none", bypass = false, parameter = false, custom = false, disableRls = false, missingBucket = false } = {}) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role cap_owner nologin;
      create role cap_actor nologin ${bypass ? "bypassrls" : "nobypassrls"};
      create schema auth authorization cap_owner; create schema storage authorization cap_owner;
      create table auth.users (id integer); create table auth.other (id integer);
      create table storage.objects (id integer); create table storage.buckets (id integer);
      alter table auth.users owner to cap_owner; alter table auth.other owner to cap_owner;
      alter table storage.objects owner to cap_owner; alter table storage.buckets owner to cap_owner;
      alter table auth.users enable row level security; alter table auth.users force row level security;
      alter table storage.objects enable row level security; alter table storage.buckets enable row level security;
      grant usage on schema auth,storage to cap_actor;
      grant select,insert on auth.users,auth.other,storage.objects,storage.buckets to cap_actor;
      grant trigger on auth.users to cap_actor;
    `);
    if (membership === "set") await db.exec("grant cap_owner to cap_actor with inherit false, set true");
    if (membership === "inherit") await db.exec("grant cap_owner to cap_actor with inherit true, set false");
    if (parameter) await db.exec("grant set on parameter session_replication_role to cap_actor");
    if (custom) {
      // Presence is deliberately independent of definition or enabled state.
      await db.exec(`
        create function auth.fixture_trigger() returns trigger language plpgsql as $$begin return new;end$$;
        create trigger second_brain_identity_created after insert on auth.users for each row execute function auth.fixture_trigger();
        create constraint trigger second_brain_admin_creation_final after insert on auth.users deferrable initially deferred for each row execute function auth.fixture_trigger();
        alter table auth.users disable trigger second_brain_identity_created;
        create policy second_brain_private_objects on storage.objects for select using(false);
        create policy second_brain_private_buckets on storage.buckets for insert with check(false);
      `);
    }
    if (disableRls) await db.exec("alter table auth.users disable row level security;alter table storage.objects disable row level security;alter table storage.buckets disable row level security");
    if (missingBucket) await db.exec("drop table storage.buckets");
    await db.exec("set session authorization cap_actor");
    return db;
  } catch (error) { await db.close(); throw error; }
}

async function actual(db) {
  const results = await db.exec(MANAGED_CAPABILITIES_SQL);
  const reports = results.flatMap(row => row.rows).map(row => row.jsonb_build_object).filter(Boolean);
  assert.equal(reports.length, 1);
  const value = validateManagedCapabilities(reports[0]);
  const after = (await db.query("select current_user=session_user as same_actor,current_setting('transaction_read_only') as readonly,current_setting('statement_timeout') as statement_timeout,current_setting('lock_timeout') as lock_timeout")).rows[0];
  assert.deepEqual(after, { same_actor: true, readonly: "off", statement_timeout: "0", lock_timeout: "0" });
  return value;
}

test("literal SQL in PGlite distinguishes unrelated owners from grants and active forced RLS without reading rows", async () => {
  const db = await fixture(); try {
    const value = await actual(db); assert.equal(value.sameActor, true); assert.equal(value.schemas, 2); assert.equal(value.tables, 4);
    assert.equal(value.schemaOwnerImmediate, 0); assert.equal(value.schemaOwnerSet, 0); assert.equal(value.schemaUsage, 2);
    assert.equal(value.tableOwnerImmediate, 0); assert.equal(value.tableOwnerSet, 0); assert.equal(value.tableSelect, 4); assert.equal(value.tableInsert, 4);
    assert.equal(value.tableRlsEnabled, 3); assert.equal(value.tableRlsForced, 1); assert.equal(value.tableRlsActive, 3); assert.equal(value.tableRlsEnabledInactive, 0);
    assert.equal(value.authUsersTrigger, true); assert.equal(value.authUsersOwnerImmediate, false); assert.equal(value.authUsersOwnerSet, false); assert.equal(value.canSetSessionReplicationRole, false);
    assert.equal(value.storagePolicyTables, 2); assert.equal(value.storagePolicyOwnerImmediate, 0); assert.equal(value.storagePolicyOwnerSet, 0);
  } finally { await db.close(); }
});

test("literal SQL distinguishes SET-only owners and replication privilege from immediately inherited owners", async () => {
  for (const membership of ["set", "inherit"]) {
    const db = await fixture({ membership, parameter: true }); try {
      const value = await actual(db); assert.equal(value.isSuperuser, false); assert.equal(value.isBypassRls, false); assert.equal(value.canSetSessionReplicationRole, true);
      assert.equal(value.schemaOwnerImmediate, membership === "inherit" ? 2 : 0); assert.equal(value.schemaOwnerSet, membership === "set" ? 2 : 0);
      assert.equal(value.tableOwnerImmediate, membership === "inherit" ? 4 : 0); assert.equal(value.tableOwnerSet, membership === "set" ? 4 : 0);
      assert.equal(value.authUsersOwnerImmediate, membership === "inherit"); assert.equal(value.authUsersOwnerSet, membership === "set");
      assert.equal(value.storagePolicyOwnerImmediate, membership === "inherit" ? 2 : 0); assert.equal(value.storagePolicyOwnerSet, membership === "set" ? 2 : 0);
      assert.equal(value.tableRlsActive, membership === "inherit" ? 1 : 3); assert.equal(value.tableRlsEnabledInactive, membership === "inherit" ? 2 : 0);
    } finally { await db.close(); }
  }
});

test("literal SQL keeps custom trigger/policy presence separate from definitions/state and accounts for both Storage tables", async () => {
  const db = await fixture({ custom: true }); try {
    const value = await actual(db); assert.equal(value.authCustomTriggersPresent, 2); assert.equal(value.storageCustomPoliciesPresent, 2); assert.equal(value.storagePolicyTables, 2);
    assert.equal(value.tableOwnerImmediate, 0); assert.equal(value.tableOwnerSet, 0);
  } finally { await db.close(); }
  // A separate RAM fixture omits one policy table before switching actor.
  const missing = await fixture({ custom: true, missingBucket: true }); try {
    const fewer = await actual(missing); assert.equal(fewer.storagePolicyTables, 1); assert.equal(fewer.storageCustomPoliciesPresent, 1); assert.equal(fewer.tables, 3);
  } finally { await missing.close(); }
});

test("literal SQL separately measures BYPASSRLS and FORCE flag remaining after RLS disable", async () => {
  for (const options of [{ bypass: true }, { disableRls: true }]) {
    const db = await fixture(options); try {
      const value = await actual(db); assert.equal(value.isBypassRls, !!options.bypass); assert.equal(value.tableRlsForced, 1); assert.equal(value.tableRlsActive, 0);
      assert.equal(value.tableRlsEnabled, options.bypass ? 3 : 0); assert.equal(value.tableRlsEnabledInactive, options.bypass ? 3 : 0);
    } finally { await db.close(); }
  }
});
