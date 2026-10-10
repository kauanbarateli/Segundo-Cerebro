import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createEventAppendOnlyAcceptance, EVENT_LOCAL_API, EVENT_LOCAL_APP, EVENT_METADATA, EVENT_STAGES } from "../e2e-auth-local/events-append-only-support.mjs";

// Protocol doubles only. These tokens are never sent to or seeded in a service.
const uuid = number => `23000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const A = uuid(1), B = uuid(2), SA = uuid(3), SB = uuid(4), CLIENT = uuid(5), EVENT = uuid(100);
const pub = `sb_publishable_${"P".repeat(32)}`;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
function actor(id, sessionId, expiresAt = Math.floor(Date.now() / 1000 + 600) * 1000) {
  return { id, sessionId, expiresAt, accessToken: `${encode({ alg: "HS256" })}.${encode({ sub: id, role: "authenticated", session_id: sessionId, exp: expiresAt / 1000 })}.${Buffer.from("synthetic-signature").toString("base64url")}` };
}
const context = () => ({ runtime: { ci: true, githubActions: true, localAuthRun: true, appUrl: EVENT_LOCAL_APP, supabaseUrl: EVENT_LOCAL_API }, publishableKey: pub, a: actor(A, SA), b: actor(B, SB) });
const stamp = "2026-10-10T08:00:00.123456+00:00";
const event = (id, user, type = "profile", action = "created", canal = "api") => ({ id, user_id: user, entity_type: type, entity_id: user, action, canal, occurred_at: stamp });
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...extra } });
const refusal = (code = "42501", status = 403) => json({ code, message: "SYNTHETIC_PRIVATE_MESSAGE", details: null, hint: null }, status);
const profile = () => ({ user_id: A, display_name: "Append-only fixture", avatar_url: null, avatar_file_id: null, timezone: "America/Sao_Paulo", locale: "pt-BR", created_at: stamp, updated_at: stamp });

function harness(override) {
  const ctx = context(), requests = [];
  const rows = {
    a: [event(uuid(10), A), event(uuid(11), A, "preference"), event(uuid(12), A, "role"), event(uuid(13), A, "moderation")],
    b: [event(uuid(20), B), event(uuid(21), B, "preference"), event(uuid(22), B, "role"), event(uuid(23), B, "moderation")]
  };
  const transport = async (url, options) => {
    const target = new URL(url);
    assert.equal(target.origin, EVENT_LOCAL_API); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    assert.equal(options.headers.apikey, pub); assert.equal(options.signal instanceof AbortSignal, true);
    const bearer = options.headers.Authorization.slice(7);
    const owner = bearer === ctx.a.accessToken ? "a" : bearer === ctx.b.accessToken ? "b" : null;
    assert.notEqual(owner, null);
    const op = { owner, method: options.method, path: target.pathname, query: target.searchParams, body: options.body ? JSON.parse(options.body) : null, ordinal: requests.length + 1 };
    requests.push(op);
    const custom = override && await override(op, options, rows, ctx);
    if (custom !== undefined && custom !== null) return custom;
    if (op.path === "/rest/v1/rpc/update_identity") {
      assert.equal(op.owner, "a"); assert.equal(op.method, "POST"); assert.equal(target.search, "");
      assert.deepEqual(op.body, { p_resource: "profile", p_patch: { display_name: "Append-only fixture" }, p_client_id: CLIENT, p_canal: "web" });
      rows.a.push(event(EVENT, A, "profile", "updated", "web")); return json(profile());
    }
    assert.equal(op.path, "/rest/v1/domain_events");
    assert.equal(op.query.get("user_id"), "eq." + (op.owner === "b" && op.query.has("id") ? A : op.owner === "a" ? A : B));
    if (op.method === "GET") {
      assert.equal(op.query.get("select"), EVENT_METADATA.join(",")); assert.equal(op.query.get("order"), "occurred_at.asc,id.asc"); assert.equal(op.query.get("limit"), "65");
      assert.deepEqual([...op.query.keys()].sort(), ["select", "order", "limit", "user_id", ...(op.query.has("id") ? ["id"] : [])].sort());
      if (op.query.has("id")) { assert.equal(op.query.get("id"), "eq." + EVENT); return json(op.owner === "b" ? [] : rows.a.filter(row => row.id === EVENT)); }
      return json(rows[op.owner]);
    }
    assert.equal(op.owner, "a"); assert.equal(op.query.get("id"), "eq." + EVENT);
    assert.deepEqual([...op.query.keys()].sort(), ["id", "user_id"]); assert.equal(options.headers.Prefer, "return=minimal");
    if (op.method === "PATCH") assert.deepEqual(op.body, { canal: "api" });
    else { assert.equal(op.method, "DELETE"); assert.equal(op.body, null); }
    return refusal();
  };
  return { ctx, rows, requests, transport };
}
const probe = (h, timeoutMs) => createEventAppendOnlyAcceptance(h.ctx, { transport: h.transport, clientId: CLIENT, ...(timeoutMs ? { timeoutMs } : {}) });
const fails = async (h, code, point, unknown = false, timeoutMs) => {
  const subject = probe(h, timeoutMs), result = await subject.run();
  assert.equal(result.status, "failed"); assert.equal(result.code, code); assert.equal(result.failurePoint, point); assert.equal(result.writeOutcomeUncertain, unknown);
  assert.equal(subject.metadata().writeOutcomeUncertain, unknown); assert.equal(result.stages.at(-1).passed, false);
  return { subject, result };
};

test("import/construction has no effects or default transport and metadata cannot expose actors", async () => {
  const h = harness(), subject = probe(h);
  assert.equal(h.requests.length, 0); assert.deepEqual(subject.metadata(), { state: "prepared", passed: false, writeOutcomeUncertain: false });
  assert.throws(() => createEventAppendOnlyAcceptance(h.ctx, { clientId: CLIENT }), /SETUP_REFUSED/);
  const source = await readFile(new URL("../e2e-auth-local/events-append-only-support.mjs", import.meta.url), "utf8");
  assert.equal(/process\s*\.\s*env|\bfetch\s*\(|console\s*\.|node:(?:fs|child_process)/.test(source), false);
  subject.dispose(); assert.equal(h.requests.length, 0); assert.equal(subject.metadata().state, "disposed");
});
test("ordinary own nonempty/foreign empty, legitimate event, exact refusal/invariance complete all12 steps", async () => {
  const h = harness(), initialA = structuredClone(h.rows.a), initialB = structuredClone(h.rows.b);
  for (const [rows, owner] of [[initialA, A], [initialB, B]]) {
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map(({ entity_type, action, canal, entity_id }) => ({ entity_type, action, canal, entity_id })),
      ["profile", "preference", "role", "moderation"].map(entity_type => ({ entity_type, action: "created", canal: "api", entity_id: owner })));
  }
  const subject = probe(h), result = await subject.run();
  assert.equal(result.status, "passed"); assert.equal(result.code, "PASSED"); assert.equal(result.failurePoint, null);
  assert.deepEqual(result.stages, EVENT_STAGES.map(name => ({ name, passed: true })));
  assert.deepEqual(result.counts, { requests: 12, readRequests: 9, rpcWriteAttempts: 1, directWriteAttempts: 2, sqlRefusals: 2, baselineARecords: 4, baselineBRecords: 4, eventCreated: 1 });
  assert.equal(Object.values(result.checks).every(Boolean), true); assert.equal(result.writeOutcomeUncertain, false);
  assert.equal(h.requests.length, 12); assert.equal(h.rows.a.at(-1).id, EVENT);
  assert.equal(h.rows.a.length, initialA.length + 1); assert.equal(h.rows.a.length, 5);
  assert.deepEqual(h.rows.a.slice(0, initialA.length), initialA); assert.deepEqual(h.rows.b, initialB);
  assert.deepEqual(h.rows.a.at(-1), event(EVENT, A, "profile", "updated", "web"));
  assert.equal(Object.isFrozen(result.counts), true); assert.equal(Object.isFrozen(result.stages[0]), true);
  for (const value of [A, B, EVENT, CLIENT, stamp, "Append-only fixture", h.ctx.a.accessToken, pub, "SYNTHETIC_PRIVATE_MESSAGE"]) assert.equal(JSON.stringify(result).includes(value), false);
});
test("refuses foreign runtime, keys, actor/session reuse, malformed JWT/clientID/deadline without calls", () => {
  for (const mutate of [c => c.runtime.ci = false, c => c.runtime.supabaseUrl = "https://foreign.invalid", c => c.runtime.appUrl = "http://localhost:3117", c => c.runtime.privileged = true, c => c.publishableKey = `sb_secret_${"S".repeat(32)}`, c => c.b = c.a, c => c.a.accessToken = "invalid", c => c.a.sessionId = SB]) {
    const h = harness(); mutate(h.ctx); assert.throws(() => probe(h), /SETUP_REFUSED/); assert.equal(h.requests.length, 0);
  }
  for (const patch of [{ clientId: "bad" }, { timeoutMs: 0 }, { timeoutMs: 15001 }, { timeoutMs: "15" }, { arbitraryPath: "/rest/v1/other" }]) {
    const h = harness(); assert.throws(() => createEventAppendOnlyAcceptance(h.ctx, { transport: h.transport, clientId: CLIENT, ...patch }), /SETUP_REFUSED/); assert.equal(h.requests.length, 0);
  }
});
test("empty ownA/ownB or foreign ownership cannot make empty isolation pass", async () => {
  for (const [ordinal, owner] of [[1, A], [2, B]]) {
    const h = harness(op => op.ordinal === ordinal ? json([]) : null);
    await fails(h, "OWNERSHIP_REFUSED", ordinal === 1 ? "A_BASELINE" : "B_BASELINE"); assert.equal(h.requests.length, ordinal);
    const foreign = harness(op => op.ordinal === ordinal ? json([event(uuid(55), owner === A ? B : A)]) : null);
    await fails(foreign, "OWNERSHIP_REFUSED", ordinal === 1 ? "A_BASELINE" : "B_BASELINE");
  }
});
test("seven columns are exact/bijective/bounded and cannot include private payload or duplicate IDs", async () => {
  for (const rows of [[event(uuid(10), A), event(uuid(10), A)], [{ ...event(uuid(10), A), before: {} }], [{ ...event(uuid(10), A), user_id: undefined }], [{ ...event(uuid(10), A), entity_type: "unknown" }], Array.from({ length: 65 }, (_, i) => event(uuid(500 + i), A))]) {
    await fails(harness(op => op.ordinal === 1 ? json(rows) : null), "OWNERSHIP_REFUSED", "A_BASELINE");
  }
});
test("current profile ROW ACK requires own8fields including avatar_file_id, never oldshape/otherowner", async () => {
  for (const mutate of [r => delete r.avatar_file_id, r => r.user_id = B, r => r.display_name = "wrong", r => r.secret = "not reported", r => r.avatar_file_id = EVENT]) {
    const row = profile(); mutate(row);
    const h = harness(op => op.ordinal === 3 ? json(row) : null);
    await fails(h, "RPC_ACK_REFUSED", "EVENT_RPC", true); assert.equal(h.requests.length, 3);
  }
});
test("metadata timestamps reject normalized invalid calendars and retain raw valid microseconds", async () => {
  for (const stamp of ["2026-02-30T08:00:00Z", "2025-02-29T08:00:00Z", "0000-01-01T08:00:00Z", "2026-10-10T24:00:00Z", "2026-10-10T08:00:00.1234567Z", "not-a-time"]) {
    await fails(harness(op => op.ordinal === 1 ? json([{ ...event(uuid(10), A), occurred_at: stamp }]) : null), "OWNERSHIP_REFUSED", "A_BASELINE");
  }
  const h = harness(); const r = await probe(h).run(); assert.equal(r.status, "passed"); assert.equal(h.rows.a.at(-1).occurred_at, stamp);
});
test("RPC acknowledgment never certifies missing/additional/reused/changed or incorrectly typed event", async () => {
  for (const alter of [rows => rows.slice(0, -1), rows => [...rows, event(uuid(101), A, "profile", "updated", "web")], rows => [{ ...rows[0], canal: "web" }, ...rows.slice(1)], rows => [...rows.slice(0, -1), { ...rows.at(-1), action: "created" }]]) {
    await fails(harness((op, _options, rows) => op.ordinal === 4 ? json(alter(rows.a)) : null), "EVENT_CREATION_REFUSED", "A_DELTA");
  }
});
test("B must not see real eventA before or after denial attempts", async () => {
  for (const ordinal of [5, 12]) {
    const h = harness(op => op.ordinal === ordinal ? json([event(EVENT, A, "profile", "updated", "web")]) : null);
    await fails(h, "OWNERSHIP_REFUSED", ordinal === 5 ? "B_FOREIGN_BEFORE" : "B_FOREIGN_AFTER"); assert.equal(h.requests.length, ordinal);
  }
});
test("only exact403/42501 certifies UPDATE/DELETE; success/schemaerrors maintain sticky writeunknown", async () => {
  for (const ordinal of [6, 8]) for (const response of [() => refusal("42501", 401), () => refusal("42501", 404), () => refusal("42883"), () => refusal("PT403"), () => json([]), () => refusal("42501", 503)]) {
    const h = harness(op => op.ordinal === ordinal ? response() : null);
    await fails(h, "SQL_REFUSAL_NOT_PROVEN", ordinal === 6 ? "EVENT_UPDATE" : "EVENT_DELETE", true); assert.equal(h.requests.length, ordinal);
  }
});
test("postdenial exact read and final A/B snapshots detect mutation, disappearance, duplication or emptyB", async () => {
  for (const ordinal of [7, 9, 10, 11]) {
    const h = harness((op, _options, rows) => op.ordinal === ordinal ? json(ordinal === 11 ? [{ ...rows.b[0], canal: "web" }, ...rows.b.slice(1)] : ordinal === 10 ? rows.a.slice(0, -1) : [{ ...rows.a.at(-1), canal: "api" }]) : null);
    await fails(h, "SNAPSHOT_CHANGED", EVENT_STAGES[ordinal - 1]); assert.equal(h.requests.length, ordinal);
  }
  await fails(harness(op => op.ordinal === 9 ? json([]) : null), "OWNERSHIP_REFUSED", "EVENT_AFTER_DELETE");
  await fails(harness(op => op.ordinal === 11 ? json([]) : null), "OWNERSHIP_REFUSED", "B_FINAL");
});
test("snapshot equality is by ID/fullmetadata rather than response ordering", async () => {
  const h = harness((op, _options, rows) => [4, 10, 11].includes(op.ordinal) ? json([...rows[op.owner]].reverse()) : null);
  assert.equal((await probe(h).run()).status, "passed");
});
test("expired/revoked roles cannot become privilege proof; check lifetime again at finalphase", async () => {
  const h = harness(); h.ctx.a = actor(A, SA, Math.floor(Date.now() / 1000 + 30) * 1000);
  await fails(h, "TOKEN_LIFETIME_REFUSED", "A_BASELINE"); assert.equal(h.requests.length, 0);
  await fails(harness(op => op.ordinal === 1 ? json([]) : null), "OWNERSHIP_REFUSED", "A_BASELINE");
  const previous = Date.now;
  const late = harness((op, _options, _rows, ctx) => { if (op.ordinal === 12) Date.now = () => ctx.a.expiresAt - 30_000; return null; });
  try { await fails(late, "TOKEN_LIFETIME_REFUSED", "B_FOREIGN_AFTER"); } finally { Date.now = previous; }
});
test("transport/refusal messages never escape, lost writes stop and cannot be retried or cleared", async () => {
  for (const ordinal of [3, 6, 8]) {
    const h = harness(op => { if (op.ordinal === ordinal) throw new Error("PRIVATE_TOKEN_BODY_CANARY"); });
    const { subject, result } = await fails(h, "TRANSPORT_FAILED", EVENT_STAGES[ordinal - 1], true);
    assert.equal(JSON.stringify(result).includes("CANARY"), false); assert.equal(h.requests.length, ordinal);
    assert.equal((await subject.run()).code, "STATE_REFUSED"); assert.equal(h.requests.length, ordinal);
    subject.dispose(); assert.equal(subject.metadata().writeOutcomeUncertain, true);
  }
});
test("deadline catches transports ignoring abort and late results cannot revive report/latch", async () => {
  let release;
  const h = harness(op => op.ordinal === 3 ? new Promise(resolve => { release = resolve; }) : null);
  const { subject, result } = await fails(h, "DEADLINE_EXCEEDED", "EVENT_RPC", true, 25);
  release(json(profile())); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(result.status, "failed"); assert.equal(subject.metadata().writeOutcomeUncertain, true); assert.equal(h.requests.length, 3);
});
test("bodyreader deadline is bounded even when stream ignores abort/cancel", async () => {
  const h = harness(op => op.ordinal === 3 ? new Response(new ReadableStream({ pull: () => new Promise(() => {}) }), { headers: { "Content-Type": "application/json" } }) : null);
  await fails(h, "DEADLINE_EXCEEDED", "EVENT_RPC", true, 25);
});
test("wrong redirect/url/contenttype/UTF8/oversize declared or actual payload cannot pass", async () => {
  const variants = [
    () => { const r = json([]); Object.defineProperty(r, "redirected", { value: true }); return r; },
    () => { const r = json([]); Object.defineProperty(r, "url", { value: "https://foreign.invalid" }); return r; },
    () => new Response("[]", { headers: { "Content-Type": "text/plain" } }),
    () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { "Content-Type": "application/json" } }),
    () => json([], 200, { "Content-Length": "1048577" }),
    () => new Response(" ".repeat(1_048_577), { headers: { "Content-Type": "application/json" } }),
  ];
  for (const reply of variants) await fails(harness(op => op.ordinal === 1 ? reply() : null), "RESPONSE_REFUSED", "A_BASELINE");
});
test("busy run/dispose/repeated run cannot race, repeat RPC or overwrite original frozen proof", async () => {
  let release;
  const h = harness(op => op.ordinal === 1 ? new Promise(resolve => { release = () => resolve(json(h.rows.a)); }) : null), subject = probe(h);
  const running = subject.run(); await Promise.resolve();
  assert.equal((await subject.run()).code, "STATE_REFUSED"); assert.throws(() => subject.dispose(), /STATE_REFUSED/);
  release(); const original = await running; assert.equal(original.status, "passed");
  assert.equal((await subject.run()).code, "STATE_REFUSED"); assert.equal(h.requests.length, 12);
  subject.dispose(); assert.equal(original.status, "passed"); assert.equal(subject.metadata().state, "disposed");
});
