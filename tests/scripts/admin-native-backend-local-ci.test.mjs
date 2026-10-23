// Closed protocol/infra contracts and injected IO. Never starts a stack/job.
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { ADMIN_NATIVE_CASES, ADMIN_NATIVE_MANIFEST, ADMIN_NATIVE_STAGES, ADMIN_NATIVE_CHECKS, ADMIN_NATIVE_PASS_COUNTS, ADMIN_NATIVE_CLEANUP_STAGES, ADMIN_NATIVE_CLEANUP_COUNTS, assembleAdminNativePacket } from "../e2e-auth-local/admin-native-backend-contract.mjs";
import { ADMIN_LOCAL_SOURCE_PATHS, ADMIN_LOCAL_DEPENDENCY_PATHS, ADMIN_LOCAL_INFRA_CHECKS, ADMIN_LOCAL_CASE_CHECKS, ADMIN_LOCAL_LIMITATIONS, ADMIN_LOCAL_SDK_VERSIONS, validateAdminLocalCiReport, validateAdminLocalCaseReport } from "../e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
import { requireAdminCi, decodeAdminSql, verifyAdminInstance, adminMarkerInput, adminInspectionInput, createAdminSqlInspector, acceptAdminContainer, createAdminOwnedTransport, collectAdminSources, verifyAdminTslibScope, probeAdminPort, adminPortFailure, main } from "../../scripts/verification/admin-native-backend-local-ci.mjs";
const sha = "b".repeat(40), namespace = "sc-admin-native-" + "a".repeat(32), systemIdentifier = "7250000000000000001", projectId = "sc-auth-ci-" + "c".repeat(24), empty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const flags = (keys, value) => Object.fromEntries(keys.map(k => [k, value]));
const sources = () => ADMIN_NATIVE_MANIFEST.map(path => ({ path, sha256: "c".repeat(64), bytes: 128 }));
const passed = kind => ({ schemaVersion: 1, scenario: "admin-native-backend", provenance: "protocol-only", case: kind, sourceSha: sha, sourceHashes: sources(), status: "passed", code: "PASSED", failurePoint: null, stages: ADMIN_NATIVE_STAGES[kind].map(name => ({ name, passed: true })), counts: { ...ADMIN_NATIVE_PASS_COUNTS[kind] }, checks: flags(ADMIN_NATIVE_CHECKS[kind], true), terminalKnown: true, writeOutcomeUncertain: false });
const cleaned = kind => ({ schemaVersion: 1, scenario: "admin-native-backend-cleanup", provenance: "protocol-only", case: kind, sourceSha: sha, status: "passed", code: "PASSED", failurePoint: null, stages: ADMIN_NATIVE_CLEANUP_STAGES[kind].map(name => ({ name, passed: true })), counts: { ...ADMIN_NATIVE_CLEANUP_COUNTS[kind] }, terminalKnown: true, exactInventory: true, accountsAbsent: true, receiptsAbsent: true, retainedAdminMetadataExact: true, writeOutcomeUncertain: false });
const local = kind => ({ schemaVersion: 1, scenario: "admin-native-backend-local-case", case: kind, sourceSha: sha, status: "passed", code: "PASSED", phase: "complete", counts: { setupRequests: 8, fixtureCreated: 2, sessionsVerified: 2, fixtureRemoved: kind === "CREATE_FORCED" ? 3 : 2 }, checks: flags(ADMIN_LOCAL_CASE_CHECKS, true), pipeline: passed(kind), cleanup: cleaned(kind), writeOutcomeUncertain: false, pendingRequests: 0, pendingInspections: 0 });
function packet(report) { return assembleAdminNativePacket({ sourceSha: report.sourceSha, writeOutcomeUncertain: report.writeOutcomeUncertain, cases: report.cases.map(e => ({ case: e.case, report: e.report?.pipeline ?? null, cleanup: e.report?.cleanup ?? null, namespaceCleanup: e.report?.pipeline ? e.checks.namespaceCleanup ? "confirmed" : "failed" : "not-run" })) }); }
function envelope() { const value = { schemaVersion: 1, scenario: "admin-native-backend-local-ci", sourceSha: sha, status: "passed", code: "PASSED", phase: "complete", sourceHashes: ADMIN_LOCAL_SOURCE_PATHS.map(path => ({ path, sha256: "c".repeat(64), bytes: 128 })), dependencyHashes: ADMIN_LOCAL_DEPENDENCY_PATHS.map(path => ({ path, sha256: path.endsWith("server-only/empty.js") ? empty : "d".repeat(64), bytes: path.endsWith("server-only/empty.js") ? 0 : 128 })), sdkVersions: { ...ADMIN_LOCAL_SDK_VERSIONS }, cliVersion: "2.120.0", checks: { environment: true, sources: true }, cases: ADMIN_NATIVE_CASES.map(kind => ({ case: kind, status: "passed", code: "PASSED", phase: "complete", migrationsApplied: 26, catalogueChecks: 1720, checks: flags(ADMIN_LOCAL_INFRA_CHECKS, true), report: local(kind), portFailure: null, writeOutcomeUncertain: false })), packet: null, limitations: flags(ADMIN_LOCAL_LIMITATIONS, false), writeOutcomeUncertain: false }; value.packet = packet(value); return value; }
const refused = f => assert.throws(f, { message: "ADMIN_LOCAL_REPORT_REFUSED" });
test("the explicit native inventory keeps every shared qualified-browser preparation source without certifying a browser",()=>{for(const path of["tests/e2e-auth-local/qualified-chromium.mjs","tests/e2e-auth-local/browser-process-environment.mjs","tests/e2e-auth-local/qualified-chromium.d.mts","tests/scripts/qualified-chromium.test.mjs","scripts/verification/prepare-qualified-chromium.py","scripts/verification/chromium-no-store-qualification.mjs","scripts/verification/prepare-chromium-no-store-qualification.py","tests/scripts/prepare_qualified_chromium_test.py"])assert.equal(ADMIN_LOCAL_SOURCE_PATHS.includes(path),true,path);});
test("external envelope has 67 source rows and 45 dependencies; packet remains protocol-only", () => { const value = validateAdminLocalCiReport(envelope()); assert.equal(ADMIN_LOCAL_SOURCE_PATHS.length, 67); assert.equal(ADMIN_LOCAL_SOURCE_PATHS.filter(path => path === "src/lib/environment/application-destination.ts").length, 1); assert.equal(ADMIN_LOCAL_DEPENDENCY_PATHS.length, 45); assert.equal(value.packet.provenance, "protocol-only"); assert.equal(Object.isFrozen(value.cases[0].report.pipeline.counts), true); assert.equal(value.cases.reduce((n, c) => n + c.report.counts.fixtureRemoved, 0), 7); });
test("every native limitation remains false and cannot be supplied as an extra claim", () => { for (const name of ADMIN_LOCAL_LIMITATIONS) { const v = envelope(); v.limitations[name] = true; refused(() => validateAdminLocalCiReport(v)); } for (const name of ["nativeVerified", "hostedProject", "coauthor", "errorBody"]) { const v = envelope(); v[name] = "synthetic-private-canary"; refused(() => validateAdminLocalCiReport(v)); } });
test("source/dependency row cardinality/order/pins and the sole empty marker cannot drift", () => { for (const change of [v => { v.cases[0].migrationsApplied = 22; }, v => { v.cases[0].migrationsApplied = 25; }, v => { v.cases[0].migrationsApplied = 27; }, v => { v.cases[0].catalogueChecks = 1428; }, v => { v.cases[0].catalogueChecks = 1534; }, v => v.sourceHashes.pop(), v => v.sourceHashes.reverse(), v => { v.sourceHashes[0].bytes = 0; }, v => v.dependencyHashes.pop(), v => v.dependencyHashes.reverse(), v => { v.sdkVersions["@supabase/supabase-js"] = "2.0.0"; }, v => { v.dependencyHashes.find(r => r.path.endsWith("server-only/empty.js")).sha256 = "a".repeat(64); }, v => { v.dependencyHashes.find(r => r.bytes).bytes = 0; }, v => { v.cases[0].report.pipeline.sourceHashes[0].sha256 = "e".repeat(64); }]) { const v = envelope(); change(v); refused(() => validateAdminLocalCiReport(v)); } });
test("real 67+45 collector verifies installed lock pins with only a synthetic Git-read seam", async () => {
  let calls = 0;
  const gitReadDouble = async (command, args) => { calls++; assert.equal(command, "git"); if (args.join("|") === "rev-parse|HEAD") return { stdout: sha, groupConfirmed: true }; assert.deepEqual(args.slice(0, 1), ["show"]); const path = args[1].slice("HEAD:".length); assert.equal(args[1], "HEAD:" + path); assert.ok(ADMIN_LOCAL_SOURCE_PATHS.includes(path)); return { stdout: await readFile(new URL("../../" + path, import.meta.url), "utf8"), groupConfirmed: true }; };
  const result = await collectAdminSources(gitReadDouble, sha); assert.equal(calls, 68); assert.equal(result.sourceHashes.length, 67); assert.equal(result.sourceHashes.filter(row => row.path === "src/lib/environment/application-destination.ts").length, 1); assert.equal(result.dependencyHashes.length, 45); assert.equal(result.dependencyHashes.find(r => r.path.endsWith("server-only/empty.js")).bytes, 0); await assert.rejects(collectAdminSources(gitReadDouble, "a".repeat(40)), { message: "SOURCE_REFUSED" });
  let omittedContractRead = false;
  await assert.rejects(collectAdminSources(async (command, args) => {
    if (command === "git" && args[0] === "show" && args[1] === "HEAD:tests/e2e-auth-local/auth-local-lifecycle-contract.mjs") {
      omittedContractRead = true; return { stdout: "", groupConfirmed: true };
    }
    return gitReadDouble(command, args);
  }, sha), { message: "SOURCE_REFUSED" });
  assert.equal(omittedContractRead, true);
});
test("only exact tslib module-scope bytes may ascend to the official versioned parent pin", async () => {
  const path = "node_modules/tslib/modules/package.json", bytes = await readFile(new URL("../../" + path, import.meta.url)), pkg = JSON.parse(await readFile(new URL("../../node_modules/tslib/package.json", import.meta.url), "utf8")), pin = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8")).packages["node_modules/tslib"];
  assert.equal(verifyAdminTslibScope(path, bytes, pkg, pin), true);
  for (const [p, b, root, lock] of [["node_modules/other/modules/package.json", bytes, pkg, pin], [path, Buffer.from('{"type":"commonjs"}'), pkg, pin], [path, Buffer.from('{"type":"module","private":"synthetic-canary"}'), pkg, pin], [path, bytes, { ...pkg, version: "2.8.2" }, pin], [path, bytes, pkg, { ...pin, resolved: "https://example.invalid/tslib.tgz" }], [path, bytes, pkg, { ...pin, integrity: "sha512-synthetic" }]]) assert.throws(() => verifyAdminTslibScope(p, b, root, lock), { message: "SOURCE_REFUSED" });
});
test("packet-only data cannot mint source, catalogue, marker, process or cleanup proof", () => { for (const key of ADMIN_LOCAL_INFRA_CHECKS) { const v = envelope(); v.cases[0].checks[key] = false; refused(() => validateAdminLocalCiReport(v)); } const v = envelope(); v.cases[0].catalogueChecks = 1253; refused(() => validateAdminLocalCiReport(v)); });
test("caller checks require actual setup8 and independent retained proof; pending cannot pass", () => { for (const change of [v => { v.counts.setupRequests = 7; }, v => { v.counts.fixtureCreated = 1; }, v => { v.counts.sessionsVerified = 1; }, v => { v.counts.fixtureRemoved = 2; }, v => { v.checks.retainedSqlConfirmed = false; }, v => { v.pendingRequests = 1; }, v => { v.pendingInspections = 1; }, v => { v.writeOutcomeUncertain = true; }]) { const v = local("CREATE_FORCED"); change(v); refused(() => validateAdminLocalCaseReport(v)); } });
test("unknown remains factual in a failed caller prefix and never authorizes cleanup", () => { const v = local("BLOCK_OLD_JWT"); v.status = "failed"; v.code = "WRITE_OUTCOME_UNCERTAIN"; v.phase = "fixture-create"; v.counts = { setupRequests: 1, fixtureCreated: 0, sessionsVerified: 0, fixtureRemoved: 0 }; v.checks = flags(ADMIN_LOCAL_CASE_CHECKS, false); v.pipeline = v.cleanup = null; v.pendingRequests = 1; v.writeOutcomeUncertain = true; assert.equal(validateAdminLocalCaseReport(v).pendingRequests, 1); v.writeOutcomeUncertain = false; refused(() => validateAdminLocalCaseReport(v)); });
test("a complete protocol cannot advance past failed namespace/process teardown", () => {
  const value = envelope(); value.status = "failed"; value.code = "TEARDOWN_UNCONFIRMED"; value.phase = "teardown"; value.cases[0].status = "failed"; value.cases[0].code = "TEARDOWN_UNCONFIRMED"; value.cases[0].phase = "teardown"; value.cases[0].checks.namespaceCleanup = value.cases[0].checks.directoriesRemoved = false;
  for (let i = 1; i < 3; i++) value.cases[i] = { case: ADMIN_NATIVE_CASES[i], status: "not-run", code: "NOT_RUN", phase: "not-run", migrationsApplied: 0, catalogueChecks: 0, checks: flags(ADMIN_LOCAL_INFRA_CHECKS, false), report: null, portFailure: null, writeOutcomeUncertain: false }; value.packet = packet(value);
  assert.equal(validateAdminLocalCiReport(value).packet.code, "NAMESPACE_FAILED"); value.cases[1] = envelope().cases[1]; refused(() => validateAdminLocalCiReport(value));
});
test("pending original IO forbids namespace cleanup even when a failed local report is closed", () => {
  const value = envelope(), caller = local("BLOCK_OLD_JWT"); caller.status = "failed"; caller.code = "WRITE_OUTCOME_UNCERTAIN"; caller.phase = "fixture-create"; caller.counts = { setupRequests: 1, fixtureCreated: 0, sessionsVerified: 0, fixtureRemoved: 0 }; caller.checks = flags(ADMIN_LOCAL_CASE_CHECKS, false); caller.pipeline = caller.cleanup = null; caller.pendingRequests = 1; caller.writeOutcomeUncertain = true;
  value.status = "failed"; value.code = "TEARDOWN_UNCONFIRMED"; value.phase = "teardown"; value.writeOutcomeUncertain = true; Object.assign(value.cases[0], { status: "failed", code: "TEARDOWN_UNCONFIRMED", phase: "teardown", report: caller, writeOutcomeUncertain: true }); value.cases[0].checks.groupsQuiescent = value.cases[0].checks.namespaceCleanup = value.cases[0].checks.directoriesRemoved = false;
  for (let i = 1; i < 3; i++) value.cases[i] = { case: ADMIN_NATIVE_CASES[i], status: "not-run", code: "NOT_RUN", phase: "not-run", migrationsApplied: 0, catalogueChecks: 0, checks: flags(ADMIN_LOCAL_INFRA_CHECKS, false), report: null, portFailure: null, writeOutcomeUncertain: false }; value.packet = packet(value); assert.equal(validateAdminLocalCiReport(value).writeOutcomeUncertain, true); value.cases[0].checks.groupsQuiescent = true; refused(() => validateAdminLocalCiReport(value));
});
test("snapshots ignore stateful get traps but refuse descriptors/accessors/symbols/private fields", () => { const value = envelope(); let gets = 0; const proxy = new Proxy(value, { get() { gets++; throw Error("synthetic-private-canary"); } }); assert.equal(validateAdminLocalCiReport(proxy).status, "passed"); assert.equal(gets, 0); const v = envelope(); Object.defineProperty(v, "status", { get() { throw Error("synthetic-private-canary"); }, enumerable: true }); refused(() => validateAdminLocalCiReport(v)); const hidden = envelope(); Object.defineProperty(hidden, "private", { value: "synthetic-private-canary" }); refused(() => validateAdminLocalCiReport(hidden)); const symbolic = envelope(); symbolic[Symbol()] = true; refused(() => validateAdminLocalCiReport(symbolic)); const trap = new Proxy({}, { ownKeys() { throw Error("synthetic-private-canary"); } }); refused(() => validateAdminLocalCiReport(trap)); });
test("finite Linux opt-in refuses hosted credentials and does not execute via help/invalid args", async () => { const env = { CI: "true", GITHUB_ACTIONS: "true", RUNNER_TEMP: "/tmp/admin-ci", SC_AUTH_LOCAL_CI_RUN: "1", SC_ADMIN_NATIVE_LOCAL_CI_RUN: "1" }; assert.equal(requireAdminCi(env, "linux").runnerTemp, resolve("/tmp/admin-ci")); for (const [v, platform] of [[env, "win32"], [{ ...env, SC_ADMIN_NATIVE_LOCAL_CI_RUN: undefined }, "linux"], [{ ...env, SUPABASE_ACCESS_TOKEN: "synthetic-private-canary" }, "linux"]]) assert.throws(() => requireAdminCi(v, platform)); const output = []; assert.equal(await main(["--help"], {}, v => output.push(v)), 0); assert.equal(await main(["--other"], {}, v => output.push(v)), 1); assert.equal(output[0].code, "NO_SERVICE_STARTED"); assert.equal(JSON.stringify(output).includes("canary"), false); });
test("one JSON row and PG17 owner/system proof fail closed", () => { const v = { database: "postgres", currentUser: "postgres", serverVersion: 170001, systemIdentifier }; assert.equal(verifyAdminInstance(v), systemIdentifier); for (const change of [x => { x.serverVersion = 180000; }, x => { x.currentUser = "service_role"; }, x => { x.systemIdentifier = "123"; }, x => { x.extra = true; }]) { const x = { ...v }; change(x); assert.throws(() => verifyAdminInstance(x)); } for (const raw of ["{}\n{}", "not-json", "x".repeat(1048577)]) assert.throws(() => decodeAdminSql(raw), { message: "LOCAL_SQL_REFUSED" }); });
test("marker DDL requires completed canonical 1720 catalogue and all own bindings", () => { const ctx = { namespace, sourceSha: sha, systemIdentifier, projectId }, catalogue = { version: 1, ok: true, checks: 1720, deviations: [] }; assert.match(adminMarkerInput(ctx, catalogue), /revoke all.*service_role/); for (const change of [v => { v.checks = 1428; }, v => { v.checks = 1253; }, v => { v.checks = 1534; }, v => { v.ok = false; }, v => { v.deviations.push("synthetic"); }]) { const v = structuredClone(catalogue); change(v); assert.throws(() => adminMarkerInput(ctx, v)); } assert.throws(() => adminMarkerInput({ ...ctx, projectId: namespace }, catalogue)); });
const actors = { a: { id: "77000000-0000-4000-8000-000000000001", sessionId: "77000000-0000-4000-8000-000000000002", marker: namespace }, b: { id: "77000000-0000-4000-8000-000000000003", sessionId: "77000000-0000-4000-8000-000000000004", marker: namespace } };
const ctx = { case: "SELF_AND_LAST_MASTER", namespace, sourceSha: sha, systemIdentifier, projectId };
const request = signal => ({ query: "BASELINE", case: ctx.case, namespace, sourceSha: sha, systemIdentifier, actorId: actors.a.id, targetId: actors.b.id, executionId: "77000000-0000-4000-8000-000000000005", operationId: null, signal });
function proof() { return { provenance: { namespace, sourceSha: sha, systemIdentifier, database: "postgres", currentUser: "postgres", serverVersion: 170000, markerRows: [{ namespace, sourceSha: sha, systemIdentifier }] }, users: [actors.a, actors.b].map(a => ({ id: a.id, email: "fixture@example.invalid", app_metadata: { sc_admin_native_fixture: namespace }, banned_until: null, deleted_at: null, is_anonymous: false })), sessions: [actors.a, actors.b].map(a => ({ id: a.sessionId, user_id: a.id, not_after: null })), refreshTokens: [], roles: [], moderation: [], entitlements: [], operations: [], audit: [], receipts: [], events: [], usableMasters: [actors.a.id], preserveSqlState: null, personalRows: 0 }; }
test("inspector binds four semantic UUIDs, query enums and rejects caller SQL before IO", async () => { let calls = 0; const inspector = createAdminSqlInspector({ context: ctx, actors, query: async () => { calls++; return proof(); }, allowed: () => true }); const r = request(new AbortController().signal); assert.match(adminInspectionInput(ctx, actors, r), /begin read only/); await assert.rejects(inspector.inspect({ ...r, query: "FINAL" }), { message: "LOCAL_SQL_REFUSED" }); assert.equal(calls, 0); await assert.rejects(inspector.inspect(r)); assert.equal(calls, 0); for (const change of [x => { x.actorId = actors.b.id; }, x => { x.executionId = actors.a.id; }, x => { x.operationId = x.executionId; }, x => { x.sql = "delete private"; }, x => { x.namespace = "foreign"; }]) { const x = { ...r }; change(x); assert.throws(() => adminInspectionInput(ctx, actors, x)); } });
test("signal immediately revokes SQL authority but retains original pending promise until settlement", async () => { let release; const gate = new Promise(resolve => { release = resolve; }); const inspector = createAdminSqlInspector({ context: ctx, actors, query: () => gate, allowed: () => true }), controller = new AbortController(), pending = inspector.inspect(request(controller.signal)); assert.equal(inspector.metadata().pending, 1); controller.abort(); assert.equal(inspector.metadata().closed, true); assert.equal(inspector.metadata().pending, 1); await assert.rejects(inspector.retained()); release(proof()); await assert.rejects(pending, { message: "LOCAL_SQL_REFUSED" }); assert.equal(inspector.metadata().pending, 0); assert.equal(inspector.metadata().queriesCompleted, 0); });
test("last-master probe is original SQL call + SQLSTATE observation, never fabricated23514", () => { const sql = adminInspectionInput(ctx, actors, { ...request(new AbortController().signal), query: "ASSERT_LAST_MASTER", operationId: randomUUID() }); assert.match(sql, /perform app_private.admin_preserve_master/); assert.match(sql, /get stacked diagnostics state=returned_sqlstate/); assert.match(sql, /errcode='P0001'/); assert.doesNotMatch(sql, /raise[^;]*errcode='23514'/); });
test("container namespace/id/image/port bindings cannot be inferred from running=true", () => { const v = { id: "d".repeat(64), name: "/supabase_db_" + projectId, label: projectId, running: true, imageId: "sha256:" + "e".repeat(64), ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "54322" }] } }; assert.equal(acceptAdminContainer(v, projectId, "db"), v.id); for (const change of [x => { x.label = "foreign"; }, x => { x.ports["5432/tcp"][0].HostPort = "5432"; }, x => { x.name += "-foreign"; }, x => { x.imageId = "postgres:17"; }]) { const x = structuredClone(v); change(x); assert.throws(() => acceptAdminContainer(x, projectId, "db")); } });
test("owned HTTP refuses mismatching URL before reading body and preserves pending through actual body settlement", async () => { let readers = 0; const wrong = new Response("synthetic"); const originalReader = wrong.body.getReader.bind(wrong.body); Object.defineProperty(wrong.body, "getReader", { value: () => { readers++; return originalReader(); } }); Object.defineProperty(wrong, "url", { value: "http://127.0.0.1:54321/foreign" }); const refusedTransport = createAdminOwnedTransport(async () => wrong); await assert.rejects(refusedTransport.transport("http://127.0.0.1:54321/auth/v1/user", {}), { message: "CASE_FAILED" }); assert.equal(readers, 0); assert.equal(refusedTransport.metadata().pending, 0);
  let release; const response = new Response(new ReadableStream({ start(controller) { release = () => { controller.enqueue(new TextEncoder().encode("synthetic")); controller.close(); }; } }), { status: 201, headers: { "X-Supabase-Api-Version": "2024-01-01" } }); const owned = createAdminOwnedTransport(async () => response), pending = owned.transport("http://127.0.0.1:54321/auth/v1/user", {}); await Promise.resolve(); assert.equal(owned.metadata().pending, 1); release(); const result = await pending; assert.equal(result.status, 201); assert.equal(result.headers.get("x-supabase-api-version"), "2024-01-01"); assert.equal(await result.text(), "synthetic"); assert.equal(owned.metadata().pending, 0);
});
test("dedicated workflow keeps contents-read, explicit dual opt-in and noncanceling concurrency", async () => { const yaml = await readFile(new URL("../../.github/workflows/admin-native-backend-local-ci.yml", import.meta.url), "utf8"); assert.match(yaml, /contents: read/); assert.match(yaml, /cancel-in-progress: false/); assert.match(yaml, /SC_ADMIN_NATIVE_LOCAL_CI_RUN="1"/); assert.match(yaml, /SC_AUTH_LOCAL_CI_RUN="1"/); assert.doesNotMatch(yaml, /upload-artifact|secrets\.|pull_request_target/); });

test("one port probe binds and awaits its close ACK without a retry or native socket", async () => {
  for (const port of [54320, 54321, 54322]) {
    const events = [];
    await probeAdminPort(port, () => ({
      once(name) { assert.equal(name, "error"); },
      listen(options, ready) { events.push("listen"); assert.deepEqual(options, { host: "127.0.0.1", port, exclusive: true }); queueMicrotask(ready); },
      close(closed) { events.push("close"); queueMicrotask(() => { events.push("close-ack"); closed(); }); },
    }));
    assert.deepEqual(events, ["listen", "close", "close-ack"]);
  }
  await assert.rejects(probeAdminPort(54323, () => { throw Error("MUST_NOT_CREATE"); }), { message: "ENVIRONMENT_REFUSED" });
  assert.equal(adminPortFailure(new Error("PORT_REFUSED")), null);
});

test("listen failures retain only the fixed port and descriptor error class; getters remain unread", async () => {
  let getterReads = 0;
  const accessor = Object.defineProperty({}, "code", { get() { getterReads++; throw Error("PRIVATE"); } });
  for (const [input, errorClass] of [[{ code: "EADDRINUSE", message: "private" }, "EADDRINUSE"], [{ code: "EACCES" }, "EACCES"], [{ code: "EPERM" }, "other"], [accessor, "other"]]) {
    let observed, listenCalls = 0, closeCalls = 0;
    const promise = probeAdminPort(54321, () => ({
      once(name, handler) { assert.equal(name, "error"); observed = handler; },
      listen() { listenCalls++; queueMicrotask(() => observed(input)); },
      close() { closeCalls++; },
    }));
    await assert.rejects(promise, error => {
      assert.equal(error.message, "PORT_REFUSED");
      assert.deepEqual(adminPortFailure(error), { port: 54321, operation: "listen", errorClass });
      assert.equal(Object.isFrozen(adminPortFailure(error)), true);
      assert.equal(JSON.stringify(adminPortFailure(error)).includes("private"), false); return true;
    });
    assert.equal(listenCalls, 1); assert.equal(closeCalls, 0);
  }
  assert.equal(getterReads, 0);
  const forged = Object.assign(new Error("PORT_REFUSED"), { portFailure: { port: 54321, operation: "listen", errorClass: "EADDRINUSE" } });
  assert.equal(adminPortFailure(forged), null);
});

test("the first close failure remains fatal and cannot be rewritten by a late listen event", async () => {
  let observed, listenCalls = 0, closeCalls = 0, original;
  const promise = probeAdminPort(54322, () => ({
    once(name, handler) { assert.equal(name, "error"); observed = handler; },
    listen(options, ready) { listenCalls++; queueMicrotask(ready); },
    close(closed) { closeCalls++; queueMicrotask(() => { closed({ code: "EACCES" }); observed({ code: "EADDRINUSE" }); }); },
  }));
  await assert.rejects(promise, error => { original = error; return error.message === "PORT_REFUSED"; });
  assert.deepEqual(adminPortFailure(original), { port: 54322, operation: "close", errorClass: "EACCES" });
  assert.equal(listenCalls, 1); assert.equal(closeCalls, 1);
});

function portFailureEnvelope() {
  const value = envelope(); Object.assign(value, { status: "failed", code: "PORT_REFUSED", phase: "ports" });
  Object.assign(value.cases[2], { status: "failed", code: "PORT_REFUSED", phase: "ports", migrationsApplied: 0, catalogueChecks: 0, checks: flags(ADMIN_LOCAL_INFRA_CHECKS, false), report: null, portFailure: { port: 54320, operation: "listen", errorClass: "EADDRINUSE" }, writeOutcomeUncertain: false });
  value.packet = packet(value); return value;
}
test("the closed port diagnostic keeps earlier cleanup proofs and never certifies the failed case", () => {
  const result = validateAdminLocalCiReport(portFailureEnvelope());
  assert.equal(result.status, "failed"); assert.equal(result.code, "PORT_REFUSED"); assert.equal(result.writeOutcomeUncertain, false);
  assert.equal(result.cases[0].status, "passed"); assert.equal(result.cases[1].report.cleanup.status, "passed");
  assert.deepEqual(result.cases[2].portFailure, { port: 54320, operation: "listen", errorClass: "EADDRINUSE" });
  assert.equal(result.cases[2].report, null); assert.equal(result.cases[2].migrationsApplied, 0);
  const absent = portFailureEnvelope(); absent.cases[2].portFailure = null; assert.equal(validateAdminLocalCiReport(absent).cases[2].portFailure, null);
});
test("port diagnostics reject free fields, invalid provenance and passed or not-run cases", () => {
  const changes = [
    v => { v.cases[2].portFailure.port = 54323; }, v => { v.cases[2].portFailure.operation = "connect"; },
    v => { v.cases[2].portFailure.errorClass = "EPERM"; }, v => { v.cases[2].portFailure.message = "private"; },
    v => { v.cases[2].code = "CASE_FAILED"; }, v => { v.cases[2].phase = "stack-start"; },
    v => { v.cases[2].migrationsApplied = 1; }, v => { v.cases[2].catalogueChecks = 1; },
    v => { v.cases[2].writeOutcomeUncertain = true; }, v => { v.cases[2].checks.ownedNamespace = true; },
    v => { v.cases[2].report = local("CREATE_FORCED"); },
    v => { v.cases[0].portFailure = v.cases[2].portFailure; },
    v => { Object.assign(v.cases[2], { status: "not-run", code: "NOT_RUN", phase: "not-run" }); },
    v => { delete v.cases[0].portFailure; },
  ];
  for (const change of changes) { const value = portFailureEnvelope(); change(value); refused(() => validateAdminLocalCiReport(value)); }
  let reads = 0; const value = portFailureEnvelope();
  Object.defineProperty(value.cases[2].portFailure, "errorClass", { enumerable: true, get() { reads++; throw Error("PRIVATE"); } });
  refused(() => validateAdminLocalCiReport(value)); assert.equal(reads, 0);
});
