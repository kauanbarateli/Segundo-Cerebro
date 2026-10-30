// Pure/process-owner doubles and temporary SOURCE-file IO. No Supabase, Docker,
// PostgreSQL, application, fixture user, hosted credential or release acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, mkdir, writeFile, readdir, rm, realpath, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_TYPES_BRANCH, PUBLIC_TYPES_OUTPUT, PUBLIC_TYPES_SOURCE_SEEDS, PUBLIC_TYPES_MIGRATIONS, validatePublicTypesEnvironment, createPublicTypesByteCapture, verifyPublicTypesMigrationRows, copyPublicTypesMigrations, validatePublicTypesContainers, validatePublicTypesLedger, inspectPublicTypesCandidate, teardownPublicTypesCandidate, validatePublicTypesMetadata, writePublicTypesCandidate, preparePublicTypesCandidate, main } from "../../scripts/verification/prepare-public-types-candidate.mjs";
const ROOT = fileURLToPath(new URL("../../", import.meta.url)), canary = "PRIVATE_TYPES_CANDIDATE_CANARY", hash = b => createHash("sha256").update(b).digest("hex");
const refused = (fn, code) => assert.throws(fn, e => e.message === code && !String(e.stack).includes(canary));
const env = () => ({ PATH: "/usr/bin", HOME: "/home/runner", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", CI: "true", GITHUB_ACTIONS: "true", RUNNER_TEMP: "/tmp/runner", GITHUB_SHA: "a".repeat(40), GITHUB_REF: PUBLIC_TYPES_BRANCH, GITHUB_EVENT_NAME: "push", GITHUB_OUTPUT: "/tmp/runner/_runner_file_commands/set_output_12345678-1234-1234-1234-123456789abc", SC_AUTH_LOCAL_CI_RUN: "1", SC_PUBLIC_TYPES_CANDIDATE: "1" });
const project = "sc-auth-ci-" + "b".repeat(24), context = { systemIdentifier: "1234567890123456789" };
const ledger = () => ({ bound: true, noAuthFixtures: true, systemIdentifier: context.systemIdentifier, ledger: PUBLIC_TYPES_MIGRATIONS.map(p => { const name = p.path.split("/").at(-1); return { version: name.slice(0, 14), name: name.slice(15, -4), statementCount: 1, statementHash: "a".repeat(64) }; }) });
const containers = () => ["db", "kong", "auth", "rest", "storage"].map((kind, i) => ({ id: String(i + 1).repeat(64), name: "/supabase_" + kind + "_" + project, label: project, running: true, image: "sha256:" + "a".repeat(64), ports: kind === "db" ? { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "54322" }] } : kind === "kong" ? { "8000/tcp": [{ HostIp: "0.0.0.0", HostPort: "54321" }] } : {} }));
const currentTypes = () => readFile(new URL("../../src/lib/supabase/database.generated.ts", import.meta.url));
const migrationRows = () => Promise.all(PUBLIC_TYPES_MIGRATIONS.map(async p => ({ path: p.path, source: await readFile(resolve(ROOT, p.path)) })));
async function metadata(bytes) {
  const paths = [...PUBLIC_TYPES_SOURCE_SEEDS, "scripts/verification/auth-local-ci.mjs", "scripts/verification/foundation-local-ci.mjs", "scripts/operations/check-database-types.mjs"];
  const sourceHashes = [...PUBLIC_TYPES_MIGRATIONS.map(p => ({ ...p })), ...await Promise.all(paths.map(async path => { const b = await readFile(resolve(ROOT, path)); return { path, bytes: b.length, sha256: hash(b) }; }))];
  return { formatVersion: 1, purpose: "PUBLIC_TYPES_PREPARATION_NOT_RELEASE", acceptance: false, hostedCertified: false, catalogueCertified: false, localOnly: true, sourceSha: "a".repeat(40), sourceHashes, dependencyHashes: ["node_modules/typescript/package.json", "node_modules/typescript/lib/typescript.js"].map(path => ({ path, bytes: 1, sha256: "b".repeat(64) })), cliVersion: "2.120.0", postgresVersion: 170006, migrations: PUBLIC_TYPES_MIGRATIONS, ledger: ledger(), containers: validatePublicTypesContainers(containers(), project), noOpSecondApply: true, types: inspectPublicTypesCandidate(bytes.toString("utf8"), bytes), infrastructure: { ioQuiet: true, namespaceRemoved: true, directoriesRemoved: true } };
}
async function outputFixture() { const root = await realpath(await mkdtemp(join(tmpdir(), "sc-types-export-"))), commands = join(root, "_runner_file_commands"), output = join(commands, "set_output_12345678-1234-1234-1234-123456789abc"); await mkdir(commands); await writeFile(output, ""); return { root, output }; }

test("import/help and unexpected arguments never enter the executable preparation", async () => {
  let calls = 0; const output = [], execute = async () => { calls++; throw new Error(canary); };
  for (const args of [[], ["--help"], ["--execute", "--remote"], ["--project-ref", canary]]) await main(args, {}, v => output.push(v), execute);
  assert.equal(calls, 0); assert.equal(output.length, 4); assert.equal(JSON.stringify(output).includes(canary), false); assert.equal(output.every(v => v.acceptance === false), true);
});
test("only opt-in Linux GitHub push/manual for the exact preparation branch is accepted", () => {
  assert.equal(validatePublicTypesEnvironment(env(), "linux").environment.GITHUB_SHA, "a".repeat(40));
  assert.equal(validatePublicTypesEnvironment({ ...env(), GITHUB_EVENT_NAME: "workflow_dispatch" }, "linux").environment.GITHUB_REF, PUBLIC_TYPES_BRANCH);
  for (const delta of [{ CI: "false" }, { GITHUB_ACTIONS: "false" }, { SC_AUTH_LOCAL_CI_RUN: "0" }, { SC_PUBLIC_TYPES_CANDIDATE: "0" }, { GITHUB_SHA: "A".repeat(40) }, { GITHUB_REF: "refs/heads/main" }, { GITHUB_EVENT_NAME: "pull_request" }, { RUNNER_TEMP: "relative" }, { GITHUB_OUTPUT: "/tmp/foreign" }]) refused(() => validatePublicTypesEnvironment({ ...env(), ...delta }, "linux"), "ENVIRONMENT_REFUSED");
  refused(() => validatePublicTypesEnvironment(env(), "win32"), "ENVIRONMENT_REFUSED");
});
test("credentials, env injection and own accessors are refused without inspecting secret values", () => {
  for (const name of ["SUPABASE_ACCESS_TOKEN", "PGPASSWORD", "DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN", "ASAAS_API_KEY", "NODE_OPTIONS", "DOCKER_HOST", "NPM_CONFIG_USERCONFIG"]) refused(() => validatePublicTypesEnvironment({ ...env(), [name]: canary }, "linux"), "ENVIRONMENT_REFUSED");
  let reads = 0; const value = env(); Object.defineProperty(value, "GITHUB_SHA", { enumerable: true, get() { reads++; throw new Error(canary); } }); refused(() => validatePublicTypesEnvironment(value, "linux"), "ENVIRONMENT_REFUSED"); assert.equal(reads, 0);
});
test("an invalid execution environment cannot invoke a subprocess or source write", async () => {
  let calls = 0; await assert.rejects(preparePublicTypesCandidate({ ...env(), GITHUB_REF: "refs/heads/main" }, { run() { calls++; throw new Error(canary); } }), e => e.message === "ENVIRONMENT_REFUSED"); assert.equal(calls, 0);
});
test("stdout bytes survive split UTF8 and require their original EOF", () => {
  const stream = new EventEmitter(); stream.readableEnded = false; const c = createPublicTypesByteCapture(64), bytes = Buffer.from("type X = '🧠';\n"); assert.equal(c.observer.start({ stdout: stream }), true);
  for (const byte of bytes) assert.equal(c.observer.data(Buffer.from([byte]), stream), true);
  refused(() => c.take(), "PROCESS_UNCONFIRMED"); assert.equal(c.observer.end(stream), false); refused(() => c.take(), "PROCESS_UNCONFIRMED");
  const clean = createPublicTypesByteCapture(64), original = new EventEmitter(); original.readableEnded = false; clean.observer.start({ stdout: original }); for (const byte of bytes) clean.observer.data(Buffer.from([byte]), original); original.readableEnded = true; assert.equal(clean.observer.end(original), true); assert.deepEqual(clean.take(), bytes);
});
test("wrong stream, post-EOF output, string chunks and byte overflow stay refused", () => {
  for (const mutate of [(c) => c.observer.data(Buffer.from("x"), new EventEmitter()), (c, s) => c.observer.data("x", s), (c, s) => c.observer.data(Buffer.alloc(9), s), (c, s) => { s.readableEnded = true; c.observer.end(s); return c.observer.data(Buffer.from("x"), s); }]) { const s = new EventEmitter(), c = createPublicTypesByteCapture(8); c.observer.start({ stdout: s }); assert.equal(mutate(c, s), false); refused(() => c.take(), "PROCESS_UNCONFIRMED"); }
});
test("all26 canonical pins are checked and snapshotted before any copy", async () => {
  const rows = await migrationRows(), checked = verifyPublicTypesMigrationRows(rows); assert.equal(checked.length, 26); assert.notEqual(checked[0].source, rows[0].source); const first = checked[0].source[0]; rows[0].source[0] ^= 1; assert.equal(checked[0].source[0], first);
  let writes = 0, stats = 0; await assert.rejects(copyPublicTypesMigrations(rows, "/tmp/owned/migrations", "/tmp/owned", { writeFile() { writes++; }, lstat() { stats++; } }), e => e.message === "SOURCE_REFUSED"); assert.equal(writes, 0); assert.equal(stats, 0);
});
test("omitted/duplicate/swapped/extra/sparse migrations and changed025/026 bytes are refused", async () => {
  const original = await migrationRows();
  for (const change of [r => r.pop(), r => r.push(r[0]), r => { r[24] = r[23]; }, r => { [r[0], r[1]] = [r[1], r[0]]; }, r => { delete r[3]; }, r => { r[24].source[0] ^= 1; }, r => { r[25].source[0] ^= 1; }, r => { r[25] = r[24]; }, r => { r[24].path = "supabase/migrations/99999999999999_foreign.sql"; }]) { const rows = original.map(r => ({ path: r.path, source: Buffer.from(r.source) })); change(rows); refused(() => verifyPublicTypesMigrationRows(rows), "SOURCE_REFUSED"); }
});
test("migration accessors, symbols and prototype iterators cannot run before validation", async () => {
  const original = await migrationRows(); let reads = 0;
  for (const change of [r => Object.defineProperty(r[0], "source", { enumerable: true, get() { reads++; return Buffer.from(canary); } }), r => { r[0][Symbol("private")] = canary; }, r => Object.setPrototypeOf(r, Object.create(Array.prototype, { [Symbol.iterator]: { get() { reads++; throw new Error(canary); } } }))]) { const rows = original.map(r => ({ ...r })); change(rows); refused(() => verifyPublicTypesMigrationRows(rows), "SOURCE_REFUSED"); }
  assert.equal(reads, 0);
});
test("five original named/labeled containers and local DB/API bindings must match", () => {
  assert.equal(validatePublicTypesContainers(containers(), project).length, 5);
  for (const change of [r => r.pop(), r => { r[1].id = r[0].id; }, r => { r[0].label = "foreign"; }, r => { r[4].running = false; }, r => { r[0].ports["5432/tcp"][0].HostPort = "6543"; }, r => { r[1].ports["8000/tcp"][0].HostIp = "example.invalid"; }, r => { r[2].image = "unpinned"; }]) { const rows = containers(); change(rows); refused(() => validatePublicTypesContainers(rows, project), "NATIVE_REFUSED"); }
});
test("ledger binds PG instance, noAuth and all26 ordered original migration identities", () => {
  assert.equal(validatePublicTypesLedger(ledger(), context).ledger.length, 26);
  for (const change of [v => { v.bound = false; }, v => { v.noAuthFixtures = false; }, v => { v.systemIdentifier = "9876543210123456789"; }, v => v.ledger.pop(), v => { v.ledger[24] = v.ledger[23]; }, v => { v.ledger[25] = v.ledger[24]; }, v => { v.ledger[0].statementCount = 0; }, v => { v.ledger[0].statementHash = canary; }]) { const value = ledger(); change(value); refused(() => validatePublicTypesLedger(value, context), "LEDGER_REFUSED"); }
});
test("parse-only official-source candidate accepts AST drift without claiming acceptance", async () => {
  const original = await currentTypes(), baseline = original.toString("utf8"), changed = Buffer.from(baseline.replace(/(\bp_scope\b|"p_scope"): string/, "$1: number")); assert.notDeepEqual(changed, original);
  assert.equal(inspectPublicTypesCandidate(baseline, original).ast.code, "SNAPSHOT_MATCH"); assert.equal(inspectPublicTypesCandidate(baseline, changed).ast.code, "SNAPSHOT_DIFFER");
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(2 * 1024 * 1024 + 1), Buffer.from([0xff]), Buffer.from(baseline + ";throw Error('" + canary + "');")]) refused(() => inspectPublicTypesCandidate(baseline, bytes), "TYPES_REFUSED");
});
test("cleanup cannot stop/remove an active group or remove a surviving namespace", async () => {
  const calls = [], actions = { stop: async () => calls.push("stop"), inventory: async () => { calls.push("inventory"); return false; }, remove: async () => calls.push("remove") };
  assert.equal((await teardownPublicTypesCandidate({ groupKnown: false, pending: 0, startAttempted: true, rootCreated: true }, actions)).ioQuiet, false); assert.deepEqual(calls, []);
  await teardownPublicTypesCandidate({ groupKnown: true, pending: 1, startAttempted: true, rootCreated: true }, actions); assert.deepEqual(calls, []);
  assert.equal((await teardownPublicTypesCandidate({ groupKnown: true, pending: 0, startAttempted: true, rootCreated: true }, actions)).directoriesRemoved, false); assert.deepEqual(calls, ["stop", "inventory"]);
});
test("cleanup success preserves stop→empty inventory→owned removal order and failures remain closed", async () => {
  const calls = []; const result = await teardownPublicTypesCandidate({ groupKnown: true, pending: 0, startAttempted: true, rootCreated: true }, { stop: async () => calls.push("stop"), inventory: async () => { calls.push("inventory"); return true; }, remove: async () => calls.push("remove") }); assert.deepEqual(result, { ioQuiet: true, namespaceRemoved: true, directoriesRemoved: true }); assert.deepEqual(calls, ["stop", "inventory", "remove"]);
  const failed = await teardownPublicTypesCandidate({ groupKnown: true, pending: 0, startAttempted: true, rootCreated: true }, { stop: async () => { throw new Error(canary); }, inventory: async () => true, remove: async () => calls.push("bad-remove") }); assert.equal(failed.namespaceRemoved, false); assert.equal(calls.includes("bad-remove"), false);
});
test("candidate metadata refuses invented acceptance, incomplete sources/cleanup, unknown data and mismatched bytes", async () => {
  const bytes = await currentTypes(), value = await metadata(bytes); assert.equal(validatePublicTypesMetadata(value, bytes).acceptance, false);
  for (const change of [v => { v.acceptance = true; }, v => { v.hostedCertified = true; }, v => { v.catalogueCertified = true; }, v => { v.postgresVersion = 180000; }, v => { v.cliVersion = "latest"; }, v => { v.noOpSecondApply = false; }, v => { v.infrastructure.ioQuiet = false; }, v => { v.infrastructure.namespaceRemoved = false; }, v => { v.infrastructure.directoriesRemoved = false; }, v => { v.sourceHashes = v.sourceHashes.filter(p => p.path !== PUBLIC_TYPES_SOURCE_SEEDS[0]); }, v => { v.sourceHashes[0].sha256 = "0".repeat(64); }, v => { v.types.ast.private = canary; }, v => { v.secret = canary; }]) { const bad = structuredClone(value); change(bad); refused(() => validatePublicTypesMetadata(bad, bytes), "EXPORT_REFUSED"); }
  refused(() => validatePublicTypesMetadata(value, Buffer.from("different")), "EXPORT_REFUSED");
});
test("unsafe output or ineligible cleanup emits no files and no ready flag", async () => {
  const bytes = await currentTypes(), value = await metadata(bytes), f = await outputFixture();
  try { const bad = structuredClone(value); bad.infrastructure.namespaceRemoved = false; assert.equal(await writePublicTypesCandidate(f.root, f.output, bad, bytes), false); assert.equal(await readFile(f.output, "utf8"), ""); assert.deepEqual((await readdir(f.root)).sort(), ["_runner_file_commands"]); assert.equal(await writePublicTypesCandidate(f.root, join(f.root, "foreign"), value, bytes), false); assert.equal(await readFile(f.output, "utf8"), ""); } finally { await rm(f.root, { recursive: true, force: true }); }
});
test("only types.ts and metadata.json are written and read back before the one ready flag", async () => {
  const bytes = await currentTypes(), value = await metadata(bytes), f = await outputFixture();
  try { assert.equal(await writePublicTypesCandidate(f.root, f.output, value, bytes), true); const dir = join(f.root, PUBLIC_TYPES_OUTPUT); assert.deepEqual((await readdir(dir)).sort(), ["metadata.json", "types.ts"]); assert.deepEqual(await readFile(join(dir, "types.ts")), bytes); const written = JSON.parse(await readFile(join(dir, "metadata.json"), "utf8")); assert.equal(written.acceptance, false); assert.equal(written.sourceSha, value.sourceSha); assert.equal(written.types.sha256, hash(bytes)); assert.equal(await readFile(f.output, "utf8"), "public_types_candidate_ready=true\n"); assert.equal(JSON.stringify(written).includes(canary), false); } finally { await rm(f.root, { recursive: true, force: true }); }
});
test("existing/symlinked output locations and occupied command files cannot be overwritten", async () => {
  const bytes = await currentTypes(), value = await metadata(bytes);
  for (const mode of ["occupied", "existing-directory", "symlink-command"]) { const f = await outputFixture(); try { if (mode === "occupied") await writeFile(f.output, canary); if (mode === "existing-directory") { await mkdir(join(f.root, PUBLIC_TYPES_OUTPUT)); await writeFile(join(f.root, PUBLIC_TYPES_OUTPUT, "keep"), canary); } if (mode === "symlink-command") { await rm(f.output); await writeFile(join(f.root, "personal"), canary); await symlink(join(f.root, "personal"), f.output); } assert.equal(await writePublicTypesCandidate(f.root, f.output, value, bytes), false); assert.equal((await readFile(f.output, "utf8")).includes("ready=true"), false); if (mode === "existing-directory") assert.equal(await readFile(join(f.root, PUBLIC_TYPES_OUTPUT, "keep"), "utf8"), canary); } finally { await rm(f.root, { recursive: true, force: true }); } }
});
test("workflow keeps a separate preparation, exact branch/CLI and only two source artifacts", async () => {
  const source = await readFile(new URL("../../.github/workflows/public-types-candidate.yml", import.meta.url), "utf8"); assert.match(source, /branches: \[codex\/redesign-parallel-20261022\]/); assert.match(source, /contents: read/); assert.match(source, /persist-credentials: false/); assert.match(source, /cancel-in-progress: false/); assert.match(source, /supabase\/setup-cli@bea637206310b05056109c4ffab256b2c3c522af/); assert.match(source, /version: "2\.120\.0"/); assert.match(source, /env -i/); assert.match(source, /public_types_candidate_ready == 'true'/); assert.match(source, /sc-public-types-candidate\/types\.ts/); assert.match(source, /sc-public-types-candidate\/metadata\.json/); assert.doesNotMatch(source, /pull_request:|secrets\.|continue-on-error|supabase (?:link|login|db reset)|\.env\.local|upload.*logs/);
});
