import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { avatarInspectionInput } from "../../scripts/verification/avatar-storage-local-ci.mjs";
import { acceptsAvatarStorageAbsence, createAvatarRequestGate, validateAvatarSetup, createAvatarStorageCase, AVATAR_API } from "../e2e-auth-local/avatar-storage-local-case.mjs";
import { AVATAR_STAGES, AVATAR_PASS_COUNTS, AVATAR_LIMITATIONS, validateAvatarStorageReport } from "../e2e-auth-local/avatar-storage-contract.mjs";

const context = () => ({ ci: true, githubActions: true, localAuthRun: true, localAvatarRun: true, supabaseUrl: AVATAR_API, sourceSha: "a".repeat(40), namespace: "sc-avatar-native-" + "a".repeat(32), systemIdentifier: "123456789", publishableKey: "sb_publishable_" + "P".repeat(32), serverSecretKey: "sb_secret_" + "S".repeat(32) });
const slot = () => ({ category: "storageRequests", url: AVATAR_API + "/storage/v1/object/sign/second-brain-files/fixture", method: "GET", capability: true, write: false });
const passed = () => ({ schemaVersion: 1, scenario: "avatar-storage-local-case", status: "passed", code: "PASSED", failurePoint: null, stages: Object.fromEntries(AVATAR_STAGES.map(key => [key, true])), counts: { ...AVATAR_PASS_COUNTS }, measurements: { sourceBytes: 20000, finalBytes: 5000, sourceWidth: 800, sourceHeight: 600, finalWidth: 512, finalHeight: 512 }, writeOutcomeUncertain: false, pendingRequests: 0, pendingInspections: 0, deadlineRefused: false, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])) });

test("avatar closed PASS requires unlink, object/Auth cleanup, final SQL and own counts", () => {
  const checked = validateAvatarStorageReport(passed()); assert.ok(Object.isFrozen(checked.counts));
  for (const mutate of [report => { report.stages.PROFILE_REMOVE = false; }, report => { report.stages.OBJECT_CLEANUP = false; }, report => { report.stages.AUTH_CLEANUP = false; }, report => { report.stages.FINAL_SQL = false; }, report => { report.counts.authRequests--; }, report => { report.writeOutcomeUncertain = true; }, report => { report.pendingInspections = 1; }, report => { report.deadlineRefused = true; }, report => { report.limitations.hostedSupabase = true; }, report => { report.measurements.finalWidth = 160; }]) { const value = passed(); mutate(value); assert.throws(() => validateAvatarStorageReport(value), /AVATAR_REPORT_REFUSED/); }
});
test("avatar report rejects extra/canary/getter fields without serializing them", () => {
  const extra = { ...passed(), providerBody: "CANARY_PRIVATE_PROVIDER_BODY" }; assert.throws(() => validateAvatarStorageReport(extra), /AVATAR_REPORT_REFUSED/);
  const getter = passed(); let reads = 0; Object.defineProperty(getter.counts, "authRequests", { enumerable: true, get() { reads++; return 16; } }); assert.throws(() => validateAvatarStorageReport(getter), /AVATAR_REPORT_REFUSED/); assert.equal(reads, 0);
});
test("avatar setup refuses remote, missing opt-in and missing ownership ports", () => {
  const ports = { transport: fetch, registerActors() {}, async inspect() { return {}; }, cleanupAllowed: () => true };
  validateAvatarSetup(context(), ports);
  for (const value of [{ ...context(), supabaseUrl: "https://example.invalid" }, { ...context(), localAvatarRun: false }, { ...context(), sourceSha: "not-a-sha" }]) assert.throws(() => validateAvatarSetup(value, ports), /SETUP_REFUSED/);
  assert.throws(() => validateAvatarSetup(context(), { ...ports, registerActors: undefined }), /SETUP_REFUSED/);
});
test("capability rejects apikey, bearer, cookie and unplanned endpoint before IO", async () => {
  for (const headers of [{ apikey: "private" }, { Authorization: "Bearer private" }, { Cookie: "private" }]) {
    let requests = 0; const gate = createAvatarRequestGate(context(), async () => { requests++; return new Response("ok"); });
    await assert.rejects(gate.request(slot(), () => gate.fetch(slot().url, { headers })), /TRANSPORT_REFUSED/); assert.equal(requests, 0); assert.equal(gate.metadata().counts.storageRequests, 0);
  }
  let requests = 0; const gate = createAvatarRequestGate(context(), async () => { requests++; return new Response(); });
  await assert.rejects(gate.request(slot(), () => gate.fetch("https://example.invalid/private")), /TRANSPORT_REFUSED/); assert.equal(requests, 0);
});
test("response original URL is checked before reading its body", async () => {
  let reads = 0; const response = new Response("bounded"); Object.defineProperty(response, "url", { value: "https://example.invalid/foreign" }); response.arrayBuffer = async () => { reads++; return new ArrayBuffer(0); };
  const gate = createAvatarRequestGate(context(), async () => response);
  await assert.rejects(gate.request(slot(), () => gate.fetch(slot().url)), /RESPONSE_REFUSED/); assert.equal(reads, 0);
});
test("storage absence requires SQL emptiness and exact missing-object HTTP/body", () => {
  const body = { statusCode: "404", code: "NoSuchKey", error: "not_found", message: "Object not found" };
  assert.equal(acceptsAvatarStorageAbsence(400, body, true), true); assert.equal(acceptsAvatarStorageAbsence(404, body, true), true);
  for (const [status, value, empty] of [[400, body, false], [200, body, true], [500, body, true], [400, { ...body, code: "NoSuchBucket" }, true], [400, { ...body, statusCode: 404 }, true], [400, { ...body, error: "forbidden" }, true], [400, { ...body, providerBody: "CANARY_PRIVATE" }, true]]) assert.equal(acceptsAvatarStorageAbsence(status, value, empty), false);
  let reads = 0; const getter = { ...body }; Object.defineProperty(getter, "code", { enumerable: true, get() { reads++; return "NoSuchKey"; } }); assert.equal(acceptsAvatarStorageAbsence(400, getter, true), false); assert.equal(reads, 0);
});
test("official SDK sees intact rehydrated bytes and hard-delete observed HTTP200", async () => {
  const key = context().serverSecretKey;
  const gate = createAvatarRequestGate(context(), async (_url, init) => { assert.deepEqual(JSON.parse(init.body), { should_soft_delete: false }); return new Response("{}", { status: 200, headers: { "content-type": "application/json" } }); });
  const admin = createClient(AVATAR_API, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: gate.fetch } });
  const request = { category: "authRequests", method: "DELETE", url: AVATAR_API + "/auth/v1/admin/users/10000000-0000-4000-8000-000000000001", key, bearer: key, write: true, body: { should_soft_delete: false } };
  const reply = await gate.request(request, () => admin.auth.admin.deleteUser("10000000-0000-4000-8000-000000000001", false));
  assert.deepEqual(reply, { data: { user: {} }, error: null }); assert.equal(request.observedStatus, 200); assert.equal(gate.metadata().unknown, false);
});
test("deadline retains owned IO until actual settlement and remains sticky", async () => {
  let resolveFetch; const gate = createAvatarRequestGate(context(), () => new Promise(resolve => { resolveFetch = resolve; }), { ioMs: 10, caseMs: 1000 });
  await assert.rejects(gate.request(slot(), () => gate.fetch(slot().url)), /DEADLINE_EXCEEDED/);
  assert.equal(gate.metadata().pending, 1); assert.equal(gate.metadata().unknown, true); assert.equal(gate.metadata().deadlineRefused, true);
  resolveFetch(new Response("ok")); assert.equal(await gate.settle(), true); assert.equal(gate.metadata().pending, 0); assert.equal(gate.metadata().unknown, true);
  await assert.rejects(gate.request(slot(), () => gate.fetch(slot().url)), /WRITE_OUTCOME_UNCERTAIN/);
});
test("unknown mutating response keeps cleanup authority revoked even after IO ends", async () => {
  const key = context().serverSecretKey;
  const gate = createAvatarRequestGate(context(), async () => new Response("CANARY_PROVIDER", { status: 500 }));
  const request = { category: "rpcRequests", method: "POST", url: AVATAR_API + "/rest/v1/rpc/file_upload_complete", key, bearer: key, write: true, body: {} };
  await assert.rejects(gate.request(request, () => gate.fetch(request.url, { method: "POST", body: "{}", headers: { apikey: key, Authorization: "Bearer " + key } })), /RESPONSE_REFUSED/);
  assert.equal(gate.metadata().pending, 0); assert.equal(gate.metadata().unknown, true);
});
test("known SQL rollback remains a refusal without claiming an uncertain mutation", async () => {
  const key = context().serverSecretKey;
  const gate = createAvatarRequestGate(context(), async () => new Response(JSON.stringify({ code: "23514" }), { status: 400 }));
  const request = { category: "rpcRequests", method: "POST", url: AVATAR_API + "/rest/v1/rpc/file_avatar_set", key, bearer: key, write: true, body: {} };
  const response = await gate.request(request, () => gate.fetch(request.url, { method: "POST", body: "{}", headers: { apikey: key, Authorization: "Bearer " + key } }));
  assert.equal(response.status, 400); assert.equal(gate.metadata().unknown, false);
});
test("failed first fixture has no invented SQL/object/Auth cleanup and no provider canary", async () => {
  let sql = 0; const subject = await createAvatarStorageCase(context(), { transport: async () => { throw new Error("CANARY_PRIVATE_PROVIDER_BODY"); }, registerActors() { sql++; }, async inspect() { sql++; return {}; }, cleanupAllowed: () => true });
  const report = await subject.run(); assert.equal(report.status, "failed"); assert.equal(report.failurePoint, "FIXTURES"); assert.equal(report.writeOutcomeUncertain, true); assert.equal(report.counts.fixtureDeleted, 0); assert.equal(report.counts.objectsRemoved, 0); assert.equal(sql, 0); assert.equal(JSON.stringify(report).includes("CANARY"), false); assert.equal(await subject.settle(), true); subject.dispose();
});

async function portableAvatarProtocol(removeResponse) {
  // This is PG18, synthetic Auth grants and a RAM object store. It has no
  // native/hosted/Next/browser provenance, regardless of the case result.
  const db = await createLocalCanonicalSql(), users = new Map(), tokens = new Map(), objects = new Map();
  let binding, subject; const inspections = [];
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "x-supabase-api-version": "2024-01-01" } });
  const userDto = row => ({ id: row.id, email: row.email, role: "authenticated", is_anonymous: false, app_metadata: row.app_metadata });
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const parameters = {
    settings_snapshot: ["p_user", "p_session"], file_upload_reserve: ["p_user", "p_session", "p_kind", "p_name", "p_folder", "p_client_id", "p_upload", "p_max_bytes", "p_quota", "p_expires"],
    file_upload_claim: ["p_user", "p_session", "p_upload", "p_lease", "p_client_id"], file_upload_complete: ["p_user", "p_session", "p_upload", "p_lease", "p_client_id", "p_file", "p_quota"],
    file_read_metadata: ["p_user", "p_session", "p_file"], file_avatar_set: ["p_user", "p_session", "p_file", "p_client_id"],
  };
  const signatures = { settings_snapshot: ["uuid", "uuid"], file_upload_reserve: ["uuid", "uuid", "text", "text", "uuid", "text", "uuid", "bigint", "bigint", "timestamptz"], file_upload_claim: ["uuid", "uuid", "uuid", "uuid", "text"], file_upload_complete: ["uuid", "uuid", "uuid", "uuid", "text", "jsonb", "bigint"], file_read_metadata: ["uuid", "uuid", "uuid"], file_avatar_set: ["uuid", "uuid", "uuid", "text"] };
  const transport = async (raw, init) => {
    const url = new URL(raw), method = init.method, headers = new Headers(init.headers), path = url.pathname;
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    const token = headers.get("authorization")?.slice(7), session = tokens.get(token);
    if (path === "/auth/v1/admin/users" && method === "POST") {
      users.set(body.id, body); await db.query("insert into auth.users(id,aud,role,email,raw_app_meta_data) values($1,'authenticated','authenticated',$2,$3::jsonb)", [body.id, body.email, JSON.stringify(body.app_metadata)]); return json(userDto(body));
    }
    if (path === "/auth/v1/token") {
      const owner = [...users.values()].find(row => row.email === body.email && row.password === body.password); assert.ok(owner);
      const sid = randomUUID(), exp = Math.floor(Date.now() / 1000) + 900, jwt = encode({ alg: "HS256" }) + "." + encode({ sub: owner.id, role: "authenticated", session_id: sid, exp }) + "." + encode("synthetic-signature");
      tokens.set(jwt, { owner, sid }); await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [sid, owner.id]); return json({ access_token: jwt, refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 900, expires_at: exp, user: userDto(owner) });
    }
    if (path === "/auth/v1/user") { assert.ok(session); return json(userDto(session.owner)); }
    if (path === "/auth/v1/logout") { assert.ok(session); await db.query("delete from auth.sessions where user_id=$1", [session.owner.id]); return new Response(null, { status: 204 }); }
    if (path.startsWith("/auth/v1/admin/users/")) {
      const id = path.split("/").at(-1); if (method === "DELETE") { assert.equal(body.should_soft_delete, false); await db.query("delete from auth.users where id=$1", [id]); users.delete(id); return json({}); }
      return users.has(id) ? json(userDto(users.get(id))) : json({ code: "user_not_found", message: "Synthetic user absent" }, 404);
    }
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").at(-1);
      try {
        const result = await db.transaction(async tx => {
          await tx.exec("set local role " + (name === "my_access_state" ? "authenticated" : "service_role"));
          if (name === "my_access_state") { assert.ok(session); await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: session.owner.id, session_id: session.sid, role: "authenticated" })]); return tx.query("select public.my_access_state() as result"); }
          assert.ok(parameters[name]); assert.deepEqual(Object.keys(body).sort(), [...parameters[name]].sort());
          return tx.query("select public." + name + "(" + signatures[name].map((type, index) => "$" + (index + 1) + "::" + type).join(",") + ") as result", parameters[name].map(key => key === "p_file" && typeof body[key] === "object" && body[key] !== null ? JSON.stringify(body[key]) : body[key]));
        }); return json(result.rows[0].result);
      } catch (error) { return json({ code: error.code, message: "Synthetic canonical refusal" }, 400); }
    }
    if (path === "/rest/v1/drive_files") {
      assert.ok(session); const result = await db.transaction(async tx => { await tx.exec("set local role authenticated"); await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: session.owner.id, session_id: session.sid, role: "authenticated" })]); return tx.query("select id,user_id,payload,storage_path,purged_at from public.drive_files where id=$1 and user_id=$2", [url.searchParams.get("id").slice(3), url.searchParams.get("user_id").slice(3)]); }); return json(result.rows);
    }
    const match = path.match(/^\/storage\/v1\/object\/(?:upload\/sign\/|sign\/)?(second-brain-(?:staging|files))(?:\/(.+))?$/); assert.ok(match);
    const bucket = match[1], objectPath = match[2], key = bucket + "/" + objectPath;
    if (path.includes("upload/sign") && method === "POST") return json({ url: "/object/upload/sign/" + key + "?token=synthetic-capability" });
    if (path.includes("/sign/") && method === "POST") return json({ signedURL: "/object/sign/" + key + "?token=synthetic-capability" });
    if (method === "PUT" || method === "POST") {
      const bytes = init.body instanceof FormData ? new Uint8Array(await init.body.get("").arrayBuffer()) : new Uint8Array(init.body);
      const id = randomUUID(); objects.set(key, { id, bytes }); await db.query("insert into storage.objects(id,bucket_id,name,owner) values($1,$2,$3,$4)", [id, bucket, objectPath, objectPath.split("/")[0]]); return json({ Id: id, Key: key });
    }
    if (method === "DELETE") {
      const removed = []; for (const objectPath of body.prefixes) { const key = bucket + "/" + objectPath, item = objects.get(key); if (item) { removed.push({ id: item.id, name: objectPath, bucket_id: bucket }); await db.query("delete from storage.objects where id=$1", [item.id]); item.bytes.fill(0); objects.delete(key); } }
      if (removeResponse?.status === 204) return new Response(null, { status: 204 });
      return json(removeResponse?.body ?? removed, removeResponse?.status ?? 200);
    }
    const stored = objects.get(key); return stored ? new Response(stored.bytes, { headers: { "content-type": "image/jpeg" } }) : json({ statusCode: "404", code: "NoSuchKey", error: "not_found", message: "Synthetic object absent" }, 400);
  };
  try {
    subject = await createAvatarStorageCase(context(), { transport, registerActors(value) { binding = value; }, cleanupAllowed: () => true, async inspect(name, request) {
      inspections.push(name);
      const input = avatarInspectionInput(context(), binding, request.uploadId), values = new Map([...input.matchAll(/^\\set (\w+) '([a-f0-9-]+)'$/gm)].map(match => [match[1], match[2]]));
      const sql = input.replace(/^\\set[^\n]+\n/gm, "").replace(/:'(\w+)'/g, (_, name) => "'" + values.get(name) + "'");
      const results = await db.exec(sql), proof = results.find(result => result.rows?.length)?.rows[0].jsonb_build_object;
      // Native provenance is deliberately absent: this projection is PG18.
      assert.ok(proof.instance.serverVersion >= 180000); return proof;
    } });
    const report = await subject.run();
    if (removeResponse) {
      assert.equal(report.status, "failed"); assert.equal(report.failurePoint, "OBJECT_CLEANUP"); assert.equal(report.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(report.writeOutcomeUncertain, true);
      assert.equal(report.counts.storageRequests, 9); assert.equal(report.counts.fixtureDeleted, 0); assert.equal(report.counts.objectsRemoved, 0); assert.equal(report.counts.authRequests, 8);
      assert.deepEqual(inspections, ["BASELINE", "FINALIZED", "LINKED", "UNLINKED"]); assert.equal(report.stages.AUTH_CLEANUP, false); assert.equal(report.stages.FINAL_SQL, false); assert.equal(objects.size, 1);
      assert.equal((await db.query("select count(*)::int as count from auth.users")).rows[0].count, 2); assert.equal(JSON.stringify(report).includes("CANARY"), false);
    } else { assert.equal(report.status, "passed", report.failurePoint + ":" + report.code); assert.deepEqual(report.counts, AVATAR_PASS_COUNTS); assert.equal(objects.size, 0); assert.equal((await db.query("select count(*)::int as count from auth.users")).rows[0].count, 0); }
    assert.equal(report.limitations.hostedSupabase, false); assert.equal(await subject.settle(), true); assert.equal(subject.metadata().unknown, Boolean(removeResponse));
  } finally { if (subject?.metadata().pending === 0) subject.dispose(); for (const object of objects.values()) object.bytes.fill(0); users.clear(); tokens.clear(); await db.close(); }
}
test("finite Avatar protocol composes actual SQL/processor with explicit SDK/Auth/Storage doubles", () => portableAvatarProtocol());
for (const [name, response] of [["HTTP201 owned array", { status: 201 }], ["HTTP204", { status: 204 }], ["HTTP200 malformed array", { status: 200, body: { providerBody: "CANARY_PRIVATE_PROVIDER" } }]]) test("Storage DELETE " + name + " latches uncertainty before absence/next DELETE/Auth cleanup", () => portableAvatarProtocol(response));
