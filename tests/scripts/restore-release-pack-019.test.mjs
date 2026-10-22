import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createPack019Fixture } from "./helpers/pack019-fixture.mjs";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { RESTORE_RELEASE_PACK_019 as pack } from "../../scripts/operations/restore-release-pack-019.mjs";
import { MANAGED_VALIDATION_019, MANAGED_VALIDATION_019_SQL as sql019 } from "../../scripts/operations/restore-managed-validation-019-sql.mjs";
import { MANAGED_VALIDATION_SQL as sql025 } from "../../scripts/operations/restore-managed-validation-sql.mjs";
import { createManagedRestoreAdapters, createManagedRestoreAdapters019, checkManagedBeforeCommit, checkManagedBeforeCommit019, validateManagedValidation } from "../../scripts/operations/restore-managed-native-adapters.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const canary = "PACK019_SYNTHETIC_PRIVATE_CANARY", nonce = "a".repeat(32);
const refusal = { code: "RESTORE_MANAGED_VALIDATION_FAILED" };
const child = () => Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
const frame = report => "SC_MANAGED_BEGIN:" + nonce + "\nSET\nDO\n" + JSON.stringify(report) + "\nSC_MANAGED_END:" + nonce + "\n";
const sqlState = code => failure => failure?.code === code;
async function result(db, sql = sql019) {
  const rows = (await db.exec(sql)).flatMap(batch => batch.rows).filter(row => row.managed_validation);
  assert.equal(rows.length, 1);
  return validateManagedValidation(rows[0].managed_validation);
}
async function within(db, action) {
  await db.exec("begin;set local session_replication_role=replica");
  try { return await action(); } finally { await db.exec("rollback"); }
}
async function framed(check, sql, report, overrides = {}) {
  const consumer = child();
  const untouched = () => {}; consumer.stdout.on("data", untouched);
  const actual = await check({ consumer, write: async input => {
    assert.equal(input, "\\echo SC_MANAGED_BEGIN:" + nonce + "\n" + sql + "\\echo SC_MANAGED_END:" + nonce + "\n");
    for (const byte of Buffer.from(frame(report))) consumer.stdout.write(Buffer.from([byte]));
  } }, { nonce, timeoutMs: 100, ...overrides });
  assert.equal(consumer.stdout.listenerCount("data"), 1);
  assert.equal(consumer.listenerCount("close"), 0);
  return actual;
}

test("PACK019 is immutable explicit public source, with exact historical catalogue and nineteen canonical pins", async () => {
  assert.equal(pack.id, "019"); assert.equal(pack.sourceSha, "c46acea0c2cc81f82c083e2ae67a3c6480a2df1e");
  assert.equal(pack.sourceTree, "5319afc5bab91727ae9d869cbfc456904a71e733");
  assert.equal(pack.migrations.length, 19); assert.equal(Object.isFrozen(pack), true);
  assert.equal(Object.isFrozen(MANAGED_VALIDATION_019), true);
  assert.equal(MANAGED_VALIDATION_019.release, pack); assert.equal(MANAGED_VALIDATION_019.sql, sql019);
  assert.equal(Object.isFrozen(pack.migrations), true); assert.equal(Object.isFrozen(pack.catalogue), true);
  for (const pin of pack.migrations) {
    assert.equal(Object.isFrozen(pin), true);
    assert.match(pin.path, /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/);
    const bytes = await readFile(new URL("../../" + pin.path, import.meta.url));
    assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
  }
  const catalogue = await readFile(new URL("../../" + pack.catalogue.path, import.meta.url));
  assert.equal(catalogue.length, 23271);
  assert.equal(hash(catalogue), "06b61763ec27661000b01f9a34add2a1e1634d8cbd861d16c5c670894ba5d73c");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(catalogue);
  const cte = source.slice(source.indexOf("with expected_tables"), source.lastIndexOf("\nselect jsonb_build_object('version',1,'ok'"));
  assert.equal(sql019.includes(cte), true);
  const suffix = sql025.slice(sql025.indexOf("do $second_brain_references$"));
  assert.equal(sql019.endsWith(suffix), true, "current FK operator overload/RLS checks and closed result remain exact");
  assert.equal(sql019.slice(0, sql019.indexOf("do $second_brain_pack019$" )).includes("set local session_replication_role = origin;"), true);
  assert.equal(sql019.includes("do $second_brain_capture_documents$"), false);
  assert.equal(/\b(?:commit;|rollback;|begin transaction|disable trigger|disable constraint)\b/i.test(sql019), false);
  assert.equal(sql019.includes("supabase_migrations"), false);
});

test("importing explicit019 never reads a file, spawns a producer or selects SQL from environment", () => {
  const url = new URL("../../scripts/operations/restore-managed-native-adapters.mjs", import.meta.url).href;
  const source = "import cp from'node:child_process';import fs from'node:fs/promises';import{syncBuiltinESMExports}from'node:module';let calls=0;const refuse=()=>{calls++;throw Error('FORBIDDEN')};cp.spawn=refuse;fs.readFile=refuse;fs.mkdir=refuse;syncBuiltinESMExports();globalThis.fetch=refuse;const m=await import(" + JSON.stringify(url) + ");if(calls||typeof m.createManagedRestoreAdapters019!=='function')throw Error('ACTIVE_IMPORT');process.stdout.write('INERT');";
  const check = spawnSync(process.execPath, ["--input-type=module", "-e", source], { shell: false, windowsHide: true, timeout: 10000, encoding: "utf8", env: { SystemRoot: process.env.SystemRoot } });
  assert.equal(check.status, 0); assert.equal(check.stdout, "INERT"); assert.equal(check.stderr, "");
});

test("original SQL019 checks live uncommitted019 state and leaves COMMIT to its caller", async () => {
  const db = await createPack019Fixture();
  try {
    await within(db, async () => {
      const actual = await result(db);
      assert.equal(actual.catalogueOk, true); assert.equal(actual.catalogueDeviations, 0);
      assert.ok(actual.catalogueChecks > 0); // observation required before any strict count is introduced
      assert.ok(actual.foreignKeysChecked > 0); assert.equal(actual.foreignKeyViolations, 0);
      assert.equal(actual.sameActor, true); assert.equal(actual.replicationOrigin, true);
      assert.equal(await framed(checkManagedBeforeCommit019, sql019, actual), true);
      assert.equal((await db.query("select current_setting('session_replication_role') mode")).rows[0].mode, "origin");
    });
    assert.equal((await db.query("select nullif(current_setting('second_brain_operator.managed_catalogue',true),'') is null reset")).rows[0].reset, true);
  } finally { await db.close(); }
});

test("wrong019/025 selection fails closed without ledger inference or fallback; default025 still selects025", async () => {
  const old = await createPack019Fixture();
  try { await within(old, () => assert.rejects(result(old, sql025), sqlState("23514"))); }
  finally { await old.close(); }
  const current = await createLocalCanonicalSql();
  try {
    await within(current, () => assert.rejects(result(current), sqlState("23514")));
    await within(current, async () => {
      const actual = await result(current, sql025);
      assert.equal(actual.catalogueOk, true); assert.equal(actual.foreignKeyViolations, 0);
      assert.equal(await framed(checkManagedBeforeCommit, sql025, actual), true);
    });
  } finally { await current.close(); }
});

test("each known020–025 boundary is refused even if its data is empty", async () => {
  const db = await createPack019Fixture();
  try {
    for (const statement of [
      "alter table public.projects add column cover_file_id uuid",
      "alter table public.user_preferences add column home_focus_file_id uuid",
      "alter table public.habits add column image_file_id uuid",
      "alter table public.calendar_events add column attendees jsonb",
      "alter table public.calendar_events add column attendees_omitted boolean",
      "alter table app_private.google_calendar_cursors add column attendees_version smallint",
      "alter table public.fin_accounts add column last_four text",
      "alter table public.fin_accounts add column default_payment_account_id uuid",
      "create function app_private.file_feature(text) returns text language sql as 'select null::text'",
      "create function app_private.habit_frequency_tuple(jsonb) returns jsonb language sql as 'select null::jsonb'",
      "create function app_private.capture_document_validate_schema(jsonb) returns void language plpgsql as 'begin return; end'",
      "create function app_private.calendar_attendee_pair_valid(jsonb) returns boolean language sql as 'select false'",
      "create function app_private.finance_card_metadata_guard() returns trigger language plpgsql as 'begin return new; end'",
      "create function app_private.capture_e4_validate_document(jsonb) returns void language plpgsql as 'begin return; end'",
    ]) await within(db, async () => { await db.exec(statement); await assert.rejects(result(db), sqlState("23514")); });
  } finally { await db.close(); }
});

test("historical body/owner/ACL/RLS drift refuses before any application helper can execute", async () => {
  const db = await createPack019Fixture();
  try {
    const definition = (await db.query("select pg_get_functiondef('app_private.my_sessions()'::regprocedure) definition")).rows[0].definition;
    const weakened = definition.replace(/AS \$function\$[\s\S]*\$function\$/i, "AS $function$ begin raise sqlstate 'ZX019'; end $function$");
    assert.notEqual(weakened, definition);
    for (const change of [
      weakened,
      "create role pack019_owner nologin;alter function app_private.my_sessions() owner to pack019_owner",
      "grant execute on function app_private.my_sessions() to anon",
      "alter table public.profiles disable row level security",
    ]) await within(db, async () => {
      await db.exec(change);
      await assert.rejects(result(db), sqlState("23514")); // never the counterfeit ZX019 helper
    });
    await within(db, async () => { assert.equal((await result(db)).catalogueOk, true); });
  } finally { await db.close(); }
});

test("actual019 foreign key verification sees replica-imported orphan and FULL partial-null rows", async () => {
  const db = await createPack019Fixture();
  try {
    await db.exec("create table auth.pack019_parent(a integer,b integer,primary key(a,b));create table auth.pack019_simple(a integer,b integer,foreign key(a,b) references auth.pack019_parent(a,b) match simple);create table auth.pack019_full(a integer,b integer,foreign key(a,b) references auth.pack019_parent(a,b) match full)");
    await within(db, async () => {
      await db.exec("insert into auth.pack019_parent values(1,1);insert into auth.pack019_simple values(1,null),(null,null),(1,1);insert into auth.pack019_full values(null,null),(1,1)");
      const clean = await result(db); assert.equal(clean.foreignKeyViolations, 0);
      await db.exec("set local session_replication_role=replica;insert into auth.pack019_simple values(9,9);insert into auth.pack019_full values(1,null)");
      const altered = await result(db); assert.equal(altered.foreignKeyViolations, 2);
      assert.equal(altered.foreignKeysChecked, clean.foreignKeysChecked);
      assert.equal(await framed(checkManagedBeforeCommit019, sql019, altered), false);
    });
  } finally { await db.close(); }
});

test("a non-bypass actor cannot turn protected catalogue/FK rows or a different actor into019 approval", async () => {
  const db = await createPack019Fixture();
  try {
    const identitySql = "select current_user actor,session_user authenticated,(select rolsuper from pg_roles where rolname=current_user) privileged";
    const originalIdentity = (await db.query(identitySql)).rows;
    assert.equal(originalIdentity.length, 1); assert.equal(originalIdentity[0].actor, originalIdentity[0].authenticated); assert.equal(originalIdentity[0].privileged, true);
    await db.exec("create table auth.pack019_parent(id integer primary key);create table auth.pack019_child(id integer references auth.pack019_parent(id));alter table auth.pack019_child enable row level security;create role pack019_reader login;create role pack019_other superuser;grant usage on schema auth,storage,public,app_private to pack019_reader;grant select on all tables in schema auth,storage,public,app_private to pack019_reader;grant set on parameter session_replication_role to pack019_reader;set session authorization pack019_reader;begin;set local session_replication_role=origin");
    assert.deepEqual((await db.query("select current_setting('session_replication_role') mode,row_security_active('auth.pack019_child'::regclass) hidden")).rows, [{ mode: "origin", hidden: true }]);
    await assert.rejects(result(db), sqlState("42501"));
    // PGlite RESET keeps the changed session default; restore the captured
    // synthetic owner, as in restore-custom-ddl-probe.test.mjs.
    await db.exec('rollback;set session authorization "' + originalIdentity[0].authenticated.replaceAll('"', '""') + '"');
    assert.deepEqual((await db.query(identitySql)).rows, originalIdentity);
    await within(db, async () => {
      await db.exec("set local role pack019_other");
      const other = await result(db); assert.equal(other.sameActor, false);
      assert.equal(await framed(checkManagedBeforeCommit019, sql019, other), false);
    });
  } finally { await db.close(); }
});

const RAM_PARENT = resolve("/"), RAM_ROOT = resolve("/PACK019-HERMETIC-ONLY");
const options = () => ({ privateRoot: RAM_ROOT, powerShellExecutable: resolve("/synthetic/pwsh.exe"), systemRoot: resolve("/Windows"), forbiddenRoots: [], syncRoots: [] });
function ram() {
  let ino = 2, random = 0;
  const entries = new Map([[RAM_PARENT, { directory: true, ino: 1 }], [RAM_ROOT, { directory: true, ino: 2 }]]);
  const info = entry => ({ dev: 1, ino: entry.ino, isSymbolicLink: () => false, isDirectory: () => entry.directory === true, isFile: () => entry.directory === false });
  const get = path => { if (!entries.has(path)) throw Object.assign(Error(canary), { code: "ENOENT" }); return entries.get(path); };
  const fs = {
    async lstat(path) { return info(get(path)); },
    async mkdir(path, settings) { assert.equal(settings.recursive, false); assert.equal(entries.has(path), false); get(dirname(path)); entries.set(path, { directory: true, ino: ++ino }); },
    async open(path, flags, mode) { assert.equal(flags, "wx"); assert.equal(mode, 0o600); assert.equal(entries.has(path), false); get(dirname(path)); const value = { directory: false, ino: ++ino, text: "" }; entries.set(path, value); return { async stat() { return info(value); }, async writeFile(text) { value.text = text; }, async sync() {}, async close() {} }; },
    async readFile(path) { return Buffer.from(get(path).text); },
    async unlink(path) { get(path); entries.delete(path); },
    async rmdir(path) { get(path); if ([...entries.keys()].some(key => key !== path && dirname(key) === path)) throw Object.assign(Error(canary), { code: "ENOTEMPTY" }); entries.delete(path); },
  };
  return { entries, ports: { fs, safeDirectory: async value => value, proveAcl: async () => {}, randomBytes: () => Buffer.alloc(16, ++random) } };
}

test("019 factory binds the original consumer and actual019 SQL, preserves owned lists and never selects caller SQL", async () => {
  const db = await createPack019Fixture(), memory = ram(); let nativeCalls = 0;
  memory.ports.spawn = () => { nativeCalls++; return child(); };
  let adapter;
  try {
    adapter = await createManagedRestoreAdapters019(options(), memory.ports);
    const list = await adapter.materializeList("1; 0 0 TABLE DATA public profiles postgres\n");
    const consumer = adapter.spawn("synthetic-psql", ["--set=ON_ERROR_STOP=1"], { shell: false, windowsHide: true });
    await assert.rejects(adapter.checkBeforeCommit({ consumer: child(), write: async () => { throw Error("FOREIGN_CONSUMER"); } }), refusal);
    await within(db, async () => {
      const accepted = await adapter.checkBeforeCommit({ consumer, write: async command => {
        const lines = command.trimEnd().split("\n"), begin = lines[0].slice("\\echo ".length), end = lines.at(-1).slice("\\echo ".length);
        assert.equal(command, "\\echo " + begin + "\n" + sql019 + "\\echo " + end + "\n");
        const observed = await result(db);
        consumer.stdout.write(begin + "\n" + JSON.stringify(observed) + "\n" + end + "\n");
      } });
      assert.equal(accepted, true); assert.equal(adapter.validationReport().catalogueOk, true);
    });
    assert.equal(nativeCalls, 1); assert.equal(memory.entries.has(list.path), true);
  } finally { try { await adapter?.removeLists(); } finally { await db.close(); } }
  assert.deepEqual([...memory.entries.keys()], [RAM_PARENT, RAM_ROOT]);
  for (const extra of [{ sql: canary }, { pack: "025" }, { cataloguePath: canary }]) {
    let io = 0;
    await assert.rejects(createManagedRestoreAdapters019({ ...options(), ...extra }, { safeDirectory: async () => { io++; throw Error(canary); } }), { code: "RESTORE_MANAGED_LIST_INVALID" });
    assert.equal(io, 0);
  }
  assert.equal(typeof createManagedRestoreAdapters, "function");
});

test("019 nonce/EOF/truncation/schema and callbacks keep original listener ownership and refusal", async () => {
  const db = await createPack019Fixture(); let observed;
  try { await within(db, async () => { observed = await result(db); }); } finally { await db.close(); }
  for (const mode of ["nonce", "truncated", "schema", "eof", "consumer", "write", "callback"]) {
    const consumer = child(), original = () => {}; consumer.stdout.on("data", original); consumer.on("error", original);
    const write = async sql => {
      assert.equal(sql.includes(sql019), true);
      if (mode === "consumer") { consumer.emit("error", Error(canary)); return; }
      let text = frame(mode === "schema" ? { ...observed, content: canary } : observed);
      if (mode === "nonce") text = text.replaceAll(nonce, "b".repeat(32));
      if (mode === "truncated" || mode === "eof") text = text.slice(0, text.lastIndexOf("SC_MANAGED_END:"));
      consumer.stdout.write(text);
      if (mode === "eof") consumer.stdout.end();
      if (mode === "write") throw Error(canary);
    };
    await assert.rejects(checkManagedBeforeCommit019({ consumer, write }, { nonce, timeoutMs: 30, onReport() { if (mode === "callback") throw Error(canary); } }), refusal);
    assert.equal(consumer.stdout.listenerCount("data"), 1); assert.equal(consumer.listenerCount("error"), 1);
    assert.equal(consumer.listenerCount("close"), 0); assert.equal(consumer.stdout.listenerCount("end"), 0);
  }
});

test("019 complete frame cannot settle a pending original write or certify foreign cleanup", async () => {
  const db = await createPack019Fixture(); let observed;
  try { await within(db, async () => { observed = await result(db); }); } finally { await db.close(); }
  for (const mode of ["deadline", "consumer", "duplicate"]) {
    const consumer = child(), original = () => {}; consumer.stdout.on("data", original); consumer.on("error", original);
    let release; const held = new Promise(resolve => { release = resolve; }); let settled = false;
    try {
      await assert.rejects(checkManagedBeforeCommit019({ consumer, write() {
        consumer.stdout.write(frame(observed));
        if (mode === "consumer") queueMicrotask(() => consumer.emit("error", Error(canary)));
        if (mode === "duplicate") queueMicrotask(() => consumer.stdout.write(frame(observed)));
        return held.then(() => { settled = true; });
      } }, { nonce, timeoutMs: 20 }), refusal);
      assert.equal(settled, false); assert.equal(consumer.stdout.listenerCount("data"), 1); assert.equal(consumer.listenerCount("error"), 1);
    } finally { release(); await held; }
  }
  const memory = ram(), adapter = await createManagedRestoreAdapters019(options(), memory.ports);
  const item = await adapter.materializeList("1; 0 0 TABLE DATA public profiles postgres\n"), foreign = join(dirname(item.path), "unowned.keep");
  memory.entries.set(foreign, { directory: false, ino: 999, text: canary });
  await assert.rejects(adapter.removeLists(), { code: "RESTORE_MANAGED_LIST_INVALID" });
  assert.equal(memory.entries.get(foreign).text, canary); assert.equal(memory.entries.has(item.path), false);
});
