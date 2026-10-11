import { createHash, randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import { loadCaptureImageProcessor } from "./capture-image-storage-support.mjs";
import { acceptsAdminNativeDeleteAcknowledgement } from "./admin-native-backend-case.mjs";
import { AVATAR_STAGES, AVATAR_CODES, AVATAR_LIMITS, AVATAR_LIMITATIONS, AVATAR_PASS_COUNTS, validateAvatarStorageReport } from "./avatar-storage-contract.mjs";

export const AVATAR_API = "http://127.0.0.1:54321";
export const AVATAR_BUCKETS = Object.freeze(["second-brain-staging", "second-brain-files"]);
export const AVATAR_SQL_QUERIES = Object.freeze(["BASELINE", "FINALIZED", "LINKED", "UNLINKED", "STAGING_ABSENT", "FINAL_ABSENT", "AUTH_ABSENT"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const rollbackCodes = new Set(["42501", "23514", "22023", "23503", "23505", "40001", "40P01", "22P02", "PT429"]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const stable = value => JSON.stringify(value, (_, child) => child && typeof child === "object" && !Array.isArray(child) ? Object.fromEntries(Object.keys(child).sort().map(key => [key, child[key]])) : child);
const same = (a, b) => stable(a) === stable(b);
class AvatarFailure extends Error { constructor(code) { super(AVATAR_CODES.includes(code) ? code : "CASE_FAILED"); this.name = "AvatarFailure"; this.stack = this.name + ": " + this.message; } }
const fail = code => { throw new AvatarFailure(code); };
const plain = value => value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
const ownsUser = (value, actor) => plain(value) && value.id === actor.id && value.email === actor.email && value.role === "authenticated" && value.is_anonymous === false && plain(value.app_metadata) && value.app_metadata.sc_avatar_ci_marker === actor.marker;

/** HTTP absence is evidence only after an owned catalogue query proved empty. */
export function acceptsAvatarStorageAbsence(httpStatus, body, catalogueEmpty) {
  if (catalogueEmpty !== true || ![400, 404].includes(httpStatus) || !plain(body)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(body), expected = ["statusCode", "code", "error", "message"];
  if (Reflect.ownKeys(descriptors).length !== expected.length || expected.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], "value"))) return false;
  const value = Object.fromEntries(expected.map(key => [key, descriptors[key].value]));
  return value.statusCode === "404" && value.code === "NoSuchKey" && value.error === "not_found" && typeof value.message === "string" && value.message.length > 0 && value.message.length <= 256;
}

export function validateAvatarSetup(context, ports) {
  if (!plain(context) || context.ci !== true || context.githubActions !== true || context.localAuthRun !== true || context.localAvatarRun !== true || context.supabaseUrl !== AVATAR_API || !/^[a-f0-9]{40}$/.test(context.sourceSha) || !/^sc-avatar-native-[a-f0-9]{32}$/.test(context.namespace) || !/^[0-9]{1,32}$/.test(context.systemIdentifier) || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(context.publishableKey) || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(context.serverSecretKey) || !plain(ports) || ["transport", "registerActors", "inspect", "cleanupAllowed"].some(key => typeof ports[key] !== "function")) fail("SETUP_REFUSED");
}

/** Dedicated finite gate; a test transport is never evidence of native IO. */
export function createAvatarRequestGate(context, transport, { now = () => performance.now(), ioMs = AVATAR_LIMITS.ioMs, caseMs = AVATAR_LIMITS.caseMs } = {}) {
  if (context?.supabaseUrl !== AVATAR_API || typeof transport !== "function" || typeof now !== "function" || !Number.isSafeInteger(ioMs) || ioMs < 1 || ioMs > AVATAR_LIMITS.ioMs || !Number.isSafeInteger(caseMs) || caseMs < 1 || caseMs > AVATAR_LIMITS.caseMs) fail("SETUP_REFUSED");
  const deadline = now() + caseMs, pending = new Set(), counts = { authRequests: 0, rpcRequests: 0, publicRequests: 0, storageRequests: 0 };
  let permit = null, unknown = false, deadlineRefused = false, closed = false;
  const active = () => { if (closed || unknown || deadlineRefused) fail("WRITE_OUTCOME_UNCERTAIN"); if (now() >= deadline) { deadlineRefused = unknown = true; fail("DEADLINE_EXCEEDED"); } };
  const request = async (spec, operation) => {
    active();
    if (permit || pending.size || typeof operation !== "function" || !plain(spec) || !Object.hasOwn(counts, spec.category) || typeof spec.write !== "boolean") fail("SETUP_REFUSED");
    const url = new URL(spec.url);
    if (url.origin !== AVATAR_API || url.username || url.password || url.hash) fail("SETUP_REFUSED");
    permit = spec;
    try { const value = await operation(); if (permit) fail("TRANSPORT_REFUSED"); active(); return value; }
    catch (error) { if (spec.write && !(error instanceof AvatarFailure)) unknown = true; throw error instanceof AvatarFailure ? error : new AvatarFailure("CASE_FAILED"); }
    finally { permit = null; }
  };
  const finiteFetch = async (input, init = {}) => {
    active();
    const spec = permit;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    const headers = new Headers(init.headers), method = (init.method ?? "GET").toUpperCase();
    if (!spec || url !== spec.url || method !== spec.method || headers.has("cookie") || headers.has("Cookie")) fail("TRANSPORT_REFUSED");
    if (spec.capability ? headers.has("apikey") || headers.has("authorization") : headers.get("apikey") !== spec.key || headers.get("authorization") !== "Bearer " + spec.bearer) fail("TRANSPORT_REFUSED");
    if (Object.hasOwn(spec, "body")) {
      let decoded; try { decoded = typeof init.body === "string" ? JSON.parse(init.body) : undefined; } catch { fail("TRANSPORT_REFUSED"); }
      if (!same(decoded, spec.body)) fail("TRANSPORT_REFUSED");
    }
    if (typeof spec.checkBody === "function") await spec.checkBody(init.body, headers);
    if (Object.values(counts).reduce((sum, count) => sum + count, 0) >= AVATAR_LIMITS.requests) fail("TRANSPORT_REFUSED");
    permit = null; counts[spec.category]++;
    const controller = new AbortController();
    let timer;
    const owned = (async () => {
      const response = await transport(url, { ...init, method, redirect: "error", credentials: "omit", cache: "no-store", signal: controller.signal });
      // The caller's owned transport must retain the original network body.
      if (!(response instanceof Response) || response.redirected || response.url && response.url !== url) fail("RESPONSE_REFUSED");
      const bytes = new Uint8Array(await response.arrayBuffer());
      try {
        if (bytes.byteLength > AVATAR_LIMITS.responseBytes) fail("RESPONSE_REFUSED");
        active();
        if (typeof spec.checkResponse === "function") spec.checkResponse(response.status, bytes, response.headers);
        if (spec.write && !response.ok) {
          let error; try { error = JSON.parse(new TextDecoder().decode(bytes)); } catch { unknown = true; fail("RESPONSE_REFUSED"); }
          if (!rollbackCodes.has(error?.code)) { unknown = true; fail("RESPONSE_REFUSED"); }
        }
        spec.observedStatus = response.status;
        return new Response(response.body ? bytes : null, { status: response.status, headers: response.headers });
      } finally { bytes.fill(0); }
    })().catch(error => { if (spec.write) unknown = true; throw error instanceof AvatarFailure ? error : new AvatarFailure("TRANSPORT_REFUSED"); }).finally(() => pending.delete(owned));
    pending.add(owned);
    try { return await Promise.race([owned, new Promise((_, reject) => { timer = setTimeout(() => { unknown = deadlineRefused = true; controller.abort(); reject(new AvatarFailure("DEADLINE_EXCEEDED")); }, Math.min(ioMs, Math.max(1, deadline - now()))); })]); }
    finally { clearTimeout(timer); }
  };
  return Object.freeze({ fetch: finiteFetch, request, active, uncertain: () => { unknown = true; }, deadline() { unknown = deadlineRefused = true; }, remaining: () => Math.max(0, deadline - now()), metadata: () => Object.freeze({ counts: { ...counts }, pending: pending.size, unknown, deadlineRefused }), async settle() { if (!pending.size) return true; let timer; try { await Promise.race([Promise.allSettled([...pending]), new Promise(resolve => { timer = setTimeout(resolve, 2000); })]); return pending.size === 0; } finally { clearTimeout(timer); } }, close() { closed = true; } });
}

function sessionHint(token, actor) {
  if (typeof token !== "string" || token.length > 16384 || token.split(".").length !== 3) fail("OWNERSHIP_REFUSED");
  let value; try { value = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { fail("OWNERSHIP_REFUSED"); }
  if (value.sub !== actor.id || value.role !== "authenticated" || !UUID.test(value.session_id) || !Number.isSafeInteger(value.exp) || value.exp * 1000 <= Date.now() + 120000) fail("OWNERSHIP_REFUSED");
  return { token, id: value.session_id, expiresAt: value.exp * 1000 };
}

export async function createAvatarStorageCase(context, ports) {
  validateAvatarSetup(context, ports);
  const loaded = await loadCaptureImageProcessor(), processor = loaded.processor;
  const gate = createAvatarRequestGate(context, ports.transport);
  const actor = () => ({ id: randomUUID(), email: "avatar-" + randomBytes(16).toString("hex") + "@example.invalid", password: randomBytes(24).toString("base64url") + "-Aa1!", marker: randomBytes(32).toString("hex"), created: false, verified: false, session: null });
  const a = actor(), b = actor(), actors = [a, b], upload = randomUUID(), lease = randomUUID(), path = b.id + "/" + upload;
  const objects = AVATAR_BUCKETS.map(bucket => ({ bucket, path, created: false, objectId: null }));
  const report = { schemaVersion: 1, scenario: "avatar-storage-local-case", status: "failed", code: "CASE_FAILED", failurePoint: "FIXTURES", stages: Object.fromEntries(AVATAR_STAGES.map(stage => [stage, false])), counts: Object.fromEntries(Object.keys(AVATAR_PASS_COUNTS).map(key => [key, 0])), measurements: { sourceBytes: 0, finalBytes: 0, sourceWidth: 0, sourceHeight: 0, finalWidth: 0, finalHeight: 0 }, writeOutcomeUncertain: false, pendingRequests: 0, pendingInspections: 0, deadlineRefused: false, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])) };
  let phase = "FIXTURES", firstFailure = null, ran = false, disposed = false, pendingInspections = 0, baseline, file, source, prepared, actorBinding;
  const buffers = new Set(), ownedInspections = new Set();
  const client = (key, bearer = key) => createClient(AVATAR_API, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch: gate.fetch, headers: { Authorization: "Bearer " + bearer } } });
  const admin = client(context.serverSecretKey);
  const spec = (category, method, suffix, key = context.serverSecretKey, bearer = key, write = false) => ({ category, method, url: AVATAR_API + suffix, key, bearer, write });
  const checked = (reply, writing = false) => { if (!reply || reply.error) { if (writing) gate.uncertain(); fail("RESPONSE_REFUSED"); } return reply.data; };
  const auth = (method, suffix, operation, writing = false, body) => { const slot = spec("authRequests", method, suffix, context.serverSecretKey, context.serverSecretKey, writing); if (body !== undefined) slot.body = body; return gate.request(slot, () => operation(slot)); };
  const rpc = async (name, args, writing = false, expectedError = null) => {
    const slot = spec("rpcRequests", "POST", "/rest/v1/rpc/" + name, context.serverSecretKey, context.serverSecretKey, writing); slot.body = args;
    const reply = await gate.request(slot, () => admin.rpc(name, args));
    if (expectedError) { if (reply.data !== null || reply.error?.code !== expectedError) { if (writing) gate.uncertain(); fail("OWNERSHIP_REFUSED"); } return null; }
    return checked(reply, writing);
  };
  const bound = owner => ({ p_user: owner.id, p_session: owner.session.id });
  const storage = async (item, method, suffix, operation, writing = false, checkBody, checkResponse) => { const slot = spec("storageRequests", method, "/storage/v1/object/" + suffix, context.serverSecretKey, context.serverSecretKey, writing); if (checkBody) slot.checkBody = checkBody; if (checkResponse) slot.checkResponse = checkResponse; return gate.request(slot, () => operation(admin.storage.from(item.bucket))); };
  const inspect = async query => {
    gate.active(); if (!AVATAR_SQL_QUERIES.includes(query) || pendingInspections || report.counts.sqlInspections >= AVATAR_LIMITS.inspections) fail("SQL_NOT_PROVEN");
    pendingInspections++; report.counts.sqlInspections++;
    let timer;
    const owned = Promise.resolve().then(() => ports.inspect(query, { actors: actorBinding, uploadId: upload })).finally(() => { pendingInspections--; ownedInspections.delete(owned); });
    ownedInspections.add(owned);
    try { const proof = await Promise.race([owned, new Promise((_, reject) => { timer = setTimeout(() => { gate.deadline(); reject(new AvatarFailure("DEADLINE_EXCEEDED")); }, Math.min(AVATAR_LIMITS.ioMs, Math.max(1, gate.remaining()))); })]); gate.active(); return proof; }
    catch (error) { if (error instanceof AvatarFailure) throw error; gate.uncertain(); fail("SQL_NOT_PROVEN"); } finally { clearTimeout(timer); }
  };
  const stage = async (name, work) => { phase = name; await work(); report.stages[name] = true; };
  const failure = error => { firstFailure ??= { phase, code: error instanceof AvatarFailure ? error.message : "CASE_FAILED" }; };
  const absence = async (item, catalogueEmpty) => {
    const slot = spec("storageRequests", "GET", "/storage/v1/object/" + item.bucket + "/" + path);
    slot.checkResponse = (httpStatus, bytes, headers) => {
      if (!/^application\/json(?:\s*;|$)/i.test(headers.get("content-type") ?? "")) fail("CLEANUP_NOT_PROVEN");
      let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("CLEANUP_NOT_PROVEN"); }
      if (!acceptsAvatarStorageAbsence(httpStatus, body, catalogueEmpty)) fail("CLEANUP_NOT_PROVEN");
    };
    const reply = await gate.request(slot, () => admin.storage.from(item.bucket).download(path));
    if (reply.data !== null || ![400, 404].includes(reply.error?.status) || reply.error?.code !== "NoSuchKey" || reply.error.status === 400 && reply.error.statusCode !== "404") fail("CLEANUP_NOT_PROVEN");
  };
  const finish = () => {
    const state = gate.metadata(); Object.assign(report.counts, state.counts);
    report.writeOutcomeUncertain = state.unknown; report.pendingRequests = state.pending; report.pendingInspections = pendingInspections; report.deadlineRefused = state.deadlineRefused;
    report.status = firstFailure ? "failed" : "passed"; report.code = firstFailure?.code ?? "PASSED"; report.failurePoint = firstFailure?.phase ?? null;
    return validateAvatarStorageReport(report);
  };
  async function run() {
    if (ran || disposed) fail("SETUP_REFUSED"); ran = true;
    try {
      await stage("FIXTURES", async () => {
        for (const owner of actors) {
          const body = { id: owner.id, email: owner.email, password: owner.password, email_confirm: true, app_metadata: { sc_avatar_ci_marker: owner.marker } };
          const result = checked(await auth("POST", "/auth/v1/admin/users", () => admin.auth.admin.createUser(body), true, body), true);
          if (!ownsUser(result.user, owner)) { gate.uncertain(); fail("OWNERSHIP_REFUSED"); }
          owner.created = true; report.counts.fixtureCreated++;
          const loginClient = client(context.publishableKey), loginSlot = spec("authRequests", "POST", "/auth/v1/token?grant_type=password", context.publishableKey, context.publishableKey, true);
          loginSlot.body = { email: owner.email, password: owner.password, gotrue_meta_security: {} };
          const login = checked(await gate.request(loginSlot, () => loginClient.auth.signInWithPassword({ email: owner.email, password: owner.password })), true);
          if (!ownsUser(login.user, owner) || !login.session) { gate.uncertain(); fail("OWNERSHIP_REFUSED"); }
          try { owner.session = sessionHint(login.session.access_token, owner); } catch { gate.uncertain(); fail("OWNERSHIP_REFUSED"); }
          const verifySlot = spec("authRequests", "GET", "/auth/v1/user", context.serverSecretKey, owner.session.token);
          const verified = checked(await gate.request(verifySlot, () => admin.auth.getUser(owner.session.token)));
          if (!ownsUser(verified.user, owner)) fail("OWNERSHIP_REFUSED");
          const user = client(context.publishableKey, owner.session.token), accessSlot = spec("authRequests", "POST", "/rest/v1/rpc/my_access_state", context.publishableKey, owner.session.token); accessSlot.body = {};
          const access = checked(await gate.request(accessSlot, () => user.rpc("my_access_state")));
          if (access?.user_id !== owner.id || access.role !== "user" || access.must_change_password !== false || !same(access.entitlements, {})) fail("OWNERSHIP_REFUSED");
          owner.verified = true; report.counts.sessionsVerified++;
        }
        if (new Set([a.id, b.id, a.session.id, b.session.id, upload, lease]).size !== 6) fail("OWNERSHIP_REFUSED");
        actorBinding = Object.freeze({ a: Object.freeze({ id: a.id, sessionId: a.session.id, marker: a.marker }), b: Object.freeze({ id: b.id, sessionId: b.session.id, marker: b.marker }) });
        await ports.registerActors(actorBinding);
      });
      await stage("BASELINE", async () => {
        baseline = await inspect("BASELINE");
        for (const owner of actors) { const snapshot = await rpc("settings_snapshot", bound(owner)); if (snapshot?.user_id !== owner.id || snapshot.profile?.avatar_file_id !== null) fail("OWNERSHIP_REFUSED"); }
        if (!baseline?.bound || !baseline.privateBuckets || baseline.objects.length || baseline.files.length || baseline.reservations.length || !same(baseline.profiles, [{ user_id: a.id, avatar_file_id: null, avatar_url: null }, { user_id: b.id, avatar_file_id: null, avatar_url: null }])) fail("SQL_NOT_PROVEN");
        for (const item of objects) await absence(item, baseline.objects.length === 0);
      });
      await stage("SIGNED_UPLOAD", async () => {
        const policy = processor.readFilePolicy({});
        const reservation = await rpc("file_upload_reserve", { ...bound(b), p_kind: "avatar", p_name: "declared-avatar.png", p_folder: null, p_client_id: "avatar-reserve", p_upload: upload, p_max_bytes: policy.image_max_bytes, p_quota: policy.quota_bytes, p_expires: new Date(Date.now() + 120 * 60000).toISOString() }, true);
        if (reservation?.id !== upload || reservation.user_id !== b.id || reservation.kind !== "avatar" || reservation.folder_id !== null || reservation.staging_path !== path || reservation.final_path !== path || reservation.status !== "reserved") { gate.uncertain(); fail("OWNERSHIP_REFUSED"); }
        const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]], pixels = Buffer.alloc(800 * 600 * 3); buffers.add(pixels);
        for (let y = 0; y < 600; y++) for (let x = 0; x < 800; x++) for (let c = 0; c < 3; c++) pixels[(y * 800 + x) * 3 + c] = colors[(y >= 300 ? 2 : 0) + (x >= 400 ? 1 : 0)][c];
        source = await processor.sharp(pixels, { raw: { width: 800, height: 600, channels: 3 } }).jpeg({ quality: 95 }).withMetadata({ orientation: 6 }).toBuffer(); buffers.add(source);
        const signed = checked(await storage(objects[0], "POST", "upload/sign/" + objects[0].bucket + "/" + path, api => api.createSignedUploadUrl(path, { upsert: false }), false, body => { if (body !== "{}") fail("TRANSPORT_REFUSED"); }));
        const target = new URL(signed.signedUrl);
        if (signed.path !== path || typeof signed.token !== "string" || target.origin !== AVATAR_API || target.pathname !== "/storage/v1/object/upload/sign/" + objects[0].bucket + "/" + path || target.username || target.password || target.hash || !same([...target.searchParams.keys()], ["token"]) || target.searchParams.get("token") !== signed.token) fail("TRANSPORT_REFUSED");
        const form = new FormData(); form.append("cacheControl", "0"); form.append("", new Blob([source], { type: "image/png" }), "declared-avatar.png");
        const slot = { category: "storageRequests", method: "PUT", url: target.href, capability: true, write: true, checkBody: (body, headers) => { if (!(body instanceof FormData) || !same([...body.keys()], ["cacheControl", ""]) || body.get("cacheControl") !== "0" || body.get("")?.size !== source.byteLength || body.get("")?.type !== "image/png" || headers.get("x-upsert") !== "false") fail("TRANSPORT_REFUSED"); } };
        const reply = await gate.request(slot, () => gate.fetch(target.href, { method: "PUT", body: form, headers: { "x-upsert": "false" } }));
        const ack = await reply.json();
        if (!reply.ok || ack?.Key !== objects[0].bucket + "/" + path || ack.Id !== undefined && !UUID.test(ack.Id)) { gate.uncertain(); fail("RESPONSE_REFUSED"); }
        objects[0].created = true; objects[0].objectId = ack.Id ?? null; report.counts.objectsCreated++;
      });
      await stage("FINALIZE", async () => {
        const claim = await rpc("file_upload_claim", { ...bound(b), p_upload: upload, p_lease: lease, p_client_id: "avatar-finalize" }, true);
        if (claim?.file !== null || claim.reservation?.id !== upload || claim.reservation.user_id !== b.id || claim.reservation.kind !== "avatar" || claim.reservation.lease_id !== lease || claim.reservation.status !== "processing" || claim.reservation.staging_path !== path || claim.reservation.final_path !== path) { gate.uncertain(); fail("OWNERSHIP_REFUSED"); }
        const downloaded = checked(await storage(objects[0], "GET", objects[0].bucket + "/" + path, api => api.download(path)));
        if (!(downloaded instanceof Blob)) fail("MEDIA_NOT_PROVEN");
        const measured = new Uint8Array(await downloaded.arrayBuffer()); buffers.add(measured);
        if (downloaded.size !== source.byteLength || measured.byteLength !== source.byteLength || hash(measured) !== hash(source)) fail("MEDIA_NOT_PROVEN");
        const sourceMetadata = await processor.sharp(measured).metadata();
        if (sourceMetadata.width !== 800 || sourceMetadata.height !== 600 || sourceMetadata.orientation !== 6 || !sourceMetadata.exif?.length) fail("MEDIA_NOT_PROVEN");
        prepared = await processor.prepararArquivo("avatar", "declared-avatar.png", measured, processor.readFilePolicy({})); buffers.add(prepared.bytes);
        if (prepared.mime !== "image/jpeg" || prepared.name !== "declared-avatar.jpg" || prepared.width !== 512 || prepared.height !== 512 || prepared.sha256 !== hash(prepared.bytes)) fail("MEDIA_NOT_PROVEN");
        const published = checked(await storage(objects[1], "POST", objects[1].bucket + "/" + path, api => api.upload(path, prepared.bytes, { contentType: prepared.mime, cacheControl: "0", upsert: false }), true, (body, headers) => { if (!(body instanceof Uint8Array) || hash(body) !== prepared.sha256 || headers.get("content-type") !== "image/jpeg" || headers.get("x-upsert") !== "false") fail("TRANSPORT_REFUSED"); }), true);
        if (published?.path !== path || published.fullPath !== objects[1].bucket + "/" + path || !UUID.test(published.id)) { gate.uncertain(); fail("OWNERSHIP_REFUSED"); }
        objects[1].created = true; objects[1].objectId = published.id; report.counts.objectsCreated++;
        const now = new Date().toISOString(); file = { id: upload, user_id: b.id, kind: "avatar", folder_id: null, name: prepared.name, mime: prepared.mime, bytes: prepared.bytes.byteLength, sha256: prepared.sha256, width: 512, height: 512, starred: false, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now, modified_at: now };
        const saved = await rpc("file_upload_complete", { ...bound(b), p_upload: upload, p_lease: lease, p_client_id: "avatar-finalize", p_file: file, p_quota: processor.readFilePolicy({}).quota_bytes }, true);
        if (!same(saved, file)) { gate.uncertain(); fail("SQL_NOT_PROVEN"); }
        Object.assign(report.measurements, { sourceBytes: measured.byteLength, finalBytes: prepared.bytes.byteLength, sourceWidth: 800, sourceHeight: 600, finalWidth: 512, finalHeight: 512 });
        const proof = await inspect("FINALIZED"); if (!same(proof.file, file) || !same(proof.profiles, baseline.profiles) || !same(proof.ledger, [{ events: baseline.ledger[0].events, receipts: baseline.ledger[0].receipts }, { events: baseline.ledger[1].events + 1, receipts: baseline.ledger[1].receipts + 1 }])) fail("SQL_NOT_PROVEN");
      });
      await stage("SIGNED_READ", async () => {
        const read = await rpc("file_read_metadata", { ...bound(b), p_file: upload });
        if (!same(read.file, file) || read.storage_path !== path) fail("OWNERSHIP_REFUSED");
        const signed = checked(await storage(objects[1], "POST", "sign/" + objects[1].bucket + "/" + path, api => api.createSignedUrl(path, 60)));
        const url = new URL(signed.signedUrl);
        if (url.origin !== AVATAR_API || url.pathname !== "/storage/v1/object/sign/" + objects[1].bucket + "/" + path || url.username || url.password || url.hash || !same([...url.searchParams.keys()], ["token"]) || !url.searchParams.get("token")) fail("TRANSPORT_REFUSED");
        const slot = { category: "storageRequests", method: "GET", url: url.href, capability: true, write: false };
        const reply = await gate.request(slot, () => gate.fetch(url.href));
        const bytes = new Uint8Array(await reply.arrayBuffer()); buffers.add(bytes);
        if (!reply.ok || hash(bytes) !== prepared.sha256 || bytes.byteLength !== file.bytes) fail("MEDIA_NOT_PROVEN");
        const metadata = await processor.sharp(bytes).metadata();
        if (metadata.width !== 512 || metadata.height !== 512 || metadata.format !== "jpeg" || ["exif", "orientation", "icc", "iptc", "xmp"].some(field => metadata[field] !== undefined)) fail("MEDIA_NOT_PROVEN");
        const decoded = await processor.sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true }); buffers.add(decoded.data);
        if (decoded.info.channels !== 3) fail("MEDIA_NOT_PROVEN");
        for (const [x, y, expected] of [[128, 128, [0, 0, 255]], [384, 128, [255, 0, 0]], [128, 384, [255, 255, 0]], [384, 384, [0, 255, 0]]]) for (let c = 0; c < 3; c++) { const channel = decoded.data[(y * decoded.info.width + x) * 3 + c]; if (expected[c] === 255 ? channel < 180 : channel > 80) fail("MEDIA_NOT_PROVEN"); }
      });
      await stage("ISOLATION", async () => {
        for (const owner of [b, a]) {
          const url = "/rest/v1/drive_files?select=id%2Cuser_id%2Cpayload%2Cstorage_path%2Cpurged_at&id=eq." + upload + "&user_id=eq." + b.id;
          const slot = spec("publicRequests", "GET", url, context.publishableKey, owner.session.token);
          const rows = checked(await gate.request(slot, () => client(context.publishableKey, owner.session.token).from("drive_files").select("id,user_id,payload,storage_path,purged_at").eq("id", upload).eq("user_id", b.id)));
          if (!same(rows, owner === a ? [] : [{ id: upload, user_id: b.id, payload: file, storage_path: path, purged_at: null }])) fail("OWNERSHIP_REFUSED");
        }
        await rpc("file_read_metadata", { ...bound(a), p_file: upload }, false, "42501");
        await rpc("file_avatar_set", { ...bound(a), p_file: upload, p_client_id: "avatar-foreign" }, true, "23514");
      });
      await stage("PROFILE_SET", async () => {
        if (!same(await rpc("file_avatar_set", { ...bound(b), p_file: upload, p_client_id: "avatar-set" }, true), { avatar_file_id: upload })) { gate.uncertain(); fail("SQL_NOT_PROVEN"); }
        if ((await rpc("settings_snapshot", bound(b))).profile?.avatar_file_id !== upload) fail("SQL_NOT_PROVEN");
        const proof = await inspect("LINKED"); if (!same(proof.file, file) || !same(proof.profiles, [baseline.profiles[0], { user_id: b.id, avatar_file_id: upload, avatar_url: null }]) || proof.ledger[1].events !== baseline.ledger[1].events + 2 || proof.ledger[1].receipts !== baseline.ledger[1].receipts + 2 || !same(proof.ledger[0], baseline.ledger[0])) fail("SQL_NOT_PROVEN");
      });
      await stage("PROFILE_REMOVE", async () => {
        if (!same(await rpc("file_avatar_set", { ...bound(b), p_file: null, p_client_id: "avatar-remove" }, true), { avatar_file_id: null })) { gate.uncertain(); fail("SQL_NOT_PROVEN"); }
        if ((await rpc("settings_snapshot", bound(b))).profile?.avatar_file_id !== null || !same((await rpc("file_read_metadata", { ...bound(b), p_file: upload })).file, file)) fail("SQL_NOT_PROVEN");
        const proof = await inspect("UNLINKED");
        if (!same(proof.file, file) || !same(proof.profiles, baseline.profiles) || !same(proof.ledger[0], baseline.ledger[0]) || proof.ledger[1].events !== baseline.ledger[1].events + 3 || proof.ledger[1].receipts !== baseline.ledger[1].receipts + 3 || !same(proof.receipts, [{ command: "avatar.remove", result: { avatar_file_id: null } }, { command: "avatar.set", result: { avatar_file_id: upload } }, { command: "file.upload.finalize", result: file }]) || !same(proof.profileEvents, [{ beforeAvatar: null, afterAvatar: upload }, { beforeAvatar: upload, afterAvatar: null }])) fail("SQL_NOT_PROVEN");
        report.counts.events = report.counts.receipts = 3;
      });
    } catch (error) { failure(error); }
    try {
      phase = "OBJECT_CLEANUP";
      if (!report.stages.BASELINE || actors.some(owner => !owner.created || !owner.verified) || !ports.cleanupAllowed() || gate.metadata().unknown || gate.metadata().pending || pendingInspections) fail("CLEANUP_NOT_PROVEN");
      await stage("OBJECT_CLEANUP", async () => {
        for (const [index, item] of objects.entries()) {
          const reply = checked(await storage(item, "DELETE", item.bucket, api => api.remove([path]), true, body => { if (!same(JSON.parse(body), { prefixes: [path] })) fail("TRANSPORT_REFUSED"); }, (httpStatus, bytes) => {
            if (httpStatus !== 200) { gate.uncertain(); fail("CLEANUP_NOT_PROVEN"); }
            let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { gate.uncertain(); fail("CLEANUP_NOT_PROVEN"); }
            if (!Array.isArray(body) || body.length !== (item.created ? 1 : 0) || body.some(row => !plain(row) || row.name !== path || row.bucket_id !== undefined && row.bucket_id !== item.bucket || !UUID.test(row.id) || item.objectId !== null && row.id !== item.objectId)) { gate.uncertain(); fail("CLEANUP_NOT_PROVEN"); }
          }), true);
          if (!Array.isArray(reply) || reply.length !== (item.created ? 1 : 0) || reply.some(row => row.name !== path || row.bucket_id !== undefined && row.bucket_id !== item.bucket || !UUID.test(row.id) || item.objectId !== null && row.id !== item.objectId)) { gate.uncertain(); fail("CLEANUP_NOT_PROVEN"); }
          const proof = await inspect(index === 0 ? "STAGING_ABSENT" : "FINAL_ABSENT");
          const catalogueEmpty = !proof.objects.some(object => object.bucket_id === item.bucket);
          if (!catalogueEmpty) fail("CLEANUP_NOT_PROVEN");
          await absence(item, catalogueEmpty); report.counts.objectsRemoved += reply.length;
        }
      });
      await stage("AUTH_CLEANUP", async () => {
        for (const owner of actors) {
          const existing = checked(await auth("GET", "/auth/v1/admin/users/" + owner.id, () => admin.auth.admin.getUserById(owner.id)));
          if (!ownsUser(existing.user, owner)) fail("OWNERSHIP_REFUSED");
          const slot = spec("authRequests", "POST", "/auth/v1/logout?scope=global", context.serverSecretKey, owner.session.token, true);
          const logout = await gate.request(slot, () => admin.auth.admin.signOut(owner.session.token, "global"));
          if (slot.observedStatus !== 204 || logout.error) { gate.uncertain(); fail("CLEANUP_NOT_PROVEN"); }
          const deleteSlot = spec("authRequests", "DELETE", "/auth/v1/admin/users/" + owner.id, context.serverSecretKey, context.serverSecretKey, true); deleteSlot.body = { should_soft_delete: false };
          const deleted = await gate.request(deleteSlot, () => admin.auth.admin.deleteUser(owner.id, false));
          if (deleteSlot.observedStatus !== 200 || !acceptsAdminNativeDeleteAcknowledgement(deleted, user => ownsUser(user, owner))) { gate.uncertain(); fail("CLEANUP_NOT_PROVEN"); }
          const absent = await auth("GET", "/auth/v1/admin/users/" + owner.id, () => admin.auth.admin.getUserById(owner.id));
          if (absent.data.user !== null || absent.error?.status !== 404 || absent.error?.code !== "user_not_found") fail("CLEANUP_NOT_PROVEN");
          report.counts.fixtureDeleted++;
        }
      });
      await stage("FINAL_SQL", async () => { const proof = await inspect("AUTH_ABSENT"); if (!proof.absent || proof.objects.length) fail("SQL_NOT_PROVEN"); });
    } catch (error) { failure(error); }
    return finish();
  }
  return Object.freeze({ run, metadata: () => Object.freeze({ ...gate.metadata(), pendingInspections, modules: loaded.modules }), async settle() { const httpQuiet = await gate.settle(); let timer; try { if (ownedInspections.size) await Promise.race([Promise.allSettled([...ownedInspections]), new Promise(resolve => { timer = setTimeout(resolve, 2000); })]); return httpQuiet && ownedInspections.size === 0; } finally { clearTimeout(timer); } }, dispose() { if (disposed) return; if (gate.metadata().pending || pendingInspections) fail("CLEANUP_NOT_PROVEN"); disposed = true; gate.close(); for (const bytes of buffers) bytes.fill(0); buffers.clear(); for (const owner of actors) { owner.password = ""; owner.email = ""; owner.marker = ""; owner.session = null; } baseline = file = source = prepared = actorBinding = null; } });
}
