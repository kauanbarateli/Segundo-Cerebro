import test, { after } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { SUPAUTILS_DELEGATION_SQL, SUPAUTILS_DELEGATION_TIMEOUT_MS, validateSupautilsDelegation, runSupautilsDelegation } from "../../scripts/operations/restore-supautils-delegation.mjs";

const canary = "PRIVATE_CONFIG_NEVER_PRINT", ref = "abcdefghijklmnopqrst";
const env = { SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + canary, SC_RESTORE_PG_RESTORE: resolve("synthetic-pg_restore"), SC_RESTORE_PSQL: resolve("synthetic-psql"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: canary, SC_RESTORE_PGSSLMODE: "require" };
const report = overrides => ({ version: 1, sameActor: true, readOnly: true, privilegedSettingsRegistered: false, policySettingsRegistered: false, currentRolePrivileged: false, replicationConfigFormatSupported: false, replicationDelegationConfigured: false, objectsPolicyDelegationConfigured: false, bucketsPolicyDelegationConfigured: false, replicationInitiallyOrigin: true, replicationReplicaObserved: false, replicationOriginObserved: false, replicationDenied: true, replicationRestored: true, ...overrides });
const result = async (query, selectedEnv = env, argv = ["check"]) => { const output = []; const exit = await runSupautilsDelegation(argv, selectedEnv, value => output.push(value), { query }); return { exit, output }; };
const denied = value => assert.throws(() => validateSupautilsDelegation(value), { code: "RESTORE_SUPAUTILS_DELEGATION_REPORT_INVALID" });
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw new Error("EXTERNAL_NETWORK_FORBIDDEN"); };
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });

test("import/help remain inert with HTTP and native children forbidden", async () => {
  const url = new URL("../../scripts/operations/restore-supautils-delegation.mjs", import.meta.url).href;
  const script = "import cp from 'node:child_process';import https from 'node:https';import{syncBuiltinESMExports}from'node:module';let calls=0;const refuse=()=>{calls++;throw Error('FORBIDDEN')};cp.spawn=refuse;https.request=refuse;syncBuiltinESMExports();globalThis.fetch=refuse;await import(" + JSON.stringify(url) + ");if(calls)throw Error('IMPORT_ACTIVE');process.stdout.write('IMPORT_INERT');";
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { SystemRoot: process.env.SystemRoot }, shell: false, windowsHide: true, timeout: 10000, encoding: "utf8" });
  assert.equal(child.status, 0); assert.equal(child.stdout, "IMPORT_INERT"); assert.equal(child.stderr, "");
  for (const argv of [[], ["--help"]]) {
    const output = []; const exit = await runSupautilsDelegation(argv, {}, value => output.push(value), { query: () => { throw Error("QUERY_FORBIDDEN"); } });
    assert.equal(exit, 0); assert.deepEqual(output, [{ version: 1, readonly: true, localSetProbe: true, rollback: true, archiveRead: false, remoteMutation: false }]);
  }
});

test("projection has exactly fifteen copied scalar fields and no names, configs, SQLSTATE or restore acceptance", () => {
  const input = report(); const value = validateSupautilsDelegation(input);
  assert.equal(Object.keys(value).length, 15); assert.notEqual(input, value); assert.equal(Object.getPrototypeOf(value), null); assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(JSON.parse(JSON.stringify(value)), input); input.replicationDenied = false; assert.equal(value.replicationDenied, true);
  for (const field of ["ok", "restoreAccepted", "allManagedQualified", "role", "owner", "oid", "config", "sqlstate", "error"]) assert.equal(Object.hasOwn(value, field), false);
  // Configuration alone is not proof of an installed hook. Denial may coexist.
  assert.equal(validateSupautilsDelegation(report({ privilegedSettingsRegistered: true, currentRolePrivileged: true, replicationConfigFormatSupported: true, replicationDelegationConfigured: true })).replicationDenied, true);
  // Ordinary parameter ACL can succeed without any delegation configuration.
  assert.equal(validateSupautilsDelegation(report({ replicationDenied: false, replicationReplicaObserved: true, replicationOriginObserved: true })).replicationDelegationConfigured, false);
  // The inner subtransaction may observe replica, then refuse origin and undo.
  validateSupautilsDelegation(report({ replicationReplicaObserved: true }));
});

test("every getter, symbol, extra, inherited or nonenumerable field and boolean coercion fails closed", () => {
  let getters = 0;
  for (const field of Object.keys(report())) {
    const accessor = report(); Object.defineProperty(accessor, field, { enumerable: true, get() { getters++; throw Error(canary); } }); denied(accessor);
    const hidden = report(); Object.defineProperty(hidden, field, { enumerable: false, value: hidden[field] }); denied(hidden);
    const missing = report(); delete missing[field]; denied(missing);
    for (const value of [null, undefined, "true", 1, 0]) if (field !== "version") denied({ ...report(), [field]: value });
  }
  for (const input of [null, [], 1, report({ version: 2 }), Object.create(report()), { ...report(), private: canary }, { ...report(), [Symbol("private")]: canary }, new Proxy({}, { ownKeys() { throw Error(canary); } })]) denied(input);
  const jsonGetter = report(); Object.defineProperty(jsonGetter, "toJSON", { get() { getters++; throw Error(canary); } }); denied(jsonGetter);
  assert.equal(getters, 0);
  for (const overrides of [{ currentRolePrivileged: true }, { replicationConfigFormatSupported: true }, { replicationDelegationConfigured: true }, { objectsPolicyDelegationConfigured: true }, { bucketsPolicyDelegationConfigured: true }, { replicationOriginObserved: true }, { replicationDenied: false }, { replicationInitiallyOrigin: false }, { readOnly: false }, { replicationRestored: false }]) denied(report(overrides));
  validateSupautilsDelegation(report({ replicationInitiallyOrigin: false, replicationDenied: false }));
});

test("fixed query/15 second transport and errors are closed; incomplete or personal configuration never queries", async () => {
  const calls = [];
  const complete = await result(async (request, options) => { calls.push({ request, options }); return report(); });
  assert.equal(complete.exit, 0); assert.deepEqual(JSON.parse(JSON.stringify(complete.output)), [report()]);
  assert.deepEqual(calls, [{ request: { sql: SUPAUTILS_DELEGATION_SQL }, options: { timeoutMs: 15000 } }]); assert.equal(SUPAUTILS_DELEGATION_TIMEOUT_MS, 15000);
  let queries = 0;
  for (const [selected, argv] of [[env, ["check", canary]], [env, ["restore"]], [env, null], [{ ...env, SC_RESTORE_PROJECT_REF: PERSONAL_REF, SC_RESTORE_CONFIRM_PROJECT: PERSONAL_REF }, ["check"]], [{ ...env, SC_RESTORE_ISOLATED: "NO" }, ["check"]], [{ ...env, SC_RESTORE_SUPABASE_KEY: "" }, ["check"]], [{ ...env, SC_RESTORE_PSQL: "relative" }, ["check"]], [{ ...env, SC_RESTORE_PGPASSWORD: "" }, ["check"]]]) {
    const value = await result(async () => { queries++; return report(); }, selected, argv); assert.equal(value.exit, 1); assert.equal(JSON.stringify(value).includes(canary), false);
  }
  assert.equal(queries, 0);
  let getters = 0; const accessor = new BackupError("PSQL_FAILED"); Object.defineProperty(accessor, "code", { get() { getters++; throw Error(canary); } });
  for (const error of [new Error(canary), new BackupError(canary), new BackupError("PSQL_TIMEOUT"), accessor]) {
    const value = await result(async () => { throw error; }); assert.equal(value.exit, 1); assert.deepEqual(Object.keys(value.output[0]).sort(), ["error", "ok"]); assert.equal(JSON.stringify(value).includes(canary), false);
  }
  const malformed = await result(async () => ({ ...report(), config: canary })); assert.equal(malformed.exit, 1); assert.equal(malformed.output[0].error, "RESTORE_SUPAUTILS_DELEGATION_REPORT_INVALID");
  assert.equal(getters, 0);
});

test("original psql transport uses hidden shellfalse query, ignores stderr and never sends credentials through argv", async () => {
  let childOptions, args;
  const spawn = (_executable, selectedArgs, options) => {
    args = selectedArgs; childOptions = options; const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true; child.unref = () => undefined;
    queueMicrotask(() => { child.stderr.end(canary); child.stdout.end(JSON.stringify(report()) + "\n"); child.emit("exit", 0); child.emit("close", 0); }); return child;
  };
  const output = []; const exit = await runSupautilsDelegation(["check"], env, value => output.push(value), { spawn });
  assert.equal(exit, 0); assert.equal(childOptions.shell, false); assert.equal(childOptions.windowsHide, true);
  assert.equal(args.includes("--command=" + SUPAUTILS_DELEGATION_SQL), true); assert.equal(args.join(" ").includes(canary), false); assert.equal(JSON.stringify(output).includes(canary), false);
});

async function fixture({ parameter = false, mode = "origin", role = "probe_actor", membership = null, configs = null } = {}) {
  const db = new PGlite();
  try {
    await db.exec("create schema storage;create table storage.objects(id integer);create table storage.buckets(id integer);create schema decoy;create table decoy.objects(id integer);create role probe_privileged;create role probe_actor login;create role probe_other login");
    await db.exec("grant usage on schema storage,decoy to probe_actor,probe_other");
    if (membership) await db.exec("grant probe_privileged to probe_actor with inherit " + (membership === "inherit" ? "true, set false" : "false, set true"));
    if (parameter) await db.exec("grant set on parameter session_replication_role to " + role);
    if (configs) for (const [name, value] of Object.entries(configs)) await db.query("select set_config($1,$2,false)", [name, value]);
    if (mode !== "origin") await db.exec("set session_replication_role = replica");
    await db.exec("set session authorization " + role);
    return db;
  } catch (error) { await db.close(); throw error; }
}

// PGlite has NO Supautils. Only registration discovery is substituted below.
// This explicit simulator tests parsing/role/OID facts, never hook capability.
// The live SET statements are unchanged and still use real PostgreSQL ACLs.
function registrationSimulator() {
  return SUPAUTILS_DELEGATION_SQL
    .replace("select count(*) = 2 into privileged_registered\n    from pg_settings where name in ('supautils.privileged_role', 'supautils.privileged_role_allowed_configs')\n      and context = 'sighup' and vartype = 'string';", "select true into privileged_registered;")
    .replace("select count(*) = 1 into policy_registered\n    from pg_settings where name = 'supautils.policy_grants' and context = 'sighup' and vartype = 'string';", "select true into policy_registered;");
}
const configs = (allowed, policy = '{ "probe_actor": ["storage.objects", "storage.buckets"] }', privileged = "probe_actor") => ({ "supautils.privileged_role": privileged, "supautils.privileged_role_allowed_configs": allowed, "supautils.policy_grants": policy });
async function actual(db, sql = SUPAUTILS_DELEGATION_SQL, expectedMode = "origin") {
  const rows = (await db.exec(sql)).flatMap(result => result.rows).filter(row => row.report);
  assert.equal(rows.length, 1); const value = validateSupautilsDelegation(rows[0].report);
  const after = (await db.query("select current_setting('session_replication_role') as mode,current_setting('transaction_read_only') as readonly,current_setting('statement_timeout') as statement_timeout,current_setting('lock_timeout') as lock_timeout,nullif(current_setting('second_brain_operator.supautils_report',true),'') is null as result_reset")).rows[0];
  assert.deepEqual(after, { mode: expectedMode, readonly: "off", statement_timeout: "0", lock_timeout: "0", result_reset: true });
  return value;
}

test("literal read-only SQL really catches native 42501 without Supautils and rolls all local settings back", async () => {
  const db = await fixture(); try {
    const value = await actual(db); assert.deepEqual(JSON.parse(JSON.stringify(value)), report());
    assert.equal(SUPAUTILS_DELEGATION_SQL.includes("execute 'SET LOCAL session_replication_role = replica'"), true);
    assert.equal(SUPAUTILS_DELEGATION_SQL.includes("execute 'SET LOCAL session_replication_role = origin'"), true);
    assert.match(SUPAUTILS_DELEGATION_SQL, /^begin transaction isolation level repeatable read read only;/); assert.match(SUPAUTILS_DELEGATION_SQL, /rollback;$/);
    assert.equal(/create (table|function|policy)|alter (table|role)|commit;|set_config\('session_replication_role'/i.test(SUPAUTILS_DELEGATION_SQL), false);
  } finally { await db.close(); }
});

test("literal SET/readback succeeds from real parameter ACL without claiming delegation; non-origin baseline is never changed", async () => {
  for (const options of [{ parameter: true }, { mode: "replica" }]) {
    const db = await fixture(options); try {
      const value = await actual(db, SUPAUTILS_DELEGATION_SQL, options.mode ?? "origin");
      assert.equal(value.replicationDelegationConfigured, false); assert.equal(value.replicationDenied, false);
      assert.equal(value.replicationInitiallyOrigin, !options.mode); assert.equal(value.replicationReplicaObserved, !options.mode); assert.equal(value.replicationOriginObserved, !options.mode); assert.equal(value.replicationRestored, true);
    } finally { await db.close(); }
  }
});

test("literal query does not treat user-defined Supautils placeholders as registered delegation", async () => {
  const db = await fixture({ configs: configs("session_replication_role") }); try {
    const value = await actual(db); assert.deepEqual(JSON.parse(JSON.stringify(value)), report());
  } finally { await db.close(); }
});

test("identified registration simulator preserves duplicate JSON role union, exact current-role keys and relation OIDs", async () => {
  const scenarios = [
    ['{"probe_actor":' + JSON.stringify(['"storage"."objects"']) + ',"probe_actor":["storage.buckets"]}', true, true],
    ['{"probe_actor":["STORAGE.OBJECTS"],"probe_other":["storage.buckets"]}', true, false],
    ['{"probe_other":["storage.objects","storage.buckets"]}', false, false],
    ['{"probe_actor":["decoy.objects","storage.missing"]}', false, false]
  ];
  for (const [policy, objects, buckets] of scenarios) {
    const db = await fixture({ configs: configs("session_replication_role", policy) }); try {
      const value = await actual(db, registrationSimulator()); assert.equal(value.policySettingsRegistered, true); assert.equal(value.objectsPolicyDelegationConfigured, objects); assert.equal(value.bucketsPolicyDelegationConfigured, buckets); assert.equal(value.replicationDenied, true); assert.equal(value.replicationDelegationConfigured, true);
    } finally { await db.close(); }
  }
});

test("identified config-format simulator supports explicit case/quote/wildcard grammar and never invalidates a real successful SET", async () => {
  const scenarios = [
    ["session_replication_role", true, true], ["SESSION_REPLICATION_ROLE", true, true], ['"session_replication_role"', true, true],
    ['"SESSION_REPLICATION_ROLE"', true, false], ["ext.*, session_replication_*", true, true], ["*", true, false],
    ["session_replication_role_other", true, false], ["ext.setting", true, false],
    ['"other,setting", session_replication_role', false, false], ['"session_replication_""role"', false, false],
    ["a".repeat(64), false, false]
  ];
  for (const [allowed, supported, configured] of scenarios) {
    const db = await fixture({ parameter: true, configs: configs(allowed) }); try {
      const value = await actual(db, registrationSimulator()); assert.equal(value.replicationConfigFormatSupported, supported); assert.equal(value.replicationDelegationConfigured, configured);
      assert.equal(value.replicationDenied, false); assert.equal(value.replicationReplicaObserved, true); assert.equal(value.replicationOriginObserved, true);
    } finally { await db.close(); }
  }
});

test("identified role simulator measures immediate USAGE independently of SET-only membership and refuses policy inheritance", async () => {
  for (const membership of ["inherit", "set"]) {
    const db = await fixture({ membership, configs: configs("session_replication_role", '{"probe_privileged":["storage.objects","storage.buckets"]}', "probe_privileged") }); try {
      const value = await actual(db, registrationSimulator()); assert.equal(value.currentRolePrivileged, membership === "inherit"); assert.equal(value.replicationDelegationConfigured, membership === "inherit");
      assert.equal(value.objectsPolicyDelegationConfigured, false); assert.equal(value.bucketsPolicyDelegationConfigured, false); assert.equal(value.replicationDenied, true);
    } finally { await db.close(); }
  }
});
