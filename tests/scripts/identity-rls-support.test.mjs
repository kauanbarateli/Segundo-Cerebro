import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createIdentityRlsAcceptance, RLS_LOCAL_API, RLS_LOCAL_APP } from "../e2e-auth-local/identity-rls-support.mjs";

// Entirely synthetic tokens for protocol doubles, never seeded into any service.
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const SA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", SB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const publishable = `sb_publishable_${"P".repeat(32)}`;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
function actor(id, sessionId, expiresAt = Math.floor(Date.now() / 1000 + 600) * 1000) {
  return { id, sessionId, expiresAt, accessToken: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, session_id: sessionId, role: "authenticated", exp: expiresAt / 1000 })}.${Buffer.from("synthetic-double-signature").toString("base64url")}` };
}
const context = () => ({ runtime: { ci: true, githubActions: true, localAuthRun: true, appUrl: RLS_LOCAL_APP, supabaseUrl: RLS_LOCAL_API }, publishableKey: publishable, a: actor(A, SA), b: actor(B, SB) });
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const refused = (code = "42501", status = 403) => json({ code, message: "synthetic not reported", details: null, hint: null }, status);

function harness(override) {
  const ctx = context(), requests = [];
  let revoked = false;
  const transport = async (url, options) => {
    assert.equal(new URL(url).origin, RLS_LOCAL_API);
    assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    assert.equal(options.headers.apikey, publishable);
    assert.equal(options.signal instanceof AbortSignal, true);
    const token = options.headers.Authorization.slice(7);
    const owner = token === ctx.a.accessToken ? "a" : token === ctx.b.accessToken ? "b" : token === publishable ? "anon" : "foreign";
    assert.notEqual(owner, "foreign");
    const target = new URL(url);
    const operation = { owner, method: options.method, path: target.pathname, query: target.searchParams, body: options.body ? JSON.parse(options.body) : null, ordinal: requests.length + 1 };
    requests.push(operation);
    const custom = override && await override(operation, options, ctx);
    if (custom) return custom;
    if (target.pathname === "/rest/v1/profiles" && options.method === "GET") {
      assert.equal(target.searchParams.get("select"), "user_id,display_name"); assert.equal(target.searchParams.get("limit"), "2");
      assert.equal([...target.searchParams.keys()].every(key => ["select", "limit", "user_id"].includes(key)), true);
      if (owner === "anon") return refused("42501", 401);
      const id = owner === "a" ? A : B, filter = target.searchParams.get("user_id");
      assert.equal(filter === null || ["eq." + A, "eq." + B].includes(filter), true);
      return json(revoked && owner === "a" || filter !== null && filter !== "eq." + id ? [] : [{ user_id: id, display_name: null }]);
    }
    if (target.pathname === "/rest/v1/user_moderation") {
      assert.equal(owner, "a"); assert.equal(target.searchParams.get("user_id"), "eq." + A);
      if (options.method === "PATCH") { assert.deepEqual(operation.body, { must_change_password: true }); assert.equal(options.headers.Prefer, "return=minimal"); }
      else { assert.equal(options.method, "GET"); assert.equal(target.searchParams.get("select"), "user_id,must_change_password"); assert.equal(target.searchParams.get("limit"), "2"); }
      return refused();
    }
    if (target.pathname === "/rest/v1/profiles" && options.method === "PATCH") {
      assert.equal(owner, "a"); assert.equal(target.searchParams.get("user_id"), "eq." + A);
      assert.deepEqual(operation.body, { display_name: "RLS refusal canary" }); assert.equal(options.headers.Prefer, "return=minimal");
      return refused();
    }
    assert.equal(target.pathname, "/rest/v1/rpc/my_access_state"); assert.equal(options.method, "POST"); assert.equal(target.search, ""); assert.deepEqual(operation.body, {});
    if (revoked && owner === "a") return refused();
    return json({ user_id: owner === "a" ? A : B, role: "user", must_change_password: false, entitlements: {} });
  };
  return { ctx, requests, transport, revoke: () => { revoked = true; } };
}

test("import and construction perform zero calls and cannot supply a default network transport", async () => {
  let calls = 0;
  const probe = createIdentityRlsAcceptance(context(), { transport: async () => { calls++; throw new Error("not called"); } });
  assert.equal(calls, 0); assert.deepEqual(probe.metadata(), { state: "prepared", beforePassed: false, afterPassed: false, writeOutcomeUncertain: false });
  const text = await readFile(new URL("../e2e-auth-local/identity-rls-support.mjs", import.meta.url), "utf8");
  assert.equal(/process\s*\.\s*env|import\s*\(.+|\bfetch\s*\(|console\s*\./.test(text), false);
  probe.dispose(); assert.equal(calls, 0); assert.equal(probe.metadata().state, "disposed");
});

test("before and actual-revocation double after are independent complete closed reports", async () => {
  const h = harness(), probe = createIdentityRlsAcceptance(h.ctx, { transport: h.transport });
  const before = await probe.before();
  assert.equal(before.status, "passed"); assert.equal(before.failurePoint, null); assert.equal(before.writeOutcomeUncertain, false);
  assert.deepEqual(before.counts, { requests: 12, directWriteAttempts: 2, sqlRefusals: 4 });
  assert.equal(Object.values(before.checks).every(value => value === true), true);
  h.revoke(); const after = await probe.after();
  assert.equal(after.status, "passed"); assert.deepEqual(after.counts, { requests: 4, directWriteAttempts: 0, sqlRefusals: 1 });
  assert.equal(Object.values(after.checks).every(value => value === true), true); assert.equal(after.scenario, "identity-rls-after");
  assert.equal(before.scenario, "identity-rls-before"); assert.equal(before.status, "passed"); assert.equal(Object.isFrozen(before.checks), true);
  assert.deepEqual(Object.keys(before), ["schemaVersion", "scenario", "status", "code", "failurePoint", "counts", "checks", "writeOutcomeUncertain"]);
  const output = JSON.stringify({ before, after, metadata: probe.metadata() });
  for (const privateValue of [A, B, h.ctx.a.accessToken, h.ctx.b.accessToken, publishable, "display_name", "synthetic not reported"]) assert.equal(output.includes(privateValue), false);
  assert.equal(h.requests.length, 16); probe.dispose();
});

test("two existing own rows are required before zero foreign or revoked rows can count as evidence", async () => {
  const h = harness(operation => operation.ordinal === 1 ? json([]) : null);
  const probe = createIdentityRlsAcceptance(h.ctx, { transport: h.transport });
  const before = await probe.before(); assert.equal(before.status, "failed"); assert.equal(before.failurePoint, "OWN_A"); assert.equal(before.code, "OWNERSHIP_REFUSED");
  const after = await probe.after(); assert.equal(after.status, "failed"); assert.equal(after.code, "STATE_REFUSED"); assert.equal(h.requests.length, 1);
});

test("foreign disclosure and wrong owner cannot be accepted as own/zero evidence", async () => {
  for (const ordinal of [1, 2, 3, 4]) {
    const h = harness(operation => operation.ordinal === ordinal ? json([{ user_id: operation.owner === "a" ? B : A, display_name: null }]) : null);
    const report = await createIdentityRlsAcceptance(h.ctx, { transport: h.transport }).before();
    assert.equal(report.status, "failed"); assert.equal(report.code, "OWNERSHIP_REFUSED"); assert.equal(h.requests.length, ordinal);
  }
});

test("schema/function errors are not privilege proofs and never trigger a fallback query", async () => {
  for (const code of ["42883", "42P01", "PGRST106", "PGRST205", "PT403"]) {
    const h = harness(operation => operation.ordinal === 6 ? refused(code, 404) : null);
    const report = await createIdentityRlsAcceptance(h.ctx, { transport: h.transport }).before();
    assert.equal(report.code, "SQL_REFUSAL_NOT_PROVEN"); assert.equal(report.failurePoint, "MODERATION_READ"); assert.equal(report.checks.moderationUnreadable, false);
    assert.equal(h.requests.length, 6); assert.equal(report.writeOutcomeUncertain, false); assert.equal(JSON.stringify(report).includes(code), false);
  }
});

test("anon empty success and mismatched status/code cannot prove lack of grants", async () => {
  for (const response of [() => json([]), () => refused("42501", 500), () => json({ code: "42501", message: "synthetic", extra: true }, 401), () => json({ code: "42501", data: [] }, 401)]) {
    const h = harness(operation => operation.owner === "anon" ? response() : null);
    const report = await createIdentityRlsAcceptance(h.ctx, { transport: h.transport }).before();
    assert.equal(report.status, "failed"); assert.equal(report.failurePoint, "ANON_PROFILES"); assert.equal(report.code, "SQL_REFUSAL_NOT_PROVEN");
    assert.equal(h.requests.length, 5);
  }
});

test("unexpected accepted/error direct PATCH stays uncertain and stops further operations", async () => {
  for (const ordinal of [7, 8]) for (const response of [() => json([], 200), () => new Response(null, { status: 204 }), () => refused("XX000", 500)]) {
    const h = harness(operation => operation.ordinal === ordinal ? response() : null);
    const probe = createIdentityRlsAcceptance(h.ctx, { transport: h.transport });
    const report = await probe.before(); assert.equal(report.status, "failed"); assert.equal(report.writeOutcomeUncertain, true);
    assert.equal(probe.metadata().writeOutcomeUncertain, true); assert.equal(h.requests.length, ordinal);
    await probe.after(); assert.equal(h.requests.length, ordinal);
  }
});

test("changed A/B rereads fail even when direct refusals returned 42501", async () => {
  for (const ordinal of [9, 10]) {
    const h = harness(operation => operation.ordinal === ordinal ? json([{ user_id: operation.owner === "a" ? A : B, display_name: "synthetic drift" }]) : null);
    const report = await createIdentityRlsAcceptance(h.ctx, { transport: h.transport }).before();
    assert.equal(report.status, "failed"); assert.equal(report.code, "SNAPSHOT_CHANGED"); assert.equal(report.checks.ownSnapshotsPreserved, false);
    assert.equal(report.writeOutcomeUncertain, false);
  }
});

test("moderation/promotion or a foreign access DTO cannot pass ordinary account proof", async () => {
  for (const patch of [{ must_change_password: true }, { role: "master" }, { user_id: B }, { entitlements: { admin: true } }, { extra: null }]) {
    const h = harness(operation => operation.ordinal === 11 ? json({ user_id: A, role: "user", must_change_password: false, entitlements: {}, ...patch }) : null);
    const report = await createIdentityRlsAcceptance(h.ctx, { transport: h.transport }).before();
    assert.equal(report.code, "ACCESS_STATE_REFUSED"); assert.equal(report.checks.ordinaryAccessPreserved, false); assert.equal(h.requests.length, 11);
  }
});

test("after without actual revoke fails while preserving original before proof", async () => {
  const h = harness(), probe = createIdentityRlsAcceptance(h.ctx, { transport: h.transport });
  const before = await probe.before(), report = await probe.after();
  assert.equal(before.status, "passed"); assert.equal(report.status, "failed"); assert.equal(report.code, "OWNERSHIP_REFUSED");
  assert.equal(report.failurePoint, "OLD_A_PROFILES"); assert.equal(report.checks.oldAOwnHidden, false);
});

test("a revoked-looking empty profile alone cannot certify revoked Auth/RPC", async () => {
  const h = harness(operation => operation.ordinal === 13 ? json([]) : null), probe = createIdentityRlsAcceptance(h.ctx, { transport: h.transport });
  assert.equal((await probe.before()).status, "passed"); const report = await probe.after();
  assert.equal(report.status, "failed"); assert.equal(report.failurePoint, "OLD_A_RPC"); assert.equal(report.code, "SQL_REFUSAL_NOT_PROVEN"); assert.equal(report.checks.oldARpcDenied, false);
});

test("B loss or drift after A revocation fails the independent B check", async () => {
  for (const body of [[], [{ user_id: B, display_name: "synthetic drift" }]]) {
    const h = harness(operation => operation.ordinal === 15 ? json(body) : null), probe = createIdentityRlsAcceptance(h.ctx, { transport: h.transport });
    assert.equal((await probe.before()).status, "passed"); h.revoke(); const report = await probe.after();
    assert.equal(report.status, "failed"); assert.equal(report.failurePoint, "B_PROFILES"); assert.equal(report.checks.bOwnUnchanged, false);
  }
});

test("expired/near-expired JWT cannot imitate active or revoked authorization", async () => {
  const h = harness(); h.ctx.a = actor(A, SA, Math.floor(Date.now() / 1000 + 30) * 1000);
  const report = await createIdentityRlsAcceptance(h.ctx, { transport: h.transport }).before();
  assert.equal(report.code, "TOKEN_LIFETIME_REFUSED"); assert.equal(h.requests.length, 0);
});

test("fixed input pins reject remote aliases, service keys, foreign subjects and extra controls before transport", () => {
  const badContexts = [];
  for (const [key, value] of [["ci", false], ["githubActions", false], ["localAuthRun", false], ["appUrl", "https://segundo-cerebro-of.vercel.app"], ["supabaseUrl", "http://localhost:54321"], ["supabaseUrl", "https://rishenjoikgmfubmnfiu.supabase.co"]]) { const ctx = context(); ctx.runtime[key] = value; badContexts.push(ctx); }
  const service = context(); service.publishableKey = `sb_secret_${"S".repeat(32)}`; badContexts.push(service);
  const extra = context(); extra.url = RLS_LOCAL_API; badContexts.push(extra);
  const wrongSubject = context(); wrongSubject.a.accessToken = wrongSubject.b.accessToken; badContexts.push(wrongSubject);
  const sameOwners = context(); sameOwners.b = sameOwners.a; badContexts.push(sameOwners);
  const invalidId = context(); invalidId.a.id += "?user_id=neq.foreign"; badContexts.push(invalidId);
  for (const ctx of badContexts) assert.throws(() => createIdentityRlsAcceptance(ctx, { transport: async () => assert.fail("transport must not run") }), { message: "SETUP_REFUSED" });
  for (const options of [{}, { transport: null }, { transport: async () => null, timeoutMs: 0 }, { transport: async () => null, timeoutMs: 15_001 }, { transport: async () => null, retries: 1 }]) assert.throws(() => createIdentityRlsAcceptance(context(), options), { message: "SETUP_REFUSED" });
});

test("body bound, malformed/fatal UTF8 and redirect responses fail closed without data outputs", async () => {
  const responders = [
    () => json([], 200, { "Content-Length": "1048577" }),
    () => new Response(" ".repeat(1_048_577), { headers: { "Content-Type": "application/json" } }),
    () => new Response("{", { headers: { "Content-Type": "application/json" } }),
    () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { "Content-Type": "application/json" } }),
    () => new Response("[]", { headers: { "Content-Type": "text/html" } }),
    () => { const response = json([]); Object.defineProperty(response, "redirected", { value: true }); return response; },
    () => { const response = json([]); Object.defineProperty(response, "url", { value: "https://foreign.invalid/" }); return response; },
  ];
  for (const responder of responders) {
    const probe = createIdentityRlsAcceptance(context(), { transport: async () => responder() });
    const report = await probe.before(); assert.equal(report.status, "failed"); assert.equal(report.code, "RESPONSE_REFUSED"); assert.equal(report.counts.requests, 1);
    assert.equal(JSON.stringify(report).includes("foreign.invalid"), false);
  }
});

test("transport/body stall is bounded and local abort never proves remote completion", async () => {
  let signal;
  const probe = createIdentityRlsAcceptance(context(), { timeoutMs: 10, transport: async (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
  const started = performance.now(), report = await probe.before();
  assert.equal(report.code, "DEADLINE_EXCEEDED"); assert.equal(signal.aborted, true); assert.equal(performance.now() - started < 2000, true);
  const h = harness(operation => operation.ordinal === 7 ? new Response(new ReadableStream({ pull: () => new Promise(() => {}) }), { headers: { "Content-Type": "application/json" } }) : null);
  const writeProbe = createIdentityRlsAcceptance(h.ctx, { timeoutMs: 25, transport: h.transport });
  const writeReport = await writeProbe.before(); assert.equal(writeReport.code, "DEADLINE_EXCEEDED"); assert.equal(writeReport.failurePoint, "MODERATION_WRITE"); assert.equal(writeReport.writeOutcomeUncertain, true);
  writeProbe.dispose();
});

test("lost PATCH transport reports only closed failure and cannot certify cleanup or retry", async () => {
  const h = harness(operation => { if (operation.ordinal === 7) throw new Error("untrusted-provider-secret-must-not-appear"); return null; });
  const probe = createIdentityRlsAcceptance(h.ctx, { transport: h.transport }), report = await probe.before();
  assert.equal(report.code, "TRANSPORT_FAILED"); assert.equal(report.writeOutcomeUncertain, true); assert.equal(h.requests.length, 7);
  assert.equal(JSON.stringify(report).includes("untrusted-provider-secret"), false);
  const again = await probe.before(); assert.equal(again.status, "failed"); assert.equal(again.writeOutcomeUncertain, true); assert.equal(h.requests.length, 7);
});

test("an unresolved late reply is not collected after timeout and cannot rewrite a closed report", async () => {
  let release;
  const probe = createIdentityRlsAcceptance(context(), { timeoutMs: 10, transport: () => new Promise(resolve => { release = resolve; }) });
  const report = await probe.before();
  const response = json([{ user_id: A, display_name: null }]);
  let reads = 0; const original = response.body.getReader.bind(response.body);
  response.body.getReader = (...args) => { reads++; return original(...args); };
  release(response); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(reads, 0); assert.equal(report.code, "DEADLINE_EXCEEDED"); assert.equal(probe.metadata().beforePassed, false); probe.dispose();
});

test("state guards stop concurrent phases and prevent reuse after disposal", async () => {
  let release;
  const probe = createIdentityRlsAcceptance(context(), { timeoutMs: 10, transport: () => new Promise(resolve => { release = resolve; }) });
  const pending = probe.before(); const second = await probe.before();
  assert.equal(second.code, "STATE_REFUSED"); assert.throws(() => probe.dispose(), { message: "STATE_REFUSED" });
  await pending; release(json([])); probe.dispose();
  assert.equal((await probe.before()).code, "STATE_REFUSED"); assert.equal((await probe.after()).code, "STATE_REFUSED");
});
