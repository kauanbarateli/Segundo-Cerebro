import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { CAPTURE_NATIVE_API, CAPTURE_NATIVE_APP } from "../e2e-auth-local/capture-task-persistence-support.mjs";
import { CAPTURE_IMAGE_STAGES, CAPTURE_IMAGE_CHECKS, CAPTURE_IMAGE_MODULES, CAPTURE_IMAGE_PASS_COUNTS, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS, CAPTURE_IMAGE_LIMITS, createCaptureImageStorageAcceptance, loadCaptureImageProcessor } from "../e2e-auth-local/capture-image-storage-support.mjs";
import { validateCaptureImageStorageReport, validateCaptureImageCleanupReport, assembleCaptureImageStoragePacket, validateCaptureImageStoragePacket } from "../e2e-auth-local/capture-image-storage-contract.mjs";

// Canonical SQL is real and disposable. Auth/PostgREST HTTP and Storage object
// bytes/capabilities below are explicit in-memory doubles. No service, network,
// hosted account, Next factory, browser upload or native Storage PASS is claimed.
let db;
before(async () => { db = await createLocalCanonicalSql(); });
after(async () => { await db?.close(); });
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const actor = (id = randomUUID(), sessionId = randomUUID()) => {
  const expiresAt = Math.floor(Date.now() / 1000 + 900) * 1000;
  return { id, sessionId, expiresAt, accessToken: encode({ alg: "HS256" }) + "." + encode({ sub: id, session_id: sessionId, role: "authenticated", exp: expiresAt / 1000 }) + "." + encode("synthetic-signature") };
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const signatures = {
  file_upload_reserve: ["uuid", "uuid", "text", "text", "uuid", "text", "uuid", "bigint", "bigint", "timestamptz"],
  file_upload_claim: ["uuid", "uuid", "uuid", "uuid", "text"],
  file_upload_complete: ["uuid", "uuid", "uuid", "uuid", "text", "jsonb", "bigint"],
  file_upload_status: ["uuid", "uuid", "uuid"],
  capture_task_snapshot: ["uuid", "uuid", "text"], capture_task_revision: ["uuid", "uuid", "text"],
  capture_task_receipt: ["uuid", "uuid", "text", "text", "text"], capture_task_commit: ["uuid", "uuid", "text", "jsonb"],
};
const parameters = {
  file_upload_reserve: ["p_user", "p_session", "p_kind", "p_name", "p_folder", "p_client_id", "p_upload", "p_max_bytes", "p_quota", "p_expires"],
  file_upload_claim: ["p_user", "p_session", "p_upload", "p_lease", "p_client_id"],
  file_upload_complete: ["p_user", "p_session", "p_upload", "p_lease", "p_client_id", "p_file", "p_quota"],
  file_upload_status: ["p_user", "p_session", "p_upload"],
  capture_task_snapshot: ["p_user", "p_session", "p_operation"], capture_task_revision: ["p_user", "p_session", "p_operation"],
  capture_task_receipt: ["p_user", "p_session", "p_operation", "p_command", "p_client_id"], capture_task_commit: ["p_user", "p_session", "p_operation", "p_request"],
};
const columns = { profiles: ["user_id", "display_name"], drive_files: ["id", "user_id", "payload", "storage_path", "purged_at"], captures: ["id", "user_id", "payload"], capture_file_links: ["user_id", "capture_id", "file_id"], domain_events: ["id", "user_id", "entity_type", "entity_id", "action", "canal", "occurred_at"] };

async function harness(override, inspectOverride) {
  const ctx = { runtime: { ci: true, githubActions: true, localAuthRun: true, appUrl: CAPTURE_NATIVE_APP, supabaseUrl: CAPTURE_NATIVE_API }, publishableKey: "sb_publishable_" + "P".repeat(32), serverSecretKey: "sb_secret_" + "S".repeat(32), a: actor(), b: actor() };
  for (const owner of [ctx.a, ctx.b]) { await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [owner.id, owner.id + "@example.invalid"]); await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [owner.sessionId, owner.id]); }
  const objects = new Map(), tokens = new Map(), requests = [], writes = [], removals = [], acknowledgments = [];
  const beforeEvents = (await db.query("select to_jsonb(e) as row from public.domain_events e where user_id=$1 order by id", [ctx.b.id])).rows.map(value => value.row);
  const inspections = [];
  const inspectSql = async ids => {
    assert.deepEqual(Object.keys(ids).sort(), ["captureId", "ownerId", "uploadId"]); assert.equal(ids.ownerId, ctx.b.id); inspections.push(ids);
    const result = await db.transaction(async tx => {
      await tx.exec("set transaction read only; set local statement_timeout='15000ms'");
      return tx.query(`select jsonb_build_object(
        'file',(select jsonb_build_object('id',f.id,'user_id',f.user_id,'payload',f.payload,'storage_path',f.storage_path,'purged_at',f.purged_at) from public.drive_files f where user_id=$1 and id=$2),
        'capture',(select jsonb_build_object('id',c.id,'user_id',c.user_id,'payload',c.payload) from public.captures c where user_id=$1 and id=$3),
        'links',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from public.capture_file_links l where user_id=$1 and file_id=$2 and capture_id=$3),
        'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'entity_type',e.entity_type,'entity_id',e.entity_id,'action',e.action,'canal',e.canal,'occurred_at',e.occurred_at,'before',e.before,'after',e.after) order by e.id),'[]') from public.domain_events e where user_id=$1 and entity_id in($2,$3)),
        'receipts',(select coalesce(jsonb_agg(jsonb_build_object('user_id',r.user_id,'command',r.command,'client_id',r.client_id,'result',r.result) order by r.command),'[]') from app_private.command_receipts r where user_id=$1 and command in('capture.create','file.upload.finalize') and result->>'id' in($2::text,$3::text))
      ) as proof`, [ids.ownerId, ids.uploadId, ids.captureId]);
    });
    const proof = result.rows[0].proof; return inspectOverride ? await inspectOverride(proof, ids) : proof;
  };
  const transport = async (url, init) => {
    const target = new URL(url), headers = new Headers(init.headers);
    assert.equal(target.origin, CAPTURE_NATIVE_API); assert.equal(init.cache, "no-store"); assert.equal(init.redirect, "error"); assert.equal(init.credentials, "omit"); assert.equal(init.signal instanceof AbortSignal, true);
    const token = headers.get("authorization"), owner = token === "Bearer " + ctx.a.accessToken ? ctx.a : token === "Bearer " + ctx.b.accessToken ? ctx.b : token === "Bearer " + ctx.serverSecretKey ? "server" : null;
    const op = { path: target.pathname, method: init.method, query: target.searchParams, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body, owner, ordinal: requests.length + 1 };
    requests.push(op);
    const custom = override && await override(op, init, { ctx, objects, tokens, requests, writes, removals, acknowledgments }); if (custom !== undefined) return custom;
    if (target.pathname.startsWith("/rest/v1/rpc/")) {
      assert.equal(owner, "server"); assert.equal(headers.get("apikey"), ctx.serverSecretKey); assert.equal(init.method, "POST"); assert.equal(target.search, "");
      const name = target.pathname.slice("/rest/v1/rpc/".length), args = op.body;
      assert.equal(Object.hasOwn(signatures, name), true); assert.deepEqual(Object.keys(args).sort(), [...parameters[name]].sort()); assert.equal(args.p_user, ctx.b.id); assert.equal(args.p_session, ctx.b.sessionId);
      if (name.startsWith("capture_task_")) { assert.equal(["capture.create", "read.captures"].includes(args.p_operation), true); if (name === "capture_task_receipt") assert.equal(args.p_command, args.p_operation); }
      const values = parameters[name].map((key, index) => signatures[name][index] === "jsonb" ? JSON.stringify(args[key]) : args[key]);
      const sql = "select public." + name + "(" + signatures[name].map((type, index) => "$" + (index + 1) + "::" + type).join(",") + ") as data";
      try { const result = await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query(sql, values); }); if (["file_upload_complete", "capture_task_commit"].includes(name)) writes.push(op); return json(result.rows[0].data); }
      catch (error) { if (typeof error.code !== "string") throw error; return json({ code: error.code }, error.code === "42501" ? 403 : 400); }
    }
    if (target.pathname.startsWith("/rest/v1/")) {
      assert.equal(init.method, "GET"); assert.notEqual(owner, null); assert.notEqual(owner, "server"); assert.equal(headers.get("apikey"), ctx.publishableKey);
      const table = target.pathname.slice("/rest/v1/".length); assert.equal(Object.hasOwn(columns, table), true); assert.equal(target.searchParams.get("select"), columns[table].join(",")); assert.equal(target.searchParams.get("limit"), "2");
      const fields = [...target.searchParams].filter(([key]) => !["select", "limit"].includes(key)); assert.equal(fields.every(([key, value]) => columns[table].includes(key) && value.startsWith("eq.")), true);
      const sql = "select " + columns[table].map(column => '"' + column + '"').join(",") + " from public." + table + (fields.length ? " where " + fields.map(([key], index) => '"' + key + '"=$' + (index + 1)).join(" and ") : "") + " limit 2";
      try { const result = await db.transaction(async tx => { await tx.exec("set local role authenticated"); await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [owner.id, JSON.stringify({ sub: owner.id, session_id: owner.sessionId, role: "authenticated" })]); return tx.query(sql, fields.map(([, value]) => value.slice(3))); }); return json(result.rows); }
      catch (error) { if (typeof error.code !== "string") throw error; return json({ code: error.code }, error.code === "42501" ? 403 : 400); }
    }
    const prefix = "/storage/v1/object/", rest = target.pathname.slice(prefix.length); assert.equal(target.pathname.startsWith(prefix), true);
    if (rest.startsWith("upload/sign/")) {
      const object = rest.slice("upload/sign/".length);
      if (init.method === "POST") { assert.equal(owner, "server"); assert.deepEqual(op.body, {}); const capability = encode({ key: object, fixture: randomUUID() }); tokens.set(capability, object); return json({ url: "/object/upload/sign/" + object + "?token=" + capability }); }
      assert.equal(init.method, "PUT"); assert.equal(owner, null); assert.equal(headers.has("apikey"), false); assert.equal(headers.has("authorization"), false); assert.equal(tokens.get(target.searchParams.get("token")), object); assert.equal(headers.get("x-upsert"), "false");
      assert.equal(op.body instanceof FormData, true); assert.deepEqual([...op.body.keys()], ["cacheControl", ""]); const blob = op.body.get(""); assert.equal(blob.type, "image/png"); assert.equal(objects.has(object), false); objects.set(object, { id: randomUUID(), bytes: new Uint8Array(await blob.arrayBuffer()), contentType: blob.type }); acknowledgments.push(object); return json({ Key: object });
    }
    assert.equal(owner, "server"); assert.equal(headers.get("apikey"), ctx.serverSecretKey);
    if (init.method === "POST") { assert.equal(objects.has(rest), false); assert.equal(op.body instanceof Uint8Array, true); assert.equal(headers.get("x-upsert"), "false"); const id = randomUUID(); objects.set(rest, { id, bytes: op.body.slice(), contentType: headers.get("content-type") }); acknowledgments.push(rest); return json({ Id: id, Key: rest }); }
    if (init.method === "DELETE") { assert.equal(target.search, ""); assert.deepEqual(Object.keys(op.body), ["prefixes"]); assert.equal(op.body.prefixes.length, 1); const key = rest + "/" + op.body.prefixes[0], object = objects.get(key); objects.delete(key); removals.push(key); return json(object ? [{ id: object.id, name: op.body.prefixes[0], bucket_id: rest }] : []); }
    assert.equal(init.method, "GET"); const object = objects.get(rest); return object ? new Response(object.bytes.slice(), { headers: { "content-type": object.contentType, "content-length": String(object.bytes.length) } }) : json({ statusCode: "404", code: "NoSuchKey", error: "NoSuchKey", message: "SYNTHETIC_OBJECT_ABSENT" }, 404);
  };
  return { ctx, objects, tokens, requests, writes, removals, acknowledgments, transport, inspectSql, inspections, beforeEvents };
}
const probe = async (h, timeoutMs, observeResponse) => {
  const subject = await createCaptureImageStorageAcceptance(h.ctx, { transport: h.transport, inspectSql: h.inspectSql, ...(timeoutMs ? { timeoutMs } : {}), ...(observeResponse === undefined ? {} : { observeResponse }) });
  return Object.freeze({ ...subject, async run() { return validateCaptureImageStorageReport(await subject.run()); }, async cleanupObjects() { return validateCaptureImageCleanupReport(await subject.cleanupObjects()); } });
};

test("fixed processor graph uses official Sharp and source EXIF is removed by original processing", async () => {
  const { processor, modules } = await loadCaptureImageProcessor(); assert.deepEqual(modules, [...CAPTURE_IMAGE_MODULES].sort()); assert.equal(modules.length, 9);
  const source = await processor.sharp({ create: { width: 60, height: 40, channels: 3, background: "#843d50" } }).jpeg().withExif({ IFD0: { ImageDescription: "SC_CAPTURE_IMAGE_STORAGE_FIXTURE" } }).withMetadata({ orientation: 6 }).toBuffer();
  const before = await processor.sharp(source).metadata(); assert.equal(before.orientation, 6); assert.equal(before.exif.includes(Buffer.from("SC_CAPTURE_IMAGE_STORAGE_FIXTURE")), true);
  const prepared = await processor.prepararArquivo("capture_image", "declared.png", source, processor.readFilePolicy({})); const after = await processor.sharp(prepared.bytes).metadata(); assert.equal(after.exif, undefined); assert.equal(after.orientation, undefined); assert.equal(after.width, 40); assert.equal(after.height, 60); assert.equal(prepared.mime, "image/jpeg");
});
test("construction is IO-free and refuses missing transport or nonlocal namespace", async () => {
  const h = await harness(), subject = await probe(h); assert.equal(h.requests.length, 0); assert.equal(subject.metadata().authDeletionAllowed, false); assert.equal(subject.metadata().moduleCount, 27);
  await assert.rejects(() => createCaptureImageStorageAcceptance(h.ctx, {}), /SETUP_REFUSED/);
  await assert.rejects(() => createCaptureImageStorageAcceptance(h.ctx, { transport: h.transport }), /SETUP_REFUSED/);
  const bad = structuredClone(h.ctx); bad.runtime.supabaseUrl = "https://rishenjoikgmfubmnfiu.supabase.co"; await assert.rejects(() => createCaptureImageStorageAcceptance(bad, { transport: h.transport, inspectSql: h.inspectSql }), /SETUP_REFUSED/); subject.dispose();
});
test("canonical SQL + original Core/processor + SDK HTTP doubles prove bytes, EXIF, attachment and exact cleanup", async () => {
  const h = await harness(), subject = await probe(h), report = await subject.run(); assert.equal(report.status, "passed", JSON.stringify(report)); assert.equal(report.code, "PASSED"); assert.deepEqual(report.counts, CAPTURE_IMAGE_PASS_COUNTS); assert.deepEqual(report.stages, CAPTURE_IMAGE_STAGES.map(name => ({ name, passed: true }))); assert.equal(Object.keys(report.checks).length, CAPTURE_IMAGE_CHECKS.length); assert.equal(Object.values(report.checks).every(Boolean), true);
  assert.equal(report.writeOutcomeUncertain, false); assert.equal(Object.hasOwn(report, "nativeVerified"), false); assert.equal(subject.metadata().authDeletionAllowed, false); assert.equal(h.objects.size, 2); assert.equal(report.counts.requests, h.requests.length); assert.equal(h.writes.length, 2);
  const rows = (await db.query("select f.payload as file,c.payload as capture from public.drive_files f join public.capture_file_links l on l.user_id=f.user_id and l.file_id=f.id join public.captures c on c.id=l.capture_id and c.user_id=l.user_id where f.user_id=$1", [h.ctx.b.id])).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].file.bytes, report.measurements.finalBytes); assert.equal(rows[0].capture.attachments[0].id, rows[0].file.id); assert.equal(rows[0].capture.attachments[0].bytes, rows[0].file.bytes);
  const events = (await db.query("select entity_type,action,canal,before,after from public.domain_events where user_id=$1 and entity_id in($2,$3) order by occurred_at,id", [h.ctx.b.id, rows[0].file.id, rows[0].capture.id])).rows; assert.deepEqual(events.map(row => [row.entity_type, row.action, row.canal, row.before]), [["drive_file", "created", "web", null], ["capture", "created", "web", null]]); assert.deepEqual(events[0].after, rows[0].file); assert.deepEqual(events[1].after, rows[0].capture);
  const conservedEvents = (await db.query("select to_jsonb(e) as row from public.domain_events e where user_id=$1 and entity_id not in($2,$3) order by id", [h.ctx.b.id, rows[0].file.id, rows[0].capture.id])).rows.map(value => value.row); assert.deepEqual(conservedEvents, h.beforeEvents); assert.equal(h.inspections.length, 1);
  const receipts = (await db.query("select command,result from app_private.command_receipts where user_id=$1 order by command", [h.ctx.b.id])).rows; assert.deepEqual(receipts.map(row => row.command), ["capture.create", "file.upload.finalize"]); assert.deepEqual(receipts[0].result, rows[0].capture); assert.deepEqual(receipts[1].result, rows[0].file);
  const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.status, "passed"); assert.deepEqual(cleanup.counts, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS); assert.equal(cleanup.authDeletionAllowed, true); assert.equal(subject.metadata().authDeletionAllowed, true); assert.equal(h.objects.size, 0); assert.deepEqual(h.removals.sort(), h.acknowledgments.sort()); assert.equal(h.requests.length, report.counts.requests + cleanup.counts.requests);
  const packet = assembleCaptureImageStoragePacket({ pipeline: report, cleanup, writeOutcomeUncertain: false }); assert.equal(validateCaptureImageStoragePacket(packet).status, "passed"); assert.equal(packet.authDeletionAllowed, true); assert.equal(Object.hasOwn(packet, "nativeVerified"), false);
  await assert.rejects(() => subject.run(), /STATE_REFUSED/); await assert.rejects(() => subject.cleanupObjects(), /STATE_REFUSED/); subject.dispose(); assert.equal(subject.metadata().authDeletionAllowed, false);
});
test("a signed capability for a foreign path is refused before any PUT", async () => {
  const h = await harness(op => op.path.includes("/upload/sign/") && op.method === "POST" ? json({ url: "/object/upload/sign/second-brain-staging/foreign/path?token=synthetic-capability" }) : undefined), subject = await probe(h), report = await subject.run(); assert.equal(report.status, "failed"); assert.equal(report.code, "TRANSPORT_REFUSED"); assert.equal(report.failurePoint, "SIGNED_PUT"); assert.equal(report.writeOutcomeUncertain, false); assert.equal(h.requests.some(op => op.method === "PUT"), false); assert.equal(subject.metadata().authDeletionAllowed, false);
});
test("a malformed successful PUT keeps write uncertainty sticky and forbids all cleanup", async () => {
  const h = await harness(op => op.method === "PUT" ? json({ Key: "wrong/object" }) : undefined), subject = await probe(h), report = await subject.run(); assert.equal(report.code, "RESPONSE_REFUSED"); assert.equal(report.writeOutcomeUncertain, true); const count = h.requests.length, cleanup = await subject.cleanupObjects(); assert.equal(cleanup.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(cleanup.writeOutcomeUncertain, true); assert.equal(cleanup.authDeletionAllowed, false); assert.equal(h.requests.length, count); subject.dispose(); assert.equal(subject.metadata().writeOutcomeUncertain, true);
});
test("a genuine SQL rollback in reserve has no uncertain write and only exact absent-object cleanup", async () => {
  const h = await harness(op => op.path.endsWith("file_upload_reserve") ? json({ code: "23514" }, 400) : undefined), subject = await probe(h), report = await subject.run(); assert.equal(report.code, "SQL_REFUSED"); assert.equal(report.writeOutcomeUncertain, false); const reserve = h.requests.find(op => op.path.endsWith("file_upload_reserve")); const preflight = h.requests.filter(op => op.ordinal < reserve.ordinal && op.path.startsWith("/storage/v1/object/") && op.method === "GET"); assert.equal(preflight.length, 2);
  const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.status, "passed"); assert.equal(cleanup.counts.removedObjects, 0); assert.equal(cleanup.authDeletionAllowed, true); assert.equal(h.removals.length, 2); assert.deepEqual(h.removals.sort(), preflight.map(op => op.path.slice("/storage/v1/object/".length)).sort());
});
test("final independent bytes are checked rather than trusting final upload ACK or SQL metadata", async () => {
  const h = await harness(async (op, _init, state) => { if (op.method === "GET" && op.path.startsWith("/storage/v1/object/second-brain-files/") && state.objects.has(op.path.slice("/storage/v1/object/".length))) { const object = state.objects.get(op.path.slice("/storage/v1/object/".length)); const source = [...state.objects].find(([key]) => key.startsWith("second-brain-staging/"))[1]; assert.notEqual(object.bytes.length, source.bytes.length); return new Response(source.bytes.slice(), { headers: { "content-type": "image/jpeg" } }); } }), subject = await probe(h), report = await subject.run(); assert.equal(report.code, "MEDIA_NOT_PROVEN"); assert.equal(report.failurePoint, "DOWNLOAD"); assert.equal(report.writeOutcomeUncertain, false); assert.equal(h.requests.some(op => op.path.endsWith("capture_task_commit")), false);
});
test("missing object status400 with body code404 cannot certify cleanup or Auth deletion", async () => {
  const h = await harness((op, _init, state) => op.method === "GET" && op.path.startsWith("/storage/v1/object/") && state.removals.length > 0 ? json({ statusCode: "404", error: "NotFound", message: "synthetic-body-only" }, 400) : undefined), subject = await probe(h); assert.equal((await subject.run()).status, "passed"); const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.status, "failed"); assert.equal(cleanup.code, "CLEANUP_NOT_PROVEN"); assert.equal(cleanup.failurePoint, "STAGING_ABSENT"); assert.equal(subject.metadata().authDeletionAllowed, false); assert.equal(cleanup.counts.removeRequests, 1);
});
test("DELETE ACK containing an extra object is refused and leaves a sticky cleanup latch", async () => {
  const h = await harness(op => op.method === "DELETE" ? json([{ id: randomUUID(), name: op.body.prefixes[0] }, { id: randomUUID(), name: "unrelated/object" }]) : undefined), subject = await probe(h); assert.equal((await subject.run()).status, "passed"); const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.code, "CLEANUP_NOT_PROVEN"); assert.equal(cleanup.writeOutcomeUncertain, true); assert.equal(cleanup.authDeletionAllowed, false); assert.equal(h.requests.filter(op => op.method === "DELETE").length, 1);
});
test("stream deadline after PUT remains sticky and late completion cannot enable cleanup", async () => {
  let release; const delayed = new Promise(resolve => { release = resolve; });
  const h = await harness(async op => { if (op.method === "PUT") { await delayed; return json({ Key: op.path.slice("/storage/v1/object/upload/sign/".length) }); } }), subject = await probe(h, 100), running = subject.run();
  const report = await running; assert.equal(report.code, "DEADLINE_EXCEEDED"); assert.equal(report.failurePoint, "SIGNED_PUT"); assert.equal(report.writeOutcomeUncertain, true); const count = h.requests.length; release(); await new Promise(resolve => setTimeout(resolve, 1)); const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(h.requests.length, count); assert.equal(subject.metadata().authDeletionAllowed, false);
});
test("binary response exceeding finite body budget is refused without publishing", async () => {
  const h = await harness((op, _init, state) => op.method === "GET" && op.path.startsWith("/storage/v1/object/second-brain-staging/") && state.objects.has(op.path.slice("/storage/v1/object/".length)) && state.removals.length === 0 ? new Response(new Uint8Array(CAPTURE_IMAGE_LIMITS.responseBytes + 1), { headers: { "content-type": "image/jpeg" } }) : undefined), subject = await probe(h), report = await subject.run(); assert.equal(report.code, "RESPONSE_REFUSED"); assert.equal(report.failurePoint, "MEASURE"); assert.equal(report.writeOutcomeUncertain, false); assert.equal(h.requests.some(op => op.method === "POST" && op.path.startsWith("/storage/v1/object/second-brain-files/")), false);
  const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.status, "passed"); assert.equal(cleanup.counts.removedObjects, 1); assert.equal(cleanup.authDeletionAllowed, true);
});
test("dispose and run reentry refuse further transport without altering the original uncertainty", async () => {
  const h = await harness(), subject = await probe(h); subject.dispose(); await assert.rejects(() => subject.run(), /STATE_REFUSED/); await assert.rejects(() => subject.cleanupObjects(), /STATE_REFUSED/); assert.equal(h.requests.length, 0); assert.equal(subject.metadata().authDeletionAllowed, false);
});
test("SQL inspection rejects a foreign attachment, extra event and missing receipt after all HTTP ACKs", async t => {
  for (const kind of ["foreign-link", "extra-event", "missing-receipt"]) await t.test(kind, async () => {
    const h = await harness(undefined, proof => { if (kind === "foreign-link") proof.links[0].user_id = randomUUID(); else if (kind === "extra-event") proof.events.push(structuredClone(proof.events[0])); else proof.receipts.pop(); return proof; }), subject = await probe(h), report = await subject.run();
    assert.equal(report.status, "failed"); assert.equal(report.code, "PERSISTENCE_NOT_PROVEN"); assert.equal(report.failurePoint, "SQL_FINAL"); assert.equal(report.writeOutcomeUncertain, false); assert.equal(report.counts.events, 0); assert.equal(report.counts.receipts, 0); assert.equal(subject.metadata().authDeletionAllowed, false); assert.equal(h.writes.length, 2);
  });
});
test("real SQL commit followed by lost transport can reconcile its receipt but never clears the unknown latch", async () => {
  const h = await harness(async (op, _init, state) => {
    if (!op.path.endsWith("capture_task_commit")) return undefined;
    const args = op.body; await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query("select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb)", [args.p_user, args.p_session, args.p_operation, JSON.stringify(args.p_request)]); }); state.writes.push(op); throw new Error("SYNTHETIC_LOST_ACK_AFTER_REAL_SQL_COMMIT");
  }), subject = await probe(h), report = await subject.run();
  assert.equal(report.status, "failed"); assert.equal(report.failurePoint, "CAPTURE"); assert.equal(report.writeOutcomeUncertain, true); assert.equal(h.requests.filter(op => op.path.endsWith("capture_task_receipt")).length, 1);
  const captureReceipts = (await db.query("select result from app_private.command_receipts where user_id=$1 and command='capture.create'", [h.ctx.b.id])).rows; assert.equal(captureReceipts.length, 1); assert.equal(captureReceipts[0].result.attachments.length, 1);
  const count = h.requests.length, cleanup = await subject.cleanupObjects(); assert.equal(cleanup.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(h.requests.length, count); assert.equal(subject.metadata().writeOutcomeUncertain, true); assert.equal(subject.metadata().authDeletionAllowed, false);
});
test("short JWT lifetime refuses the first request and invalid claim binding refuses construction", async () => {
  const h = await harness(), exp = Math.floor(Date.now() / 1000 + 30) * 1000; h.ctx.b.expiresAt = exp; h.ctx.b.accessToken = encode({ alg: "HS256" }) + "." + encode({ sub: h.ctx.b.id, session_id: h.ctx.b.sessionId, role: "authenticated", exp: exp / 1000 }) + "." + encode("synthetic-signature");
  const subject = await probe(h), report = await subject.run(); assert.equal(report.code, "TOKEN_LIFETIME_REFUSED"); assert.equal(report.counts.requests, 0); assert.equal(h.requests.length, 0); assert.equal(report.writeOutcomeUncertain, false);
  h.ctx.b.id = randomUUID(); await assert.rejects(() => probe(h), /SETUP_REFUSED/); assert.equal(h.requests.length, 0);
});
test("malformed reservation ACK and DELETE transport loss cannot grant cleanup authority", async t => {
  await t.test("reservation", async () => { const h = await harness(op => op.path.endsWith("file_upload_reserve") ? json(null) : undefined), subject = await probe(h), report = await subject.run(); assert.equal(report.code, "OWNERSHIP_REFUSED"); assert.equal(report.writeOutcomeUncertain, true); const count = h.requests.length; assert.equal((await subject.cleanupObjects()).code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(h.requests.length, count); });
  await t.test("delete", async () => { const h = await harness((op, _init, state) => { if (op.method !== "DELETE") return undefined; state.objects.delete(op.path.slice("/storage/v1/object/".length) + "/" + op.body.prefixes[0]); throw new Error("SYNTHETIC_LOST_DELETE_ACK"); }), subject = await probe(h); assert.equal((await subject.run()).status, "passed"); const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.writeOutcomeUncertain, true); assert.equal(cleanup.authDeletionAllowed, false); assert.equal(cleanup.counts.absenceReads, 0); assert.equal(h.objects.size, 1); });
});
test("preexisting path is refused before reservation and preserved without any DELETE", async () => {
  const h = await harness((op, _init, state) => { if (op.method !== "GET" || !op.path.startsWith("/storage/v1/object/second-brain-staging/")) return undefined; const key = op.path.slice("/storage/v1/object/".length); state.objects.set(key, { id: randomUUID(), bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" }); return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }); }), subject = await probe(h), report = await subject.run();
  assert.equal(report.status, "failed"); assert.equal(report.code, "OWNERSHIP_REFUSED"); assert.equal(report.failurePoint, "BASELINE"); assert.equal(report.writeOutcomeUncertain, false); assert.equal(h.requests.some(op => op.path.endsWith("file_upload_reserve")), false); const before = h.requests.length; const cleanup = await subject.cleanupObjects(); assert.equal(cleanup.code, "CLEANUP_NOT_PROVEN"); assert.equal(cleanup.failurePoint, "PREREQUISITE"); assert.equal(cleanup.authDeletionAllowed, false); assert.equal(h.requests.length, before); assert.equal(h.objects.size, 1); assert.equal(h.removals.length, 0);
});
test("ambiguous 404 route/bucket error cannot prove fresh paths or enable cleanup", async () => {
  const h = await harness(op => op.method === "GET" && op.path.startsWith("/storage/v1/object/") ? json({ statusCode: "404", code: "NoSuchBucket", message: "SYNTHETIC_BUCKET_UNAVAILABLE" }, 404) : undefined), subject = await probe(h), report = await subject.run();
  assert.equal(report.code, "RESPONSE_REFUSED"); assert.equal(report.failurePoint, "BASELINE"); assert.equal(report.writeOutcomeUncertain, false); assert.equal(h.requests.some(op => op.method !== "GET" && !op.path.endsWith("capture_task_snapshot")), false); assert.equal((await subject.cleanupObjects()).authDeletionAllowed, false); assert.equal(h.removals.length, 0);
});

test("optional observation has one frozen baseline projection and preserves complete reports, counts and cleanup even when its sink throws", async () => {
  const results = [];
  for (const mode of ["absent", "present", "throws"]) {
    const observed = []; let readers = 0, clones = 0;
    const h = await harness(op => {
      if (op.ordinal !== 4 || op.method !== "GET" || !op.path.startsWith("/storage/v1/object/second-brain-staging/")) return undefined;
      const response = json({ statusCode: "404", code: "NoSuchKey", error: "NoSuchKey", message: "SYNTHETIC_OBJECT_ABSENT" }, 404), getReader = response.body.getReader.bind(response.body);
      response.body.getReader = (...args) => { readers++; return getReader(...args); };
      response.clone = () => { clones++; throw new Error("SYNTHETIC_SECOND_READER_FORBIDDEN"); };
      return response;
    });
    const sink = mode === "absent" ? undefined : row => { observed.push(row); if (mode === "throws") throw new Error("SYNTHETIC_SINK_SECRET"); };
    const subject = await probe(h, undefined, sink); assert.equal(observed.length, 0); assert.equal(h.requests.length, 0);
    const pipeline = await subject.run(), cleanup = await subject.cleanupObjects();
    assert.equal(pipeline.status, "passed"); assert.equal(cleanup.status, "passed"); assert.deepEqual(pipeline.counts, CAPTURE_IMAGE_PASS_COUNTS); assert.deepEqual(cleanup.counts, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS);
    assert.equal(h.requests.length, 31); assert.equal(h.inspections.length, 1); assert.equal(h.writes.length, 2); assert.equal(h.removals.length, 2); assert.equal(h.objects.size, 0); assert.equal(readers, 1); assert.equal(clones, 0);
    assert.equal(observed.length, mode === "absent" ? 0 : 1);
    if (observed.length) { assert.equal(Object.isFrozen(observed[0]), true); assert.equal(Object.keys(observed[0]).length, 14); assert.equal(observed[0].httpStatus, 404); assert.equal(observed[0].bodyCodeKind, "NO_SUCH_KEY"); assert.equal(observed[0].decodeKind, "JSON_OBJECT"); assert.equal(observed[0].operation, "FRESH_STAGING_GET"); assert.equal(JSON.stringify(observed).includes("SYNTHETIC"), false); }
    results.push({ pipeline, cleanup, metadata: subject.metadata() }); subject.dispose();
  }
  assert.deepEqual(results[1], results[0]); assert.deepEqual(results[2], results[0]);
});
test("observing body404 in a native status400 cannot certify baseline or authorize any cleanup", async () => {
  const results = [];
  for (const mode of ["absent", "present", "throws"]) {
    const observed = [], h = await harness(op => op.method === "GET" && op.path.startsWith("/storage/v1/object/") ? json({ statusCode: "404", code: "NoSuchKey", error: "NotFound", message: "SYNTHETIC_BODY_ONLY" }, 400) : undefined);
    const subject = await probe(h, undefined, mode === "absent" ? undefined : row => { observed.push(row); if (mode === "throws") throw new Error("SYNTHETIC_SINK_SECRET"); });
    const pipeline = await subject.run(), before = h.requests.length, cleanup = await subject.cleanupObjects();
    assert.equal(pipeline.code, "OWNERSHIP_REFUSED"); assert.equal(pipeline.failurePoint, "BASELINE"); assert.equal(pipeline.writeOutcomeUncertain, false); assert.equal(pipeline.counts.requests, 4); assert.equal(pipeline.counts.storageRequests, 1);
    assert.equal(cleanup.code, "CLEANUP_NOT_PROVEN"); assert.equal(cleanup.authDeletionAllowed, false); assert.equal(cleanup.failurePoint, "PREREQUISITE"); assert.equal(h.requests.length, before); assert.equal(h.writes.length, 0); assert.equal(h.removals.length, 0);
    assert.equal(observed.length, mode === "absent" ? 0 : 1);
    if (observed.length) { assert.equal(observed[0].httpStatus, 400); assert.equal(observed[0].bodyStatusKind, "STRING_404"); assert.equal(observed[0].bodyCodeKind, "NO_SUCH_KEY"); assert.equal(observed[0].bodyErrorKind, "NOT_FOUND"); }
    results.push({ pipeline, cleanup, metadata: subject.metadata() }); subject.dispose();
  }
  assert.deepEqual(results[1], results[0]); assert.deepEqual(results[2], results[0]);
});
test("an explicitly present invalid support sink refuses before any transport", async () => {
  const h = await harness();
  for (const observeResponse of [undefined, null, false, {}, "SYNTHETIC_NOT_FUNCTION"]) await assert.rejects(() => createCaptureImageStorageAcceptance(h.ctx, { transport: h.transport, inspectSql: h.inspectSql, observeResponse }), /SETUP_REFUSED/);
  assert.equal(h.requests.length, 0); assert.equal(h.inspections.length, 0);
});
