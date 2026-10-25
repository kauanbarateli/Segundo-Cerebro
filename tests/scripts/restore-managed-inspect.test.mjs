import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, writeFile, readdir, rm, rmdir, lstat, realpath, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, win32 } from "node:path";
import { EventEmitter } from "node:events";
import { types } from "node:util";
import { PassThrough, Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import { BackupError, writeBackup } from "../../scripts/operations/backup-format.mjs";
import { DATABASE_METADATA } from "../../scripts/operations/backup-sources.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { INSPECTION_LIMITS, PRIVATE_PATH_ACL_SCRIPT, defaultInspectionTemporaryRoot, inspectManagedBackup, inspectManagedBackupFormat, inspectManagedBackupToc, inspectManagedBackupHistory, runManagedInspect } from "../../scripts/operations/restore-managed-inspect.mjs";
import { diagnosticInventory, managedRestoreRequirements } from "../../scripts/operations/restore-managed-plan.mjs";

// Ciphertext fixtures on owned temp disk; original AEAD/manifest routines run.
// Inspector ACL/pg_restore children are RAM streams/events. One explicit local
// ACL control runs the fixed helper only on new empty owned fixture paths.
// No native inspector/PG, original backup/profile, SQL or HTTP is invoked.
const hash = bytes => createHash("sha256").update(bytes).digest("hex"), canary = "PRIVATE_CANARY_NEVER_OUTPUT";
const database = Buffer.from("PGDMP_" + canary), ref = "abcdefghijklmnopqrst";
const rows = [
  [1, "SCHEMA", "-", "auth", "supabase_auth_admin", []], [2, "SCHEMA", "-", "storage", "supabase_storage_admin", []], [3, "SCHEMA", "-", "app_private", "postgres", []],
  [4, "TABLE", "auth", "users", "supabase_auth_admin", [1]], [5, "TABLE", "storage", "objects", "supabase_storage_admin", [2]], [6, "TABLE", "storage", "buckets", "supabase_storage_admin", [2]],
  [7, "FUNCTION", "app_private", "on_auth_user_created()", "postgres", [3]], [8, "FUNCTION", "app_private", "check_admin_auth_creation_final()", "postgres", [3]],
  [9, "TABLE DATA", "auth", "users", "supabase_auth_admin", [4]], [10, "TABLE DATA", "storage", "objects", "supabase_storage_admin", [5]],
  [11, "TRIGGER", "auth", "users second_brain_identity_created", "postgres", [4, 7]], [12, "TRIGGER", "auth", "users second_brain_admin_creation_final", "postgres", [4, 8]],
  [13, "POLICY", "storage", "objects second_brain_private_objects", "supabase_storage_admin", [5]], [14, "POLICY", "storage", "buckets second_brain_private_buckets", "supabase_storage_admin", [6]],
];
const toc = ";\n;     TOC Entries: 14\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n;\n" + rows.map(([id, type, schema, tag, owner, deps]) => `${id}; 0 0 ${type} ${schema} ${tag} ${owner}\n` + (deps.length ? ";\tdepends on: " + deps.join(" ") + "\n" : "")).join("");
// Independent synthetic PG18.4 wire for the integrated diagnostic only. The
// native TOC is still a RAM child fixture. No DATA block is interpreted here.
function binaryTocFixture(overrides = {}, withHistory = false) {
  const int = value => { const bytes = Buffer.alloc(5); bytes[0] = value < 0 ? 1 : 0; bytes.writeUInt32LE(Math.abs(value), 1); return bytes; };
  const string = value => value === null ? int(-1) : Buffer.concat([int(Buffer.byteLength(value)), Buffer.from(value)]);
  const entries = [[15,"ENCODING","-","ENCODING","",[]], [16,"STDSTRINGS","-","STDSTRINGS","",[]], [17,"SEARCHPATH","-","SEARCHPATH","",[]], ...rows,
    ...(withHistory ? [[18,"TABLE","auth","schema_migrations","supabase_auth_admin",[1]], [19,"TABLE","storage","migrations","supabase_storage_admin",[2]], [20,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[18]], [21,"TABLE DATA","storage","migrations","supabase_storage_admin",[19]]] : [])];
  const nativeToc = ";     TOC Entries: " + entries.length + "\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n" + entries.map(([id, kind, schema, tag, owner, dependencies]) => `${id}; 0 0 ${kind} ${schema} ${tag} ${owner}\n` + (dependencies.length ? ";\tdepends on: " + dependencies.join(" ") + "\n" : "")).join("");
  const parts = [Buffer.from([80,71,68,77,80,1,16,0,4,8,1,1]), ...[0,0,0,16,9,126,0].map(int), string("postgres"), string("17.6"), string("18.4"), int(entries.length)];
  for (const [id, kind, schema, tag, owner, dependencies] of entries) {
    const selected = { id, tag, owner, namespace: schema === "-" ? null : schema, ...overrides[id] };
    const definition = kind === "ENCODING" ? "SET client_encoding = 'UTF8';\n" : withHistory && kind === "STDSTRINGS" ? "SET standard_conforming_strings = 'on';\n" : withHistory && kind === "SEARCHPATH" ? "SELECT pg_catalog.set_config('search_path', '', false);\n" : withHistory && kind === "TABLE DATA" ? null : "-- " + canary + "\n";
    const copyStatement = id === 20 ? "COPY auth.schema_migrations (version) FROM stdin;\n" : id === 21 ? "COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n" : null;
    parts.push(int(selected.id), int(kind === "TABLE DATA" ? 1 : 0), string("0"), string("0"), string(selected.tag), string(kind), int(kind === "TABLE DATA" ? 3 : ["TRIGGER","POLICY"].includes(kind) ? 4 : 2), string(definition), string(null), string(copyStatement), string(selected.namespace), string(null), string(null), int(kind === "TABLE" ? 114 : 0), string(selected.owner), string("false"), ...dependencies.map(value => string(String(value))), string(null), Buffer.from([kind === "TABLE DATA" ? 1 : 3]), Buffer.alloc(8));
  }
  const tocBytes = parts.reduce((count, part) => count + part.length, 0);
  return { bytes: Buffer.concat([...parts, Buffer.from("UNPARSED_DATA_" + canary)]), nativeToc, tocBytes };
}
const key = randomBytes(32), baseEnv = { SystemRoot: process.env.SystemRoot ?? resolve("not-installed-system-root"), PATH: process.env.PATH, SC_BACKUP_ENCRYPTION_KEY: key.toString("base64"), SC_BACKUP_KEY_ID: "fixture-v1", SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + canary, SC_RESTORE_PG_RESTORE: resolve("not-installed-pg_restore"), SC_RESTORE_PSQL: resolve("not-installed-psql"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: canary, SC_RESTORE_PGSSLMODE: "require", PGPASSWORD: canary, GOOGLE_TOKEN_ENCRYPTION_KEY: canary };
const originalFetch = globalThis.fetch; let networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw Error("NETWORK_FORBIDDEN"); };
after(() => { globalThis.fetch = originalFetch; key.fill(0); assert.equal(networkCalls, 0); });
async function fixture(action, bytes = database, header = {}) {
  const temporary = await defaultInspectionTemporaryRoot();
  const directory = await mkdtemp(join(temporary, "sc-inspect-fixture-")), lease = await lstat(directory), file = join(directory, "synthetic.scbackup");
  try {
    await writeBackup(file, key, { project_ref: PERSONAL_REF, key_id: "fixture-v1", created_at: "2026-10-13T00:00:00Z", ...header }, (async function* () {
      yield { metadata: DATABASE_METADATA, stream: Readable.from([bytes.subarray(0, 8), bytes.subarray(8)]) };
      const value = Buffer.from("FAKE_STORAGE_" + canary);
      yield { metadata: { kind: "storage", bucket: "second-brain-files", path: "synthetic/private.bin", object_id: "synthetic-object", source_updated_at: "2026-10-13T00:00:00Z", mime: "application/octet-stream", expected_bytes: value.length }, stream: Readable.from([value]) };
    })());
    return await action({ directory, file, env: { ...baseEnv }, dependencies: { temporaryRoot: directory } });
  } finally {
    const current = await lstat(directory);
    assert.equal(current.dev, lease.dev); assert.equal(current.ino, lease.ino); assert.equal(current.birthtimeMs, lease.birthtimeMs);
    assert.equal(directory.startsWith(join(temporary, "sc-inspect-fixture-")), true);
    await rm(directory, { recursive: true, force: true });
  }
}
function harness(options = {}) {
  const aclCalls = [], listCalls = [], inputReferences = [], observed = [];
  let killed = 0;
  const child = () => Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() { killed++; }, unref() {} });
  const dependencies = {
    spawnAcl(executable, args, settings) {
      aclCalls.push({ executable, args, settings }); const selected = child();
      assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true); assert.equal(Object.keys(settings.env).some(name => /PG|KEY|PASSWORD|SUPABASE/.test(name)), false);
      assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-EncodedCommand"]); assert.equal(Buffer.from(args[3], "base64").toString("utf16le"), PRIVATE_PATH_ACL_SCRIPT);
      queueMicrotask(async () => {
        await options.beforeAcl?.(settings.env);
        selected.stderr.end(canary);
        if (!options.aclNoEof) selected.stdout.end(options.aclText ?? '{"private":true}');
        if (!options.aclNoClose) selected.emit("close", options.aclExit ?? 0);
      });
      return selected;
    },
    spawnList(executable, args, settings) {
      listCalls.push({ executable, args, settings }); const selected = child();
      options.listChild?.(selected);
      assert.equal(executable, baseEnv.SC_RESTORE_PG_RESTORE); assert.deepEqual(args, ["--list", "--verbose"]);
      assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true); assert.deepEqual(settings.stdio, ["pipe", "pipe", "pipe"]);
      assert.equal(Object.keys(settings.env).some(name => !["PATH", "SystemRoot", "TEMP", "TMP"].includes(name)), false);
      selected.stdin.on("data", bytes => { inputReferences.push(bytes); observed.push(hash(bytes)); });
      if (options.eofTransport) {
        installEofTransport(selected, options.eofTransport, inputReferences, observed);
        return selected;
      }
      queueMicrotask(() => {
        if (!options.nativeError && !options.noSpawn) selected.emit("spawn");
        selected.stderr.end(canary);
        if (options.inputError) selected.stdin.emit("error", Object.assign(new Error(canary), { code: options.inputError }));
        if (options.nativeError) selected.emit("error", new Error(canary));
        if (options.outputClose) selected.stdout.destroy();
        else if (!options.noEof) selected.stdout.end(options.toc ?? toc);
        if (options.exitOnly) selected.emit("exit", 0);
        else if (!options.noClose) selected.emit("close", options.exit ?? 0);
      });
      return selected;
    },
  };
  return { dependencies, aclCalls, listCalls, inputReferences, observed, get killed() { return killed; } };
}
// Original callback and event are independent observations. These synthetic
// children never execute PG, read a private archive, or query a target. Unlike
// PassThrough.end, this explicit transport does not fabricate stdin finish.
function installEofTransport(child, options, inputReferences, observed) {
  const error = code => Object.assign(Error(canary), { code });
  child.stdin.end = (bytes, callback) => {
    inputReferences.push(bytes); observed.push(hash(bytes));
    queueMicrotask(() => {
      if (!options.noSpawn && !options.inputBeforeSpawn) child.emit("spawn");
      if (options.duplicateSpawn) child.emit("spawn");
      const callbacks = options.callbacks ?? [error("EOF")];
      const events = options.events ?? [error("EOF")];
      const sendCallback = () => { for (const value of callbacks) callback(value); };
      const sendEvent = () => { for (const value of events) child.stdin.emit("error", value); };
      if (options.eventFirst) { sendEvent(); sendCallback(); }
      else { sendCallback(); sendEvent(); }
      if (options.inputBeforeSpawn) child.emit("spawn");
      if (options.finish) child.stdin.emit("finish");
      if (options.stderrCloseBeforeEnd) child.stderr.emit("close");
      const drain = () => {
        if (!options.noStderrEof) child.stderr.end(canary);
        if (!options.noStdoutEof) child.stdout.end(options.toc ?? toc);
      };
      if (options.exitBeforeDrain || options.closeBeforeDrain) child.emit("exit", 0, null);
      if (options.closeBeforeDrain) { child.emit("close", 0, null); setImmediate(drain); }
      else drain();
      setImmediate(() => {
        const exit = () => { if (!options.noExit && !options.exitBeforeDrain && !options.closeBeforeDrain) child.emit("exit", options.exit ?? 0, options.signal ?? null); };
        const close = () => { if (!options.noClose && !options.closeBeforeDrain) child.emit("close", options.close ?? 0, options.closeSignal ?? null); };
        if (options.closeFirst) { close(); exit(); } else { exit(); close(); }
        if (options.duplicateExit) child.emit("exit", 0, null);
        if (options.duplicateClose) child.emit("close", 0, null);
        if (options.duplicateStdoutEof) child.stdout.emit("end");
        if (options.duplicateStderrEof) child.stderr.emit("end");
        if (options.lateError) child.stdin.emit("error", options.lateError);
      });
    });
    return child.stdin;
  };
  if (options.errorOnDestroy) {
    const destroy = child.stdin.destroy.bind(child.stdin);
    child.stdin.destroy = () => { queueMicrotask(() => child.stdin.emit("error", options.errorOnDestroy)); return destroy(); };
  }
}
async function execute(context, options = {}, selectedEnv = context.env) {
  const fake = harness(options), output = [];
  const exit = await runManagedInspect(["inspect", context.file], selectedEnv, value => output.push(value), { ...context.dependencies, ...fake.dependencies, timeoutMs: options.timeoutMs ?? 2000 });
  return { exit, output, fake };
}
const hidden = (output, file) => { const text = JSON.stringify(output); for (const forbidden of [canary, key.toString("base64"), file, '"auth"', '"storage"', "supabase_auth_admin", "postgres", "PGDMP", toc]) assert.equal(text.includes(forbidden), false); };

// Real AEAD + B2/B3 nominal stores, but all selected pg_restore transport is
// artificial RAM. The reader itself labels injected ports synthetic.
const historyScript = Buffer.from("--\n-- PostgreSQL database dump\n--\n\n\\restrict SCBaselineV1\n\n-- Dumped from database version 17.6\n-- Dumped by pg_dump version 18.4\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n" +
  "--\n-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin\n--\n\nCOPY auth.schema_migrations (version) FROM stdin;\n20240101\n\\.\n\n\n" +
  "--\n-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin\n--\n\nCOPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n0\tinitial\t" + "a".repeat(40) + "\t\\N\n\\.\n\n\n--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict SCBaselineV1\n\n");
function historyHarness(context, options = {}) {
  const calls = [], inputs = [], outputs = []; let child, root;
  const nativeHistoryPorts = {
    async createLists(listOptions, remaining) {
      calls.push("factory"); root = listOptions.privateRoot;
      assert.equal(root.startsWith(join(context.directory, "sc-inspect-cipher-")), true);
      assert.equal(remaining > 0 && remaining <= INSPECTION_LIMITS.timeoutMs, true);
      assert.equal(listOptions.powerShellExecutable, join(baseEnv.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"));
      if (options.delay) await new Promise(yes => setTimeout(yes, options.delay));
      return {
        async materializeList(value) { calls.push("list"); assert.deepEqual(value.split("\n").filter(Boolean).map(line => Number(line.split(";")[0])), [20,21]); return { path:join(root,"RAM-list.toc"),sha256:hash(value),private:true }; },
        async removeLists() { calls.push("cleanup"); await options.cleanup?.({ child, root }); },
      };
    },
    spawn(executable, args, settings) {
      calls.push("spawn"); assert.equal(executable, baseEnv.SC_RESTORE_PG_RESTORE);
      assert.deepEqual(args, ["--data-only", "--use-list=" + join(root,"RAM-list.toc"), "--file=-", "--restrict-key=SCBaselineV1"]);
      assert.equal(Object.keys(settings.env).some(name => /PG|KEY|PASSWORD|SUPABASE/.test(name)), false);
      child = Object.assign(new EventEmitter(), { stdin:new EventEmitter(),stdout:new PassThrough(),stderr:new PassThrough(),kill(){calls.push("kill");},unref(){} });
      child.stdin.destroy = () => {};
      child.stdin.end = (bytes, callback) => { inputs.push(bytes); queueMicrotask(() => {
        child.emit("spawn"); const output = Buffer.from(options.output ?? historyScript); outputs.push(output);
        child.stdout.end(output); child.stderr.end();
        if (options.inputError) { const error = Object.assign(Error(canary), { code:options.inputError }); child.stdin.emit("error", error); callback(error); }
        else { child.stdin.emit("finish"); callback(); }
        child.emit("exit", options.exit ?? 0); child.emit("close", options.exit ?? 0);
      }); };
      return child;
    },
  };
  return { nativeHistoryPorts, calls, inputs, outputs };
}

test("explicit history inspection authenticates all records before two original COPYs and exposes only bounded synthetic aggregates", async () => {
  const binary = binaryTocFixture({}, true);
  await fixture(async context => {
    const fake = harness({ toc:binary.nativeToc }), history = historyHarness(context), output = [];
    assert.equal(await runManagedInspect(["inspect-history",context.file],context.env,value=>output.push(value),{...context.dependencies,...fake.dependencies,nativeHistoryPorts:history.nativeHistoryPorts}),0);
    assert.equal(output[0].operation,"managed_restore_history_inspect"); assert.equal(output[0].authenticated,true);
    assert.deepEqual(output[0].migrationHistory,{authRows:1,storageRows:1,stdoutBytes:historyScript.length,inputTerminal:"finish",transportMode:"synthetic"});
    assert.equal(output[0].customToc.entries,21); assert.equal(output[0].targetQueried,false); assert.equal(output[0].remoteMutation,false); assert.equal(output[0].restoreAccepted,false);
    assert.deepEqual(history.calls,["factory","list","spawn","cleanup"]); assert.equal(fake.listCalls.length,1);
    assert.deepEqual(await readdir(context.directory),["synthetic.scbackup"]);
    for (const view of [...fake.inputReferences,...history.inputs,...history.outputs]) assert.equal(view.every(v=>v===0),true);
    hidden(output,context.file); assert.equal(JSON.stringify(output).includes("20240101"),false);
    const secondFake=harness({toc:binary.nativeToc}),secondHistory=historyHarness(context);
    const result=await inspectManagedBackupHistory(context.file,context.env,{...context.dependencies,...secondFake.dependencies,nativeHistoryPorts:secondHistory.nativeHistoryPorts});
    assert.equal(Object.isFrozen(result.migrationHistory),true); assert.deepEqual(Object.keys(result).sort(),["customToc","format","migrationHistory","plan"]);
  },binary.bytes);
});

test("history transport cannot start before full AEAD, original list terminals, planning and binary cross-check", async () => {
  const binary=binaryTocFixture({},true);
  await fixture(async context=>{
    for(const option of [{exit:1},{toc:binary.nativeToc.replace("TABLE auth users","UNKNOWN auth users")},{toc:binary.nativeToc.replace("TABLE auth users","TABLE auth other")}]){
      const fake=harness({toc:binary.nativeToc,...option}),history=historyHarness(context),output=[];
      assert.equal(await runManagedInspect(["inspect-history",context.file],context.env,v=>output.push(v),{...context.dependencies,...fake.dependencies,nativeHistoryPorts:history.nativeHistoryPorts}),1);
      assert.deepEqual(history.calls,[]); assert.equal(output[0].nativeHistoryDiagnostic,null); assert.equal(Object.hasOwn(output[0],"migrationHistory"),false); hidden(output,context.file);
    }
    const damaged=await readFile(context.file);damaged[damaged.length-1]^=1;await writeFile(context.file,damaged);
    const fake=harness({toc:binary.nativeToc}),history=historyHarness(context),output=[];
    assert.equal(await runManagedInspect(["inspect-history",context.file],context.env,v=>output.push(v),{...context.dependencies,...fake.dependencies,nativeHistoryPorts:history.nativeHistoryPorts}),1);
    assert.deepEqual(history.calls,[]);assert.equal(fake.listCalls.length,0);assert.equal(output[0].authComplete,false);
  },binary.bytes);
});

test("history read paired tail EPIPE stays diagnostic while truncated COPY and non-EPIPE remain closed failures", async () => {
  const binary=binaryTocFixture({},true);
  await fixture(async context=>{
    for(const option of [{inputError:"EPIPE"},{inputError:"EOF"},{inputError:"ECONNRESET"},{inputError:"EPIPE",output:historyScript.subarray(0,historyScript.length-10)}]){
      const fake=harness({toc:binary.nativeToc}),history=historyHarness(context,option),output=[];
      const exit=await runManagedInspect(["inspect-history",context.file],context.env,v=>output.push(v),{...context.dependencies,...fake.dependencies,nativeHistoryPorts:history.nativeHistoryPorts});
      if(option.inputError==="EPIPE"&&!option.output){assert.equal(exit,0);assert.equal(output[0].migrationHistory.inputTerminal,"selected_tail_unconsumed");}
      else{assert.equal(exit,1);assert.equal(output[0].stage,"native_history");assert.match(output[0].error,/^RESTORE_MIGRATION_HISTORY_NATIVE_(?:INPUT_FAILED|PARSER_REFUSED)$/);assert.notEqual(output[0].nativeHistoryDiagnostic,null);assert.equal(Object.hasOwn(output[0],"migrationHistory"),false);}
      hidden(output,context.file);
    }
  },binary.bytes);
});

test("a late original history error during inspector cleanup revokes an assembled result and outranks a later cleanup refusal", async () => {
  const binary=binaryTocFixture({},true);
  await fixture(async context=>{
    for(const extraFile of [false,true]){
      const fake=harness({toc:binary.nativeToc}),history=historyHarness(context,{cleanup:async({child,root})=>{
        if(extraFile)await writeFile(join(root,"unexpected-owned-fixture"),canary);
        setImmediate(()=>child.stdin.emit("error",Object.assign(Error(canary),{code:"ECONNRESET"})));
      }}),output=[];
      assert.equal(await runManagedInspect(["inspect-history",context.file],context.env,v=>output.push(v),{...context.dependencies,...fake.dependencies,nativeHistoryPorts:history.nativeHistoryPorts}),1);
      assert.equal(output[0].stage,"cleanup");assert.equal(output[0].error,"RESTORE_MIGRATION_HISTORY_NATIVE_INPUT_FAILED");assert.equal(output[0].nativeHistoryDiagnostic.phase,"retained");assert.equal(Object.hasOwn(output[0],"migrationHistory"),false);hidden(output,context.file);
    }
  },binary.bytes);
});

test("history cleanup refusal alone cannot certify a read and the reader never receives a renewed inspection deadline", async () => {
  const binary=binaryTocFixture({},true);
  await fixture(async context=>{
    const fake=harness({toc:binary.nativeToc}),history=historyHarness(context,{cleanup:async({root})=>writeFile(join(root,"unexpected-owned-fixture"),canary)}),output=[];
    assert.equal(await runManagedInspect(["inspect-history",context.file],context.env,v=>output.push(v),{...context.dependencies,...fake.dependencies,nativeHistoryPorts:history.nativeHistoryPorts}),1);
    assert.equal(output[0].stage,"cleanup");assert.equal(output[0].error,"INSPECTION_CLEANUP_FAILED");assert.equal(output[0].nativeHistoryDiagnostic,null);hidden(output,context.file);
    const other=harness({toc:binary.nativeToc}),slow=historyHarness(context,{delay:150}),second=[];
    assert.equal(await runManagedInspect(["inspect-history",context.file],context.env,v=>second.push(v),{...context.dependencies,...other.dependencies,nativeHistoryPorts:slow.nativeHistoryPorts,timeoutMs:100}),1);
    assert.equal(slow.calls.includes("spawn"),false);assert.equal(Object.hasOwn(second[0],"migrationHistory"),false);hidden(second,context.file);
    await new Promise(yes=>setTimeout(yes,160));
  },binary.bytes);
});

test("late original list errors veto history work and a result assembled before inspector cleanup", async () => {
  const binary=binaryTocFixture({},true);
  await fixture(async context=>{
    for(const phase of ["history","cleanup"]){
      let originalList;
      const fake=harness({toc:binary.nativeToc,listChild(child){originalList=child;}});
      const history=historyHarness(context,{cleanup:async()=>{
        const refuse=()=>originalList.stdin.emit("error",Object.assign(Error(canary),{code:"ECONNRESET"}));
        if(phase==="history")refuse();else setImmediate(refuse);
      }}),output=[];
      assert.equal(await runManagedInspect(["inspect-history",context.file],context.env,v=>output.push(v),{...context.dependencies,...fake.dependencies,nativeHistoryPorts:history.nativeHistoryPorts}),1);
      assert.equal(output[0].error,"INSPECTION_INPUT_FAILED");assert.equal(output[0].stage,phase==="history"?"native_history":"cleanup");
      assert.equal(output[0].nativeHistoryDiagnostic,null);assert.equal(Object.hasOwn(output[0],"migrationHistory"),false);hidden(output,context.file);
    }
  },binary.bytes);
});

test("format command detection remains inside the closed failure boundary for argv getters and revoked proxies", async () => {
  const accessor = []; Object.defineProperty(accessor, 0, { get() { throw new Error(canary); } });
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  for (const argv of [accessor, revoked.proxy]) {
    let calls = 0; const output = [];
    assert.equal(await runManagedInspect(argv, {}, value => output.push(value), { spawnList() { calls++; }, spawnAcl() { calls++; } }), 1);
    assert.equal(calls, 0); assert.equal(output.length, 1); assert.equal(output[0].error, "INSPECTION_UNAVAILABLE"); assert.equal(output[0].stage, null);
    assert.equal(output[0].authComplete, false); assert.equal(output[0].targetQueried, false); assert.equal(output[0].remoteMutation, false); hidden(output, "unused");
  }
});

test("explicit format inspection observes only the authenticated same database after native EOF and planning, without changing normal inspection output", async () => {
  const bytes = Buffer.concat([Buffer.from([80,71,68,77,80,1,16,0,4,8,1,0]), Buffer.from(canary)]);
  await fixture(async context => {
    const fake = harness(), output = [];
    const exit = await runManagedInspect(["inspect-format", context.file], context.env, value => output.push(value), { ...context.dependencies, ...fake.dependencies });
    assert.equal(exit, 0); assert.equal(fake.listCalls.length, 1); assert.deepEqual(fake.observed, [hash(bytes)]);
    assert.deepEqual(output, [{ ok:true, operation:"managed_restore_format_inspect", authenticated:true, planSupported:true, selectedEntries:9, preservedEntries:5, segments:5, format:{archiveVersion:"1.16-0",intSize:4,offSize:8,format:"CUSTOM",compression:"NONE"}, targetQueried:false, remoteMutation:false, restoreAccepted:false }]);
    assert.equal(Object.isFrozen(output[0].format), true); hidden(output, context.file);
    const other = harness(), entry = await inspectManagedBackupFormat(context.file, context.env, { ...context.dependencies, ...other.dependencies });
    assert.equal(Object.isFrozen(entry), true); assert.deepEqual(entry.format, output[0].format);
    assert.equal(Object.hasOwn(entry, "snapshot"), false); assert.equal(Object.hasOwn(entry.plan, "database"), false);
    for (const view of [...fake.inputReferences, ...other.inputReferences]) assert.equal(view.every(byte => byte === 0), true);
  }, bytes);
});

test("format metadata is absent after authentication, native or plan failure; unsupported version is a closed post-plan refusal", async () => fixture(async context => {
  for (const options of [{ noEof:true }, { exit:1 }, { toc:toc.replace("TABLE auth users", "UNKNOWN_"+canary+" auth users") }, {}]) {
    const fake = harness(options), output = [];
    const exit = await runManagedInspect(["inspect-format",context.file],context.env,value=>output.push(value),{...context.dependencies,...fake.dependencies,timeoutMs:500});
    assert.equal(exit,1); assert.equal(Object.hasOwn(output[0],"format"),false);
    if (Object.keys(options).length===0) { assert.equal(output[0].stage,"custom_header"); assert.equal(output[0].error,"RESTORE_CUSTOM_HEADER_UNSUPPORTED"); assert.equal(output[0].authComplete,true); assert.equal(output[0].listStarted,true); }
    else assert.notEqual(output[0].stage,"custom_header");
    hidden(output,context.file);
  }
  const corrupted=await readFile(context.file); corrupted[corrupted.length-1]^=1; await writeFile(context.file,corrupted);
  const fake=harness(), output=[];
  assert.equal(await runManagedInspect(["inspect-format",context.file],context.env,value=>output.push(value),{...context.dependencies,...fake.dependencies}),1);
  assert.equal(fake.listCalls.length,0); assert.equal(output[0].authComplete,false); assert.equal(Object.hasOwn(output[0],"format"),false); hidden(output,context.file);
}));

test("explicit binary TOC inspection uses the fully authenticated same bytes and returns only aggregates, without mint or DATA", async () => {
  const binary = binaryTocFixture();
  await fixture(async context => {
    const fake = harness({ toc: binary.nativeToc }), output = [];
    assert.equal(await runManagedInspect(["inspect-toc", context.file], context.env, value => output.push(value), { ...context.dependencies, ...fake.dependencies }), 0);
    assert.deepEqual(output, [{ ok:true, operation:"managed_restore_toc_inspect", authenticated:true, planSupported:true, selectedEntries:12, preservedEntries:5, segments:5, format:{ archiveVersion:"1.16-0",intSize:4,offSize:8,format:"CUSTOM",compression:"GZIP" }, customToc:{ entries:17,preservedEntries:5,encoding:"UTF8",tocBytes:binary.tocBytes }, targetQueried:false,remoteMutation:false,restoreAccepted:false }]);
    assert.equal(fake.listCalls.length, 1); assert.deepEqual(fake.observed, [hash(binary.bytes)]); hidden(output, context.file);
    for (const view of fake.inputReferences) assert.equal(view.every(byte => byte === 0), true);
    const other = harness({ toc:binary.nativeToc });
    const entry = await inspectManagedBackupToc(context.file, context.env, { ...context.dependencies, ...other.dependencies });
    assert.equal(Object.isFrozen(entry), true); assert.equal(Object.isFrozen(entry.customToc), true);
    assert.deepEqual(Object.keys(entry).sort(), ["customToc","format","plan"]);
    assert.deepEqual(entry.customToc, output[0].customToc); assert.equal(Object.hasOwn(entry, "snapshot"), false);
    assert.equal(Object.hasOwn(entry, "records"), false); assert.equal(Object.hasOwn(entry, "database"), false);
  }, binary.bytes);
});

test("binary TOC cannot run before full authentication, native EOF/close0 and plan; mismatch is a closed post-plan refusal", async () => {
  const binary = binaryTocFixture({ 4:{ tag:"different" } });
  await fixture(async context => {
    for (const options of [{ noEof:true }, { exit:1 }, { toc:binary.nativeToc.replace("TABLE auth users", "UNKNOWN_"+canary+" auth users") }, {}]) {
      const fake = harness({ toc:binary.nativeToc,...options }), output = [];
      assert.equal(await runManagedInspect(["inspect-toc", context.file], context.env, value => output.push(value), { ...context.dependencies,...fake.dependencies,timeoutMs:200 }), 1);
      assert.equal(Object.hasOwn(output[0], "customToc"), false); assert.equal(Object.hasOwn(output[0], "format"), false);
      if (Object.keys(options).length === 0) { assert.equal(output[0].stage, "custom_toc"); assert.equal(output[0].error, "RESTORE_CUSTOM_TOC_PLAN_MISMATCH"); }
      else assert.notEqual(output[0].stage, "custom_toc");
      hidden(output, context.file);
    }
    const corrupted = await readFile(context.file); corrupted[corrupted.length-1] ^= 1; await writeFile(context.file, corrupted);
    const fake = harness({ toc:binary.nativeToc }), output = [];
    assert.equal(await runManagedInspect(["inspect-toc", context.file], context.env, value => output.push(value), { ...context.dependencies,...fake.dependencies }), 1);
    assert.equal(fake.listCalls.length, 0); assert.equal(output[0].authComplete, false); assert.notEqual(output[0].stage, "custom_toc"); hidden(output, context.file);
  }, binary.bytes);
});

test("fixed native ACL helper protects only an exclusive empty current-owner directory; copied empty fixtures inherit it and files stay verify-only", async () => {
  assert.equal(INSPECTION_LIMITS.aclTimeoutMs, 15000); assert.equal(INSPECTION_LIMITS.timeoutMs, 45000);
  if (process.platform !== "win32") return; // POSIX uses the UID/mode guard.
  const root = await mkdtemp(join(await defaultInspectionTemporaryRoot(), "sc-inspect-acl-test-")), rootLease = await lstat(root);
  let directory, directoryLease; const files = new Map();
  const call = (script, path, kind) => spawnSync(win32.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { env: { SystemRoot: process.env.SystemRoot, SC_INSPECT_ACL_PATH: path, SC_INSPECT_ACL_KIND: kind }, stdio: ["ignore", "pipe", "ignore"], shell: false, windowsHide: true, encoding: "utf8", timeout: INSPECTION_LIMITS.aclTimeoutMs, maxBuffer: 1024 });
  // SDDL stays inside this owned helper; only its opaque digest is retained in
  // RAM for equality. No SID/name/raw ACL or provider error can leave the test.
  const factsScript = String.raw`$ErrorActionPreference='Stop'
try {
 $acl=Get-Acl -LiteralPath $env:SC_INSPECT_ACL_PATH
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));$foreign=$false;$full=$false
 foreach($rule in $rules){if($rule.AccessControlType -eq 'Allow'){$actor=$rule.IdentityReference.Value;if($actor -ne $sid){$foreign=$true};if($actor -eq $sid -and (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl)){$full=$true}}}
 $hash=[Security.Cryptography.SHA256]::Create()
 try{$fingerprint=[Convert]::ToBase64String($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($acl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access -bor [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Group))))}finally{$hash.Dispose()}
 [Console]::WriteLine(([ordered]@{fingerprint=$fingerprint;ownerCurrent=($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq $sid);protected=$acl.AreAccessRulesProtected;oneRule=($rules.Count -eq 1);foreignAllow=$foreign;currentFull=$full}|ConvertTo-Json -Compress))
}catch{[Console]::WriteLine('{"unavailable":true}');exit 1}`;
  const facts = path => {
    const result = call(factsScript, path, "file");
    const code = Object.getOwnPropertyDescriptor(result.error ?? {}, "code")?.value;
    assert.equal(result.status === 0, true, ["ETIMEDOUT", "ENOBUFS", "ENOENT", "EACCES", "EPERM"].includes(code) ? "ACL_FACTS_" + code : "ACL_FACTS_REFUSED");
    let value; try { value = JSON.parse(result.stdout); } catch { assert.fail("CLOSED_ACL_FACTS_REQUIRED"); }
    assert.deepEqual(Object.keys(value).sort(), ["fingerprint", "ownerCurrent", "protected", "oneRule", "foreignAllow", "currentFull"].sort());
    assert.match(value.fingerprint, /^[A-Za-z0-9+/]{43}=$/); for (const field of ["ownerCurrent", "protected", "oneRule", "foreignAllow", "currentFull"]) assert.equal(typeof value[field], "boolean");
    return value;
  };
  const helper = (path, kind) => {
    const result = call(PRIVATE_PATH_ACL_SCRIPT, path, kind);
    assert.equal(result.status === 0 || result.status === 1, true, "ACL_HELPER_TERMINAL_REQUIRED");
    let value; try { value = JSON.parse(result.stdout); } catch { assert.fail("CLOSED_HELPER_FACT_REQUIRED"); }
    assert.deepEqual(Object.keys(value), ["private"]); assert.equal(typeof value.private, "boolean");
    assert.equal(result.status === 0, value.private);
    return result.status === 0 && value.private === true;
  };
  const same = (left, right) => left.dev === right.dev && left.ino === right.ino && left.birthtimeMs === right.birthtimeMs;
  try {
    const parentBefore = facts(root).fingerprint;
    directory = await mkdtemp(join(root, "sc-inspect-cipher-")); directoryLease = await lstat(directory);
    assert.equal(helper(directory, "directory"), true);
    assert.equal(same(directoryLease, await lstat(directory)), true);
    const secured = facts(directory);
    for (const field of ["ownerCurrent", "protected", "oneRule", "currentFull"]) assert.equal(secured[field], true);
    assert.equal(secured.foreignAllow, false);
    const source = join(root, "source-empty.fixture"), copied = join(directory, "copied-empty.fixture");
    await writeFile(source, Buffer.alloc(0), { flag: "wx" }); files.set(source, await lstat(source));
    await copyFile(source, copied, constants.COPYFILE_EXCL); files.set(copied, await lstat(copied));
    const fileBefore = facts(copied).fingerprint;
    assert.equal(helper(copied, "file"), true);
    assert.equal(facts(copied).fingerprint === fileBefore, true);
    assert.equal(helper(directory, "directory"), false); // nonempty: no ACL write
    assert.equal(facts(directory).fingerprint === secured.fingerprint, true);
    assert.equal(helper(copied, "directory"), false); // wrong kind
    assert.equal(helper(directory, "unknown"), false);
    assert.equal(facts(root).fingerprint === parentBefore, true);
  } finally {
    for (const [path, lease] of files) { assert.equal(same(lease, await lstat(path)), true); await unlink(path); }
    if (directory) { assert.equal(same(directoryLease, await lstat(directory)), true); await rmdir(directory); }
    assert.equal(same(rootLease, await lstat(root)), true); await rmdir(root);
  }
});

test("import/help are inert and no restore, unknown argv or target/key drift can open the absent archive", async () => {
  const url = new URL("../../scripts/operations/restore-managed-inspect.mjs", import.meta.url).href;
  const code = "import cp from'node:child_process';import{syncBuiltinESMExports}from'node:module';cp.spawn=()=>{throw Error('SPAWN_FORBIDDEN')};syncBuiltinESMExports();globalThis.fetch=()=>{throw Error('HTTP_FORBIDDEN')};await import(" + JSON.stringify(url) + ");process.stdout.write('INERT')";
  const probe = spawnSync(process.execPath, ["--input-type=module", "-e", code], { env: { SystemRoot: process.env.SystemRoot }, shell: false, windowsHide: true, encoding: "utf8", timeout: 10000 });
  assert.equal(probe.status, 0); assert.equal(probe.stdout, "INERT"); assert.equal(probe.stderr, "");
  let spawns = 0; const dependencies = { spawnAcl() { spawns++; throw Error(canary); }, spawnList() { spawns++; throw Error(canary); } };
  for (const argv of [[], ["--help"]]) { const output = []; assert.equal(await runManagedInspect(argv, {}, value => output.push(value), dependencies), 0); assert.equal(output[0].targetQueried, false); }
  for (const argv of [["restore", resolve("absent")], ["inspect", "relative"], ["inspect", resolve("absent"), "extra"], null]) { const output = []; assert.equal(await runManagedInspect(argv, baseEnv, value => output.push(value), dependencies), 1); assert.equal(output[0].stage, null); assert.equal(output[0].authComplete, false); assert.equal(output[0].listStarted, false); hidden(output, "unused"); }
  for (const [alter, expected] of [[env => { env.SC_RESTORE_PROJECT_REF = PERSONAL_REF; env.SC_RESTORE_CONFIRM_PROJECT = PERSONAL_REF; }, "ISOLATED_RESTORE_TARGET_REQUIRED"], [env => { env.SC_BACKUP_ENCRYPTION_KEY = "invalid"; }, "BACKUP_KEY_REQUIRED"], [env => { env.SC_RESTORE_CONFIRM_PROJECT = "other"; }, "ISOLATED_RESTORE_TARGET_REQUIRED"]]) {
    const env = { ...baseEnv }; alter(env); const output = []; assert.equal(await runManagedInspect(["inspect", resolve("absent")], env, value => output.push(value), dependencies), 1); assert.equal(output[0].error, expected); assert.equal(output[0].stage, null); assert.equal(output[0].authComplete, false); assert.equal(output[0].listStarted, false); assert.equal(output[0].tocDiagnostic, null);
  }
  assert.equal(spawns, 0);
});
test("full original AEAD/footer/manifest authentication yields a private bound plan before list-only EOF+close0; output is only closed counts", async () => fixture(async context => {
  const fake = harness(), plan = await inspectManagedBackup(context.file, context.env, { ...context.dependencies, ...fake.dependencies });
  assert.deepEqual(plan, { version: 1, selectedEntries: 9, preservedEntries: 5, segments: 5 });
  const requirements = managedRestoreRequirements(plan);
  assert.equal(requirements.archiveSha256, hash(await readFile(context.file))); assert.equal(requirements.databaseSha256, hash(database)); assert.equal(requirements.databaseBytes, database.length); assert.equal(requirements.tocSha256, hash(toc));
  assert.deepEqual(fake.observed, [hash(database)]); assert.equal(fake.inputReferences.every(value => value.every(byte => byte === 0)), true);
  assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
  const result = await execute(context); assert.equal(result.exit, 0); hidden(result.output, context.file);
  assert.deepEqual(result.output, [{ ok: true, operation: "managed_restore_inspect", authenticated: true, planSupported: true, selectedEntries: 9, preservedEntries: 5, segments: 5, targetQueried: false, remoteMutation: false, restoreAccepted: false }]);
}));
test("wrong key, corrupt final Storage/manifest, truncated or appended archive all refuse before native list", async () => fixture(async context => {
  const original = await readFile(context.file), bad = Buffer.from(original); bad[bad.length - 1] ^= 1;
  for (const bytes of [bad, original.subarray(0, -1), Buffer.concat([original, Buffer.from([1])]), original.subarray(0, original.length - 80)]) {
    await writeFile(context.file, bytes); const result = await execute(context); assert.equal(result.exit, 1); assert.equal(result.fake.listCalls.length, 0); hidden(result.output, context.file);
    assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
  }
  await writeFile(context.file, original); const result = await execute(context, {}, { ...context.env, SC_BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("base64") }); assert.equal(result.exit, 1); assert.equal(result.fake.listCalls.length, 0);
}));
test("original header identity and PGDMP source are required before list even when encryption is valid", async () => {
  for (const [bytes, header, expected] of [[database, { key_id: "different" }, "BACKUP_IDENTITY_MISMATCH"], [database, { project_ref: ref }, "BACKUP_IDENTITY_MISMATCH"], [Buffer.from("NOT_A_DATABASE"), {}, "RESTORE_MANAGED_DATABASE_INVALID"]]) await fixture(async context => {
    const result = await execute(context); assert.equal(result.exit, 1); assert.equal(result.output[0].error, expected); assert.equal(result.fake.listCalls.length, 0);
  }, bytes, header);
});
test("ACL denial/extra fields and incomplete helper terminal refuse before ciphertext copy or list, without exposing paths or stderr", async () => fixture(async context => {
  if (process.platform !== "win32") return; // POSIX has the real UID/mode guard.
  for (const option of [{ aclText: '{"private":false}' }, { aclText: '{"private":true,"extra":1}' }, { aclText: 'null' }, { aclExit: 1 }, { aclNoEof: true }, { aclNoClose: true }]) {
    const result = await execute(context, { ...option, timeoutMs: 500 }); assert.equal(result.exit, 1); assert.equal(result.fake.listCalls.length, 0); hidden(result.output, context.file); assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
  }
}));
test("copy is ciphertext-only and original source replacement after copy cannot alter the authenticated native input", async () => fixture(async context => {
  if (process.platform !== "win32") return;
  let changed = false;
  const result = await execute(context, { beforeAcl: async env => {
    if (env.SC_INSPECT_ACL_KIND === "file") { const cipher = await readFile(env.SC_INSPECT_ACL_PATH); assert.equal(cipher.includes(database), false); await writeFile(context.file, "REPLACED_SOURCE"); changed = true; }
  } });
  assert.equal(changed, true); assert.equal(result.exit, 0); assert.deepEqual(result.fake.observed, [hash(database)]); assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
}));
test("list exit0 alone, close0 without stdout EOF, EOF without close and premature pipe-close all refuse", async () => fixture(async context => {
  for (const option of [{ exitOnly: true }, { noEof: true }, { noClose: true }, { outputClose: true }]) {
    const result = await execute(context, { ...option, timeoutMs: 500 }); assert.equal(result.exit, 1); assert.equal(result.fake.listCalls.length, 1); assert.equal(result.fake.killed > 0, true); hidden(result.output, context.file);
    assert.equal(result.fake.inputReferences.every(value => value.every(byte => byte === 0)), true); assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
  }
}));
test("TOC-only EPIPE may discard a known authenticated tail only with real EOF+close0; other errors and failing native terminals stay failures", async () => fixture(async context => {
  assert.equal((await execute(context, { inputError: "EPIPE" })).exit, 0);
  for (const option of [{ inputError: "EPIPE", exit: 1 }, { inputError: "EPIPE", noEof: true }, { inputError: "EPIPE", noClose: true }, { inputError: "OTHER" }, { nativeError: true }, { exit: 1 }]) {
    // Include fixture disk/authentication work in a realistic synthetic budget;
    // otherwise a slow local scan can expire before the terminal under test.
    const result = await execute(context, { ...option, timeoutMs: 2000 }); assert.equal(result.exit, 1); assert.equal(result.fake.listCalls.length, 1, JSON.stringify({ option, error: result.output[0].error, stage: result.output[0].stage })); hidden(result.output, context.file);
  }
}));
test("authenticated source TOC paired original EOF accepts either observation order only after natural terminals and cleans owned RAM", async () => fixture(async context => {
  for (const eofTransport of [{}, { eventFirst: true }, { exitBeforeDrain: true }]) {
    const fake = harness({ eofTransport });
    const plan = await inspectManagedBackup(context.file, context.env, { ...context.dependencies, ...fake.dependencies });
    const binding = managedRestoreRequirements(plan);
    assert.deepEqual(plan, { version: 1, selectedEntries: 9, preservedEntries: 5, segments: 5 });
    assert.equal(binding.archiveSha256, hash(await readFile(context.file)));
    assert.equal(binding.databaseSha256, hash(database)); assert.equal(binding.databaseBytes, database.length);
    assert.equal(binding.tocSha256, hash(toc)); assert.deepEqual(fake.observed, [hash(database)]);
    assert.equal(fake.killed, 0); assert.equal(fake.inputReferences.every(value => value.every(byte => byte === 0)), true);
    assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
  }
  const result = await execute(context, { eofTransport: {} });
  assert.equal(result.exit, 0); assert.equal(result.output[0].authenticated, true);
  assert.equal(result.output[0].targetQueried, false); assert.equal(result.output[0].remoteMutation, false);
  assert.equal(result.output[0].restoreAccepted, false); hidden(result.output, context.file);
}));

test("authenticated source TOC EOF refuses incomplete, mixed, repeated and finish input observations", async () => fixture(async context => {
  const error = code => Object.assign(Error(canary), { code });
  const cases = [
    { callbacks: [] }, { events: [] }, { callbacks: [null] },
    { callbacks: [error("EPIPE")] }, { events: [error("EPIPE")] },
    { callbacks: [error("EOF"), error("EOF")] }, { events: [error("EOF"), error("EOF")] },
    { callbacks: [error("EOF"), null] }, { events: [error("EOF"), error("EPIPE")] },
    { callbacks: [error("ECONNRESET")] }, { events: [error("ECONNRESET")] }, { finish: true },
  ];
  for (const eofTransport of cases) {
    const result = await execute(context, { eofTransport });
    assert.equal(result.exit, 1); assert.equal(result.output[0].error, "INSPECTION_INPUT_FAILED");
    assert.equal(result.output[0].stage, "native_toc"); assert.equal(result.output[0].authComplete, true);
    assert.equal(Object.hasOwn(result.output[0], "selectedEntries"), false);
    assert.equal(result.fake.inputReferences.every(value => value.every(byte => byte === 0)), true);
    assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]); hidden(result.output, context.file);
  }
}));

test("authenticated source TOC EOF requires one natural spawn exit close, both output EOFs and no signal", async () => fixture(async context => {
  const cases = [
    { noSpawn: true }, { duplicateSpawn: true }, { noExit: true }, { duplicateExit: true },
    { duplicateClose: true }, { closeFirst: true }, { exit: 1 }, { close: 1 },
    { signal: "SIGTERM" }, { closeSignal: "SIGTERM" }, { noStderrEof: true },
    { noStdoutEof: true }, { noClose: true }, { duplicateStdoutEof: true },
    { duplicateStderrEof: true }, { stderrCloseBeforeEnd: true }, { inputBeforeSpawn: true }, { closeBeforeDrain: true },
  ];
  for (const eofTransport of cases) {
    const result = await execute(context, { eofTransport, timeoutMs: 750 });
    assert.equal(result.exit, 1); assert.equal(result.output[0].stage, "native_toc");
    assert.equal(result.output[0].authComplete, true); assert.equal(result.fake.killed > 0, true);
    assert.equal(Object.hasOwn(result.output[0], "selectedEntries"), false);
    assert.equal(result.fake.inputReferences.every(value => value.every(byte => byte === 0)), true);
    assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]); hidden(result.output, context.file);
  }
}));

test("authenticated source TOC EOF rejects unknown and accessor or proxy codes without invoking providers", async () => fixture(async context => {
  let reads = 0;
  const accessor = Object.defineProperty({}, "code", { get() { reads++; throw Error(canary); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const inherited = Object.create({ code: "EOF" });
  const proxy = new Proxy({ code: "EOF" }, { get() { reads++; throw Error(canary); }, getOwnPropertyDescriptor() { reads++; throw Error(canary); } });
  for (const value of [accessor, revoked.proxy, inherited, proxy, { code: "EOF " }, { code: {} }, canary]) {
    for (const field of ["callbacks", "events"]) {
      const result = await execute(context, { eofTransport: { [field]: [value] } });
      assert.equal(result.exit, 1); assert.equal(result.output[0].error, "INSPECTION_INPUT_FAILED");
      assert.equal(Object.hasOwn(result.output[0], "selectedEntries"), false); hidden(result.output, context.file);
    }
  }
  assert.equal(reads, 0);
}));

test("authenticated source TOC EOF cannot bypass whole archive authentication, plan validation or late original refusal", async () => fixture(async context => {
  const original = await readFile(context.file), corrupted = Buffer.from(original); corrupted[corrupted.length - 1] ^= 1;
  for (const bytes of [corrupted, original.subarray(0, -1), Buffer.concat([original, Buffer.from([1])])]) {
    await writeFile(context.file, bytes);
    const result = await execute(context, { eofTransport: {} });
    assert.equal(result.exit, 1); assert.equal(result.output[0].authComplete, false);
    assert.equal(result.fake.listCalls.length, 0); hidden(result.output, context.file);
  }
  await writeFile(context.file, original);
  const invalidPlan = await execute(context, { eofTransport: { toc: toc.replace("TABLE auth users", "UNKNOWN auth users") } });
  assert.equal(invalidPlan.exit, 1); assert.equal(invalidPlan.output[0].stage, "plan");
  assert.equal(Object.hasOwn(invalidPlan.output[0], "selectedEntries"), false); hidden(invalidPlan.output, context.file);
  for (const mode of ["lateError", "errorOnDestroy"]) {
    const result = await execute(context, { eofTransport: { [mode]: Object.assign(Error(canary), { code: "ECONNRESET" }) } });
    assert.equal(result.exit, 1); assert.equal(result.output[0].error, "INSPECTION_INPUT_FAILED");
    assert.equal(Object.hasOwn(result.output[0], "selectedEntries"), false); hidden(result.output, context.file);
  }
}));

test("authenticated source TOC EOF retains nonrecursive cleanup refusal and first original error precedence", async () => fixture(async context => {
  if (process.platform !== "win32") return;
  for (const lateError of [null, Object.assign(Error(canary), { code: "ECONNRESET" })]) {
    let foreign;
    const result = await execute(context, { eofTransport: { ...(lateError ? { lateError } : {}) }, beforeAcl: async env => {
      if (env.SC_INSPECT_ACL_KIND === "file") { foreign = join(env.SC_INSPECT_ACL_PATH, "..", "unexpected.cipher"); await writeFile(foreign, randomBytes(32)); }
    } });
    assert.equal(result.exit, 1); assert.equal(result.output[0].error, lateError ? "INSPECTION_INPUT_FAILED" : "INSPECTION_CLEANUP_FAILED");
    assert.equal((await lstat(foreign)).isFile(), true);
    assert.equal(Object.hasOwn(result.output[0], "selectedEntries"), false); hidden(result.output, context.file);
  }
}));

test("TOC byte bound, strict UTF8 and unsupported plan refuse without raw TOC, fabricated counts or historical fallback", async () => fixture(async context => {
  for (const value of [Buffer.alloc(INSPECTION_LIMITS.tocBytes + 1, 65), Buffer.from([255]), toc.replace("TABLE auth users", "UNKNOWN auth users"), toc.replace("TOC Entries: 14", "TOC Entries: 13")]) {
    const result = await execute(context, { toc: value }); assert.equal(result.exit, 1); assert.equal(Object.hasOwn(result.output[0], "selectedEntries"), false); assert.equal(Object.hasOwn(result.output[0], "preservedEntries"), false); hidden(result.output, context.file);
    assert.equal(result.fake.inputReferences.every(value => value.every(byte => byte === 0)), true);
  }
}));
test("only an original unsupported plan refusal supplies closed TOC enums through sanitized CLI failure; native/other errors stay null", async () => fixture(async context => {
  const cases = [
    [toc.replace("TABLE auth users", "UNKNOWN_" + canary + " auth users"), { reason: "unknown_descriptor", knownKind: null, scopeCategory: "unparsed", tailShape: "not_parsed" }],
    [toc.replace("TABLE auth users", 'TABLE auth "' + canary + '"'), { reason: "tail_grammar", knownKind: "TABLE", scopeCategory: "managed", tailShape: "forbidden_tag_character" }],
    [toc.replace("TABLE auth users", "TABLE outside_canary " + canary), { reason: "scope_classification", knownKind: "TABLE", scopeCategory: "other", tailShape: "valid" }],
  ];
  for (const [value, diagnostic] of cases) {
    const result = await execute(context, { toc: value });
    assert.equal(result.exit, 1); assert.equal(result.output[0].error, "RESTORE_TOC_UNSUPPORTED");
    assert.equal(result.output[0].stage, "plan"); assert.equal(result.output[0].authComplete, true); assert.equal(result.output[0].listStarted, true);
    assert.deepEqual(result.output[0].tocDiagnostic, diagnostic);
    assert.deepEqual(Object.keys(result.output[0]).sort(), ["ok", "operation", "error", "stage", "authComplete", "listStarted", "tocDiagnostic", "tocPlanDiagnostic", "inventory", "targetQueried", "remoteMutation", "restoreAccepted"].sort());
    assert.equal(result.output[0].tocPlanDiagnostic, null);
    assert.deepEqual(result.output[0].inventory, diagnosticInventory(value)); assert.equal(Object.isFrozen(result.output[0].inventory), true);
    assert.equal(result.output[0].targetQueried, false); assert.equal(result.output[0].remoteMutation, false); assert.equal(result.output[0].restoreAccepted, false);
    assert.equal(JSON.stringify(result.output).includes("outside_canary"), false); hidden(result.output, context.file);
    assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
  }
  for (const option of [{ nativeError: true }, { toc: toc.replace("TOC Entries: 14", "TOC Entries: 13") }]) {
    const result = await execute(context, option); assert.equal(result.exit, 1); assert.equal(result.output[0].tocDiagnostic, null); assert.deepEqual(result.output[0].inventory, option.toc ? diagnosticInventory(option.toc) : null); hidden(result.output, context.file);
  }
  let reads = 0; const fake = harness(), output = [], provider = {};
  for (const key of ["code", "message", "tocDiagnostic", "tocPlanDiagnostic", "inventory"]) Object.defineProperty(provider, key, { enumerable: true, get() { reads++; throw Error(canary); } });
  assert.equal(await runManagedInspect(["inspect", context.file], context.env, value => output.push(value), { ...context.dependencies, ...fake.dependencies, spawnList() { throw provider; } }), 1);
  assert.equal(output[0].tocDiagnostic, null); assert.equal(output[0].tocPlanDiagnostic, null); assert.equal(output[0].inventory, null); assert.equal(reads, 0); hidden(output, context.file);
  if (process.platform === "win32") {
    let unexpected;
    const first = await execute(context, { toc: cases[0][0], beforeAcl: async env => {
      if (env.SC_INSPECT_ACL_KIND === "file") { unexpected = join(env.SC_INSPECT_ACL_PATH, "..", "unexpected.cipher"); await writeFile(unexpected, randomBytes(32)); }
    } });
    assert.equal(first.output[0].error, "RESTORE_TOC_UNSUPPORTED"); assert.equal(first.output[0].stage, "plan");
    assert.deepEqual(first.output[0].tocDiagnostic, cases[0][1]); assert.deepEqual(first.output[0].inventory, diagnosticInventory(cases[0][0])); assert.equal((await lstat(unexpected)).isFile(), true); hidden(first.output, context.file);
  }
}));
test("an invalid absolute deadline or thrown factory cannot start a target service or leak source/exception text", async () => fixture(async context => {
  for (const timeoutMs of [0, -1, INSPECTION_LIMITS.timeoutMs + 1, NaN]) { const result = await execute(context, { timeoutMs }); assert.equal(result.exit, 1); assert.equal(result.output[0].stage, null); assert.equal(result.output[0].authComplete, false); assert.equal(result.output[0].listStarted, false); assert.equal(result.fake.listCalls.length, 0); hidden(result.output, context.file); }
  const output = [], fake = harness(); const exit = await runManagedInspect(["inspect", context.file], context.env, value => output.push(value), { ...context.dependencies, ...fake.dependencies, spawnList() { throw Error(canary); } });
  assert.equal(exit, 1); hidden(output, context.file); assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
}));
test("ACL work shares the absolute inspection deadline; a late helper cannot renew it or start list", async () => fixture(async context => {
  if (process.platform !== "win32") return;
  const result = await execute(context, { timeoutMs: 1000, beforeAcl: async () => { await new Promise(resolve => setTimeout(resolve, 600)); } });
  assert.equal(result.exit, 1); assert.equal(result.output[0].error, "INSPECTION_TIMEOUT"); assert.equal(result.fake.listCalls.length, 0); assert.equal(result.fake.killed > 0, true);
  assert.equal(result.fake.aclCalls.length, 2);
  assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]); hidden(result.output, context.file);
}));
test("nonrecursive cleanup preserves an unexpected file and a cleanup refusal cannot replace the first native failure", async () => fixture(async context => {
  if (process.platform !== "win32") return;
  let foreign;
  for (const option of [{}, { exit: 1 }]) {
    const result = await execute(context, { ...option, beforeAcl: async env => {
      if (env.SC_INSPECT_ACL_KIND === "file") { foreign = join(env.SC_INSPECT_ACL_PATH, "..", "unexpected.cipher"); await writeFile(foreign, randomBytes(32)); }
    } });
    assert.equal(result.exit, 1); assert.equal(result.output[0].error, option.exit ? "INSPECTION_NATIVE_FAILED" : "INSPECTION_CLEANUP_FAILED");
    assert.equal(result.output[0].stage, option.exit ? "native_toc" : "cleanup"); assert.equal(result.output[0].authComplete, true); assert.equal(result.output[0].listStarted, true);
    assert.equal((await lstat(foreign)).isFile(), true); hidden(result.output, context.file);
  }
}));
test("a replaced owned ciphertext inode cannot qualify or be deleted as if it were the original lease", async () => fixture(async context => {
  if (process.platform !== "win32") return;
  let replacementPath; const replacement = randomBytes(48);
  const result = await execute(context, { beforeAcl: async env => {
    if (env.SC_INSPECT_ACL_KIND === "file") { replacementPath = env.SC_INSPECT_ACL_PATH; await unlink(replacementPath); await writeFile(replacementPath, replacement); }
  } });
  assert.equal(result.exit, 1); assert.equal(result.output[0].error, "INSPECTION_SNAPSHOT_CHANGED"); assert.equal(result.fake.listCalls.length, 0);
  assert.deepEqual(await readFile(replacementPath), replacement); hidden(result.output, context.file);
}));
test("actual default OS temp canonicalization preserves directory identity, including an OS 8.3 alias when supplied by the launcher", async () => {
  const original = await lstat(tmpdir()), canonical = await defaultInspectionTemporaryRoot(), resolved = await lstat(canonical);
  assert.equal(canonical, await realpath(tmpdir())); assert.equal(canonical.includes("~"), false);
  assert.equal(original.dev, resolved.dev); assert.equal(original.ino, resolved.ino); assert.equal(original.birthtimeMs, resolved.birthtimeMs);
});
test("default-only 8.3 resolution checks original ancestors before realpath and refuses original/canonical reparse or identity drift", async () => {
  const root = resolve("VIRTUAL_OS_TEMP"), alias = join(root, "USERNA~1", "Temp"), canonical = join(root, "Long User Name", "Temp");
  const info = { dev: 1, ino: 2, birthtimeMs: 3, isDirectory: () => true, isSymbolicLink: () => false };
  const visited = []; let resolved = false;
  const result = await defaultInspectionTemporaryRoot({ tmpdir: () => alias, lstat: async path => { visited.push({ path, resolved }); return info; }, realpath: async path => { assert.equal(path, alias); resolved = true; return canonical; } });
  assert.equal(result, canonical); assert.equal(visited[0].path, alias); assert.equal(visited.filter(row => !row.resolved).some(row => row.path === root), true); assert.equal(visited.find(row => row.resolved).path, canonical);
  for (const link of [alias, resolve(alias, "..")]) {
    let realpaths = 0;
    await assert.rejects(defaultInspectionTemporaryRoot({ tmpdir: () => alias, lstat: async path => ({ ...info, isSymbolicLink: () => path === link }), realpath: async () => { realpaths++; return canonical; } }), { code: "INSPECTION_PATH_REFUSED" });
    assert.equal(realpaths, 0);
  }
  for (const alter of [path => ({ ...info, isSymbolicLink: () => path === resolve(canonical, "..") }), path => ({ ...info, ino: path === canonical ? 99 : 2 })]) await assert.rejects(defaultInspectionTemporaryRoot({ tmpdir: () => alias, lstat: async path => alter(path), realpath: async () => canonical }));
});
test("explicit archive and temporaryRoot tilde paths remain refused and never enter the default OS exception", async () => fixture(async context => {
  for (const [archive, temporaryRoot, expected] of [[join(context.directory, "USER~1", "archive.scbackup"), context.directory, "INSPECTION_PATH_REFUSED"], [context.file, join(context.directory, "TEMP~1"), "UNSAFE_BACKUP_DESTINATION"]]) {
    const fake = harness(), output = [];
    const exit = await runManagedInspect(["inspect", archive], context.env, value => output.push(value), { ...fake.dependencies, temporaryRoot });
    assert.equal(exit, 1); assert.equal(output[0].error, expected); assert.equal(fake.aclCalls.length, 0); assert.equal(fake.listCalls.length, 0);
    assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
  }
}));
test("inspection without an explicit temporaryRoot uses the canonical OS default and still authenticates before list", async () => fixture(async context => {
  const fake = harness(), output = [];
  const exit = await runManagedInspect(["inspect", context.file], context.env, value => output.push(value), fake.dependencies);
  assert.equal(exit, 0); assert.deepEqual(fake.observed, [hash(database)]); hidden(output, context.file);
  if (process.platform === "win32") for (const call of fake.aclCalls) assert.equal(call.settings.env.SC_INSPECT_ACL_PATH.includes("~"), false);
}));
test("closed owned-stage diagnostics distinguish ACL and native-list timeouts without paths, raw output, progress callbacks or a new deadline", async () => fixture(async context => {
  if (process.platform === "win32") {
    const acl = await execute(context, { aclNoEof: true, timeoutMs: 500 });
    assert.equal(acl.output[0].error, "INSPECTION_TIMEOUT"); assert.equal(acl.output[0].stage, "directory_acl"); assert.equal(acl.output[0].authComplete, false); assert.equal(acl.output[0].listStarted, false); hidden(acl.output, context.file);
  }
  const list = await execute(context, { noEof: true, timeoutMs: 500 });
  assert.equal(list.output[0].error, "INSPECTION_TIMEOUT"); assert.equal(list.output[0].stage, "native_toc"); assert.equal(list.output[0].authComplete, true); assert.equal(list.output[0].listStarted, true); hidden(list.output, context.file);
  const notSpawned = await execute(context, { nativeError: true });
  assert.equal(notSpawned.output[0].stage, "native_toc"); assert.equal(notSpawned.output[0].authComplete, true); assert.equal(notSpawned.output[0].listStarted, false);
  assert.equal(list.output[0].tocDiagnostic, null);
  assert.equal(list.output[0].inventory, null);
  assert.equal(list.output[0].tocPlanDiagnostic, null);
  assert.deepEqual(Object.keys(list.output[0]).sort(), ["ok", "operation", "error", "stage", "authComplete", "listStarted", "tocDiagnostic", "tocPlanDiagnostic", "inventory", "targetQueried", "remoteMutation", "restoreAccepted"].sort());
}));

test("an authenticated native EOF and close0 precede any closed inventory; a terminal failure or truncated text cannot populate it", async () => fixture(async context => {
  const value = toc.replace("TOC Entries: 14", "TOC Entries: 16") + `15; 0 0 EXTENSION - ${canary} private_owner_canary\n16; 0 0 UNKNOWN_${canary} auth ${canary} private_owner_canary\n`;
  for (const options of [{ noEof: true }, { noClose: true }, { exit: 1 }, { nativeError: true }, { outputClose: true }, { toc: Buffer.from([255]) }, { toc: Buffer.alloc(INSPECTION_LIMITS.tocBytes + 1, 65) }]) {
    const result = await execute(context, { toc: value, ...options, timeoutMs: 500 });
    assert.equal(result.exit, 1); assert.equal(result.output[0].inventory, null); assert.equal(result.output[0].restoreAccepted, false); hidden(result.output, context.file);
    assert.equal(result.fake.inputReferences.every(chunk => chunk.every(byte => byte === 0)), true);
  }
  const result = await execute(context, { toc: value });
  assert.equal(result.exit, 1); assert.equal(result.output[0].error, "RESTORE_TOC_UNSUPPORTED"); assert.equal(result.output[0].stage, "plan");
  assert.equal(result.output[0].authComplete, true); assert.equal(result.output[0].listStarted, true);
  assert.deepEqual(result.output[0].inventory, diagnosticInventory(value)); assert.equal(result.output[0].inventory.headersValid, true);
  assert.equal(result.output[0].inventory.classes.some(entry => entry.kind === "EXTENSION" && entry.count === 1), true); assert.equal(result.output[0].inventory.unknownClassCount, 1);
  assert.equal(Buffer.byteLength(JSON.stringify(result.output[0])) < 64 * 1024, true); hidden(result.output, context.file);
  assert.equal(JSON.stringify(result.output).includes("private_owner_canary"), false);
  assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
}));

test("CLI success and help retain their existing schemas without exposing inventory or new plan authority", async () => fixture(async context => {
  const result = await execute(context); assert.equal(result.exit, 0);
  assert.deepEqual(Object.keys(result.output[0]), ["ok", "operation", "authenticated", "planSupported", "selectedEntries", "preservedEntries", "segments", "targetQueried", "remoteMutation", "restoreAccepted"]);
  const output = []; assert.equal(await runManagedInspect(["--help"], context.env, value => output.push(value)), 0);
  assert.deepEqual(Object.keys(output[0]), ["operation", "command", "readonly", "targetQueried", "restoreAccepted"]);
  for (const item of [...result.output, ...output]) { assert.equal(Object.hasOwn(item, "inventory"), false); assert.equal(Object.hasOwn(item, "tocPlanDiagnostic"), false); assert.equal(item.restoreAccepted, false); }
  hidden(result.output, context.file);
}));

test("authenticated native repeated TABLE dependencies pass planning without TOC normalization or a changed CLI success schema", async () => fixture(async context => {
  const repeated = toc.replace(";\tdepends on: 1\n", ";\tdepends on: 1 1\n"), fake = harness({ toc: repeated });
  const plan = await inspectManagedBackup(context.file, context.env, { ...context.dependencies, ...fake.dependencies, timeoutMs: 2000 }), requirements = managedRestoreRequirements(plan);
  assert.deepEqual(requirements.preserved.find(row => row.description === "TABLE" && row.schema === "auth" && row.tag === "users").dependencies, [1, 1]);
  assert.equal(requirements.tocSha256, hash(Buffer.from(repeated))); assert.notEqual(requirements.tocSha256, hash(Buffer.from(toc)));
  assert.equal(requirements.archiveSha256, hash(await readFile(context.file))); assert.equal(requirements.databaseSha256, hash(database)); assert.equal(requirements.databaseBytes, database.length);
  assert.deepEqual(fake.observed, [hash(database)]); assert.equal(fake.inputReferences.every(chunk => chunk.every(byte => byte === 0)), true);
  const result = await execute(context, { toc: repeated }); assert.equal(result.exit, 0); assert.equal(result.output[0].restoreAccepted, false);
  assert.equal(Object.hasOwn(result.output[0], "tocPlanDiagnostic"), false); assert.equal(Object.hasOwn(result.output[0], "inventory"), false); hidden(result.output, context.file);
  assert.deepEqual(await readdir(context.directory), ["synthetic.scbackup"]);
}));

test("original planner INVALID/dependency/custom refusals preserve their closed reason through CLI sanitation and a later cleanup failure", async () => fixture(async context => {
  const missingCustom = toc.replace("TOC Entries: 14", "TOC Entries: 13").replace(/^11;[^\n]*\n;\tdepends on:[^\n]*\n/m, "");
  const cases = [
    [toc.replace("TOC Entries: 14", "TOC Entries: 13"), "RESTORE_TOC_INVALID", { version: 1, reason: "entry_count_mismatch", knownKind: null, scopeCategory: "unparsed" }],
    [toc.replace("5; 0 0 TABLE storage objects", "4; 0 0 TABLE storage objects"), "RESTORE_TOC_INVALID", { version: 1, reason: "entry_id_repeated", knownKind: null, scopeCategory: "unparsed" }],
    [toc.replace(";\tdepends on: 1\n", ";\tdepends on: 999\n"), "RESTORE_TOC_DEPENDENCY_INVALID", { version: 1, reason: "dependency_missing", knownKind: "TABLE", scopeCategory: "managed" }],
    [missingCustom, "RESTORE_MANAGED_CUSTOM_INVALID", { version: 1, reason: "customization_missing", knownKind: null, scopeCategory: "unparsed" }],
  ];
  for (const [value, code, facts] of cases) {
    const result = await execute(context, { toc: value });
    assert.equal(result.exit, 1); assert.equal(result.output[0].error, code); assert.equal(result.output[0].stage, "plan");
    assert.deepEqual(result.output[0].tocPlanDiagnostic, facts); assert.equal(Object.isFrozen(result.output[0].tocPlanDiagnostic), true);
    assert.equal(result.output[0].tocDiagnostic, null); assert.deepEqual(result.output[0].inventory, diagnosticInventory(value));
    assert.equal(result.output[0].authComplete, true); assert.equal(result.output[0].listStarted, true); assert.equal(result.output[0].restoreAccepted, false);
    assert.equal(Object.keys(result.output[0]).length, 12); assert.equal(Buffer.byteLength(JSON.stringify(result.output[0])) < 64 * 1024, true); hidden(result.output, context.file);
  }
  for (const option of [{ nativeError: true }, { noEof: true, timeoutMs: 500 }, { toc: toc.replace("TABLE auth users", "UNKNOWN_" + canary + " auth users") }]) {
    const result = await execute(context, option); assert.equal(result.exit, 1); assert.equal(result.output[0].tocPlanDiagnostic, null); hidden(result.output, context.file);
  }
  if (process.platform === "win32") {
    let unexpected;
    const result = await execute(context, { toc: cases[1][0], beforeAcl: async env => {
      if (env.SC_INSPECT_ACL_KIND === "file") { unexpected = join(env.SC_INSPECT_ACL_PATH, "..", "unexpected.cipher"); await writeFile(unexpected, randomBytes(32)); }
    } });
    assert.equal(result.output[0].error, cases[1][1]); assert.equal(result.output[0].stage, "plan"); assert.deepEqual(result.output[0].tocPlanDiagnostic, cases[1][2]);
    assert.equal((await lstat(unexpected)).isFile(), true); hidden(result.output, context.file);
  }
}));

let originalSourceEofFunctions;
async function loadOriginalSourceEofFunctions() {
  originalSourceEofFunctions ??= (async () => {
    const source = await readFile(new URL("../../scripts/operations/restore-managed-inspect.mjs", import.meta.url), "utf8");
    const start = source.indexOf("function nativeInputCode(error) {"), end = source.indexOf("\nasync function privatePath(", start);
    assert.ok(start >= 0 && end > start); assert.equal(source.indexOf("function nativeInputCode(error) {", start + 1), -1);
    const declarations = source.slice(start, end); assert.equal(declarations.split("async function collectNative(").length, 2);
    // Execute the actual production function bodies; only lifecycle/error ports
    // are synthetic. No archive, native process, ACL helper, SQL or SDK is used.
    return new Function("ports", 'const {BackupError,types,fail,discard,stop}=ports;' + declarations + ';return { collectNative, nativeInputCode };')({ BackupError, types, fail: value => { throw new BackupError(value); }, discard() {}, stop() {} });
  })();
  return originalSourceEofFunctions;
}
test("native stdin qualifier accepts only own data EOF/EPIPE and refuses accessor/inherited/proxy codes without reads", async () => {
  const { nativeInputCode } = await loadOriginalSourceEofFunctions();
  for (const code of ["EOF", "EPIPE"]) assert.equal(nativeInputCode({ code }), code);
  assert.equal(nativeInputCode({ code: "ECONNRESET" }), "OTHER");
  let reads = 0;
  for (const code of ["ECONNRESET", "EOF", "EPIPE"]) {
    const accessor = Object.defineProperty({}, "code", { get() { reads++; return code; } });
    const inherited = Object.create(Object.defineProperty({}, "code", { get() { reads++; return code; } }));
    assert.equal(nativeInputCode(accessor), "OTHER"); assert.equal(nativeInputCode(inherited), "OTHER");
    assert.equal(nativeInputCode(Object.create({ code })), "OTHER");
  }
  const traps = { get() { reads++; throw Error(canary); }, getOwnPropertyDescriptor() { reads++; throw Error(canary); } };
  assert.equal(nativeInputCode(new Proxy({ code: "EPIPE" }, traps)), "OTHER");
  const revoked = Proxy.revocable({ code: "EOF" }, traps); revoked.revoke();
  assert.equal(nativeInputCode(revoked.proxy), "OTHER"); assert.equal(reads, 0);
});
async function observeOriginalSourceEofLifecycle({ order, late, code = "EOF", authenticatedSource = true }) {
  const { collectNative: collect } = await loadOriginalSourceEofFunctions(), child = new EventEmitter(), stdout = new EventEmitter(), stderr = new EventEmitter(), stdin = new EventEmitter(), trace = [];
  Object.assign(child, { stdout, stderr, stdin }); stderr.resume = () => {}; stdin.destroy = () => {};
  let first = true, finishIteration; const done = new Promise(resolve => { finishIteration = resolve; });
  stdout[Symbol.asyncIterator] = () => ({ next() { if (first) { first = false; return Promise.resolve({ done: false, value: Buffer.from("PUBLIC_SYNTHETIC_TOC") }); } return done; } });
  stdin.end = (_input, callback) => setImmediate(() => {
    const error = Object.assign(new Error(canary), { code });
    const pair = () => { for (const step of order === "callback-event" ? ["callback", "event"] : ["event", "callback"]) { trace.push(step); if (step === "callback") callback(error); else stdin.emit("error", error); } };
    trace.push("spawn"); child.emit("spawn"); if (!late) pair();
    trace.push("stdout-end"); stdout.emit("end"); trace.push("stderr-end"); stderr.emit("end"); trace.push("exit0"); child.emit("exit", 0, null); trace.push("close0"); child.emit("close", 0, null);
    if (late) pair(); finishIteration({ done: true, value: undefined });
  });
  let firstRefusal = null;
  try { const output = await collect(child, { check() {}, remaining: () => 2000 }, 1024, Buffer.from("PUBLIC_SYNTHETIC_INPUT"), error => { firstRefusal ??= error.code; }, null, authenticatedSource); output.fill(0); return { outcome: "accepted", firstRefusal, trace }; }
  catch (error) { return { outcome: "refused", code: error.code, firstRefusal, trace }; }
}
for (const order of ["callback-event", "event-callback"]) test("EOF Source same-turn post-close pair is refused: " + order, async () => {
  const result = await observeOriginalSourceEofLifecycle({ order, late: true });
  assert.equal(result.outcome, "refused"); assert.equal(result.code, "INSPECTION_INPUT_FAILED"); assert.equal(result.firstRefusal, "INSPECTION_INPUT_FAILED");
  assert.deepEqual(result.trace, ["spawn", "stdout-end", "stderr-end", "exit0", "close0", ...(order === "callback-event" ? ["callback", "event"] : ["event", "callback"])]);
});
test("EOF Source pre-close control still qualifies only the internally authenticated source", async () => {
  for (const order of ["callback-event", "event-callback"]) {
    const source = await observeOriginalSourceEofLifecycle({ order, late: false }); assert.equal(source.outcome, "accepted"); assert.equal(source.firstRefusal, null);
    const target = await observeOriginalSourceEofLifecycle({ order, late: false, authenticatedSource: false }); assert.equal(target.outcome, "refused"); assert.equal(target.code, "INSPECTION_INPUT_FAILED");
  }
});
test("EOF closed-state guard preserves the historical EPIPE branch in either ordering", async () => {
  for (const order of ["callback-event", "event-callback"]) for (const late of [false, true]) for (const authenticatedSource of [false, true]) {
    const result = await observeOriginalSourceEofLifecycle({ order, late, code: "EPIPE", authenticatedSource }); assert.equal(result.outcome, "accepted"); assert.equal(result.firstRefusal, null);
  }
});
