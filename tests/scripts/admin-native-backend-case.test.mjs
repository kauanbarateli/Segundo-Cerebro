// Pure composition: real canonical SQL/PGlite + original Core/ports/SDK,
// explicit synthetic Auth/HTTP/provenance doubles. No GoTrue/PostgREST service,
// JWT cryptographic authentication, PG17 instance, namespace or browser PASS.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { createAdminNativeBackendAcceptance, loadAdminNativeBackend, ADMIN_NATIVE_API } from "../e2e-auth-local/admin-native-backend-case.mjs";
import { ADMIN_NATIVE_CASES, ADMIN_NATIVE_PASS_COUNTS, ADMIN_NATIVE_CLEANUP_COUNTS, validateAdminNativeReport, validateAdminNativeCleanup } from "../e2e-auth-local/admin-native-backend-contract.mjs";

const A = "77000000-0000-4000-8000-000000000001", AS = "77000000-0000-4000-8000-000000000002", B = "77000000-0000-4000-8000-000000000003", BS = "77000000-0000-4000-8000-000000000004";
const namespace = "sc-admin-native-" + "a".repeat(32), sourceSha = "b".repeat(40), systemIdentifier = "7250000000000000001";
function jwt(id, sessionId, seconds = 3600) { const exp = Math.floor(Date.now() / 1000) + seconds; return { token: Buffer.from('{"alg":"synthetic"}').toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: id, session_id: sessionId, role: "authenticated", exp })).toString("base64url") + ".synthetic", expiresAt: exp * 1000 }; }
function makeContext(kind) { const a = jwt(A, AS), b = jwt(B, BS); return { case: kind, sourceSha, publishableKey: "sb_publishable_fake_only_for_test", serverSecretKey: "sb_secret_fake_only_for_test", commitmentSecret: "synthetic-admin-exclusive-hmac-closure-32-chars", runtime: { ci: true, githubActions: true, localAdminRun: true, supabaseUrl: ADMIN_NATIVE_API, namespace, systemIdentifier }, a: { id: A, sessionId: AS, accessToken: a.token, expiresAt: a.expiresAt, email: "admin-a@example.invalid" }, b: { id: B, sessionId: BS, accessToken: b.token, expiresAt: b.expiresAt, email: "admin-b@example.invalid" } }; }
const rpcSignatures = {
  admin_snapshot: ["p_actor", "p_session"], admin_reserve: ["p_actor", "p_session", "p_intent", "p_execution"], admin_claim: ["p_actor", "p_session", "p_operation", "p_execution"], admin_operation_guard: ["p_actor", "p_session", "p_operation", "p_execution"], admin_transition: ["p_actor", "p_session", "p_operation", "p_phase", "p_execution", "p_release"], admin_complete: ["p_actor", "p_session", "p_operation", "p_execution"], capture_task_snapshot: ["p_user", "p_session", "p_operation"], my_access_state: [],
};
const typeOfArg = key => key === "p_intent" ? "jsonb" : ["p_phase"].includes(key) ? "text" : key === "p_release" ? "boolean" : "uuid";
async function fixture(kind, controls = {}) {
  const db = await createLocalCanonicalSql(), context = makeContext(kind), history = [], inspectHistory = [], tokens = new Map([[context.a.accessToken, { sub: A, session_id: AS, role: "authenticated" }], [context.b.accessToken, { sub: B, session_id: BS, role: "authenticated" }]]);
  await db.query("insert into auth.users(id,aud,role,email,raw_app_meta_data)values($1,'authenticated','authenticated',$2,$5::jsonb),($3,'authenticated','authenticated',$4,$5::jsonb)", [A, context.a.email, B, context.b.email, JSON.stringify({ sc_admin_native_fixture: namespace })]);
  await db.query("insert into auth.sessions(id,user_id)values($1,$2),($3,$4)", [AS, A, BS, B]); await db.query("insert into auth.refresh_tokens(user_id,session_id,token)values($1,$2,'synthetic-a'),($3,$4,'synthetic-b')", [A, AS, B, BS]);
  // Authorized local fixture only. Use the canonical bootstrap function rather
  // than claiming that app_metadata grants a role.
  await db.query("select app_private.bootstrap_master($1::uuid)", [A]);
  // The native fixed inspector will return JSON, not PGlite JS Date objects.
  const rows = async sql => JSON.parse(JSON.stringify((await db.query(sql)).rows));
  async function authUser(id) { const list = (await db.query("select id,email,role,is_anonymous,raw_app_meta_data as app_metadata,banned_until,created_at,updated_at from auth.users where id=$1", [id])).rows; return list[0] ? { aud: "authenticated", user_metadata: {}, identities: [], ...list[0] } : null; }
  const errorResponse = (code, status = 403) => Response.json({ code, message: "Synthetic SQL or Auth refused.", details: null, hint: null }, { status, headers: { "X-Supabase-Api-Version": "2024-01-01" } });
  async function transport(raw, request) {
    const url = new URL(raw), headers = new Headers(request.headers), data = request.body === undefined ? undefined : JSON.parse(request.body), token = headers.get("authorization")?.slice(7), claims = tokens.get(token);
    assert.equal(url.origin, ADMIN_NATIVE_API); assert.equal(request.redirect, "error"); assert.equal(request.credentials, "omit"); assert.equal(request.cache, "no-store"); assert.ok(request.signal instanceof AbortSignal); history.push({ path: url.pathname, method: request.method, aborted: false });
    if (controls.transport) { const response = await controls.transport({ url, request, data, history, db, context }); if (response !== undefined) return response; }
    if (url.pathname === "/auth/v1/user" && request.method === "GET") { assert.ok(claims); const user = await authUser(claims.sub); return user ? Response.json({ user }) : errorResponse("user_not_found", 404); }
    if (url.pathname === "/auth/v1/admin/users" && request.method === "POST") {
      assert.equal(headers.get("apikey"), context.serverSecretKey); await db.query("insert into auth.users(id,aud,role,email,raw_app_meta_data,banned_until)values($1,'authenticated','authenticated',$2,$3::jsonb,now()+interval '876000 hours')", [data.id, data.email, JSON.stringify(data.app_metadata)]); return Response.json({ user: await authUser(data.id) });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/") && ["GET", "PUT", "DELETE"].includes(request.method)) {
      const id = url.pathname.split("/").at(-1), user = await authUser(id); assert.equal(headers.get("apikey"), context.serverSecretKey); if (!user) return errorResponse("user_not_found", 404);
      if (request.method === "PUT") { assert.equal(data.ban_duration, kind === "BLOCK_OLD_JWT" ? "876000h" : "none"); await db.query("update auth.users set banned_until=case when $2='none' then null else now()+interval '876000 hours' end where id=$1", [id, data.ban_duration]); return Response.json({ user: await authUser(id) }); }
      if (request.method === "DELETE") { assert.deepEqual(data, { should_soft_delete: false }); await db.query("delete from auth.users where id=$1", [id]); return Response.json({ user }); }
      return Response.json({ user });
    }
    if (url.pathname === "/auth/v1/token" && request.method === "POST") {
      assert.equal(url.search, "?grant_type=password"); const users = (await db.query("select id from auth.users where email=$1 and (banned_until is null or banned_until<=now())", [data.email])).rows; assert.equal(users.length, 1); const id = users[0].id, sessionId = randomUUID(), hint = jwt(id, sessionId); tokens.set(hint.token, { sub: id, session_id: sessionId, role: "authenticated" }); await db.query("insert into auth.sessions(id,user_id)values($1,$2)", [sessionId, id]); await db.query("insert into auth.refresh_tokens(user_id,session_id,token)values($1,$2,'synthetic-created')", [id, sessionId]); return Response.json({ access_token: hint.token, token_type: "bearer", expires_in: 3600, expires_at: hint.expiresAt / 1000, refresh_token: "synthetic-created-refresh", user: await authUser(id) });
    }
    if (url.pathname === "/auth/v1/logout" && request.method === "POST") { assert.equal(url.search, "?scope=global"); assert.ok(claims); await db.query("delete from auth.refresh_tokens where user_id=$1", [claims.sub]); await db.query("delete from auth.sessions where user_id=$1", [claims.sub]); return new Response(null, { status: 204 }); }
    try {
      return await db.transaction(async tx => {
        const privileged = token === context.serverSecretKey; await tx.exec("set local role " + (privileged ? "service_role" : "authenticated")); if (!privileged) { assert.ok(claims); await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims)]); }
        if (url.pathname === "/rest/v1/user_moderation" && request.method === "PATCH") { const result = await tx.query("update public.user_moderation set status=$2,must_change_password=$3 where user_id=$1 returning user_id,status,must_change_password", [url.searchParams.get("user_id").slice(3), data.status, data.must_change_password]); return Response.json(result.rows); }
        if (!url.pathname.startsWith("/rest/v1/rpc/") || request.method !== "POST") throw Error("TEST_ENDPOINT_REFUSED"); const name = url.pathname.split("/").at(-1), names = rpcSignatures[name]; assert.ok(names); assert.deepEqual(Object.keys(data ?? {}).sort(), names.slice().sort());
        const casts = names.map((key, index) => "$" + (index + 1) + "::" + (name === "capture_task_snapshot" && key === "p_operation" ? "text" : typeOfArg(key))), values = names.map(key => key === "p_intent" ? JSON.stringify(data[key]) : data[key]); const result = await tx.query("select public." + name + "(" + casts.join(",") + ") as value", values); return Response.json(result.rows[0].value);
      });
    } catch (error) { if (typeof error.code !== "string") throw error; return errorResponse(error.code, error.code === "23505" || error.code === "40001" ? 409 : error.code === "42501" ? 403 : 400); }
  }
  async function inspectSql(request) {
    assert.equal(request.sourceSha, sourceSha); assert.equal(request.namespace, namespace); assert.equal(request.systemIdentifier, systemIdentifier); assert.equal(request.actorId, A); assert.match(request.executionId, /^[a-f0-9-]{36}$/); assert.equal("sql" in request, false); assert.ok(request.signal instanceof AbortSignal); inspectHistory.push(request.query);
    let preserveSqlState = null;
    if (request.query === "ASSERT_LAST_MASTER") { try { await db.transaction(tx => tx.query("select app_private.admin_preserve_master($1::uuid)", [A])); } catch (error) { assert.equal(error.code, "23514"); preserveSqlState = error.code; } }
    const proof = {
      // Deliberately synthetic provenance. Only a future own native runner can
      // derive actual marker rows/system_identifier from a PG17 namespace.
      provenance: { namespace, sourceSha, systemIdentifier, database: "postgres", currentUser: "postgres", serverVersion: 170000, markerRows: [{ namespace, sourceSha, systemIdentifier }] },
      users: await rows("select id,email,raw_app_meta_data as app_metadata,banned_until,deleted_at,is_anonymous from auth.users order by id"),
      sessions: await rows("select id,user_id,not_after from auth.sessions order by user_id,id"), refreshTokens: await rows("select user_id,revoked from auth.refresh_tokens order by id"), roles: await rows("select user_id,role from public.user_roles order by user_id"), moderation: await rows("select user_id,status,must_change_password from public.user_moderation order by user_id"), entitlements: await rows("select user_id,feature_key,allowed from public.user_entitlements order by user_id,feature_key"),
      operations: (await rows("select to_jsonb(o) as row from app_private.admin_operations o order by created_at,ctid")).map(row => row.row), audit: await rows("select id,actor_user_id,target_user_id,operation_id,action,phase,occurred_at from public.admin_audit_events order by occurred_at,ctid"), receipts: (await rows("select to_jsonb(r) as row from app_private.command_receipts r order by created_at,command,client_id")).map(row => row.row), events: await rows("select id,user_id,entity_type,entity_id,action,canal,occurred_at,\"before\",\"after\" from public.domain_events order by occurred_at,ctid"), usableMasters: (await rows("select user_id from public.user_roles where app_private.admin_usable_master(user_id) order by user_id")).map(row => row.user_id), preserveSqlState, personalRows: 0,
    };
    if (controls.inspect) await controls.inspect(proof, request, db); return proof;
  }
  return { db, context, transport, inspectSql, history, inspectHistory, async close() { tokens.clear(); await db.close(); } };
}

test("original backend graph contains Core/ports/HMAC/official SDK without personal factory substitution", async () => {
  const result = await loadAdminNativeBackend(); assert.equal(result.modules.length, 54); assert.ok(result.modules.includes("src/adapters/db/admin-runtime.ts")); assert.ok(result.modules.includes("node_modules/server-only/empty.js")); assert.equal("adminServicesForRequest" in result.product, false); assert.equal(Object.keys(result.product).length, 9);
});

for (const kind of ADMIN_NATIVE_CASES) test("canonical SQL and original SDK/Core compose " + kind + " with its own exact cleanup", async () => {
  const f = await fixture(kind); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); const report = await acceptance.run(); assert.equal(report.code, "PASSED", JSON.stringify({ point: report.failurePoint, counts: report.counts, stages: report.stages })); assert.deepEqual(report.counts, ADMIN_NATIVE_PASS_COUNTS[kind]); assert.deepEqual(validateAdminNativeReport(report), report); assert.equal(report.provenance, "protocol-only"); assert.equal(acceptance.metadata().writeOutcomeUncertain, false);
    const cleanup = await acceptance.cleanupAuth(); assert.equal(cleanup.code, "PASSED", JSON.stringify({ point: cleanup.failurePoint, counts: cleanup.counts })); assert.deepEqual(cleanup.counts, ADMIN_NATIVE_CLEANUP_COUNTS[kind]); assert.deepEqual(validateAdminNativeCleanup(cleanup), cleanup); assert.equal(acceptance.metadata().authCleanupConfirmed, true); await assert.rejects(acceptance.run(), { message: "STATE_REFUSED" }); await assert.rejects(acceptance.cleanupAuth(), { message: "STATE_REFUSED" });
    assert.equal((await f.db.query("select count(*)::integer as n from auth.users")).rows[0].n, 0); assert.equal((await f.db.query("select count(*)::integer as n from app_private.command_receipts")).rows[0].n, 0); assert.equal((await f.db.query("select count(*)::integer as n from app_private.admin_operations")).rows[0].n, ADMIN_NATIVE_PASS_COUNTS[kind].operations); assert.equal((await f.db.query("select count(*)::integer as n from public.admin_audit_events")).rows[0].n, ADMIN_NATIVE_PASS_COUNTS[kind].auditEntries);
  } finally { acceptance?.dispose(); await f.close(); }
});

test("missing SQL authority or foreign runtime is refused before any transport call", async () => {
  const context = makeContext("BLOCK_OLD_JWT"); let calls = 0; const transport = async () => { calls++; throw Error("unexpected"); };
  await assert.rejects(createAdminNativeBackendAcceptance(context, { transport }), { message: "SETUP_REFUSED" }); context.runtime.supabaseUrl = "https://rishenjoikgmfubmnfiu.supabase.co"; await assert.rejects(createAdminNativeBackendAcceptance(context, { transport, inspectSql: async () => ({}) }), { message: "SETUP_REFUSED" }); assert.equal(calls, 0);
});

test("actual reservation ACK lost keeps the reservation and external unknown, denying cleanup", async () => {
  const f = await fixture("BLOCK_OLD_JWT"); let acceptance;
  try { let lost = false; const transport = async (url, request) => { const response = await f.transport(url, request); if (!lost && url.endsWith("/admin_reserve")) { lost = true; throw Error("synthetic-response-lost"); } return response; }; acceptance = await createAdminNativeBackendAcceptance(f.context, { transport, inspectSql: f.inspectSql }); const report = await acceptance.run(); assert.equal(report.status, "failed"); assert.equal(report.writeOutcomeUncertain, true); assert.equal(report.failurePoint, "FENCE"); const requests = f.history.length; const cleanup = await acceptance.cleanupAuth(); assert.equal(cleanup.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(f.history.length, requests); assert.equal(acceptance.metadata().authDeletionAllowed, false); assert.equal((await f.db.query("select phase from app_private.admin_operations")).rows[0].phase, "reserved");
  } finally { acceptance?.dispose(); await f.close(); }
});

test("actual transition ACK lost keeps unknown even when Core releases its reconciliation claim", async () => {
  const f = await fixture("BLOCK_OLD_JWT"); let acceptance;
  try {
    let lost = false; const transport = async (url, request) => { const response = await f.transport(url, request); if (!lost && url.endsWith("/admin_transition") && JSON.parse(request.body).p_phase === "auth_applied") { lost = true; throw Error("synthetic-response-lost"); } return response; };
    acceptance = await createAdminNativeBackendAcceptance(f.context, { transport, inspectSql: f.inspectSql }); const report = await acceptance.run();
    assert.equal(report.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(report.writeOutcomeUncertain, true); assert.equal(report.counts.authEffects, 1); assert.equal(report.terminalKnown, false);
    const operation = (await f.db.query("select phase,active_execution from app_private.admin_operations")).rows[0]; assert.equal(operation.phase, "needs_reconciliation"); assert.equal(operation.active_execution, null);
    assert.equal((await f.db.query("select count(*)::integer as n from app_private.command_receipts")).rows[0].n, 0); const before = f.history.length;
    assert.equal((await acceptance.cleanupAuth()).code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(f.history.length, before); assert.equal(acceptance.metadata().authDeletionAllowed, false); acceptance.dispose(); assert.equal(acceptance.metadata().writeOutcomeUncertain, true);
  } finally { acceptance?.dispose(); await f.close(); }
});

test("actual Auth ban ACK lost retains the claim and never treats its observed effect as confirmation", async () => {
  const f = await fixture("BLOCK_OLD_JWT"); let acceptance;
  try {
    const transport = async (url, request) => { const response = await f.transport(url, request); if (request.method === "PUT") throw Error("synthetic-response-lost"); return response; };
    acceptance = await createAdminNativeBackendAcceptance(f.context, { transport, inspectSql: f.inspectSql }); const report = await acceptance.run();
    assert.equal(report.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(report.counts.authMutationRequests, 1); assert.equal(report.counts.authEffects, 0); assert.equal(report.terminalKnown, false);
    const operation = (await f.db.query("select phase,active_execution from app_private.admin_operations")).rows[0]; assert.equal(operation.phase, "needs_reconciliation"); assert.ok(operation.active_execution);
    assert.equal((await f.db.query("select banned_until>now() as banned from auth.users where id=$1", [B])).rows[0].banned, true); const before = f.history.length;
    assert.equal((await acceptance.cleanupAuth()).code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(f.history.length, before); assert.equal(f.history.filter(row => row.method === "PUT").length, 1);
  } finally { acceptance?.dispose(); await f.close(); }
});

test("a deadline does not erase a still-owned mutation or authorize cleanup after its late response", async () => {
  const f = await fixture("BLOCK_OLD_JWT"); let acceptance, release; let entered;
  const started = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
  try {
    const transport = async (url, request) => { const response = await f.transport(url, request); if (url.endsWith("/admin_reserve")) { entered(); await blocked; } return response; };
    acceptance = await createAdminNativeBackendAcceptance(f.context, { transport, inspectSql: f.inspectSql, timeoutMs: 150 }); const running = acceptance.run(); await started; const report = await running, fixed = JSON.stringify(report);
    assert.equal(report.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(acceptance.metadata().pendingRequests, 1); assert.equal(acceptance.metadata().authDeletionAllowed, false);
    await assert.rejects(acceptance.cleanupAuth(), { message: "STATE_REFUSED" }); acceptance.dispose(); assert.equal(acceptance.metadata().pendingRequests, 1); release(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(acceptance.metadata().pendingRequests, 0); assert.equal(acceptance.metadata().writeOutcomeUncertain, true); assert.equal(JSON.stringify(report), fixed); assert.equal(f.history.some(row => row.method === "DELETE"), false);
  } finally { release(); acceptance?.dispose(); await f.close(); }
});

test("a read-only inspector remains owned after deadline until actual settlement, without promoting its late proof", async () => {
  const f = await fixture("BLOCK_OLD_JWT"); let acceptance, release; let entered;
  const started = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
  try {
    const inspectSql = async request => { const proof = await f.inspectSql(request); if (request.query === "BASELINE") { entered(); await blocked; } return proof; };
    acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql, timeoutMs: 150 }); const running = acceptance.run(); await started; const report = await running, fixed = JSON.stringify(report);
    assert.equal(report.code, "DEADLINE_EXCEEDED"); assert.equal(report.writeOutcomeUncertain, false); assert.equal(acceptance.metadata().pendingInspections, 1); await assert.rejects(acceptance.cleanupAuth(), { message: "STATE_REFUSED" });
    acceptance.dispose(); release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(acceptance.metadata().pendingInspections, 0); assert.equal(JSON.stringify(report), fixed); assert.equal(acceptance.metadata().pipelinePassed, false); assert.equal(f.history.some(row => row.method === "PUT"), false);
  } finally { release(); acceptance?.dispose(); await f.close(); }
});

test("bounded transport refuses an oversized Auth response before any write", async () => {
  const f = await fixture("BLOCK_OLD_JWT", { transport({ url }) { if (url.pathname === "/auth/v1/user") return new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "1048577" } }); } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); const report = await acceptance.run(); assert.equal(report.code, "RESPONSE_REFUSED"); assert.equal(report.counts.requests, 1); assert.equal(report.counts.authMutationRequests, 0); assert.equal(report.writeOutcomeUncertain, false); assert.equal((await acceptance.cleanupAuth()).code, "SAGA_NOT_TERMINAL"); }
  finally { acceptance?.dispose(); await f.close(); }
});

test("expired bound JWT hints are refused before the first SDK request", async () => {
  const context = makeContext("BLOCK_OLD_JWT"), expired = jwt(A, AS, -1); context.a.accessToken = expired.token; context.a.expiresAt = expired.expiresAt; let calls = 0, acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(context, { transport: async () => { calls++; throw Error("unexpected"); }, inspectSql: async () => { calls++; throw Error("unexpected"); } }); const report = await acceptance.run(); assert.equal(report.code, "TOKEN_LIFETIME_REFUSED"); assert.equal(report.counts.requests, 0); assert.equal(report.counts.sqlInspections, 0); assert.equal(calls, 0); }
  finally { acceptance?.dispose(); }
});

test("a foreign metadata row in the inspector cannot be hidden behind the two bound users", async () => {
  const f = await fixture("BLOCK_OLD_JWT", { inspect(proof, request) { if (request.query === "BASELINE") proof.roles.push({ user_id: "77000000-0000-4000-8000-000000000099", role: "user" }); } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); const report = await acceptance.run(); assert.equal(report.code, "OWNERSHIP_REFUSED"); assert.equal(report.failurePoint, "BASELINE"); assert.equal(report.counts.coreCommands, 0); assert.equal(f.history.some(row => row.method === "PUT"), false); }
  finally { acceptance?.dispose(); await f.close(); }
});

test("an extra field in the full SQL event diff cannot satisfy the exact final bijection", async () => {
  const f = await fixture("BLOCK_OLD_JWT", { inspect(proof, request) { if (request.query === "FINAL") { const event = proof.events.find(event => event.entity_type === "authentication" && event.after?.phase === "complete"); assert.ok(event); event.after.extra = "synthetic-extra"; } } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); const report = await acceptance.run(); assert.equal(report.code, "PERSISTENCE_NOT_PROVEN"); assert.equal(report.failurePoint, "SQL_FINAL"); assert.equal(report.terminalKnown, true); assert.equal(report.writeOutcomeUncertain, false); assert.equal(report.counts.events, 0); assert.equal(report.counts.receipts, 0); }
  finally { acceptance?.dispose(); await f.close(); }
});

test("marker mismatch in fixed SQL inspection refuses the fence before an Auth mutation", async () => {
  const f = await fixture("BLOCK_OLD_JWT", { inspect(proof, request) { if (request.query === "FENCE") proof.provenance.markerRows[0].systemIdentifier = "7250000000000000002"; } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); const report = await acceptance.run(); assert.equal(report.code, "SQL_REFUSED"); assert.equal(report.failurePoint, "FENCE"); assert.equal(f.history.some(row => row.method === "PUT"), false); assert.equal(acceptance.metadata().authDeletionAllowed, false); const cleanup = await acceptance.cleanupAuth(); assert.equal(cleanup.code, "SAGA_NOT_TERMINAL"); }
  finally { acceptance?.dispose(); await f.close(); }
});

test("terminal creation followed by a known replay-inspection failure cannot clean only A/B and omit C", async () => {
  const f = await fixture("CREATE_FORCED", { inspect(_proof, request) { if (request.query === "UNCHANGED") throw Error("synthetic-fixed-inspection-failure"); } }); let acceptance;
  try {
    acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); const report = await acceptance.run();
    assert.equal(report.code, "SQL_REFUSED"); assert.equal(report.failurePoint, "REPLAY"); assert.equal(report.terminalKnown, true); assert.equal(report.writeOutcomeUncertain, false); assert.equal(report.counts.authEffects, 2); assert.equal(report.counts.authLoginRequests, 0);
    const before = f.history.length; assert.equal(acceptance.metadata().authDeletionAllowed, false); const cleanup = await acceptance.cleanupAuth();
    assert.equal(cleanup.code, "CLEANUP_NOT_PROVEN"); assert.equal(cleanup.failurePoint, "PREREQUISITE"); assert.equal(cleanup.terminalKnown, true); assert.equal(cleanup.writeOutcomeUncertain, false); assert.deepEqual(validateAdminNativeCleanup(cleanup), cleanup); assert.ok(Object.values(cleanup.counts).every(value => value === 0)); assert.equal(f.history.length, before); assert.equal(f.history.some(row => row.method === "DELETE" || row.path === "/auth/v1/logout"), false);
    assert.equal((await f.db.query("select count(*)::integer as n from auth.users")).rows[0].n, 3); const op = (await f.db.query("select phase,active_execution from app_private.admin_operations")).rows[0]; assert.equal(op.phase, "complete"); assert.equal(op.active_execution, null); await assert.rejects(acceptance.cleanupAuth(), { message: "STATE_REFUSED" });
  } finally { acceptance?.dispose(); await f.close(); }
});

test("wrong HTTP logout ACK cannot be replaced by SDK success or namespace disposal", async () => {
  const f = await fixture("SELF_AND_LAST_MASTER", { transport({ url }) { if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 200 }); } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); assert.equal((await acceptance.run()).code, "PASSED"); const cleanup = await acceptance.cleanupAuth(); assert.equal(cleanup.status, "failed"); assert.equal(cleanup.failurePoint, "REVOKE"); assert.equal(cleanup.writeOutcomeUncertain, true); assert.equal(cleanup.counts.removedUsers, 0); assert.equal(f.history.some(row => row.method === "DELETE"), false); acceptance.dispose(); assert.equal(acceptance.metadata().writeOutcomeUncertain, true); }
  finally { acceptance?.dispose(); await f.close(); }
});

test("ACK of DELETE with a foreign user preserves unknown and never counts absence", async () => {
  const f = await fixture("SELF_AND_LAST_MASTER", { transport({ request }) { if (request.method === "DELETE") return Response.json({ user: { id: B, email: "admin-b@example.invalid", role: "authenticated", is_anonymous: false, app_metadata: { sc_admin_native_fixture: namespace } } }); } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); assert.equal((await acceptance.run()).code, "PASSED"); const cleanup = await acceptance.cleanupAuth(); assert.equal(cleanup.status, "failed"); assert.equal(cleanup.failurePoint, "DELETE_A"); assert.equal(cleanup.writeOutcomeUncertain, true); assert.equal(cleanup.counts.removedUsers, 0); assert.equal(cleanup.counts.absenceReads, 0); }
  finally { acceptance?.dispose(); await f.close(); }
});

test("HTTP204 logout without SQL revocation cannot authorize deletion or another cleanup attempt", async () => {
  const f = await fixture("SELF_AND_LAST_MASTER", { transport({ url }) { if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 }); } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); assert.equal((await acceptance.run()).code, "PASSED"); const cleanup = await acceptance.cleanupAuth(); assert.equal(cleanup.code, "CLEANUP_NOT_PROVEN"); assert.equal(cleanup.failurePoint, "REVOKE"); assert.equal(cleanup.writeOutcomeUncertain, false); assert.equal(cleanup.counts.deleteRequests, 0); assert.equal(acceptance.metadata().authDeletionAllowed, false); assert.equal((await f.db.query("select count(*)::integer as n from auth.sessions")).rows[0].n, 2); await assert.rejects(acceptance.cleanupAuth(), { message: "STATE_REFUSED" }); }
  finally { acceptance?.dispose(); await f.close(); }
});

test("a generic404 after the real DELETE is not the SDK's known user absence", async () => {
  let deleted = false;
  const f = await fixture("SELF_AND_LAST_MASTER", { transport({ url, request }) { if (request.method === "DELETE") deleted = true; if (deleted && request.method === "GET" && url.pathname.startsWith("/auth/v1/admin/users/")) return Response.json({ code: "synthetic_unavailable", message: "Synthetic unknown404." }, { status: 404, headers: { "X-Supabase-Api-Version": "2024-01-01" } }); } }); let acceptance;
  try { acceptance = await createAdminNativeBackendAcceptance(f.context, { transport: f.transport, inspectSql: f.inspectSql }); assert.equal((await acceptance.run()).code, "PASSED"); const cleanup = await acceptance.cleanupAuth(); assert.equal(cleanup.code, "CLEANUP_NOT_PROVEN"); assert.equal(cleanup.failurePoint, "ABSENT_A"); assert.equal(cleanup.counts.deleteRequests, 1); assert.equal(cleanup.counts.absenceReads, 1); assert.equal(cleanup.counts.removedUsers, 0); assert.equal(acceptance.metadata().authDeletionAllowed, false); assert.equal((await f.db.query("select count(*)::integer as n from auth.users")).rows[0].n, 1); }
  finally { acceptance?.dispose(); await f.close(); }
});
