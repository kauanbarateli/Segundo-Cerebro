import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { planManagedRestore, managedRestoreRequirements, authorizeManagedRestore } from "../../scripts/operations/restore-managed-plan.mjs";
import { runManagedRestore } from "../../scripts/operations/restore-managed-stream.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";

// Everything below is artificial RAM: no pg_restore/psql executable, original
// backup/profile, filesystem materialization, HTTP, or hosted SQL is invoked.
const hash = value => createHash("sha256").update(value).digest("hex");
const database = Buffer.from("PGDMP_PRIVATE_CANARY_FAKE_DATABASE");
const binding = { archiveSha256: "a".repeat(64), databaseSha256: hash(database), databaseBytes: database.length };
const ref = "abcdefghijklmnopqrst", canary = "PRIVATE_CANARY_NEVER_REPORT";
const env = { SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + canary, SC_RESTORE_PG_RESTORE: resolve("fake-pg_restore"), SC_RESTORE_PSQL: resolve("fake-psql"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: canary, SC_RESTORE_PGSSLMODE: "require" };
const rows = [
  [1, "SCHEMA", "-", "auth", "supabase_auth_admin", []], [2, "SCHEMA", "-", "storage", "supabase_storage_admin", []], [3, "SCHEMA", "-", "app_private", "postgres", []],
  [4, "TABLE", "auth", "users", "supabase_auth_admin", [1]], [5, "TABLE", "storage", "objects", "supabase_storage_admin", [2]], [6, "TABLE", "storage", "buckets", "supabase_storage_admin", [2]],
  [7, "FUNCTION", "app_private", "on_auth_user_created()", "postgres", [3]], [8, "FUNCTION", "app_private", "check_admin_auth_creation_final()", "postgres", [3, 4]],
  [9, "TABLE DATA", "auth", "users", "supabase_auth_admin", [4]], [10, "TABLE DATA", "storage", "objects", "supabase_storage_admin", [5]], [11, "TABLE DATA", "storage", "buckets", "supabase_storage_admin", [6]],
  [12, "TABLE", "public", "profiles", "postgres", [4]], [13, "TABLE DATA", "public", "profiles", "postgres", [12]],
  [14, "TRIGGER", "auth", "users second_brain_identity_created", "postgres", [4, 7]], [15, "TRIGGER", "auth", "users second_brain_admin_creation_final", "postgres", [4, 8]],
  [16, "POLICY", "storage", "objects second_brain_private_objects", "supabase_storage_admin", [5]], [17, "POLICY", "storage", "buckets second_brain_private_buckets", "supabase_storage_admin", [6]],
];
const toc = ";\n;     TOC Entries: 17\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n;\n" + rows.map(([id, type, schema, tag, owner, dependencies]) => `${id}; 0 0 ${type} ${schema} ${tag} ${owner}\n` + (dependencies.length ? ";\tdepends on: " + dependencies.join(" ") + "\n" : "")).join("");
function qualified(mode = "setRole") {
  const plan = planManagedRestore(toc, binding);
  const history = () => ({ auth: [{ version: "20260101000000" }], storage: [{ id: 0, name: "create-migrations-table", hash: "a".repeat(40), executed_at: null }] });
  const scopes = { identityTrigger: ["auth", "users", "CREATE TRIGGER"], adminTrigger: ["auth", "users", "CREATE CONSTRAINT TRIGGER"], objectsPolicy: ["storage", "objects", "CREATE POLICY"], bucketsPolicy: ["storage", "buckets", "CREATE POLICY"] };
  const facts = { ...binding, tocSha256: managedRestoreRequirements(plan).tocSha256, archiveAuthenticated: true, nativeSqlControlQualified: true, actor: "postgres", sameActor: true, allTargetsEmpty: true, baselineMatchesArchive: true, baselineOwnerAclMatchesArchive: true, appOwnerAclCanBeRestored: true, dataCopyCanUseOperator: true, replicaCanUseOperator: { actor: "postgres", setLocalObserved: true, readback: "replica", rollbackObserved: true }, referencesCanBeVerified: true, managedMigrationHistories: { archive: history(), target: history() }, customRoles: Object.fromEntries(Object.entries(scopes).map(([key, [schema, table, operation]]) => [key, { mode: typeof mode === "string" ? mode : mode[key], actor: "postgres", schema, table, operation, canCreate: true, ...((typeof mode === "string" ? mode : mode[key]) === "setRole" ? { role: key.includes("Policy") ? "supabase_storage_admin" : "supabase_auth_admin", canSetRole: true } : {}) }])) };
  return { plan, authorization: authorizeManagedRestore(plan, facts), env, databaseSource: (async function* () { yield database.subarray(0, 8); yield database.subarray(8); })() };
}
function nativeHarness(options = {}) {
  const calls = [], inputs = [], lists = [], producers = [], eventOrder = [];
  let consumer, cleaned = 0, killed = 0;
  const child = () => Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() { killed++; }, unref() {} });
  const dependencies = {
    timeoutMs: options.timeoutMs ?? 500,
    materializeList: async list => { lists.push(list); return { path: resolve("RAM_ONLY_LIST_" + lists.length), sha256: hash(list), private: true }; },
    removeLists: async () => { cleaned++; if (options.cleanupFail) throw new Error(canary); },
    checkBeforeCommit: async ({ write, consumer: selected }) => { assert.equal(selected, consumer); eventOrder.push("validation"); if (options.validationThrow) throw new Error(canary); if (options.validationFalse) return false; await write("-- ARTIFICIAL_FIXED_VALIDATION_SEAM\n"); return true; },
    spawn(executable, args, settings) {
      calls.push({ executable, args, settings }); const selected = child();
      assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true);
      if (executable === env.SC_RESTORE_PSQL) {
        consumer = selected;
        consumer.stdin.on("data", bytes => {
          inputs.push(Buffer.from(bytes));
          if (bytes.toString() === "COMMIT;\n") {
            eventOrder.push("commit_requested");
            if (options.ack !== false) { consumer.stdout.write(options.rollback ? "ROLLBACK\n" : "COM"); if (!options.rollback) consumer.stdout.write(options.ackTruncated ? "MIT" : "MIT\r\n"); }
          }
        });
        consumer.stdin.on("finish", () => queueMicrotask(() => {
          if (!options.consumerNoEof) consumer.stdout.end();
          consumer.emit("close", options.consumerExit ?? 0);
        }));
        if (options.consumerEarly) queueMicrotask(() => { consumer.stdout.end(); consumer.emit("close", 0); });
        if (options.consumerError) queueMicrotask(() => consumer.emit("error", new Error(canary)));
        return selected;
      }
      assert.equal(executable, env.SC_RESTORE_PG_RESTORE);
      const index = producers.length; producers.push(selected);
      selected.stdin.on("data", bytes => { assert.equal(hash(bytes), binding.databaseSha256); });
      const finish = () => {
        const sql = index === 0 ? "-- " + canary + "\nCOPY public.artificial_copy FROM stdin;\nCOMMIT\n\\.\n" : "-- FAKE_CUSTOM_DDL_" + index + "\n";
        selected.stderr.end(canary); selected.stdout.write(sql);
        if (options.inputError === index) selected.stdin.emit("error", Object.assign(new Error(canary), { code: options.inputErrorCode ?? "EPIPE" }));
        if (options.beforeCommitAck === index) consumer.stdout.write("COMMIT\n");
        if (options.producerOutputClose === index) selected.stdout.destroy();
        else if (options.producerNoEof !== index) selected.stdout.end();
        if (options.producerNoClose !== index) { eventOrder.push("producer_close_" + index); selected.emit("close", options.producerFail === index ? 1 : 0); }
      };
      if (options.held === index) selected.release = finish; else queueMicrotask(finish);
      return selected;
    },
  };
  return { dependencies, calls, inputs, lists, producers, eventOrder, get cleaned() { return cleaned; }, get killed() { return killed; } };
}
const run = async (options, mode = "setRole") => { const harness = nativeHarness(options); return { report: await runManagedRestore(qualified(mode), harness.dependencies), harness }; };
const sentCommit = harness => harness.inputs.some(bytes => bytes.toString() === "COMMIT;\n");
const progress = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); } assert.fail("artificial harness did not reach its intended boundary"); };

test("bound private RAM source and original owners/ACL produce five qualified-role segments, then validation, observed COMMIT and consumer EOF/close0", async () => {
  const { report, harness } = await run();
  assert.equal(report.ok, true); assert.equal(report.producerSegmentsFinished, 5); assert.equal(report.commitAckObserved, true); assert.equal(report.consumerFinished, true); assert.equal(report.remoteOutcome, "committed"); assert.equal(report.restoreAccepted, false);
  assert.equal(harness.calls.length, 6); assert.equal(harness.cleaned, 1); assert.equal(harness.killed, 0);
  const sql = Buffer.concat(harness.inputs).toString();
  assert.equal(sql.startsWith("BEGIN;\nSET LOCAL session_replication_role = replica;\n"), true);
  assert.equal((sql.match(/SET LOCAL ROLE/g) ?? []).length, 4); assert.equal((sql.match(/RESET ROLE/g) ?? []).length, 4);
  assert.equal(sql.includes("COPY public.artificial_copy FROM stdin;\nCOMMIT\n\\.\n"), true, "COPY body is forwarded verbatim, never SQL-regex filtered");
  assert.equal(harness.eventOrder.indexOf("commit_requested") > harness.eventOrder.indexOf("producer_close_4"), true);
  assert.equal(harness.eventOrder.indexOf("commit_requested") > harness.eventOrder.indexOf("validation"), true);
  for (const call of harness.calls.slice(1)) { assert.deepEqual(call.args.slice(0, 1), ["--exit-on-error"]); assert.equal(call.args.includes("--file=-"), true); for (const forbidden of ["--clean", "--if-exists", "--no-owner", "--no-acl", "--single-transaction", "--use-set-session-authorization"]) assert.equal(call.args.includes(forbidden), false); }
  for (const call of harness.calls) { assert.equal(call.settings.env.PGOPTIONS, undefined); assert.equal(call.settings.env.PGPASSWORD, canary); assert.equal(JSON.stringify(call.args).includes(canary), false); }
  assert.equal(JSON.stringify(report).includes(canary), false);
});
test("valid SQL prefix followed by producer close1 never supplies COMMIT; error/cleanup cannot heal or replace the first refusal", async () => {
  const { report, harness } = await run({ producerFail: 0, cleanupFail: true });
  assert.equal(report.ok, false); assert.equal(report.error, "RESTORE_MANAGED_PRODUCER_FAILED"); assert.equal(sentCommit(harness), false); assert.equal(report.remoteOutcome, "unknown"); assert.equal(report.rollbackObserved, false); assert.equal(harness.killed > 0, true); assert.equal(JSON.stringify(report).includes(canary), false);
});
test("real producer EOF without close and close0 without EOF both remain pending until bounded refusal, with no COMMIT", async () => {
  for (const option of [{ producerNoClose: 0 }, { producerNoEof: 0 }]) { const { report, harness } = await run({ ...option, timeoutMs: 40 }); assert.equal(report.error, "RESTORE_MANAGED_TIMEOUT"); assert.equal(report.producerSegmentsFinished, 0); assert.equal(sentCommit(harness), false); }
});
test("an unfinished later segment prevents COMMIT even after earlier real terminal events", async () => {
  const harness = nativeHarness({ held: 4 }); const pending = runManagedRestore(qualified(), harness.dependencies);
  await progress(() => harness.producers.length === 5); assert.equal(sentCommit(harness), false); assert.equal(harness.eventOrder.includes("validation"), false);
  harness.producers[4].release(); const report = await pending; assert.equal(report.ok, true);
});
test("consumer exit0 before COMMIT, consumer error and premature COMMIT output are failures, never a completed restore", async () => {
  for (const option of [{ consumerEarly: true }, { consumerError: true }, { beforeCommitAck: 0 }]) { const { report, harness } = await run(option); assert.equal(report.ok, false); assert.equal(report.error, "RESTORE_MANAGED_CONSUMER_FAILED"); assert.equal(sentCommit(harness), false); assert.equal(report.consumerFinished, false); }
});
test("consumer close0 without COMMIT acknowledgement or without stdout EOF cannot pass; ROLLBACK is observed rather than renamed COMMIT", async () => {
  for (const option of [{ ack: false }, { rollback: true }, { consumerNoEof: true }, { consumerExit: 1 }]) { const { report } = await run({ ...option, timeoutMs: 40 }); assert.equal(report.ok, false); assert.equal(report.consumerFinished, false); assert.equal(report.remoteOutcome, "unknown"); if (option.rollback) { assert.equal(report.rollbackObserved, true); assert.equal(report.commitAckObserved, false); } }
});
test("truncated COMMIT text without its native newline is not a complete acknowledgement", async () => {
  const { report } = await run({ ackTruncated: true }); assert.equal(report.ok, false); assert.equal(report.commitAckObserved, false);
});
test("producer stdout close without its real end event is not EOF even when the process closes0", async () => {
  const { report, harness } = await run({ producerOutputClose: 0 }); assert.equal(report.ok, false); assert.equal(report.error, "RESTORE_MANAGED_PRODUCER_FAILED"); assert.equal(sentCommit(harness), false);
});
test("custom TOC-only EPIPE requires full bound source plus producer close0 and SQL EOF; DATA and other errors refuse", async () => {
  const custom = await run({ inputError: 1 }); assert.equal(custom.report.ok, true);
  for (const option of [{ inputError: 0 }, { inputError: 1, inputErrorCode: "OTHER" }, { inputError: 1, producerFail: 1 }, { inputError: 1, producerNoEof: 1 }]) { const { report, harness } = await run({ ...option, timeoutMs: 40 }); assert.equal(report.ok, false); assert.equal(sentCommit(harness), false); }
});
test("the encrypted-snapshot/database binding must finish completely before any list or native child", async () => {
  for (const source of [(async function* () { yield database.subarray(0, 8); })(), (async function* () { yield Buffer.concat([database, Buffer.from("TAIL")]); })(), (async function* () { yield Buffer.from("PGDMP_DIFFERENT_DATABASE"); })(), (async function* () { yield "not-bytes"; })()]) {
    const harness = nativeHarness(), request = qualified(); request.databaseSource = source;
    const report = await runManagedRestore(request, harness.dependencies); assert.equal(report.error, "RESTORE_MANAGED_DATABASE_INVALID"); assert.equal(report.remoteOutcome, "not_started"); assert.equal(harness.calls.length, 0); assert.equal(harness.lists.length, 0);
  }
});
test("private TOC materializer digest/descriptors are closed; fake authorization and personal target never spawn", async () => {
  for (const result of [{ path: resolve("FAKE"), sha256: "b".repeat(64), private: true }, { path: "relative", sha256: hash("irrelevant"), private: true }, { path: resolve("FAKE"), sha256: hash("irrelevant"), private: true, secret: canary }]) {
    const harness = nativeHarness(); harness.dependencies.materializeList = async () => result;
    const report = await runManagedRestore(qualified(), harness.dependencies); assert.equal(report.error, "RESTORE_MANAGED_LIST_INVALID"); assert.equal(harness.calls.length, 0); assert.equal(JSON.stringify(report).includes(canary), false);
  }
  for (const alter of [request => { request.authorization = {}; }, request => { request.env = { ...env, SC_RESTORE_PROJECT_REF: PERSONAL_REF, SC_RESTORE_CONFIRM_PROJECT: PERSONAL_REF }; }]) {
    const harness = nativeHarness(), request = qualified(); alter(request); const report = await runManagedRestore(request, harness.dependencies); assert.equal(report.ok, false); assert.equal(harness.calls.length, 0); assert.equal(harness.lists.length, 0);
  }
});
test("private TOC getters are not invoked and an original database replay error after bytes still stops before any child", async () => {
  let getters = 0; const harness = nativeHarness();
  harness.dependencies.materializeList = async list => ({ get path() { getters++; return resolve("FAKE"); }, sha256: hash(list), private: true });
  assert.equal((await runManagedRestore(qualified(), harness.dependencies)).error, "RESTORE_MANAGED_LIST_INVALID"); assert.equal(getters, 0); assert.equal(harness.calls.length, 0);
  const replayHarness = nativeHarness(), request = qualified(); request.databaseSource = (async function* () { yield database; throw new Error(canary); })();
  const report = await runManagedRestore(request, replayHarness.dependencies); assert.equal(report.ok, false); assert.equal(report.remoteOutcome, "not_started"); assert.equal(replayHarness.calls.length, 0); assert.equal(JSON.stringify(report).includes(canary), false);
});
test("required in-transaction reference/catalog validator may refuse or throw; a separate connection is never supplied by default", async () => {
  for (const option of [{ validationFalse: true }, { validationThrow: true }]) { const { report, harness } = await run(option); assert.equal(report.ok, false); assert.equal(sentCommit(harness), false); assert.equal(JSON.stringify(report).includes(canary), false); }
  const report = await runManagedRestore(qualified()); assert.equal(report.error, "RESTORE_MANAGED_DEPENDENCIES_REQUIRED"); assert.equal(report.remoteOutcome, "not_started");
});
test("consumer backpressure keeps the current producer pending and forbids COMMIT until original write completion", async () => {
  const harness = nativeHarness(); const original = harness.dependencies.spawn; let release, writes = 0;
  harness.dependencies.spawn = (...args) => {
    const selected = original(...args);
    if (args[0] === env.SC_RESTORE_PSQL) { const write = selected.stdin.write.bind(selected.stdin); selected.stdin.write = (bytes, callback) => { writes++; if (writes === 2) { release = () => write(bytes, callback); return false; } return write(bytes, callback); }; }
    return selected;
  };
  const pending = runManagedRestore(qualified(), harness.dependencies); await progress(() => typeof release === "function");
  assert.equal(harness.producers.length, 1); assert.equal(sentCommit(harness), false); release(); assert.equal((await pending).ok, true);
});

test("currentActor omits SET/RESET ROLE while mixed authority changes only its exact SET-owner segments; original terminal/validation gates stay required", async () => {
  for (const [mode, expected] of [["currentActor", 0], [{ identityTrigger: "currentActor", adminTrigger: "setRole", objectsPolicy: "currentActor", bucketsPolicy: "setRole" }, 2]]) {
    const { report, harness } = await run(undefined, mode), sql = Buffer.concat(harness.inputs).toString();
    assert.equal(report.ok, true); assert.equal(report.restoreAccepted, false); assert.equal(report.producerSegmentsFinished, 5); assert.equal(report.commitAckObserved, true); assert.equal(report.consumerFinished, true);
    assert.equal((sql.match(/SET LOCAL ROLE/g) ?? []).length, expected); assert.equal((sql.match(/RESET ROLE/g) ?? []).length, expected);
    assert.equal(harness.eventOrder.indexOf("commit_requested") > harness.eventOrder.indexOf("producer_close_4"), true);
    assert.equal(harness.eventOrder.indexOf("commit_requested") > harness.eventOrder.indexOf("validation"), true);
    assert.equal(sql.startsWith("BEGIN;\nSET LOCAL session_replication_role = replica;\n"), true);
    assert.equal(sql.includes("SET LOCAL session_replication_role = origin;\n"), true);
    for (const call of harness.calls.slice(1)) for (const forbidden of ["--clean", "--no-owner", "--no-acl", "--use-set-session-authorization"]) assert.equal(call.args.includes(forbidden), false);
    assert.equal(JSON.stringify(report).includes(canary), false);
  }
});
test("delegated custom-only EPIPE remains distinct from DATA; currentActor cannot turn close0, EOF or ACK alone into completion", async () => {
  assert.equal((await run({ inputError: 1 }, "currentActor")).report.ok, true);
  for (const option of [{ inputError: 0 }, { inputError: 1, producerFail: 1 }, { inputError: 1, producerNoEof: 1 }, { producerNoClose: 4 }, { consumerNoEof: true }, { ack: false }, { validationFalse: true }]) {
    const { report, harness } = await run({ ...option, timeoutMs: 40 }, "currentActor");
    assert.equal(report.ok, false); assert.equal(report.restoreAccepted, false); assert.equal(report.remoteOutcome, "unknown");
    if (!option.consumerNoEof && !Object.hasOwn(option, "ack")) assert.equal(sentCommit(harness), false);
  }
});
