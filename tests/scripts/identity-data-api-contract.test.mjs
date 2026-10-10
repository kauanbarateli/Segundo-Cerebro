import test from "node:test";
import assert from "node:assert/strict";
import { assembleIdentityRlsPacket, validateIdentityRlsPacket, IDENTITY_RLS_PACKET_FILE } from "../e2e-auth-local/identity-data-api-contract.mjs";
import { createIdentityRlsAcceptance, RLS_LOCAL_API, RLS_LOCAL_APP } from "../e2e-auth-local/identity-rls-support.mjs";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const SA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", SB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
function actor(id, sessionId) {
  const expiresAt = Math.floor(Date.now() / 1000 + 600) * 1000;
  return { id, sessionId, expiresAt, accessToken: `${encode({ alg: "HS256" })}.${encode({ sub: id, session_id: sessionId, role: "authenticated", exp: expiresAt / 1000 })}.${encode("fake-only-signature")}` };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const denial = (code = "42501", status = 403) => json({ code, message: "synthetic excluded from report", details: null, hint: null }, status);
const profile = id => json([{ user_id: id, display_name: null }]);
const access = id => json({ user_id: id, role: "user", must_change_password: false, entitlements: {} });

// Actual prototype, explicitly injected scripted protocol double. No server,
// browser, fetch, credentials, session seeding or service-side RLS is involved.
function protocol(override) {
  const context = { runtime: { ci: true, githubActions: true, localAuthRun: true, appUrl: RLS_LOCAL_APP, supabaseUrl: RLS_LOCAL_API }, publishableKey: `sb_publishable_${"P".repeat(32)}`, a: actor(A, SA), b: actor(B, SB) };
  const responses = [() => profile(A), () => json([]), () => profile(B), () => json([]), () => denial("42501", 401), () => denial(), () => denial(), () => denial(), () => profile(A), () => profile(B), () => access(A), () => access(B), () => json([]), () => denial(), () => profile(B), () => access(B)];
  const methods = ["GET", "GET", "GET", "GET", "GET", "GET", "PATCH", "PATCH", "GET", "GET", "POST", "POST", "GET", "POST", "GET", "POST"];
  let calls = 0;
  const probe = createIdentityRlsAcceptance(context, { transport: async (url, options) => {
    const index = calls++;
    assert.equal(new URL(url).origin, RLS_LOCAL_API); assert.equal(options.redirect, "error"); assert.equal(options.method, methods[index]);
    assert.equal(options.headers.apikey, context.publishableKey);
    if (override) { const replacement = await override(index + 1); if (replacement) return replacement; }
    assert.ok(responses[index], "no unplanned operation"); return responses[index]();
  } });
  return { probe, calls: () => calls, context };
}
const copy = value => JSON.parse(JSON.stringify(value));
const refused = fn => assert.throws(fn, { message: "IDENTITY_RLS_PACKET_REFUSED" });
async function completed() {
  const { probe, calls } = protocol();
  try { return { before: await probe.before(), after: await probe.after(), writeOutcomeUncertain: false, calls: calls() }; }
  finally { probe.dispose(); }
}

test("actual fake-protocol phases produce an independent complete metadata-only packet", async () => {
  const { before, after, calls } = await completed();
  assert.equal(calls, 16);
  const packet = assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: false });
  assert.deepEqual([packet.status, packet.code, packet.failurePhase], ["passed", "PASSED", null]);
  assert.deepEqual(packet.before.counts, { requests: 12, directWriteAttempts: 2, sqlRefusals: 4 });
  assert.deepEqual(packet.after.counts, { requests: 4, directWriteAttempts: 0, sqlRefusals: 1 });
  assert.equal(Object.values(packet.before.checks).length, 10); assert.equal(Object.values(packet.after.checks).length, 5);
  assert.equal(IDENTITY_RLS_PACKET_FILE, "auth-local-ci-identity-rls-report.json");
  assert.deepEqual(validateIdentityRlsPacket(copy(packet)), packet);
  const serialized = JSON.stringify(packet);
  for (const raw of [A, B, "accessToken", "sessionId", "display_name", "synthetic excluded from report", "Authorization", "sb_publishable_"]) assert.equal(serialized.includes(raw), false);
});

test("Auth prerequisite failure preserves both phases absent without fabricating an RLS cause", () => {
  const packet = assembleIdentityRlsPacket({ before: null, after: null, writeOutcomeUncertain: false });
  assert.deepEqual(packet, { schemaVersion: 1, scenario: "identity-data-api", status: "not-run", code: "DEPENDENCY_NOT_RUN", failurePhase: null, before: null, after: null, writeOutcomeUncertain: false });
  assert.deepEqual(validateIdentityRlsPacket(packet), packet);
  refused(() => validateIdentityRlsPacket({ ...packet, status: "passed", code: "PASSED" }));
  refused(() => validateIdentityRlsPacket({ ...packet, status: "failed", code: "BEFORE_FAILED", failurePhase: "before" }));
});

test("an Auth stop after before PASS records after not-run, not an after failure or complete RLS", async () => {
  const { before } = await completed();
  const packet = assembleIdentityRlsPacket({ before, after: null, writeOutcomeUncertain: false });
  assert.deepEqual([packet.status, packet.code, packet.failurePhase, packet.after], ["not-run", "AFTER_NOT_RUN", null, null]);
  assert.deepEqual(validateIdentityRlsPacket(packet), packet);
  refused(() => validateIdentityRlsPacket({ ...packet, status: "passed", code: "PASSED" }));
  refused(() => validateIdentityRlsPacket({ ...packet, status: "failed", code: "AFTER_FAILED", failurePhase: "after" }));
});

test("observed before schema refusal cannot be replaced by skipped metadata or an after proof", async () => {
  const { probe, calls } = protocol(ordinal => ordinal === 6 ? denial("42P01", 404) : null);
  try {
    const before = await probe.before(); assert.equal(calls(), 6);
    const packet = assembleIdentityRlsPacket({ before, after: null, writeOutcomeUncertain: false });
    assert.deepEqual([packet.code, packet.failurePhase, packet.before.code, packet.before.failurePoint], ["BEFORE_FAILED", "before", "SQL_REFUSAL_NOT_PROVEN", "MODERATION_READ"]);
    assert.deepEqual(validateIdentityRlsPacket(packet), packet);
    refused(() => validateIdentityRlsPacket({ ...packet, status: "not-run", code: "DEPENDENCY_NOT_RUN", failurePhase: null }));
    const complete = await completed();
    refused(() => assembleIdentityRlsPacket({ before, after: complete.after, writeOutcomeUncertain: false }));
  } finally { probe.dispose(); }
});

test("observed after failure retains before proof and its actual granular cause", async () => {
  const { probe } = protocol(ordinal => ordinal === 13 ? profile(A) : null);
  try {
    const before = await probe.before(), after = await probe.after();
    const packet = assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: false });
    assert.deepEqual([packet.code, packet.failurePhase, packet.after.failurePoint, packet.after.counts.requests], ["AFTER_FAILED", "after", "OLD_A_PROFILES", 1]);
    assert.deepEqual(packet.before, before); assert.deepEqual(validateIdentityRlsPacket(packet), packet);
    refused(() => validateIdentityRlsPacket({ ...packet, status: "not-run", code: "AFTER_NOT_RUN", failurePhase: null }));
  } finally { probe.dispose(); }
});

test("lost direct PATCH is ORed from actual phase metadata even when caller supplies false", async () => {
  const { probe, calls } = protocol(ordinal => { if (ordinal === 7) throw new Error("synthetic provider data must never escape"); return null; });
  try {
    const before = await probe.before(); assert.equal(calls(), 7); assert.equal(before.writeOutcomeUncertain, true);
    const packet = assembleIdentityRlsPacket({ before, after: null, writeOutcomeUncertain: false });
    assert.equal(packet.writeOutcomeUncertain, true); assert.equal(packet.code, "BEFORE_FAILED");
    assert.equal(packet.before.failurePoint, "MODERATION_WRITE");
    assert.deepEqual(validateIdentityRlsPacket(packet), packet);
    refused(() => validateIdentityRlsPacket({ ...packet, writeOutcomeUncertain: false }));
    assert.equal(JSON.stringify(packet).includes("synthetic provider"), false);
  } finally { probe.dispose(); }
});

test("caller sticky uncertainty prevents PASS after successful phases and never invents a failure phase", async () => {
  const { before, after } = await completed();
  for (const phases of [{ before: null, after: null }, { before, after: null }, { before, after }]) {
    const packet = assembleIdentityRlsPacket({ ...phases, writeOutcomeUncertain: true });
    assert.deepEqual([packet.status, packet.code, packet.failurePhase, packet.writeOutcomeUncertain], ["failed", "WRITE_OUTCOME_UNCERTAIN", null, true]);
    assert.deepEqual(validateIdentityRlsPacket(packet), packet);
    refused(() => validateIdentityRlsPacket({ ...packet, status: "passed", code: "PASSED" }));
    refused(() => validateIdentityRlsPacket({ ...packet, failurePhase: phases.before ? "after" : "before" }));
  }
});

test("after cannot be transplanted before an absent prerequisite or failed before", async () => {
  const { before, after } = await completed();
  refused(() => assembleIdentityRlsPacket({ before: null, after, writeOutcomeUncertain: false }));
  refused(() => assembleIdentityRlsPacket({ before: after, after: before, writeOutcomeUncertain: false }));
  refused(() => assembleIdentityRlsPacket({ before, after: before, writeOutcomeUncertain: false }));
});

test("schema/scenario/status/point/count/check grafts cannot borrow Auth or another phase's PASS", async () => {
  const { before, after } = await completed();
  const packet = assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: false });
  const patches = [
    { schemaVersion: 2 }, { scenario: "logout" }, { status: "success" }, { code: "DEPENDENCY_NOT_RUN" }, { failurePhase: "after" },
    { before: { ...copy(before), scenario: "identity-data-api" } },
    { after: { ...copy(after), failurePoint: "MODERATION_READ", status: "failed", code: "RESPONSE_REFUSED" } },
    { before: { ...copy(before), counts: { requests: 12, directWriteAttempts: 1, sqlRefusals: 4 } } },
    { before: { ...copy(before), counts: { requests: 13, directWriteAttempts: 2, sqlRefusals: 4 } } },
    { after: { ...copy(after), counts: { requests: 4, directWriteAttempts: 1, sqlRefusals: 1 } } },
    { after: { ...copy(after), counts: { requests: 4, directWriteAttempts: 0, sqlRefusals: 0 } } },
    { before: { ...copy(before), checks: { ...copy(before.checks), ownA: false } } },
    { before: { ...copy(before), checks: { ...copy(before.checks), ownA: 1 } } },
    { after: { ...copy(after), checks: { oldADenied: true, bIntact: true, cleanupConfirmed: true } } },
    { before: { ...copy(before), code: "42501" } },
  ];
  for (const patch of patches) refused(() => validateIdentityRlsPacket({ ...packet, ...patch }));
});

test("failure metadata counts must be bounded and support every claimed completed checkpoint", async () => {
  const { before, after } = await completed();
  const failed = { ...copy(before), status: "failed", code: "STATE_REFUSED", failurePoint: "PREREQUISITE" };
  for (const bad of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "12", null]) refused(() => assembleIdentityRlsPacket({ before: { ...failed, counts: { ...failed.counts, requests: bad } }, after: null, writeOutcomeUncertain: false }));
  refused(() => assembleIdentityRlsPacket({ before: { ...failed, counts: { requests: 0, directWriteAttempts: 0, sqlRefusals: 0 } }, after: null, writeOutcomeUncertain: false }));
  const afterFailed = { ...copy(after), status: "failed", code: "TOKEN_LIFETIME_REFUSED", failurePoint: "B_RPC" };
  // The actual helper checks lifetime after its last checkpoint: all checks can
  // be true while status is failed. This must remain failed, never unioned.
  const packet = assembleIdentityRlsPacket({ before, after: afterFailed, writeOutcomeUncertain: false });
  assert.equal(packet.code, "AFTER_FAILED"); assert.deepEqual(validateIdentityRlsPacket(packet), packet);
});

test("foreign/raw fields at every level and prototype/accessor tricks are refused without invoking getters", async () => {
  const { before, after } = await completed();
  const packet = assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: false });
  for (const key of ["token", "user_id", "raw", "provider", "statusCode", "headers", "beforePassed", "password"]) {
    refused(() => validateIdentityRlsPacket({ ...packet, [key]: "synthetic excluded" }));
    refused(() => validateIdentityRlsPacket({ ...packet, before: { ...copy(before), [key]: "synthetic excluded" } }));
    refused(() => validateIdentityRlsPacket({ ...packet, after: { ...copy(after), counts: { ...after.counts, [key]: 0 } } }));
    refused(() => validateIdentityRlsPacket({ ...packet, before: { ...copy(before), checks: { ...before.checks, [key]: true } } }));
  }
  let getters = 0;
  const getter = Object.defineProperty({ ...packet }, "before", { get() { getters++; throw new Error("secret getter"); }, enumerable: true });
  refused(() => validateIdentityRlsPacket(getter)); assert.equal(getters, 0);
  for (const abnormal of [[], null, Object.assign(Object.create(null), packet), Object.assign(Object.create({ extra: "secret" }), packet)]) refused(() => validateIdentityRlsPacket(abnormal));
  const symbol = { ...packet, [Symbol("private")]: "secret" }; refused(() => validateIdentityRlsPacket(symbol));
  const hidden = Object.defineProperty({ ...packet }, "raw", { value: "secret", enumerable: false }); refused(() => validateIdentityRlsPacket(hidden));
});

test("explicit sticky boolean and explicit absent phases are required; undefined or string truthiness cannot pass", async () => {
  const { before, after } = await completed();
  for (const missing of [{ before, after }, { before, writeOutcomeUncertain: false }, { after, writeOutcomeUncertain: false }, { before: undefined, after: null, writeOutcomeUncertain: false }]) refused(() => assembleIdentityRlsPacket(missing));
  for (const flag of [undefined, null, "false", "true", 0, 1, {}, []]) refused(() => assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: flag }));
  const packet = assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: false });
  for (const flag of [undefined, null, "false", 0]) refused(() => validateIdentityRlsPacket({ ...packet, writeOutcomeUncertain: flag }));
  refused(() => assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: false, raw: "secret" }));
});

test("returned projections are deeply immutable independent copies and do not alter source evidence", async () => {
  const actual = await completed(), before = copy(actual.before), after = copy(actual.after);
  const packet = assembleIdentityRlsPacket({ before, after, writeOutcomeUncertain: false });
  before.checks.ownA = false; after.counts.requests = 0;
  assert.equal(packet.before.checks.ownA, true); assert.equal(packet.after.counts.requests, 4);
  for (const value of [packet, packet.before, packet.before.counts, packet.before.checks, packet.after, packet.after.counts, packet.after.checks]) assert.equal(Object.isFrozen(value), true);
  assert.throws(() => { packet.before.checks.ownA = false; }, TypeError);
  const second = validateIdentityRlsPacket(packet); assert.notEqual(second, packet); assert.notEqual(second.before, packet.before); assert.deepEqual(second, packet);
});
