import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createEventAppendOnlyAcceptance } from "../e2e-auth-local/events-append-only-support.mjs";
import {
  AUTH_IDENTITY_STAGES, AUTH_IDENTITY_CHECKS, AUTH_IDENTITY_FAILURE_POINTS, AUTH_IDENTITY_CODES,
  AUTH_IDENTITY_CLEANUP_FAILURE_POINTS, EVENT_STAGES, EVENT_PACKET_FILE,
  validateIdentityAuthReport, assembleEventsPacket, validateEventsPacket,
} from "../e2e-auth-local/identity-data-api-contract.mjs";

const uuid = number => `34000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const A = uuid(1), B = uuid(2), CLIENT = uuid(5), NEW = uuid(99);
const stamp = "2026-10-10T08:00:00.123456+00:00";
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const row = (id, owner, type = "profile", action = "created", canal = "api") => ({ id, user_id: owner, entity_type: type, entity_id: owner, action, canal, occurred_at: stamp });
const refusal = () => json({ code: "42501", message: "SYNTHETIC_EXCLUDED", details: null, hint: null }, 403);
const clone = value => structuredClone(value);
function actor(id, sid) {
  const expiresAt = Math.floor(Date.now() / 1000 + 600) * 1000;
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  return { id, sessionId: sid, expiresAt, accessToken: `${encode({ alg: "HS256" })}.${encode({ sub: id, role: "authenticated", session_id: sid, exp: expiresAt / 1000 })}.${encode("synthetic")}` };
}
async function eventProtocol(fault) {
  const context = { runtime: { ci: true, githubActions: true, localAuthRun: true, appUrl: "http://127.0.0.1:3117", supabaseUrl: "http://127.0.0.1:54321" }, publishableKey: `sb_publishable_${"P".repeat(32)}`, a: actor(A, uuid(3)), b: actor(B, uuid(4)) };
  const rows = Object.fromEntries([[A, 10], [B, 20]].map(([owner, start]) => [owner, ["profile", "preference", "role", "moderation"].map((type, index) => row(uuid(start + index), owner, type))]));
  let calls = 0;
  const helper = createEventAppendOnlyAcceptance(context, { clientId: CLIENT, transport: async (url, init) => {
    calls++; const parsed = new URL(url), owner = init.headers.Authorization === `Bearer ${context.a.accessToken}` ? A : B;
    assert.equal(parsed.origin, context.runtime.supabaseUrl);
    assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
    const replacement = fault && await fault(calls, rows);
    if (replacement) return replacement;
    if (parsed.pathname === "/rest/v1/rpc/update_identity") {
      assert.deepEqual(JSON.parse(init.body), { p_resource: "profile", p_patch: { display_name: "Append-only fixture" }, p_client_id: CLIENT, p_canal: "web" });
      rows[A].push(row(NEW, A, "profile", "updated", "web"));
      return json({ user_id: A, display_name: "Append-only fixture", avatar_url: null, avatar_file_id: null, timezone: "America/Sao_Paulo", locale: "pt-BR", created_at: stamp, updated_at: stamp });
    }
    assert.equal(parsed.pathname, "/rest/v1/domain_events");
    if (init.method !== "GET") return refusal();
    if (parsed.searchParams.has("id")) return json(owner === B ? [] : rows[A].filter(event => event.id === NEW));
    return json(rows[owner]);
  } });
  try { return { report: await helper.run(), metadata: helper.metadata(), calls, context }; }
  finally { helper.dispose(); }
}
function authPassed() {
  return { schemaVersion: 3, scenario: "identity-data-api", status: "passed", code: "PASSED", failurePoint: null, cleanupFailurePoint: null,
    stages: AUTH_IDENTITY_STAGES.map(name => ({ name, passed: true })), counts: { fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3 },
    checks: Object.fromEntries(AUTH_IDENTITY_CHECKS.map(key => [key, true])), cleanupConfirmed: true };
}
const eventRefused = action => assert.throws(action, { message: "EVENT_PACKET_REFUSED" });
const authRefused = action => assert.throws(action, { message: "IDENTITY_AUTH_REPORT_REFUSED" });

test("identity Auth uses independent schema and exactly minimum31 plus three component points", async () => {
  const source = ts.createSourceFile("support.ts", await readFile(new URL("../e2e-auth-local/support.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const readArray = name => {
    const statement = source.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === name));
    const declaration = statement.declarationList.declarations.find(declaration => declaration.name.getText(source) === name);
    const initializer = ts.isAsExpression(declaration.initializer) ? declaration.initializer.expression : declaration.initializer;
    assert.equal(ts.isArrayLiteralExpression(initializer), true);
    return initializer.elements.map(element => { assert.equal(ts.isStringLiteral(element), true); return element.text; });
  };
  assert.deepEqual(AUTH_IDENTITY_STAGES, readArray("AUTH_LOCAL_STAGES"));
  assert.deepEqual(AUTH_IDENTITY_FAILURE_POINTS.slice(0, 31), readArray("AUTH_LOCAL_FAILURE_POINTS"));
  assert.deepEqual(AUTH_IDENTITY_CLEANUP_FAILURE_POINTS, readArray("AUTH_LOCAL_CLEANUP_FAILURE_POINTS"));
  assert.deepEqual(AUTH_IDENTITY_FAILURE_POINTS.slice(31), ["IDENTITY_RLS_BEFORE", "EVENT_APPEND_ONLY", "IDENTITY_RLS_AFTER"]);
  const value = authPassed(); assert.deepEqual(validateIdentityAuthReport(value), value);
  for (const mutation of [r => r.schemaVersion = 1, r => r.schemaVersion = 2, r => r.scenario = "password-change", r => r.failurePoint = "POST_REQUEST_ABORTED", r => r.counts.fixtureDeleted = 1, r => r.checks.oldADenied = false, r => r.stages.splice(8, 1), r => r.stages.reverse()]) {
    const candidate = clone(value); mutation(candidate); authRefused(() => validateIdentityAuthReport(candidate));
  }
  assert.equal(AUTH_IDENTITY_CODES.includes("PASSWORD_CHANGE_FAILED"), false);
});
test("failed identity component retains Auth proof without borrowing a global PASS or clearing uncertain cleanup", () => {
  const failed = { ...authPassed(), status: "failed", code: "ACCEPTANCE_FAILED", failurePoint: "EVENT_APPEND_ONLY", cleanupConfirmed: false, cleanupFailurePoint: "OUTCOME_UNCERTAIN" };
  failed.counts.fixtureDeleted = 0; failed.checks.cleanupConfirmed = false;
  failed.stages = failed.stages.slice(0, 8);
  const projected = validateIdentityAuthReport(failed); assert.equal(projected.status, "failed");
  authRefused(() => validateIdentityAuthReport({ ...failed, code: "PASSED" }));
  authRefused(() => validateIdentityAuthReport({ ...failed, cleanupFailurePoint: null }));
  authRefused(() => validateIdentityAuthReport({ ...failed, failurePoint: null }));
  authRefused(() => validateIdentityAuthReport({ ...failed, counts: { ...failed.counts, fixtureDeleted: 3 } }));
  assert.equal(Object.isFrozen(projected.stages[0]), true);
});
test("actual event protocol packet preserves all12 operations and exact nonempty4-to5 baseline evidence", async () => {
  const { report, calls, context } = await eventProtocol();
  const packet = assembleEventsPacket({ report, writeOutcomeUncertain: false });
  assert.equal(EVENT_PACKET_FILE, "auth-local-ci-events-report.json");
  assert.deepEqual([packet.status, packet.code, calls], ["passed", "PASSED", 12]);
  assert.deepEqual(packet.report.stages, EVENT_STAGES.map(name => ({ name, passed: true })));
  assert.deepEqual(packet.report.counts, { requests: 12, readRequests: 9, rpcWriteAttempts: 1, directWriteAttempts: 2, sqlRefusals: 2, baselineARecords: 4, baselineBRecords: 4, eventCreated: 1 });
  assert.deepEqual(validateEventsPacket(clone(packet)), packet);
  for (const value of [A, B, CLIENT, stamp, context.a.accessToken, context.publishableKey, "display_name", "SYNTHETIC_EXCLUDED"]) assert.equal(JSON.stringify(packet).includes(value), false);
  const projected = validateEventsPacket(packet); assert.notEqual(projected.report, packet.report);
  assert.equal(Object.isFrozen(projected.report.counts), true);
});
test("missing event prerequisite stays explicit not-run and cannot be converted to failed or passed cause", () => {
  const packet = assembleEventsPacket({ report: null, writeOutcomeUncertain: false });
  assert.deepEqual(packet, { schemaVersion: 1, scenario: "identity-data-api", status: "not-run", code: "DEPENDENCY_NOT_RUN", report: null, writeOutcomeUncertain: false });
  assert.deepEqual(validateEventsPacket(packet), packet);
  for (const patch of [{ status: "passed", code: "PASSED" }, { status: "failed", code: "EVENT_FAILED" }, { scenario: "password-change" }, { report: undefined }]) eventRefused(() => validateEventsPacket({ ...packet, ...patch }));
  eventRefused(() => assembleEventsPacket({ report: null }));
});
test("known SQL refusal failure and lost write stay independent failures with sticky bit OR", async () => {
  const known = await eventProtocol(ordinal => ordinal === 6 ? json({ code: "42P01", message: "excluded" }, 404) : null);
  const packet = assembleEventsPacket({ report: known.report, writeOutcomeUncertain: false });
  assert.deepEqual([packet.code, packet.report.failurePoint, packet.writeOutcomeUncertain], ["EVENT_FAILED", "EVENT_UPDATE", true]);
  assert.deepEqual(validateEventsPacket(packet), packet);
  eventRefused(() => validateEventsPacket({ ...packet, writeOutcomeUncertain: false }));
  const lost = await eventProtocol(ordinal => { if (ordinal === 3) throw new Error("SYNTHETIC_PRIVATE_PROVIDER"); });
  assert.equal(lost.calls, 3); assert.equal(lost.report.code, "TRANSPORT_FAILED");
  const unknown = assembleEventsPacket({ report: lost.report, writeOutcomeUncertain: false });
  assert.equal(unknown.writeOutcomeUncertain, true); assert.equal(unknown.report.failurePoint, "EVENT_RPC");
  assert.equal(JSON.stringify(unknown).includes("SYNTHETIC_PRIVATE_PROVIDER"), false);
  const passed = await eventProtocol();
  const external = assembleEventsPacket({ report: passed.report, writeOutcomeUncertain: true });
  assert.deepEqual([external.status, external.code, external.report.status], ["failed", "WRITE_OUTCOME_UNCERTAIN", "passed"]);
  assert.deepEqual(validateEventsPacket(external), external);
  const absent = assembleEventsPacket({ report: null, writeOutcomeUncertain: true });
  assert.equal(absent.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(absent.report, null);
});
test("event phase/count/check grafts cannot claim denied operations or transplant Auth checkpoints", async () => {
  const { report } = await eventProtocol();
  const packet = assembleEventsPacket({ report, writeOutcomeUncertain: false });
  for (const mutate of [r => r.report.counts.requests = 11, r => r.report.counts.sqlRefusals = 1, r => r.report.counts.baselineBRecords = 0,
    r => r.report.counts.baselineARecords = 64, r => r.report.checks.deleteDenied = false, r => r.report.stages[5].passed = false,
    r => r.report.stages.reverse(), r => r.report.stages[3].name = "login-a1", r => r.report.scenario = "identity-rls-before", r => r.report.checks.loginA1 = true]) {
    const candidate = clone(packet); mutate(candidate); eventRefused(() => validateEventsPacket(candidate));
  }
  const failed = await eventProtocol(ordinal => ordinal === 8 ? json({}, 200) : null);
  assert.equal(validateEventsPacket(assembleEventsPacket({ report: failed.report, writeOutcomeUncertain: false })).report.counts.requests, 8);
  const candidate = clone(failed.report); candidate.checks.eventUnchanged = true;
  eventRefused(() => assembleEventsPacket({ report: candidate, writeOutcomeUncertain: true }));
});
test("every actual event operation failure stays readable metadata, never a false PASS or fabricated later stage", async () => {
  for (let failAt = 1; failAt <= 12; failAt++) {
    const observed = await eventProtocol(ordinal => { if (ordinal === failAt) throw new Error("SYNTHETIC_PRIVATE_PROVIDER"); });
    const packet = validateEventsPacket(assembleEventsPacket({ report: observed.report, writeOutcomeUncertain: observed.metadata.writeOutcomeUncertain }));
    assert.equal(observed.calls, failAt); assert.equal(packet.status, "failed"); assert.equal(packet.code, "EVENT_FAILED");
    assert.equal(packet.report.code, "TRANSPORT_FAILED"); assert.equal(packet.report.failurePoint, EVENT_STAGES[failAt - 1]);
    assert.equal(packet.report.stages.length, failAt); assert.equal(packet.report.stages.at(-1).passed, false);
    assert.equal(packet.writeOutcomeUncertain, [3, 6, 8].includes(failAt));
    assert.equal(JSON.stringify(packet).includes("SYNTHETIC_PRIVATE_PROVIDER"), false);
  }
});
test("closed packets reject raw/symbol/accessor/prototype fields before invoking them", async () => {
  const { report } = await eventProtocol();
  const event = assembleEventsPacket({ report, writeOutcomeUncertain: false });
  for (const base of [event, authPassed()]) {
    const check = base === event ? validateEventsPacket : validateIdentityAuthReport;
    const refused = base === event ? eventRefused : authRefused;
    for (const mutate of [r => r.rawToken = "synthetic", r => r[Symbol("foreign")] = true, r => Object.setPrototypeOf(r, null), r => Object.defineProperty(r, "status", { get() { throw new Error("MUST_NOT_RUN"); } })]) {
      const candidate = clone(base); mutate(candidate); refused(() => check(candidate));
    }
  }
  for (const mutate of [r => r.report.counts.raw = "private", r => r.report.stages[0].id = A, r => Object.defineProperty(r.report.stages, "0", { get() { throw new Error("MUST_NOT_RUN"); }, enumerable: true }), r => r.report.stages.extra = true]) {
    const candidate = clone(event); mutate(candidate); eventRefused(() => validateEventsPacket(candidate));
  }
});
