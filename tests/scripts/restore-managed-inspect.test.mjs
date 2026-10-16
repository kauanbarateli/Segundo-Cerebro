import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, writeFile, readdir, rm, rmdir, lstat, realpath, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, win32 } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import { writeBackup } from "../../scripts/operations/backup-format.mjs";
import { DATABASE_METADATA } from "../../scripts/operations/backup-sources.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { INSPECTION_LIMITS, PRIVATE_PATH_ACL_SCRIPT, defaultInspectionTemporaryRoot, inspectManagedBackup, inspectManagedBackupFormat, runManagedInspect } from "../../scripts/operations/restore-managed-inspect.mjs";
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
const key = randomBytes(32), baseEnv = { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, SC_BACKUP_ENCRYPTION_KEY: key.toString("base64"), SC_BACKUP_KEY_ID: "fixture-v1", SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + canary, SC_RESTORE_PG_RESTORE: resolve("not-installed-pg_restore"), SC_RESTORE_PSQL: resolve("not-installed-psql"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: canary, SC_RESTORE_PGSSLMODE: "require", PGPASSWORD: canary, GOOGLE_TOKEN_ENCRYPTION_KEY: canary };
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
      assert.equal(executable, baseEnv.SC_RESTORE_PG_RESTORE); assert.deepEqual(args, ["--list", "--verbose"]);
      assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true); assert.deepEqual(settings.stdio, ["pipe", "pipe", "pipe"]);
      assert.equal(Object.keys(settings.env).some(name => !["PATH", "SystemRoot", "TEMP", "TMP"].includes(name)), false);
      selected.stdin.on("data", bytes => { inputReferences.push(bytes); observed.push(hash(bytes)); });
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
async function execute(context, options = {}, selectedEnv = context.env) {
  const fake = harness(options), output = [];
  const exit = await runManagedInspect(["inspect", context.file], selectedEnv, value => output.push(value), { ...context.dependencies, ...fake.dependencies, timeoutMs: options.timeoutMs ?? 2000 });
  return { exit, output, fake };
}
const hidden = (output, file) => { const text = JSON.stringify(output); for (const forbidden of [canary, key.toString("base64"), file, '"auth"', '"storage"', "supabase_auth_admin", "postgres", "PGDMP", toc]) assert.equal(text.includes(forbidden), false); };

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
