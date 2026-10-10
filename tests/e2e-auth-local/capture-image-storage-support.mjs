// Local service composition only. Protocol PASS is not native provenance: the
// caller must supply the own CI envelope. Backend orchestration and HTTP/Auth
// are explicit seams; personal factories, Next and browser upload are outside.
import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { CAPTURE_NATIVE_API, CAPTURE_NATIVE_APP, loadCaptureNativeCore } from "./capture-task-persistence-support.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = "tests/e2e-auth-local/capture-image-storage.entry.ts";
const STAGING = "second-brain-staging", FINAL = "second-brain-files";
const MARKER = "SC_CAPTURE_IMAGE_STORAGE_FIXTURE", NAME = "declared-image.png";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SQL_ROLLBACK = new Set(["PT429", "42501", "23505", "40001", "40P01", "22023", "23514", "23503", "22P02"]);
export const CAPTURE_IMAGE_STAGES = Object.freeze(["BASELINE", "RESERVE", "SIGNED_PUT", "CLAIM", "MEASURE", "PREPARE", "PUBLISH", "COMPLETE", "DOWNLOAD", "CAPTURE", "PUBLIC_FINAL", "SQL_FINAL"]);
export const CAPTURE_IMAGE_CHECKS = Object.freeze(["ordinaryOwnBaseline", "reservationBound", "signedPutWithoutCredentials", "leaseBound", "serverBytesMeasured", "originalProcessorUsed", "finalObjectPublished", "finalizedReceiptProven", "finalBytesExifFree", "captureAttachmentAtomic", "publicOwnAndForeign", "sqlAtomicLedger"]);
export const CAPTURE_IMAGE_CLEANUP_STAGES = Object.freeze(["STAGING_REMOVE", "STAGING_ABSENT", "FINAL_REMOVE", "FINAL_ABSENT"]);
export const CAPTURE_IMAGE_FAILURE_CODES = Object.freeze(["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED", "TRANSPORT_REFUSED", "TRANSPORT_FAILED", "DEADLINE_EXCEEDED", "RESPONSE_REFUSED", "OWNERSHIP_REFUSED", "SQL_REFUSED", "MEDIA_NOT_PROVEN", "PERSISTENCE_NOT_PROVEN", "COMMIT_UNCONFIRMED", "CLEANUP_NOT_PROVEN", "WRITE_OUTCOME_UNCERTAIN"]);
export const CAPTURE_IMAGE_LIMITS = Object.freeze({ requests: 48, responseBytes: 1_048_576, timeoutMs: 15000 });
export const CAPTURE_IMAGE_MODULES = Object.freeze([ENTRY, "src/adapters/db/files-processor.ts", "src/adapters/db/files-policy.ts", "src/core/contracts/base.ts", "src/core/drive/index.ts", "src/core/drive/rules.ts", "src/core/drive/types.ts", "src/core/drive/use-cases.ts", "node_modules/server-only/empty.js"]);
// Derived from the explicit one-call sequence, not the CaptureTask 45 protocol:
// profiles2+baseline1+fresh-path GET404s2; reserve1; signer1+PUT1; claim1;
// stagingGET1; finalPOST1;
// complete1+receipt-claim1+status1; finalGET1; Core snapshot/commit1each
// +post-snapshot1+receipt1; public file/capture/link/event reads2each =27.
export const CAPTURE_IMAGE_PASS_COUNTS = Object.freeze({ requests: 27, rpcRequests: 10, publicRequests: 10, storageRequests: 7, signedPuts: 1, coreCommands: 1, commitAttempts: 1, sqlInspections: 1, events: 2, receipts: 2 });
export const CAPTURE_IMAGE_CLEANUP_PASS_COUNTS = Object.freeze({ requests: 4, removeRequests: 2, absenceReads: 2, removedObjects: 2 });
const CODES = new Set(CAPTURE_IMAGE_FAILURE_CODES);
class ImageFailure extends Error {}
const fail = code => { throw new ImageFailure(CODES.has(code) ? code : "RESPONSE_REFUSED"); };
const exact = (value, names, code = "SETUP_REFUSED") => {
  try {
    if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.length !== names.length || keys.some(key => typeof key !== "string" || !names.includes(key)) || names.some(name => !Object.hasOwn(descriptors, name) || !Object.hasOwn(descriptors[name], "value") || !descriptors[name].enumerable)) fail(code);
  } catch { fail(code); }
};
const copy = value => structuredClone(value);
const freeze = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
const signature = value => Array.isArray(value) ? "[" + value.map(signature).join(",") + "]" : value && typeof value === "object" ? "{" + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key) + ":" + signature(value[key])).join(",") + "}" : JSON.stringify(value);
const same = (a, b) => signature(a) === signature(b);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = path => path.replaceAll("\\", "/");

let processorPromise;
export async function loadCaptureImageProcessor() {
  processorPromise ??= (async () => {
    const marker = JSON.parse(await readFile(resolve(ROOT, "node_modules/server-only/package.json"), "utf8"));
    if (marker.name !== "server-only" || marker.version !== "0.0.1" || marker.exports?.["."]?.["react-server"] !== "./empty.js" || (await readFile(resolve(ROOT, "node_modules/server-only/empty.js"))).length !== 0) fail("GRAPH_REFUSED");
    // Official package resolution to a native-module file URL is necessary for
    // the RAM data-URI entry. No source, alias, stub or module is substituted.
    const require = createRequire(import.meta.url), sharpPath = await realpath(require.resolve("sharp"));
    const sharpPackage = JSON.parse(await readFile(resolve(ROOT, "node_modules/sharp/package.json"), "utf8"));
    if (sharpPackage.name !== "sharp" || sharpPackage.version !== "0.35.5" || canonical(relative(ROOT, sharpPath)) !== "node_modules/sharp/dist/index.cjs") fail("GRAPH_REFUSED");
    const sharpUrl = pathToFileURL(sharpPath).href, inventory = new Set(), { rolldown } = await import("rolldown");
    const build = await rolldown({ input: resolve(ROOT, ENTRY), platform: "node", logLevel: "silent", resolve: { conditionNames: ["react-server", "node", "import", "default"] }, plugins: [{ name: "fixed-official-native-module", resolveId(id) { if (id === "sharp") return { id: sharpUrl, external: true }; }, async moduleParsed(info) {
      if (info.isExternal || info.dynamicallyImportedIds.length || canonical(await realpath(info.id)) !== canonical(info.id)) fail("GRAPH_REFUSED");
      const name = canonical(relative(ROOT, info.id)); if (!CAPTURE_IMAGE_MODULES.includes(name)) fail("GRAPH_REFUSED"); inventory.add(name);
    } }] });
    try {
      const generated = await build.generate({ format: "es", codeSplitting: false, sourcemap: false }), chunk = generated.output[0];
      if (inventory.size !== CAPTURE_IMAGE_MODULES.length || CAPTURE_IMAGE_MODULES.some(path => !inventory.has(path)) || generated.output.length !== 1 || chunk.type !== "chunk" || chunk.dynamicImports.length || !same([...chunk.imports].sort(), ["node:crypto", sharpUrl].sort()) || Buffer.byteLength(chunk.code) > 65536) fail("GRAPH_REFUSED");
      const processor = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64"));
      if (!same(Object.keys(processor).sort(), ["prepararArquivo", "readFilePolicy", "sharp"]) || Object.values(processor).some(value => typeof value !== "function")) fail("GRAPH_REFUSED");
      return Object.freeze({ processor, modules: Object.freeze([...inventory].sort()) });
    } finally { await build.close(); }
  })().catch(() => fail("GRAPH_REFUSED"));
  return processorPromise;
}
function actor(value) {
  exact(value, ["id", "sessionId", "accessToken", "expiresAt"]);
  if (typeof value.id !== "string" || typeof value.sessionId !== "string" || !UUID.test(value.id) || !UUID.test(value.sessionId) || typeof value.accessToken !== "string" || value.accessToken.length > 32768 || !Number.isSafeInteger(value.expiresAt)) fail("SETUP_REFUSED");
  try {
    const parts = value.accessToken.split("."); if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) fail("SETUP_REFUSED");
    const bytes = Buffer.from(parts[1], "base64url");
    try { const claims = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); if (bytes.toString("base64url") !== parts[1] || claims.sub !== value.id || claims.session_id !== value.sessionId || claims.role !== "authenticated" || claims.exp * 1000 !== value.expiresAt) fail("SETUP_REFUSED"); } finally { bytes.fill(0); }
  } catch { fail("SETUP_REFUSED"); }
  return copy(value);
}

/** A/B must already have caller-verified ordinary Auth sessions. JWT decoding
 * only binds hints; it never authenticates. Mandatory transport supplies IO. */
export async function createCaptureImageStorageAcceptance(context, options) {
  exact(context, ["runtime", "publishableKey", "serverSecretKey", "a", "b"]); exact(context.runtime, ["ci", "githubActions", "localAuthRun", "appUrl", "supabaseUrl"]);
  exact(options, Object.hasOwn(options ?? {}, "timeoutMs") ? ["transport", "inspectSql", "timeoutMs"] : ["transport", "inspectSql"]);
  if (context.runtime.ci !== true || context.runtime.githubActions !== true || context.runtime.localAuthRun !== true || context.runtime.appUrl !== CAPTURE_NATIVE_APP || context.runtime.supabaseUrl !== CAPTURE_NATIVE_API || typeof context.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(context.publishableKey) || typeof context.serverSecretKey !== "string" || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(context.serverSecretKey) || typeof options.transport !== "function" || typeof options.inspectSql !== "function") fail("SETUP_REFUSED");
  const timeoutMs = options.timeoutMs ?? CAPTURE_IMAGE_LIMITS.timeoutMs; if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > CAPTURE_IMAGE_LIMITS.timeoutMs) fail("SETUP_REFUSED");
  let a = actor(context.a), b = actor(context.b), pub = context.publishableKey, secret = context.serverSecretKey;
  if (a.id === b.id || a.sessionId === b.sessionId || a.accessToken === b.accessToken) fail("SETUP_REFUSED");
  const [{ core, modules: coreModules }, { processor, modules }] = await Promise.all([loadCaptureNativeCore(), loadCaptureImageProcessor()]);
  const transport = options.transport, inspectSql = options.inspectSql, upload = randomUUID(), lease = randomUUID(), clientId = randomUUID(), captureCid = randomUUID(), path = b.id + "/" + upload;
  const policy = processor.readFilePolicy({}), inventory = [STAGING, FINAL].map(bucket => ({ bucket, path, objectId: null, created: false, removed: false, absent: false }));
  const counts = Object.fromEntries(Object.keys(CAPTURE_IMAGE_PASS_COUNTS).map(key => [key, 0]));
  const cleanupCounts = Object.fromEntries(Object.keys(CAPTURE_IMAGE_CLEANUP_PASS_COUNTS).map(key => [key, 0]));
  let state = "prepared", unknown = false, permit = null, lastFailure = null, pipelineReport = null, cleanupReport = null, cleanupConfirmed = false, freshPathsVerified = false;
  let stagingBytes = null, finalBytes = null, signedUrl = null, signedToken = null, file = null, capture = null, baseline = null, expectedBatch = null, pendingCommit = false, lastRollback = false;
  const buffers = new Set(), pendingControllers = new Set();
  const live = () => { if (!a || !b || a.expiresAt <= Date.now() + 60000 || b.expiresAt <= Date.now() + 60000) fail("TOKEN_LIFETIME_REFUSED"); };
  const active = () => { if (!["running", "cleaning"].includes(state)) fail("STATE_REFUSED"); live(); };

  async function finiteFetch(input, init = {}) {
    active(); const slot = permit; permit = null;
    if (!slot) fail("TRANSPORT_REFUSED");
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : null;
    const headers = new Headers(init.headers), method = init.method ?? "GET";
    if (url !== slot.url || method !== slot.method || !url.startsWith(CAPTURE_NATIVE_API + "/") || init.signal?.aborted || [...headers.keys()].some(key => !["apikey", "authorization", "x-client-info", "content-type", "cache-control", "x-upsert", "accept-profile", "content-profile"].includes(key)) || ["accept-profile", "content-profile"].some(key => headers.has(key) && headers.get(key) !== "public")) fail("TRANSPORT_REFUSED");
    if (slot.auth === "capability") { if (headers.has("apikey") || headers.has("authorization") || headers.get("x-upsert") !== "false") fail("TRANSPORT_REFUSED"); }
    else { const owner = slot.auth === "a" ? a : b, privileged = slot.auth === "server"; if (headers.get("apikey") !== (privileged ? secret : pub) || headers.get("authorization") !== "Bearer " + (privileged ? secret : owner.accessToken)) fail("OWNERSHIP_REFUSED"); }
    slot.check(init.body, headers);
    if (counts.requests + cleanupCounts.requests >= CAPTURE_IMAGE_LIMITS.requests) fail("CALL_LIMIT_REFUSED");
    if (state === "cleaning") { cleanupCounts.requests++; if (method === "DELETE") cleanupCounts.removeRequests++; else cleanupCounts.absenceReads++; }
    else { counts.requests++; counts[slot.kind + "Requests"]++; if (slot.auth === "capability") counts.signedPuts++; }
    const controller = new AbortController(), deadline = performance.now() + timeoutMs; pendingControllers.add(controller);
    let timer, reader, settled = false; const pieces = []; let length = 0;
    const check = () => { active(); if (settled || controller.signal.aborted || performance.now() >= deadline) fail("DEADLINE_EXCEEDED"); };
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ImageFailure("DEADLINE_EXCEEDED")); }, timeoutMs); });
    try {
      return await Promise.race([timeout, (async () => {
        const response = await transport(url, { method, headers: Object.freeze(Object.fromEntries(headers)), ...(init.body === undefined ? {} : { body: init.body }), signal: controller.signal, redirect: "error", cache: "no-store", credentials: "omit" }); check();
        if (!(response instanceof Response) || response.redirected || response.url && response.url !== url || !response.body) fail("RESPONSE_REFUSED");
        const declared = response.headers.get("content-length"); if (declared && (!/^\d+$/.test(declared) || Number(declared) > CAPTURE_IMAGE_LIMITS.responseBytes)) fail("RESPONSE_REFUSED");
        const contentType = response.headers.get("content-type") ?? "";
        if (!slot.binary || !response.ok) { if (!/^application\/json(?:\s*;|$)/i.test(contentType)) fail("RESPONSE_REFUSED"); }
        else if (!/^image\/(jpeg|png)(?:\s*;|$)/i.test(contentType)) fail("RESPONSE_REFUSED");
        reader = response.body.getReader(); for (;;) { check(); const next = await reader.read(); check(); if (next.done) break; if (!(next.value instanceof Uint8Array) || length + next.value.byteLength > CAPTURE_IMAGE_LIMITS.responseBytes) fail("RESPONSE_REFUSED"); pieces.push(next.value.slice()); length += next.value.byteLength; }
        const bytes = new Uint8Array(length); let offset = 0; for (const piece of pieces) { bytes.set(piece, offset); offset += piece.length; piece.fill(0); }
        if (!slot.binary || !response.ok) {
          let value; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { fail("RESPONSE_REFUSED"); }
          if (slot.absent && response.status === 404) {
            // Known Storage missing-key error, not a missing route, unavailable
            // bucket or a provider body containing the number404 by itself.
            if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["statusCode", "code", "error", "message"].includes(key)) || value.code !== "NoSuchKey" || value.statusCode !== undefined && String(value.statusCode) !== "404" || typeof value.message !== "string" || value.message.length < 1 || value.message.length > 256 || value.error !== undefined && typeof value.error !== "string") fail("RESPONSE_REFUSED");
          }
          if (slot.write && !response.ok && !([400, 403, 409, 422, 429].includes(response.status) && SQL_ROLLBACK.has(value?.code))) unknown = true;
          if (slot.write && !response.ok && SQL_ROLLBACK.has(value?.code)) lastRollback = true;
        }
        check(); return new Response(bytes, { status: response.status, headers: { "content-type": contentType } });
      })()]);
    } catch (error) { if (slot.write) unknown = true; lastFailure = error instanceof ImageFailure ? error.message : "TRANSPORT_FAILED"; fail(lastFailure); }
    finally { settled = true; clearTimeout(timer); controller.abort(); pendingControllers.delete(controller); for (const piece of pieces) piece.fill(0); if (reader) void reader.cancel().catch(() => undefined); }
  }
  const sdkFetch = (input, init) => finiteFetch(input, init).catch(error => { lastFailure = error instanceof ImageFailure ? error.message : "TRANSPORT_FAILED"; throw error; });
  const settings = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch: sdkFetch } };
  const server = createClient(CAPTURE_NATIVE_API, secret, settings);
  const publicClient = owner => createClient(CAPTURE_NATIVE_API, pub, { ...settings, global: { fetch: sdkFetch, headers: { Authorization: "Bearer " + owner.accessToken } } });
  const publicA = publicClient(a), publicB = publicClient(b);
  function allow(slot) { active(); if (permit) fail("STATE_REFUSED"); lastFailure = null; permit = slot; }
  function jsonCheck(expected) { return body => { let parsed; try { parsed = JSON.parse(body); } catch { fail("TRANSPORT_REFUSED"); } if (!same(parsed, expected)) fail("TRANSPORT_REFUSED"); }; }
  async function rpc(name, args, writing = false) {
    active(); if (args.p_user !== b.id || args.p_session !== b.sessionId || name.startsWith("capture_task_") && args.p_operation !== "read.captures" && args.p_operation !== "capture.create") fail("OWNERSHIP_REFUSED");
    allow({ url: CAPTURE_NATIVE_API + "/rest/v1/rpc/" + name, method: "POST", auth: "server", kind: "rpc", binary: false, write: writing, check: jsonCheck(args) });
    lastRollback = false; const response = await server.rpc(name, args); if (lastFailure) fail(lastFailure);
    if (response.error && (!SQL_ROLLBACK.has(response.error.code) || !lastRollback && writing)) { if (writing) unknown = true; fail("RESPONSE_REFUSED"); }
    return response;
  }
  async function fileRpc(name, args, writing = false) { const response = await rpc(name, { p_user: b.id, p_session: b.sessionId, ...args }, writing); if (response.error) fail("SQL_REFUSED"); return response.data; }
  function gateway(operation) {
    const boundRpc = async (name, args) => {
      const extras = name === "capture_task_commit" ? ["p_request"] : name === "capture_task_receipt" ? ["p_command", "p_client_id"] : [];
      exact(args, ["p_user", "p_session", "p_operation", ...extras], "TRANSPORT_REFUSED");
      if (args.p_operation !== operation || args.p_user !== b.id || args.p_session !== b.sessionId || name === "capture_task_receipt" && (args.p_command !== operation || args.p_client_id !== captureCid)) fail("OWNERSHIP_REFUSED");
      const writing = name === "capture_task_commit";
      if (writing) { if (operation !== "capture.create" || args.p_request.context.user_id !== b.id || args.p_request.context.canal !== "web" || args.p_request.receipt.client_id !== captureCid) fail("OWNERSHIP_REFUSED"); counts.commitAttempts++; pendingCommit = true; expectedBatch = copy(args.p_request); }
      return rpc(name, args, writing);
    };
    const real = core.createCaptureTaskGateway(b.id, b.sessionId, operation, boundRpc);
    return { ...real, async commit(batch) { try { const reply = await real.commit(batch); if (reply.status !== "committed" || !same(reply.result, batch.receipt.result)) { unknown = true; fail("COMMIT_UNCONFIRMED"); } pendingCommit = false; return reply; } catch (error) { if (pendingCommit && !lastRollback) unknown = true; pendingCommit = false; throw error; } } };
  }
  const readGateway = gateway("read.captures");
  async function publicRead(table, query, owner) {
    const url = CAPTURE_NATIVE_API + "/rest/v1/" + table + "?" + query.toString();
    allow({ url, method: "GET", auth: owner, kind: "public", binary: false, write: false, check: body => { if (body !== undefined) fail("TRANSPORT_REFUSED"); } });
    const response = await (owner === "a" ? publicA : publicB).from(table).select(query.get("select")).match(Object.fromEntries([...query].filter(([key]) => !["select", "limit"].includes(key)).map(([key, value]) => [key, value.replace(/^eq\./, "")]))).limit(Number(query.get("limit")));
    if (lastFailure) fail(lastFailure); if (response.error || !Array.isArray(response.data)) fail("OWNERSHIP_REFUSED"); return response.data;
  }
  const query = (select, fields, limit = 2) => new URLSearchParams({ select, ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, "eq." + value])), limit: String(limit) });
  async function storage(bucket, method, suffix, action, check, binary = false, writing = false, absent = false) {
    allow({ url: CAPTURE_NATIVE_API + "/storage/v1/object/" + suffix, method, auth: "server", kind: "storage", binary, write: writing, check, absent });
    const result = await action(server.storage.from(bucket)); if (lastFailure) fail(lastFailure); return result;
  }
  const bodyNone = body => { if (body !== undefined) fail("TRANSPORT_REFUSED"); };
  const pipeline = { schemaVersion: 1, scenario: "capture-image-storage", status: "failed", code: "STATE_REFUSED", failurePoint: "PREREQUISITE", stages: [], counts, checks: Object.fromEntries(CAPTURE_IMAGE_CHECKS.map(name => [name, false])), measurements: { sourceBytes: 0, finalBytes: 0, sourceWidth: 0, sourceHeight: 0, finalWidth: 0, finalHeight: 0 }, writeOutcomeUncertain: false };
  async function stage(name, work) { pipeline.failurePoint = name; await work(); pipeline.stages.push({ name, passed: true }); pipeline.checks[CAPTURE_IMAGE_CHECKS[CAPTURE_IMAGE_STAGES.indexOf(name)]] = true; }
  async function run() {
    if (state !== "prepared") fail("STATE_REFUSED"); state = "running";
    try {
      await stage("BASELINE", async () => {
        for (const owner of ["a", "b"]) { const rows = await publicRead("profiles", query("user_id,display_name", {}), owner); if (rows.length !== 1 || rows[0].user_id !== (owner === "a" ? a.id : b.id)) fail("OWNERSHIP_REFUSED"); }
        baseline = await readGateway.snapshot();
        for (const item of inventory) { const absent = await storage(item.bucket, "GET", item.bucket + "/" + item.path, api => api.download(item.path), bodyNone, true, false, true); if (absent.data !== null || absent.error?.status !== 404 || absent.error?.code !== "NoSuchKey") fail("OWNERSHIP_REFUSED"); }
        freshPathsVerified = true;
      });
      await stage("RESERVE", async () => {
        const reservation = await fileRpc("file_upload_reserve", { p_kind: "capture_image", p_name: NAME, p_folder: null, p_client_id: clientId, p_upload: upload, p_max_bytes: policy.image_max_bytes, p_quota: policy.quota_bytes, p_expires: new Date(Date.now() + 150 * 60000).toISOString() }, true);
        if (!reservation || reservation.id !== upload || reservation.user_id !== b.id || reservation.kind !== "capture_image" || reservation.name !== NAME || reservation.folder_id !== null || reservation.staging_path !== path || reservation.final_path !== path || reservation.status !== "reserved" || reservation.max_bytes !== policy.image_max_bytes || reservation.quota_bytes !== policy.quota_bytes) { unknown = true; fail("OWNERSHIP_REFUSED"); }
      });
      await stage("SIGNED_PUT", async () => {
        stagingBytes = new Uint8Array(await processor.sharp({ create: { width: 60, height: 40, channels: 3, background: "#843d50" } }).jpeg().withExif({ IFD0: { ImageDescription: MARKER } }).withMetadata({ orientation: 6 }).toBuffer()); buffers.add(stagingBytes);
        const source = await processor.sharp(stagingBytes).metadata(); if (source.width !== 60 || source.height !== 40 || source.orientation !== 6 || !source.exif?.includes(Buffer.from(MARKER))) fail("MEDIA_NOT_PROVEN");
        const signed = await storage(STAGING, "POST", "upload/sign/" + STAGING + "/" + path, api => api.createSignedUploadUrl(path, { upsert: false }), jsonCheck({}));
        if (signed.error || !signed.data || signed.data.path !== path || typeof signed.data.token !== "string" || signed.data.token.length < 8 || signed.data.token.length > 32768) fail("RESPONSE_REFUSED");
        signedUrl = signed.data.signedUrl; signedToken = signed.data.token; const target = new URL(signedUrl);
        if (target.origin !== CAPTURE_NATIVE_API || target.pathname !== "/storage/v1/object/upload/sign/" + STAGING + "/" + path || target.username || target.password || target.hash || !same([...target.searchParams.keys()], ["token"]) || target.searchParams.get("token") !== signedToken) fail("TRANSPORT_REFUSED");
        const form = new FormData(); form.append("cacheControl", "0"); form.append("", new Blob([stagingBytes], { type: "image/png" }), NAME);
        allow({ url: signedUrl, method: "PUT", auth: "capability", kind: "storage", binary: false, write: true, check: body => { if (!(body instanceof FormData) || !same([...body.keys()], ["cacheControl", ""]) || body.get("cacheControl") !== "0" || body.get("").size !== stagingBytes.length || body.get("").type !== "image/png") fail("TRANSPORT_REFUSED"); } });
        const response = await finiteFetch(signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
        const ack = await response.json(); if (!response.ok || ack?.Key !== STAGING + "/" + path || ack.Id !== undefined && (typeof ack.Id !== "string" || !UUID.test(ack.Id))) { unknown = true; fail("RESPONSE_REFUSED"); } inventory[0].created = true; inventory[0].objectId = ack.Id ?? null;
      });
      await stage("CLAIM", async () => { const claim = await fileRpc("file_upload_claim", { p_upload: upload, p_lease: lease, p_client_id: clientId }, true); if (!claim || claim.file !== null || claim.reservation?.id !== upload || claim.reservation.user_id !== b.id || claim.reservation.lease_id !== lease || claim.reservation.status !== "processing" || claim.reservation.staging_path !== path || claim.reservation.final_path !== path) { unknown = true; fail("OWNERSHIP_REFUSED"); } });
      let measured;
      await stage("MEASURE", async () => { const download = await storage(STAGING, "GET", STAGING + "/" + path, api => api.download(path), bodyNone, true); if (download.error || !(download.data instanceof Blob)) fail("MEDIA_NOT_PROVEN"); measured = new Uint8Array(await download.data.arrayBuffer()); buffers.add(measured); if (download.data.size !== measured.length || measured.length !== stagingBytes.length || hash(measured) !== hash(stagingBytes) || measured.length > policy.image_max_bytes) fail("MEDIA_NOT_PROVEN"); pipeline.measurements.sourceBytes = measured.length; pipeline.measurements.sourceWidth = 60; pipeline.measurements.sourceHeight = 40; });
      let prepared;
      await stage("PREPARE", async () => { prepared = await processor.prepararArquivo("capture_image", NAME, measured, policy); finalBytes = prepared.bytes; buffers.add(finalBytes); if (prepared.mime !== "image/jpeg" || prepared.name !== "declared-image.jpg" || prepared.width !== 40 || prepared.height !== 60 || prepared.sha256 !== hash(finalBytes)) fail("MEDIA_NOT_PROVEN"); pipeline.measurements.finalBytes = finalBytes.length; pipeline.measurements.finalWidth = 40; pipeline.measurements.finalHeight = 60; });
      await stage("PUBLISH", async () => { const response = await storage(FINAL, "POST", FINAL + "/" + path, api => api.upload(path, finalBytes, { contentType: prepared.mime, upsert: false, cacheControl: "0" }), (body, headers) => { if (!(body instanceof Uint8Array) || hash(body) !== hash(finalBytes) || headers.get("content-type") !== "image/jpeg" || headers.get("x-upsert") !== "false" || headers.get("cache-control") !== "max-age=0") fail("TRANSPORT_REFUSED"); }, false, true); if (response.error || response.data?.path !== path || response.data.fullPath !== FINAL + "/" + path || typeof response.data.id !== "string" || !UUID.test(response.data.id)) { unknown = true; fail("RESPONSE_REFUSED"); } inventory[1].created = true; inventory[1].objectId = response.data.id; });
      await stage("COMPLETE", async () => {
        const now = new Date().toISOString(), expected = { id: upload, user_id: b.id, kind: "capture_image", folder_id: null, name: prepared.name, mime: prepared.mime, bytes: finalBytes.length, sha256: prepared.sha256, width: prepared.width, height: prepared.height, starred: false, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now, modified_at: now };
        file = await fileRpc("file_upload_complete", { p_upload: upload, p_lease: lease, p_client_id: clientId, p_file: expected, p_quota: policy.quota_bytes }, true); if (!same(file, expected)) { unknown = true; fail("PERSISTENCE_NOT_PROVEN"); }
        const replay = await fileRpc("file_upload_claim", { p_upload: upload, p_lease: randomUUID(), p_client_id: clientId }, true); if (!replay || replay.reservation !== null || !same(replay.file, file)) { unknown = true; fail("PERSISTENCE_NOT_PROVEN"); }
        const status = await fileRpc("file_upload_status", { p_upload: upload }); if (status.status !== "finalized" || !same(status.file, file)) fail("PERSISTENCE_NOT_PROVEN");
      });
      await stage("DOWNLOAD", async () => { const download = await storage(FINAL, "GET", FINAL + "/" + path, api => api.download(path), bodyNone, true); if (download.error || !(download.data instanceof Blob)) fail("MEDIA_NOT_PROVEN"); const bytes = new Uint8Array(await download.data.arrayBuffer()); buffers.add(bytes); const metadata = await processor.sharp(bytes).metadata(); if (download.data.size !== file.bytes || bytes.length !== file.bytes || hash(bytes) !== file.sha256 || metadata.width !== file.width || metadata.height !== file.height || metadata.exif !== undefined || metadata.orientation !== undefined || metadata.format !== "jpeg") fail("MEDIA_NOT_PROVEN"); });
      await stage("CAPTURE", async () => {
        counts.coreCommands++; const bound = gateway("capture.create"), store = core.createCaptureTaskStore(bound, { maxAttempts: 1 });
        const attachment = { id: file.id, name: file.name, mime: file.mime, width: file.width, height: file.height, bytes: file.bytes };
        const decoded = core.decodeCaptureTaskRequest({ command: "capture.create", input: { client_id: captureCid, type: "note", title: "Local image composition", content: "Synthetic image bytes are attached to this capture.", category_id: null, project_id: null, attachments: [attachment] } });
        capture = await core.executeCaptureTaskCommand(store, { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: b.id, canal: "web" }, decoded);
        if (unknown || !same(capture.attachments, [attachment]) || expectedBatch?.changes.length !== 1 || expectedBatch.events.length !== 1 || expectedBatch.changes[0].before !== null || !same(expectedBatch.changes[0].after, capture)) fail("PERSISTENCE_NOT_PROVEN");
        const event = expectedBatch.events[0]; if (event.entity_type !== "capture" || event.entity_id !== capture.id || event.action !== "created" || event.canal !== "web" || event.user_id !== b.id || event.before !== null || !same(event.after, capture)) fail("PERSISTENCE_NOT_PROVEN");
        const next = await readGateway.snapshot(), receipt = await bound.receipt("capture.create", captureCid);
        if (!same(receipt, expectedBatch.receipt) || !same(next.captures.filter(row => row.id !== capture.id), baseline.captures) || !same(next.captures.find(row => row.id === capture.id), capture) || !same(next.tasks, baseline.tasks) || !same(next.categories, baseline.categories) || !same(next.projects, baseline.projects) || !same(next.events.filter(row => row.id !== event.id), baseline.events) || !same(next.events.find(row => row.id === event.id), event) || !same(next.receipts.filter(row => row.client_id !== captureCid), baseline.receipts) || !same(next.receipts.find(row => row.client_id === captureCid), receipt) || BigInt(next.revision) <= BigInt(baseline.revision)) fail("PERSISTENCE_NOT_PROVEN");
      });
      await stage("PUBLIC_FINAL", async () => {
        for (const owner of ["b", "a"]) {
          const foreign = owner === "a";
          const files = await publicRead("drive_files", query("id,user_id,payload,storage_path,purged_at", { id: upload, user_id: b.id }), owner); if (files.length !== (foreign ? 0 : 1) || !foreign && (!same(files[0].payload, file) || files[0].storage_path !== path || files[0].purged_at !== null)) fail("OWNERSHIP_REFUSED");
          const captures = await publicRead("captures", query("id,user_id,payload", { id: capture.id, user_id: b.id }), owner); if (captures.length !== (foreign ? 0 : 1) || !foreign && !same(captures[0], { id: capture.id, user_id: b.id, payload: capture })) fail("OWNERSHIP_REFUSED");
          const links = await publicRead("capture_file_links", query("user_id,capture_id,file_id", { capture_id: capture.id, file_id: upload, user_id: b.id }), owner); if (!same(links, foreign ? [] : [{ user_id: b.id, capture_id: capture.id, file_id: upload }])) fail("OWNERSHIP_REFUSED");
          // Public policy exposes capture event metadata only; raw before/after
          // is verified through the internal snapshot, never a broadened GRANT.
          const events = await publicRead("domain_events", query("id,user_id,entity_type,entity_id,action,canal,occurred_at", { entity_id: capture.id, user_id: b.id }), owner);
          const expected = expectedBatch.events[0];
          if (events.length !== (foreign ? 0 : 1) || !foreign && (events[0].id !== expected.id || events[0].entity_type !== "capture" || events[0].entity_id !== capture.id || events[0].user_id !== b.id || events[0].action !== "created" || events[0].canal !== "web" || Date.parse(events[0].occurred_at) !== Date.parse(expected.occurred_at))) fail("PERSISTENCE_NOT_PROVEN");
        }
      });
      await stage("SQL_FINAL", async () => {
        // Caller owns a FIXED READ ONLY local query, not arbitrary SQL accepted
        // by this helper. Its actual namespace/PG17 provenance is a CI duty.
        // Public policy intentionally hides capture_image file events and raw
        // before/after, so those cannot be inferred from a public empty result.
        active(); const ids = Object.freeze({ ownerId: b.id, uploadId: upload, captureId: capture.id });
        if (!Object.values(ids).every(value => typeof value === "string" && UUID.test(value)) || new Set(Object.values(ids)).size !== 3) fail("OWNERSHIP_REFUSED");
        counts.sqlInspections++; const deadline = performance.now() + timeoutMs; let timer, settled = false;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new ImageFailure("DEADLINE_EXCEEDED")), timeoutMs); });
        let inspected;
        try { inspected = await Promise.race([timeout, inspectSql(ids)]); active(); if (settled || performance.now() >= deadline) fail("DEADLINE_EXCEEDED"); }
        finally { settled = true; clearTimeout(timer); }
        const plain = (value, depth = 0) => {
          if (depth > 20) fail("RESPONSE_REFUSED");
          if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || typeof value === "string" && value.length <= 32768) return;
          if (!value || typeof value !== "object") fail("RESPONSE_REFUSED");
          if (Array.isArray(value)) { const keys = Reflect.ownKeys(value); if (value.length > 100 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key))) || keys.length !== value.length + 1) fail("RESPONSE_REFUSED"); for (let i = 0; i < value.length; i++) { const descriptor = Object.getOwnPropertyDescriptor(value, String(i)); if (!descriptor || !Object.hasOwn(descriptor, "value")) fail("RESPONSE_REFUSED"); plain(descriptor.value, depth + 1); } }
          else { if (Object.getPrototypeOf(value) !== Object.prototype) fail("RESPONSE_REFUSED"); for (const key of Reflect.ownKeys(value)) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (typeof key !== "string" || !descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) fail("RESPONSE_REFUSED"); plain(descriptor.value, depth + 1); } }
        };
        plain(inspected); if (Buffer.byteLength(JSON.stringify(inspected)) > CAPTURE_IMAGE_LIMITS.responseBytes) fail("RESPONSE_REFUSED");
        exact(inspected, ["file", "capture", "links", "events", "receipts"], "RESPONSE_REFUSED"); exact(inspected.file, ["id", "user_id", "payload", "storage_path", "purged_at"], "RESPONSE_REFUSED"); exact(inspected.capture, ["id", "user_id", "payload"], "RESPONSE_REFUSED");
        if (!same(inspected.file, { id: upload, user_id: b.id, payload: file, storage_path: path, purged_at: null }) || !same(inspected.capture, { id: capture.id, user_id: b.id, payload: capture }) || !same(inspected.links, [{ user_id: b.id, capture_id: capture.id, file_id: upload }]) || !Array.isArray(inspected.events) || inspected.events.length !== 2 || !Array.isArray(inspected.receipts) || inspected.receipts.length !== 2) fail("PERSISTENCE_NOT_PROVEN");
        const kinds = new Map(inspected.events.map(event => [event.entity_type, event])); if (kinds.size !== 2 || new Set(inspected.events.map(event => event.id)).size !== 2) fail("PERSISTENCE_NOT_PROVEN");
        for (const event of inspected.events) { exact(event, ["id", "user_id", "entity_type", "entity_id", "action", "canal", "occurred_at", "before", "after"], "RESPONSE_REFUSED"); if (!UUID.test(event.id) || event.user_id !== b.id || event.action !== "created" || event.canal !== "web" || event.before !== null || !Number.isFinite(Date.parse(event.occurred_at))) fail("PERSISTENCE_NOT_PROVEN"); }
        const fileEvent = kinds.get("drive_file"), captureEvent = kinds.get("capture");
        if (fileEvent?.entity_id !== upload || !same(fileEvent.after, file) || captureEvent?.entity_id !== capture.id || captureEvent.id !== expectedBatch.events[0].id || !same(captureEvent.after, capture) || Date.parse(captureEvent.occurred_at) !== Date.parse(expectedBatch.events[0].occurred_at)) fail("PERSISTENCE_NOT_PROVEN");
        const expectedReceipts = [{ user_id: b.id, command: "file.upload.finalize", client_id: clientId, result: file }, { user_id: b.id, command: "capture.create", client_id: captureCid, result: capture }];
        for (const receipt of inspected.receipts) exact(receipt, ["user_id", "command", "client_id", "result"], "RESPONSE_REFUSED");
        if (!same([...inspected.receipts].sort((x, y) => x.command.localeCompare(y.command)), expectedReceipts.sort((x, y) => x.command.localeCompare(y.command)))) fail("PERSISTENCE_NOT_PROVEN");
        counts.events = 2; counts.receipts = 2;
      });
      if (!same(counts, CAPTURE_IMAGE_PASS_COUNTS) || unknown) fail("PERSISTENCE_NOT_PROVEN");
      pipeline.status = "passed"; pipeline.code = "PASSED"; pipeline.failurePoint = null; state = "passed";
    } catch (error) { if (pendingCommit && !lastRollback) unknown = true; pipeline.status = "failed"; pipeline.code = error instanceof ImageFailure ? error.message : unknown || error instanceof core.CommitOutcomeUnknown ? "COMMIT_UNCONFIRMED" : "PERSISTENCE_NOT_PROVEN"; if (pipeline.failurePoint !== "PREREQUISITE") pipeline.stages.push({ name: pipeline.failurePoint, passed: false }); state = state === "disposed" ? state : "failed"; }
    finally { permit = null; pipeline.writeOutcomeUncertain = unknown; pipelineReport = freeze(copy(pipeline)); }
    return pipelineReport;
  }
  async function cleanupObjects() {
    if (!["passed", "failed"].includes(state) || cleanupReport) fail("STATE_REFUSED");
    const report = { schemaVersion: 1, scenario: "capture-image-storage-cleanup", status: "failed", code: "STATE_REFUSED", failurePoint: "PREREQUISITE", stages: [], counts: cleanupCounts, exactInventory: false, objectsAbsent: false, authDeletionAllowed: false, writeOutcomeUncertain: unknown };
    if (unknown) { report.code = "WRITE_OUTCOME_UNCERTAIN"; cleanupReport = freeze(copy(report)); return cleanupReport; }
    if (!freshPathsVerified) { report.code = "CLEANUP_NOT_PROVEN"; cleanupReport = freeze(copy(report)); return cleanupReport; }
    state = "cleaning";
    try {
      for (const [index, item] of inventory.entries()) {
        report.failurePoint = CAPTURE_IMAGE_CLEANUP_STAGES[index * 2];
        const removal = await storage(item.bucket, "DELETE", item.bucket, api => api.remove([item.path]), jsonCheck({ prefixes: [item.path] }), false, true);
        if (removal.error || !Array.isArray(removal.data) || removal.data.length !== (item.created ? 1 : 0) || removal.data.some(row => row.name !== item.path || row.bucket_id !== undefined && row.bucket_id !== item.bucket || typeof row.id !== "string" || !UUID.test(row.id) || item.objectId !== null && row.id !== item.objectId)) { unknown = true; fail("CLEANUP_NOT_PROVEN"); }
        item.removed = true; cleanupCounts.removedObjects += removal.data.length; report.stages.push({ name: report.failurePoint, passed: true });
        report.failurePoint = CAPTURE_IMAGE_CLEANUP_STAGES[index * 2 + 1];
        const absent = await storage(item.bucket, "GET", item.bucket + "/" + item.path, api => api.download(item.path), bodyNone, true, false, true);
        // Exact native 404 is mandatory; a 400, fabricated code alone or empty
        // successful download cannot certify absence. CI establishes provenance.
        if (absent.data !== null || absent.error?.status !== 404 || absent.error?.code !== "NoSuchKey") fail("CLEANUP_NOT_PROVEN");
        item.absent = true; report.stages.push({ name: report.failurePoint, passed: true });
      }
      if (unknown || !inventory.every(item => item.removed && item.absent)) fail("CLEANUP_NOT_PROVEN");
      cleanupConfirmed = true; report.exactInventory = true; report.objectsAbsent = true; report.authDeletionAllowed = true; report.status = "passed"; report.code = "PASSED"; report.failurePoint = null;
    } catch (error) { report.code = error instanceof ImageFailure ? error.message : "CLEANUP_NOT_PROVEN"; if (report.failurePoint !== "PREREQUISITE") report.stages.push({ name: report.failurePoint, passed: false }); }
    finally { permit = null; report.writeOutcomeUncertain = unknown; cleanupReport = freeze(copy(report)); if (state !== "disposed") state = pipelineReport.status === "passed" ? "passed" : "failed"; }
    return cleanupReport;
  }
  const metadata = () => Object.freeze({ state, pipelinePassed: pipelineReport?.status === "passed", objectsCleanupConfirmed: cleanupConfirmed, writeOutcomeUncertain: unknown, authDeletionAllowed: cleanupConfirmed && !unknown && state !== "disposed", moduleCount: new Set([...coreModules, ...modules]).size });
  function dispose() { if (state === "disposed") return; state = "disposed"; permit = null; for (const controller of pendingControllers) controller.abort(); for (const bytes of buffers) bytes.fill(0); buffers.clear(); a = null; b = null; pub = null; secret = null; stagingBytes = null; finalBytes = null; signedUrl = null; signedToken = null; file = null; capture = null; baseline = null; expectedBatch = null; }
  return Object.freeze({ run, cleanupObjects, metadata, dispose });
}
