import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CAPTURE_NATIVE_API, CAPTURE_NATIVE_APP, CAPTURE_NATIVE_MODULES, CAPTURE_NATIVE_STAGES,
  CAPTURE_NATIVE_CHECKS, CAPTURE_NATIVE_FAILURE_CODES, CAPTURE_NATIVE_COUNT_LIMITS, CAPTURE_NATIVE_PASS_COUNTS,
  createCaptureTaskNativeAcceptance, loadCaptureNativeCore, validateCaptureNativeInventory,
} from "../e2e-auth-local/capture-task-persistence-support.mjs";

// In-memory protocol doubles only. No service, user, SDK fixture, SQL or network.
const uuid = number => `47000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const A = uuid(1), B = uuid(2), SA = uuid(3), SB = uuid(4);
const pub = `sb_publishable_${"P".repeat(32)}`, secret = `sb_secret_${"S".repeat(32)}`;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const actor = (id, sessionId, expiresAt = Math.floor(Date.now() / 1000 + 600) * 1000) => ({
  id, sessionId, expiresAt,
  accessToken: `${encode({ alg: "HS256" })}.${encode({ sub: id, session_id: sessionId, role: "authenticated", exp: expiresAt / 1000 })}.${encode("synthetic-signature")}`,
});
const context = () => ({ runtime: { ci: true, githubActions: true, localAuthRun: true, appUrl: CAPTURE_NATIVE_APP, supabaseUrl: CAPTURE_NATIVE_API }, publishableKey: pub, serverSecretKey: secret, a: actor(A, SA), b: actor(B, SB) });
const copy = value => structuredClone(value);
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
const empty = () => ({ revision: "0", captures: [], tasks: [], categories: [], projects: [], events: [], receipts: [], readonlyCaptureIds: [], projects_visible: true });
const sortKeys = value => Array.isArray(value) ? value.map(sortKeys) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().reverse().map(key => [key, sortKeys(value[key])])) : value;

function harness(override) {
  const ctx = context(), state = empty(), requests = [], writes = [], replays = [];
  function apply(batch) {
    const saved = state.receipts.find(receipt => receipt.command === batch.receipt.command && receipt.client_id === batch.receipt.client_id);
    if (saved) {
      assert.equal(saved.fingerprint, batch.receipt.fingerprint);
      replays.push(copy(batch)); return json(sortKeys({ status: "replayed", result: saved.result }));
    }
    if (batch.expectedRevision !== state.revision) return json({ status: "stale" });
    assert.deepEqual(batch.context, { user_id: B, canal: "web" });
    assert.equal(batch.changes.length, batch.events.length);
    for (const change of batch.changes) {
      const rows = change.type === "capture" ? state.captures : state.tasks;
      const index = rows.findIndex(row => row.id === change.after.id);
      assert.deepEqual(index < 0 ? null : rows[index], change.before);
      const matching = batch.events.filter(event => event.entity_type === change.type && event.entity_id === change.after.id && JSON.stringify(sortKeys(event.before)) === JSON.stringify(sortKeys(change.before)) && JSON.stringify(sortKeys(event.after)) === JSON.stringify(sortKeys(change.after)));
      assert.equal(matching.length, 1); assert.equal(matching[0].canal, "web"); assert.equal(matching[0].user_id, B);
      if (index < 0) rows.push(copy(change.after)); else rows[index] = copy(change.after);
    }
    state.events.push(...copy(batch.events)); state.receipts.push(copy(batch.receipt));
    // Revision is deliberately opaque; the test does not simulate trigger counts.
    state.revision = String(BigInt(state.revision) + 11n);
    writes.push(copy(batch)); return json(sortKeys({ status: "committed", result: batch.receipt.result }));
  }
  const transport = async (url, init) => {
    const target = new URL(url);
    assert.equal(target.origin, CAPTURE_NATIVE_API); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.equal(init.signal instanceof AbortSignal, true);
    assert.equal(init.headers.Accept, "application/json");
    const isRpc = target.pathname.startsWith("/rest/v1/rpc/");
    const token = init.headers.Authorization.slice(7), owner = token === ctx.a.accessToken ? "a" : token === ctx.b.accessToken ? "b" : token === secret ? "server" : null;
    assert.notEqual(owner, null); assert.equal(init.headers.apikey, isRpc ? secret : pub); assert.equal(isRpc ? owner === "server" : owner !== "server", true);
    const op = { url, path: target.pathname, query: target.searchParams, method: init.method, body: init.body ? JSON.parse(init.body) : null, owner, ordinal: requests.length + 1 };
    requests.push(op);
    if (isRpc) {
      assert.equal(op.method, "POST"); assert.equal(target.search, ""); assert.equal(op.body.p_user, B); assert.equal(op.body.p_session, SB);
      assert.equal(init.headers["Content-Type"], "application/json");
    } else assert.equal(op.method, "GET");
    const custom = override && await override(op, init, state, ctx, apply);
    if (custom !== undefined) return custom;
    if (op.path === "/rest/v1/profiles") {
      assert.deepEqual([...op.query], [["select", "user_id,display_name"], ["limit", "2"]]);
      return json([{ user_id: owner === "a" ? A : B, display_name: null }]);
    }
    if (op.path === "/rest/v1/captures" || op.path === "/rest/v1/tasks") {
      assert.deepEqual([...op.query.keys()], ["select", "id", "user_id", "limit"]);
      assert.equal(op.query.get("select"), "id,user_id,payload"); assert.equal(op.query.get("user_id"), "eq." + B); assert.equal(op.query.get("limit"), "2");
      const rows = op.path.endsWith("captures") ? state.captures : state.tasks;
      const row = rows.find(row => "eq." + row.id === op.query.get("id")); assert.notEqual(row, undefined);
      return json(owner === "a" ? [] : [{ id: row.id, user_id: B, payload: sortKeys(row) }]);
    }
    if (op.path === "/rest/v1/rpc/capture_task_snapshot") return json(sortKeys(state));
    if (op.path === "/rest/v1/rpc/capture_task_revision") return json(state.revision);
    if (op.path === "/rest/v1/rpc/capture_task_receipt") return json(sortKeys(state.receipts.find(row => row.command === op.body.p_command && row.client_id === op.body.p_client_id) ?? null));
    assert.equal(op.path, "/rest/v1/rpc/capture_task_commit");
    assert.equal(op.body.p_operation, op.body.p_request.receipt.command);
    return apply(op.body.p_request);
  };
  return { ctx, state, requests, writes, replays, transport };
}
const probe = (h, timeoutMs) => createCaptureTaskNativeAcceptance(h.ctx, { transport: h.transport, ...(timeoutMs ? { timeoutMs } : {}) });
async function fails(h, code, point, uncertain = false, timeoutMs) {
  const subject = await probe(h, timeoutMs), report = await subject.run();
  assert.equal(report.status, "failed"); assert.equal(report.code, code); assert.equal(report.failurePoint, point); assert.equal(report.writeOutcomeUncertain, uncertain); assert.equal(Object.hasOwn(report, "nativeVerified"), false);
  assert.equal(subject.metadata().writeOutcomeUncertain, uncertain); assert.equal(report.stages.at(-1).passed, false); return { subject, report };
}

test("loads only the fixed actual Core/commands/store/gateway graph via official react-server condition", async () => {
  const loaded = await loadCaptureNativeCore();
  assert.deepEqual(loaded.modules, [...CAPTURE_NATIVE_MODULES].sort()); assert.equal(loaded.modules.length, 20); assert.equal(Object.keys(loaded.core).length, 8);
  assert.throws(() => validateCaptureNativeInventory([...loaded.modules, "src/adapters/db/capture-task-runtime.ts"]), /GRAPH_REFUSED/);
  assert.throws(() => validateCaptureNativeInventory(loaded.modules.filter(name => !name.endsWith("server-only/empty.js"))), /GRAPH_REFUSED/);
  assert.throws(() => validateCaptureNativeInventory([...loaded.modules, loaded.modules[0]]), /GRAPH_REFUSED/);
  const source = await readFile(new URL("../e2e-auth-local/capture-task-persistence-support.mjs", import.meta.url), "utf8");
  assert.equal(/process\s*\.\s*env|\bfetch\s*\(|node:child_process|console\s*\.|@supabase\/supabase-js/.test(source), false);
  assert.equal(source.includes('conditionNames: ["react-server", "node", "import", "default"]'), true);
  for (const value of [CAPTURE_NATIVE_CHECKS, CAPTURE_NATIVE_FAILURE_CODES, CAPTURE_NATIVE_COUNT_LIMITS, CAPTURE_NATIVE_PASS_COUNTS]) assert.equal(Object.isFrozen(value), true);
  assert.equal(CAPTURE_NATIVE_CHECKS.length, 12); assert.equal(CAPTURE_NATIVE_FAILURE_CODES.length, 14);
  assert.deepEqual(CAPTURE_NATIVE_PASS_COUNTS, { requests: 45, rpcRequests: 29, publicRequests: 16, coreCommands: 8, commitAttempts: 9, committedReplies: 7, replayedReplies: 2, events: 8, receipts: 7 });
  assert.deepEqual(CAPTURE_NATIVE_COUNT_LIMITS, { ...CAPTURE_NATIVE_PASS_COUNTS, requests: 64, rpcRequests: 64, publicRequests: 64 });
});

test("construction/import performs no RPC and refuses missing transport without default IO", async () => {
  const h = harness(), subject = await probe(h);
  assert.equal(h.requests.length, 0); assert.deepEqual(subject.metadata(), { state: "prepared", passed: false, writeOutcomeUncertain: false, moduleCount: 20 });
  await assert.rejects(() => createCaptureTaskNativeAcceptance(h.ctx, {}), /SETUP_REFUSED/);
  subject.dispose(); assert.equal(h.requests.length, 0); assert.equal(subject.metadata().state, "disposed");
});

test("real Core executes eight commands, seven commits/eight full events and both receipt-before-CAS replays", async () => {
  const h = harness(), subject = await probe(h), report = await subject.run();
  assert.equal(report.status, "passed"); assert.equal(report.code, "PASSED"); assert.equal(report.failurePoint, null); assert.equal(Object.hasOwn(report, "nativeVerified"), false);
  assert.deepEqual(report.stages, CAPTURE_NATIVE_STAGES.map(name => ({ name, passed: true }))); assert.equal(Object.values(report.checks).every(Boolean), true);
  assert.equal(report.counts.coreCommands, 8); assert.equal(report.counts.commitAttempts, 9); assert.equal(report.counts.committedReplies, 7); assert.equal(report.counts.replayedReplies, 2); assert.equal(report.counts.events, 8); assert.equal(report.counts.receipts, 7);
  assert.deepEqual(report.counts, { requests: 45, rpcRequests: 29, publicRequests: 16, coreCommands: 8, commitAttempts: 9, committedReplies: 7, replayedReplies: 2, events: 8, receipts: 7 });
  assert.equal(report.counts.requests, h.requests.length); assert.equal(report.counts.rpcRequests + report.counts.publicRequests, h.requests.length); assert.equal(report.counts.requests <= 64, true); assert.equal(report.writeOutcomeUncertain, false);
  assert.equal(h.writes.length, 7); assert.equal(h.replays.length, 2); assert.equal(h.state.captures.length, 1); assert.equal(h.state.tasks.length, 1);
  assert.deepEqual(h.writes.flatMap(batch => batch.events.map(event => [event.entity_type, event.action])), [["capture", "created"], ["capture", "updated"], ["task", "created"], ["capture", "status_changed"], ["task", "deleted"], ["task", "restored"], ["capture", "deleted"], ["capture", "restored"]]);
  assert.deepEqual(h.replays[0].changes, []); assert.deepEqual(h.replays[0].events, []); assert.deepEqual(h.replays[1], h.writes[2]); assert.notEqual(h.replays[1].expectedRevision, h.state.revision);
  assert.equal(new Set(h.writes.map(batch => batch.receipt.client_id)).size, 7);
  assert.equal(h.state.captures[0].converted_task_id, h.state.tasks[0].id); assert.equal(h.state.tasks[0].origin_capture_id, h.state.captures[0].id);
  assert.equal(h.state.captures[0].deleted_at, null); assert.equal(h.state.tasks[0].deleted_at, null);
  assert.equal(Object.isFrozen(report.counts), true); assert.equal(Object.isFrozen(report.stages[0]), true);
  for (const sensitive of [A, B, SA, SB, pub, secret, h.ctx.a.accessToken, h.ctx.b.accessToken, h.state.captures[0].id, h.state.tasks[0].id, "Synthetic short content", "Updated synthetic content", h.state.captures[0].created_at]) assert.equal(JSON.stringify(report).includes(sensitive), false);
  subject.dispose(); assert.equal(subject.metadata().passed, true); assert.equal(subject.metadata().state, "disposed");
});

test("PostgreSQL snapshot ordering and JSONB key order do not weaken full event/receipt bijection", async () => {
  const h = harness((op, init, state) => {
    if (op.path.endsWith("capture_task_snapshot")) {
      const value = sortKeys(state); value.events.sort((a, b) => a.id.localeCompare(b.id)); value.receipts.sort((a, b) => a.command.localeCompare(b.command));
      return json(value);
    }
  });
  const subject = await probe(h), report = await subject.run(); assert.equal(report.status, "passed"); assert.equal(report.counts.events, 8); assert.equal(report.counts.receipts, 7);
});

test("rejects runtime, key, actor, session and context authority before any transport", async () => {
  for (const mutate of [ctx => ctx.runtime.ci = false, ctx => ctx.runtime.githubActions = false, ctx => ctx.runtime.localAuthRun = false, ctx => ctx.runtime.supabaseUrl = "https://foreign.invalid", ctx => ctx.runtime.appUrl = "http://localhost:3117", ctx => ctx.runtime.extra = true, ctx => ctx.publishableKey = secret, ctx => ctx.serverSecretKey = pub, ctx => ctx.b = ctx.a, ctx => ctx.a.sessionId = SB, ctx => ctx.b.accessToken = ctx.a.accessToken, ctx => ctx.b.id = A, ctx => ctx.a.accessToken = "bad", ctx => ctx.a.accessToken += "=", ctx => ctx.a.id = { toString() { throw new Error("unsafe coercion"); } }, ctx => ctx.serverSecretKey = { toString() { throw new Error("unsafe coercion"); } }]) {
    const h = harness(); mutate(h.ctx); await assert.rejects(() => probe(h), /SETUP_REFUSED/); assert.equal(h.requests.length, 0);
  }
  for (const timeoutMs of [0, -1, 15001, 1.1, "15"]) { const h = harness(); await assert.rejects(() => createCaptureTaskNativeAcceptance(h.ctx, { transport: h.transport, timeoutMs }), /SETUP_REFUSED/); }
  const h = harness(); Object.defineProperty(h.ctx, "serverSecretKey", { enumerable: true, get() { throw new Error("unsafe getter"); } });
  await assert.rejects(() => probe(h), /SETUP_REFUSED/);
});

test("expired A/B and claims bindings cannot certify isolation on a revoked or expired actor", async () => {
  for (const key of ["a", "b"]) {
    const h = harness(); h.ctx[key] = actor(key === "a" ? A : B, key === "a" ? SA : SB, Math.floor(Date.now() / 1000 + 30) * 1000);
    await fails(h, "TOKEN_LIFETIME_REFUSED", "BASELINE"); assert.equal(h.requests.length, 0);
    const malformed = harness(); malformed.ctx[key].expiresAt += 1000; await assert.rejects(() => probe(malformed), /SETUP_REFUSED/);
  }
});

test("requires both own profile rows and empty actual own domain baseline", async () => {
  for (const ordinal of [1, 2]) {
    const h = harness(op => op.ordinal === ordinal ? json([]) : undefined); await fails(h, "OWNERSHIP_REFUSED", "BASELINE"); assert.equal(h.requests.length, ordinal);
  }
  const foreign = harness(op => op.path.endsWith("profiles") ? json([{ user_id: B, display_name: null }]) : undefined); await fails(foreign, "OWNERSHIP_REFUSED", "BASELINE");
  const nonempty = harness((op, init, state) => { if (op.path.endsWith("capture_task_snapshot")) { const altered = copy(state); altered.readonlyCaptureIds = [uuid(60)]; return json(altered); } });
  await fails(nonempty, "DOMAIN_REFUSED", "BASELINE"); assert.equal(nonempty.writes.length, 0);
});

test("public persistence needs positive exact owner payload before foreign-empty checks", async () => {
  const emptyOwn = harness(op => op.path === "/rest/v1/captures" && op.owner === "b" ? json([]) : undefined); await fails(emptyOwn, "OWNERSHIP_REFUSED", "CREATE"); assert.equal(emptyOwn.writes.length, 1);
  const wrongPayload = harness((op, init, state) => op.path === "/rest/v1/captures" && op.owner === "b" ? json([{ id: state.captures[0].id, user_id: B, payload: { ...state.captures[0], content: "SYNTHETIC_TAMPER" } }]) : undefined); await fails(wrongPayload, "SNAPSHOT_CHANGED", "CREATE");
  const foreign = harness((op, init, state) => op.path === "/rest/v1/captures" && op.owner === "a" ? json([{ id: state.captures[0].id, user_id: B, payload: state.captures[0] }]) : undefined); await fails(foreign, "OWNERSHIP_REFUSED", "CONVERT"); assert.equal(foreign.writes.length, 3);
});

test("full receipts and event bijection detect changed fingerprint, payload and metadata after acknowledged commit", async () => {
  for (const change of [snapshot => snapshot.receipts[0].fingerprint = "SYNTHETIC_TAMPER", snapshot => snapshot.receipts[0].result.content = "SYNTHETIC_TAMPER", snapshot => snapshot.events[0].canal = "api", snapshot => snapshot.events[0].after.content = "SYNTHETIC_TAMPER"]) {
    const h = harness((op, init, state) => { if (op.path.endsWith("capture_task_snapshot") && state.receipts.length) { const altered = copy(state); change(altered); return json(altered); } });
    await fails(h, "EVENT_NOT_PROVEN", "CREATE"); assert.equal(h.writes.length, 1);
  }
});

test("snapshot schema or ownership corruption fails closed through actual gateway and store", async () => {
  for (const [mutate, code] of [[value => value.captures[0].user_id = A, "DOMAIN_REFUSED"], [value => value.captures[0].extraPrivate = "SYNTHETIC_SECRET", "DOMAIN_REFUSED"], [value => value.captures.push(copy(value.captures[0])), "SNAPSHOT_CHANGED"], [value => value.revision = "invalid", "DOMAIN_REFUSED"]]) {
    const h = harness((op, init, state) => { if (op.path.endsWith("capture_task_snapshot") && state.captures.length) { const value = copy(state); mutate(value); return json(value); } });
    await fails(h, code, "CREATE"); assert.equal(h.writes.length, 1);
  }
});

test("structured SQL rollback refuses the command without retry or sticky transport uncertainty", async () => {
  for (const code of ["42501", "PT429", "23514", "23505"]) {
    const h = harness(op => op.path.endsWith("capture_task_commit") ? json({ code, message: "SYNTHETIC_PRIVATE_ERROR" }, code === "42501" ? 403 : 400) : undefined);
    const { report } = await fails(h, "DOMAIN_REFUSED", "CREATE"); assert.equal(report.counts.commitAttempts, 1); assert.equal(h.writes.length, 0); assert.equal(h.requests.filter(op => op.path.endsWith("capture_task_commit")).length, 1);
    assert.equal(JSON.stringify(report).includes("SYNTHETIC_PRIVATE_ERROR"), false);
  }
});

test("CAS stale with maxAttempts1 fails once without turning explicit replay into retry", async () => {
  const h = harness(op => op.path.endsWith("capture_task_commit") ? json({ status: "stale" }) : undefined);
  const { report } = await fails(h, "DOMAIN_REFUSED", "CREATE"); assert.equal(report.counts.commitAttempts, 1); assert.equal(h.writes.length, 0);
});

test("lost committed reply stays uncertain even actual Store reconciles via matching saved receipt", async () => {
  const h = harness((op, init, state, ctx, apply) => {
    if (op.path.endsWith("capture_task_commit")) { apply(op.body.p_request); throw new Error("SYNTHETIC_PRIVATE_ERROR"); }
  });
  const { subject, report } = await fails(h, "COMMIT_UNCONFIRMED", "CREATE", true);
  assert.equal(h.writes.length, 1); assert.equal(h.state.receipts.length, 1); assert.equal(h.requests.some(op => op.path.endsWith("capture_task_receipt")), true);
  assert.equal(report.counts.commitAttempts, 1); assert.equal(report.counts.committedReplies, 0); assert.equal(JSON.stringify(report).includes("SYNTHETIC_PRIVATE_ERROR"), false);
  const originalCounts = copy(report.counts);
  await assert.rejects(() => subject.run(), /STATE_REFUSED/); assert.equal(subject.metadata().writeOutcomeUncertain, true); assert.deepEqual(report.counts, originalCounts); assert.equal(h.writes.length, 1);
  subject.dispose(); assert.equal(subject.metadata().writeOutcomeUncertain, true);
});

test("malformed success and untrusted HTTP/SQL errors keep uncertain commit, not fabricated rollback", async () => {
  for (const response of [() => json({ status: "committed" }), () => json({ status: "committed", result: { private: true } }), () => json({ code: "XX000" }, 500), () => json({ code: "42501" }, 500), () => json({ code: "42703" }, 400)]) {
    const h = harness((op, init, state, ctx, apply) => { if (op.path.endsWith("capture_task_commit")) { apply(op.body.p_request); return response(); } });
    await fails(h, "COMMIT_UNCONFIRMED", "CREATE", true); assert.equal(h.writes.length, 1);
  }
});

test("both replay replies must remain replayed and preserve full snapshot/cardinality", async () => {
  let coreReplay;
  const h = harness(op => { if (op.path.endsWith("capture_task_commit") && op.body.p_operation === "capture.convert" && op.body.p_request.changes.length === 0) { coreReplay = op; return json({ status: "stale" }); } });
  await fails(h, "DOMAIN_REFUSED", "CORE_REPLAY"); assert.notEqual(coreReplay, undefined); assert.equal(h.writes.length, 3);
  let conversionCalls = 0;
  const noNativeReplay = harness(op => { if (op.path.endsWith("capture_task_commit") && op.body.p_operation === "capture.convert" && ++conversionCalls === 3) return json({ status: "stale" }); });
  await fails(noNativeReplay, "REPLAY_NOT_PROVEN", "RPC_REPLAY"); assert.equal(noNativeReplay.writes.length, 3);
});

test("receipt lookup must preserve observed original result/fingerprint in exact native RPC replay", async () => {
  const h = harness((op, init, state) => op.path.endsWith("capture_task_receipt") ? json({ ...state.receipts.find(row => row.command === "capture.convert"), fingerprint: "SYNTHETIC_TAMPER" }) : undefined);
  await fails(h, "REPLAY_NOT_PROVEN", "RPC_REPLAY"); assert.equal(h.writes.length, 3); assert.equal(h.replays.length, 2);
});

test("trash lifecycle needs persisted exact metadata and reciprocal links throughout", async () => {
  const h = harness((op, init, state) => { if (op.path.endsWith("capture_task_snapshot") && state.receipts.at(-1)?.command === "task.delete") { const value = copy(state); value.tasks[0].origin_capture_id = null; return json(value); } });
  await fails(h, "SNAPSHOT_CHANGED", "TASK_DELETE"); assert.equal(h.writes.length, 4);
  assert.equal(h.state.tasks[0].deleted_at !== null, true); assert.equal(h.state.captures[0].converted_task_id, h.state.tasks[0].id);
});

test("HTTP origin, redirects, content type/length, size and UTF8/JSON are finite before copying rows", async () => {
  for (const response of [
    () => ({ status: 200 }), () => { const value = json([]); Object.defineProperty(value, "redirected", { value: true }); return value; },
    () => { const value = json([]); Object.defineProperty(value, "url", { value: "http://foreign.invalid" }); return value; },
    () => new Response("[]", { headers: { "content-type": "text/plain" } }),
    () => json([], 200, { "content-length": "1048577" }), () => json([], 200, { "content-length": "-1" }),
    () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { "content-type": "application/json" } }),
    () => new Response("invalid", { headers: { "content-type": "application/json" } }),
    () => new Response(new Uint8Array(1048577), { headers: { "content-type": "application/json" } }),
  ]) { const h = harness(() => response()); await fails(h, "RESPONSE_REFUSED", "BASELINE"); assert.equal(h.requests.length, 1); }
});

test("deadline includes never-settling transport and body read, aborts without late acceptance", async () => {
  const transportNever = harness(() => new Promise(() => {}));
  await fails(transportNever, "DEADLINE_EXCEEDED", "BASELINE", false, 30); assert.equal(transportNever.requests.length, 1);
  let canceled = false;
  const bodyNever = harness(() => new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { canceled = true; } }), { headers: { "content-type": "application/json" } }));
  await fails(bodyNever, "DEADLINE_EXCEEDED", "BASELINE", false, 30); await Promise.resolve(); assert.equal(canceled, true);
});

test("lost commit body deadline is sticky even if receipt reconciles and body later finishes", async () => {
  let streamController, canceled = false;
  const h = harness((op, init, state, ctx, apply) => {
    if (op.path.endsWith("capture_task_commit")) {
      apply(op.body.p_request);
      return new Response(new ReadableStream({ start(controller) { streamController = controller; }, cancel() { canceled = true; } }), { headers: { "content-type": "application/json" } });
    }
  });
  const { subject } = await fails(h, "COMMIT_UNCONFIRMED", "CREATE", true, 30);
  assert.equal(h.writes.length, 1); assert.equal(canceled, true); assert.throws(() => streamController.enqueue(new TextEncoder().encode("{}")));
  assert.equal(subject.metadata().writeOutcomeUncertain, true);
});

test("late commit acknowledgement cannot clear original uncertainty or add an accepted write", async () => {
  let release;
  const h = harness((op, init, state, ctx, apply) => {
    if (op.path.endsWith("capture_task_commit")) {
      const response = apply(op.body.p_request); return new Promise(resolve => { release = () => resolve(response); });
    }
  });
  const { subject, report } = await fails(h, "COMMIT_UNCONFIRMED", "CREATE", true, 30);
  const counts = copy(report.counts); release(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(report.counts, counts); assert.equal(report.counts.committedReplies, 0); assert.equal(subject.metadata().writeOutcomeUncertain, true); assert.equal(h.writes.length, 1);
});

test("a running helper cannot be disposed or re-entered into another command flow", async () => {
  let release;
  const h = harness(op => op.ordinal === 1 ? new Promise(resolve => { release = resolve; }) : undefined);
  const subject = await probe(h), pending = subject.run(); await Promise.resolve();
  assert.throws(() => subject.dispose(), /STATE_REFUSED/);
  await assert.rejects(() => subject.run(), /STATE_REFUSED/); assert.equal(h.requests.length, 1);
  release(json([{ user_id: A, display_name: null }])); const report = await pending; assert.equal(report.status, "passed"); subject.dispose();
});
