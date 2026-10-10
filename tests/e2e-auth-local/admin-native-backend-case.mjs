// Original Admin Core/ports/HMAC/SDK, caller-owned fixed local SQL and finite
// HTTP transport. This protocol never claims a native service or browser PASS.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  ADMIN_NATIVE_MANIFEST, ADMIN_NATIVE_CASES, ADMIN_NATIVE_STAGES, ADMIN_NATIVE_CHECKS,
  ADMIN_NATIVE_FAILURE_CODES, ADMIN_NATIVE_LIMITS, ADMIN_NATIVE_PASS_COUNTS,
  ADMIN_NATIVE_CLEANUP_STAGES, ADMIN_NATIVE_CLEANUP_COUNTS, ADMIN_NATIVE_SQL_QUERIES,
  validateAdminNativeReport, validateAdminNativeCleanup,
} from "./admin-native-backend-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = "tests/e2e-auth-local/admin-native-backend.entry.ts";
export const ADMIN_NATIVE_API = "http://127.0.0.1:54321";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NAMESPACE = /^sc-admin-native-[a-f0-9]{32}$/;
const MARKER = "sc_admin_native_fixture";
const SQL_ROLLBACK = new Set(["42501", "23505", "40001", "40P01", "22023", "23514", "23503", "22P02", "PT429"]);
const ADMIN_RPCS = new Set(["admin_snapshot", "admin_reserve", "admin_claim", "admin_operation_guard", "admin_transition", "admin_complete"]);
export const ADMIN_NATIVE_MODULES = Object.freeze([
  "node_modules/@supabase/auth-js/dist/main/AuthAdminApi.js", "node_modules/@supabase/auth-js/dist/main/AuthClient.js", "node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.js", "node_modules/@supabase/auth-js/dist/main/GoTrueClient.js", "node_modules/@supabase/auth-js/dist/main/index.js",
  ...["base64url", "constants", "errors", "fetch", "helpers", "local-storage", "locks", "polyfills", "types", "version", "webauthn.errors", "webauthn"].map(name => "node_modules/@supabase/auth-js/dist/main/lib/" + name + ".js"),
  "node_modules/@supabase/auth-js/dist/main/lib/web3/ethereum.js",
  ...["FunctionsClient", "helper", "index", "types"].map(name => "node_modules/@supabase/functions-js/dist/main/" + name + ".js"),
  "node_modules/@supabase/phoenix/priv/static/phoenix.mjs", "node_modules/@supabase/postgrest-js/dist/index.mjs",
  ...["RealtimeChannel", "RealtimeClient", "RealtimePostgresFilterBuilder", "RealtimePresence", "index"].map(name => "node_modules/@supabase/realtime-js/dist/main/" + name + ".js"),
  ...["constants", "normalizeChannelError", "serializer", "transformers", "version", "websocket-factory"].map(name => "node_modules/@supabase/realtime-js/dist/main/lib/" + name + ".js"),
  ...["channelAdapter", "presenceAdapter", "socketAdapter"].map(name => "node_modules/@supabase/realtime-js/dist/main/phoenix/" + name + ".js"),
  "node_modules/@supabase/storage-js/dist/index.mjs", "node_modules/@supabase/supabase-js/dist/index.mjs", "node_modules/@supabase/supabase-js/dist/tracingRegistry.mjs", "node_modules/iceberg-js/dist/index.mjs", "node_modules/server-only/empty.js", "node_modules/tslib/modules/index.js", "node_modules/tslib/tslib.js",
  "src/adapters/db/admin-runtime.ts", "src/core/access/resolve-access.ts", "src/core/admin/index.ts", "src/core/contracts/base.ts", "src/core/contracts/index.ts", "src/core/contracts/modules.ts", "src/core/contracts/unit-of-work.ts", "src/lib/auth/types.ts", ENTRY,
]);
class NativeFailure extends Error {
  constructor(code) { super(code); this.name = "NativeFailure"; this.stack = "NativeFailure: " + code; }
}
const fail = code => { throw new NativeFailure(ADMIN_NATIVE_FAILURE_CODES.includes(code) ? code : "RESPONSE_REFUSED"); };
const hash = value => createHash("sha256").update(value).digest("hex");
const stable = value => { if (value && typeof value === "object" && Object.getPrototypeOf(value) !== (Array.isArray(value) ? Array.prototype : Object.prototype)) fail("RESPONSE_REFUSED"); return Array.isArray(value) ? "[" + value.map(stable).join(",") + "]" : value && typeof value === "object" ? "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}" : JSON.stringify(value); };
const same = (a, b) => stable(a) === stable(b);
const canonical = path => path.replaceAll("\\", "/");
const clone = value => { try { return structuredClone(value); } catch { fail("RESPONSE_REFUSED"); } };
function fields(value, keys, code = "SETUP_REFUSED") {
  try {
    if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
    const d = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(d);
    if (names.length !== keys.length || names.some(name => typeof name !== "string" || !keys.includes(name)) || keys.some(name => !d[name] || !Object.hasOwn(d[name], "value") || !d[name].enumerable)) fail(code);
    return Object.fromEntries(keys.map(name => [name, d[name].value]));
  } catch { fail(code); }
}
let productPromise;
export async function loadAdminNativeBackend() {
  productPromise ??= (async () => {
    const marker = JSON.parse(await readFile(resolve(ROOT, "node_modules/server-only/package.json"), "utf8")), sdk = JSON.parse(await readFile(resolve(ROOT, "node_modules/@supabase/supabase-js/package.json"), "utf8")), lock = JSON.parse(await readFile(resolve(ROOT, "package-lock.json"), "utf8"));
    if (marker.name !== "server-only" || marker.version !== "0.0.1" || marker.exports?.["."]?.["react-server"] !== "./empty.js" || hash(await readFile(resolve(ROOT, "node_modules/server-only/empty.js"))) !== "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" || sdk.name !== "@supabase/supabase-js" || sdk.version !== "2.117.2" || lock.packages?.["node_modules/@supabase/supabase-js"]?.version !== sdk.version || lock.packages?.["node_modules/server-only"]?.version !== marker.version) fail("GRAPH_REFUSED");
    const modules = new Set(), { rolldown } = await import("rolldown");
    const build = await rolldown({ input: resolve(ROOT, ENTRY), platform: "node", tsconfig: false, logLevel: "silent", resolve: { conditionNames: ["react-server", "node", "import", "default"] }, plugins: [{ name: "closed-original-admin-graph", async moduleParsed(info) {
      const name = canonical(relative(ROOT, info.id));
      if (canonical(await realpath(info.id)) !== canonical(info.id) || info.dynamicallyImportedIds.length || !ADMIN_NATIVE_MODULES.includes(name)) fail("GRAPH_REFUSED"); modules.add(name);
    } }] });
    try {
      const { output } = await build.generate({ format: "es", codeSplitting: false, sourcemap: false }), chunk = output[0];
      if (modules.size !== ADMIN_NATIVE_MODULES.length || output.length !== 1 || chunk.type !== "chunk" || chunk.dynamicImports.length || !same([...chunk.imports].sort(), ["node:crypto", "node:module"].sort()) || Buffer.byteLength(chunk.code) > 1048576) fail("GRAPH_REFUSED");
      const product = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64"));
      if (!same(Object.keys(product).sort(), ["AdminAuthUncertainError", "adminCommitment", "createAdminAuthPort", "createAdminPort", "createClient", "decodeAdminCommand", "executeAdminCommand", "preserveUsableMaster", "usableMaster"].sort()) || Object.values(product).some(value => typeof value !== "function")) fail("GRAPH_REFUSED");
      return Object.freeze({ product, modules: Object.freeze([...modules].sort()) });
    } finally { await build.close(); }
  })().catch(() => fail("GRAPH_REFUSED"));
  return productPromise;
}
function actor(value) {
  const a = fields(value, ["id", "sessionId", "accessToken", "expiresAt", "email"]);
  if (typeof a.id !== "string" || typeof a.sessionId !== "string" || !UUID.test(a.id) || !UUID.test(a.sessionId) || typeof a.email !== "string" || !/^[a-z0-9-]+@example\.invalid$/.test(a.email) || typeof a.accessToken !== "string" || a.accessToken.length > 32768 || !Number.isSafeInteger(a.expiresAt)) fail("SETUP_REFUSED");
  try { const parts = a.accessToken.split("."); if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) fail("SETUP_REFUSED"); const bytes = Buffer.from(parts[1], "base64url"); try { const hint = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); if (bytes.toString("base64url") !== parts[1] || hint.sub !== a.id || hint.session_id !== a.sessionId || hint.role !== "authenticated" || hint.exp * 1000 !== a.expiresAt) fail("SETUP_REFUSED"); } finally { bytes.fill(0); } } catch { fail("SETUP_REFUSED"); }
  return a;
}
/** Caller first creates/verifies A/B and bootstraps only its isolated A. JWT
 * hints are not authentication; this case repeats real SDK/access/SQL binding. */
export async function createAdminNativeBackendAcceptance(context, options) {
  const c = fields(context, ["case", "sourceSha", "publishableKey", "serverSecretKey", "commitmentSecret", "runtime", "a", "b"]), runtime = fields(c.runtime, ["ci", "githubActions", "localAdminRun", "supabaseUrl", "namespace", "systemIdentifier"]);
  const o = fields(options, Object.getOwnPropertyDescriptor(options ?? {}, "timeoutMs") ? ["transport", "inspectSql", "timeoutMs"] : ["transport", "inspectSql"]);
  if (!ADMIN_NATIVE_CASES.includes(c.case) || typeof c.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(c.sourceSha) || runtime.ci !== true || runtime.githubActions !== true || runtime.localAdminRun !== true || runtime.supabaseUrl !== ADMIN_NATIVE_API || typeof runtime.namespace !== "string" || !NAMESPACE.test(runtime.namespace) || typeof runtime.systemIdentifier !== "string" || !/^[0-9]{16,20}$/.test(runtime.systemIdentifier) || typeof c.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(c.publishableKey) || typeof c.serverSecretKey !== "string" || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(c.serverSecretKey) || typeof c.commitmentSecret !== "string" || Buffer.byteLength(c.commitmentSecret) < 32 || c.commitmentSecret === c.serverSecretKey || typeof o.transport !== "function" || typeof o.inspectSql !== "function") fail("SETUP_REFUSED");
  const timeoutMs = o.timeoutMs ?? ADMIN_NATIVE_LIMITS.timeoutMs; if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > ADMIN_NATIVE_LIMITS.timeoutMs) fail("SETUP_REFUSED");
  let a = actor(c.a), b = actor(c.b), created = null, pub = c.publishableKey, secret = c.serverSecretKey;
  if (a.id === b.id || a.sessionId === b.sessionId || a.accessToken === b.accessToken || a.email === b.email) fail("OWNERSHIP_REFUSED");
  const { product: p, modules } = await loadAdminNativeBackend();
  const sourceHashes = await Promise.all(ADMIN_NATIVE_MANIFEST.map(async path => { const bytes = await readFile(resolve(ROOT, path)); if (!bytes.length || bytes.length > ADMIN_NATIVE_LIMITS.sourceBytes) fail("GRAPH_REFUSED"); return { path, sha256: hash(bytes), bytes: bytes.length }; }));
  const execution = randomUUID(), clientId = randomUUID(), temporaryEmail = "admin-created-" + randomBytes(16).toString("hex") + "@example.invalid";
  let temporaryPassword = randomBytes(24).toString("base64url") + "-Aa1!";
  const config = { mode: "supabase", appOrigin: ADMIN_NATIVE_API, supabaseUrl: ADMIN_NATIVE_API, publishableKey: pub, secretKey: secret, stateSecret: "synthetic-admin-local-state-closure", rateLimitSecret: "synthetic-admin-local-rate-closure", secureCookies: false };
  const commit = p.adminCommitment(config, { ADMIN_COMMAND_SECRET: c.commitmentSecret });
  const counts = Object.fromEntries(Object.keys(ADMIN_NATIVE_PASS_COUNTS[c.case]).map(key => [key, 0])), cleanupCounts = Object.fromEntries(Object.keys(ADMIN_NATIVE_CLEANUP_COUNTS[c.case]).map(key => [key, 0]));
  const stages = [], cleanupStages = [], controllers = new Set();
  let state = "prepared", unknown = false, terminalKnown = false, createdVerified = false, cleaned = false, cleanupStarted = false, permit = null, pendingRequests = 0, pendingInspections = 0, pendingWrites = 0, firstFailureCode = null, lastTransportFailure = null, lastSqlCode = null, currentOperation = null, baseline = null, terminal = null, pipelineReport = null, failurePoint = "PREREQUISITE", cleanupPoint = "PREREQUISITE";
  const live = () => { if (!a || !b || a.expiresAt <= Date.now() + 60000 || b.expiresAt <= Date.now() + 60000 || created && created.expiresAt <= Date.now() + 60000) fail("TOKEN_LIFETIME_REFUSED"); };
  const active = () => { if (!["running", "cleaning"].includes(state)) fail("STATE_REFUSED"); live(); };
  const owners = () => [a, b, created].filter(Boolean);
  const target = () => c.case === "CREATE_FORCED" ? currentOperation?.target_user_id ?? null : b.id;
  function allow(slot) { active(); if (permit) fail("STATE_REFUSED"); permit = slot; lastTransportFailure = null; lastSqlCode = null; }
  function body(expected) { return value => { if (typeof value !== "string" || Buffer.byteLength(value) > 4096) fail("TRANSPORT_REFUSED"); let parsed; try { parsed = JSON.parse(value); } catch { fail("TRANSPORT_REFUSED"); } if (!same(parsed, expected)) fail("TRANSPORT_REFUSED"); }; }
  async function finiteFetch(input, init = {}) {
    active(); const slot = permit; permit = null; if (!slot) fail("TRANSPORT_REFUSED");
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : null, headers = new Headers(init.headers);
    if (url !== slot.url || (init.method ?? "GET") !== slot.method || init.signal?.aborted || [...headers.keys()].some(key => !["apikey", "authorization", "x-client-info", "x-supabase-api-version", "content-type", "accept-profile", "content-profile", "prefer"].includes(key)) || ["accept-profile", "content-profile"].some(key => headers.has(key) && headers.get(key) !== "public")) fail("TRANSPORT_REFUSED");
    // The installed original GoTrue request helper adds this exact API version.
    if (slot.url.startsWith(ADMIN_NATIVE_API + "/auth/") ? headers.get("x-supabase-api-version") !== "2024-01-01" : headers.has("x-supabase-api-version")) fail("TRANSPORT_REFUSED");
    const owner = slot.owner, privileged = owner === "server", key = privileged ? secret : pub, token = slot.authToken ?? (privileged ? secret : owner.accessToken);
    if (slot.authToken !== undefined && (!slot.logout || !owners().some(owner => owner.accessToken === slot.authToken))) fail("OWNERSHIP_REFUSED");
    if (headers.get("apikey") !== key || headers.get("authorization") !== "Bearer " + token) fail("OWNERSHIP_REFUSED");
    slot.check(init.body, headers);
    const counters = state === "cleaning" ? cleanupCounts : counts, limit = state === "cleaning" ? ADMIN_NATIVE_LIMITS.cleanupRequests : ADMIN_NATIVE_LIMITS.requests;
    if (counters.requests >= limit) fail("CALL_LIMIT_REFUSED"); counters.requests++; counters[slot.kind]++;
    const controller = new AbortController(), deadline = performance.now() + timeoutMs; controllers.add(controller); pendingRequests++; if (slot.write) pendingWrites++;
    let timer, reader, ended = false; const pieces = []; let bytes = 0;
    const check = () => { active(); if (ended || controller.signal.aborted || performance.now() >= deadline) fail("DEADLINE_EXCEEDED"); };
    try {
      return await Promise.race([new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new NativeFailure("DEADLINE_EXCEEDED")); }, timeoutMs); }), (async () => {
        const response = await o.transport(url, { method: slot.method, headers: Object.freeze(Object.fromEntries(headers)), ...(init.body === undefined ? {} : { body: init.body }), signal: controller.signal, redirect: "error", cache: "no-store", credentials: "omit" }); check();
        if (!(response instanceof Response) || response.redirected || response.url && response.url !== url) fail("RESPONSE_REFUSED");
        if (slot.logout) { if (response.status !== 204 || response.body !== null) fail("RESPONSE_REFUSED"); return new Response(null, { status: 204 }); }
        if (!response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) fail("RESPONSE_REFUSED");
        const length = response.headers.get("content-length"); if (length && (!/^\d+$/.test(length) || Number(length) > ADMIN_NATIVE_LIMITS.responseBytes)) fail("RESPONSE_REFUSED");
        reader = response.body.getReader(); for (;;) { check(); const part = await reader.read(); check(); if (part.done) break; if (!(part.value instanceof Uint8Array) || bytes + part.value.length > ADMIN_NATIVE_LIMITS.responseBytes) fail("RESPONSE_REFUSED"); pieces.push(part.value.slice()); bytes += part.value.length; }
        const buffer = Buffer.concat(pieces, bytes); let value; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); } finally { buffer.fill(0); }
        if (!response.ok) {
          lastSqlCode = typeof value?.code === "string" ? value.code : null;
          if (slot.write && !(slot.sql && [400, 403, 409, 422, 429].includes(response.status) && SQL_ROLLBACK.has(lastSqlCode)) && !(slot.authWrite && response.status >= 400 && response.status < 500)) unknown = true;
        }
        const apiVersion = response.headers.get("x-supabase-api-version"); if (apiVersion !== null && apiVersion !== "2024-01-01") fail("RESPONSE_REFUSED");
        // Preserve the genuine bounded API-version header. The original SDK
        // uses it to interpret an Auth error's code; do not fabricate one.
        check(); return Response.json(value, { status: response.status, headers: apiVersion === null ? undefined : { "X-Supabase-Api-Version": apiVersion } });
      })().finally(() => { controllers.delete(controller); pendingRequests--; if (slot.write) pendingWrites--; })]);
    } catch (error) { if (slot.write) unknown = true; lastTransportFailure = error instanceof NativeFailure ? error.message : "TRANSPORT_FAILED"; firstFailureCode ??= lastTransportFailure; fail(lastTransportFailure); }
    // A caller may ignore abort. Keep its owned operation pending until the
    // actual transport/body promise settles; a deadline is not quiescence.
    finally { ended = true; clearTimeout(timer); controller.abort(); for (const piece of pieces) piece.fill(0); if (reader) void reader.cancel().catch(() => undefined); }
  }
  const sdkFetch = (input, init) => finiteFetch(input, init).catch(error => { lastTransportFailure = error instanceof NativeFailure ? error.message : "TRANSPORT_FAILED"; throw error; });
  const settings = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch: sdkFetch } };
  const server = p.createClient(ADMIN_NATIVE_API, secret, settings);
  const client = owner => p.createClient(ADMIN_NATIVE_API, pub, { ...settings, global: { fetch: sdkFetch, headers: { Authorization: "Bearer " + owner.accessToken } } });
  const clients = new Map([[a.id, client(a)], [b.id, client(b)]]);
  const takeFailure = () => { if (lastTransportFailure) fail(lastTransportFailure); if (permit) fail("TRANSPORT_REFUSED"); };
  async function sql(query) {
    active(); if (!ADMIN_NATIVE_SQL_QUERIES.includes(query)) fail("SQL_REFUSED");
    const controller = new AbortController(); controllers.add(controller); pendingInspections++; const counters = state === "cleaning" ? cleanupCounts : counts; counters.sqlInspections++;
    let timer, ended = false; const deadline = performance.now() + timeoutMs;
    try {
      const request = Object.freeze({ query, case: c.case, sourceSha: c.sourceSha, namespace: runtime.namespace, systemIdentifier: runtime.systemIdentifier, actorId: a.id, targetId: target(), executionId: execution, operationId: currentOperation?.operation_id ?? null, signal: controller.signal });
      const inspected = Promise.resolve().then(() => o.inspectSql(request)).finally(() => { controllers.delete(controller); pendingInspections--; });
      const result = await Promise.race([inspected, new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new NativeFailure("DEADLINE_EXCEEDED")); }, timeoutMs); })]);
      active(); if (ended || controller.signal.aborted || performance.now() >= deadline) fail("DEADLINE_EXCEEDED"); const proof = clone(result);
      fields(proof, ["provenance", "users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "operations", "audit", "receipts", "events", "usableMasters", "preserveSqlState", "personalRows"], "SQL_REFUSED");
      const origin = fields(proof.provenance, ["namespace", "sourceSha", "systemIdentifier", "database", "currentUser", "serverVersion", "markerRows"], "SQL_REFUSED");
      if (origin.namespace !== runtime.namespace || origin.sourceSha !== c.sourceSha || origin.systemIdentifier !== runtime.systemIdentifier || origin.database !== "postgres" || origin.currentUser !== "postgres" || !Number.isInteger(origin.serverVersion) || origin.serverVersion < 170000 || origin.serverVersion >= 180000 || !same(origin.markerRows, [{ namespace: runtime.namespace, sourceSha: c.sourceSha, systemIdentifier: runtime.systemIdentifier }]) || proof.personalRows !== 0 || ![null, "23514"].includes(proof.preserveSqlState)) fail("SQL_REFUSED");
      for (const name of ["users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "operations", "audit", "receipts", "events", "usableMasters"]) if (!Array.isArray(proof[name]) || proof[name].length > 128) fail("SQL_REFUSED");
      const userIds = proof.users.map(user => user.id), allowedIds = [a.id, b.id, ...(currentOperation?.command === "admin.user.create" ? [currentOperation.target_user_id] : [])];
      if (new Set(userIds).size !== userIds.length || userIds.some(id => !allowedIds.includes(id)) || proof.sessions.some(row => !allowedIds.includes(row.user_id) || !UUID.test(row.id)) || proof.refreshTokens.some(row => !allowedIds.includes(row.user_id)) || proof.operations.some(row => row.actor_user_id !== a.id || row.target_user_id !== target() || !UUID.test(row.operation_id)) || proof.audit.some(row => row.actor_user_id !== a.id || row.target_user_id !== target())) fail("OWNERSHIP_REFUSED");
      if ([...proof.roles, ...proof.moderation, ...proof.entitlements, ...proof.receipts, ...proof.events].some(row => !allowedIds.includes(row.user_id)) || proof.usableMasters.some(id => !allowedIds.includes(id)) || proof.events.some(row => !UUID.test(row.id) || row.entity_id !== row.user_id)) fail("OWNERSHIP_REFUSED");
      return proof;
    } catch (error) { firstFailureCode ??= error instanceof NativeFailure ? error.message : "SQL_REFUSED"; if (error instanceof NativeFailure) throw error; fail("SQL_REFUSED"); }
    finally { ended = true; clearTimeout(timer); controller.abort(); }
  }
  const userMatches = (user, owner) => !!user && user.id === owner.id && user.email === owner.email && user.role === "authenticated" && user.is_anonymous === false && (owner === created ? user.app_metadata?.sc_admin_operation === currentOperation?.operation_id : user.app_metadata?.[MARKER] === runtime.namespace);
  async function getOwn(owner) {
    allow({ url: ADMIN_NATIVE_API + "/auth/v1/user", method: "GET", owner, kind: "authReadRequests", check: value => { if (value !== undefined) fail("TRANSPORT_REFUSED"); } });
    const response = await clients.get(owner.id).auth.getUser(owner.accessToken); takeFailure(); if (response.error || !userMatches(response.data.user, owner)) fail("AUTH_NOT_PROVEN");
  }
  async function access(owner, expectedRole) {
    allow({ url: ADMIN_NATIVE_API + "/rest/v1/rpc/my_access_state", method: "POST", owner, kind: "otherRpcRequests", check: value => { if (value !== undefined && !same(JSON.parse(value), {})) fail("TRANSPORT_REFUSED"); } });
    const response = await clients.get(owner.id).rpc("my_access_state"); takeFailure();
    const expected = expectedRole === "forced" ? { user_id: owner.id, must_change_password: true } : { user_id: owner.id, role: expectedRole, must_change_password: false, entitlements: {} };
    if (response.error || !same(response.data, expected)) fail("AUTH_NOT_PROVEN"); return expectedRole === "forced" ? null : { userId: owner.id, sessionId: owner.sessionId, role: expectedRole, mustChangePassword: false, entitlements: {} };
  }
  async function protectedRead(owner, denied) {
    const args = { p_user: owner.id, p_session: owner.sessionId, p_operation: "read.captures" };
    allow({ url: ADMIN_NATIVE_API + "/rest/v1/rpc/capture_task_snapshot", method: "POST", owner: "server", kind: "otherRpcRequests", sql: true, check: body(args) });
    const response = await server.rpc("capture_task_snapshot", args); takeFailure();
    if (denied ? response.error?.code !== "42501" || lastSqlCode !== "42501" : response.error !== null || !response.data || !Array.isArray(response.data.captures) || ["captures", "tasks", "categories", "projects", "events", "receipts", "readonlyCaptureIds"].some(key => !Array.isArray(response.data[key]) || response.data[key].length)) fail("PERSISTENCE_NOT_PROVEN");
  }
  function operationProof(proof, operation, phase) {
    const row = proof.operations.find(row => row.operation_id === operation.operation_id);
    if (!row || row.actor_user_id !== a.id || row.target_user_id !== operation.target_user_id || row.command !== operation.command || row.client_id !== operation.client_id || row.phase !== phase || row.commitment !== commit(commandFor(operation)) || (phase === "complete" ? row.active_execution !== null : row.active_execution !== execution)) fail("PERSISTENCE_NOT_PROVEN");
    return row;
  }
  const commandFor = operation => operation.command === "admin.user.create" ? { command: operation.command, input: { client_id: operation.client_id, email: temporaryEmail, temporary_password: temporaryPassword } } : operation.command === "admin.user.role" ? { command: operation.command, input: { client_id: operation.client_id, target_user_id: operation.target_user_id, role: operation.role } } : { command: operation.command, input: { client_id: operation.client_id, target_user_id: operation.target_user_id } };
  function moderation(proof, id) { return proof.moderation.find(row => row.user_id === id); }
  function banned(proof, id) { const user = proof.users.find(row => row.id === id); return !!user && !!user.banned_until && Date.parse(user.banned_until) > Date.now(); }
  function noSessions(proof, id) { return !proof.sessions.some(row => row.user_id === id) && !proof.refreshTokens.some(row => row.user_id === id); }
  function unchanged(before, after) { if (!same(before, after)) fail("PERSISTENCE_NOT_PROVEN"); }
  function passedStage(name) { if (ADMIN_NATIVE_STAGES[c.case][stages.length] !== name) fail("STATE_REFUSED"); stages.push({ name, passed: true }); failurePoint = ADMIN_NATIVE_STAGES[c.case][stages.length] ?? "SQL_FINAL"; }
  async function stage(name, run) { failurePoint = name; await run(); passedStage(name); }
  let identity, port;
  async function adminRpc(name, args) {
    active(); if (!ADMIN_RPCS.has(name) || args.p_actor !== a.id || args.p_session !== a.sessionId || name !== "admin_snapshot" && args.p_execution !== execution || name !== "admin_snapshot" && name !== "admin_reserve" && args.p_operation !== currentOperation?.operation_id) fail("OWNERSHIP_REFUSED");
    allow({ url: ADMIN_NATIVE_API + "/rest/v1/rpc/" + name, method: "POST", owner: "server", kind: "adminRpcRequests", sql: true, write: ["admin_reserve", "admin_claim", "admin_transition", "admin_complete"].includes(name), check: body(args) });
    const response = await server.rpc(name, args); takeFailure(); return response;
  }
  const observedAdmin = {
    async getUserById(id) {
      if (id !== target()) fail("OWNERSHIP_REFUSED"); allow({ url: ADMIN_NATIVE_API + "/auth/v1/admin/users/" + id, method: "GET", owner: "server", kind: "authReadRequests", check: value => { if (value !== undefined) fail("TRANSPORT_REFUSED"); } }); const response = await server.auth.admin.getUserById(id); takeFailure(); return response;
    },
    async createUser(value) {
      if (unknown || c.case !== "CREATE_FORCED" || !currentOperation || !same(value, { id: target(), email: temporaryEmail, password: temporaryPassword, email_confirm: true, ban_duration: "876000h", app_metadata: { sc_admin_operation: currentOperation.operation_id } })) fail("OWNERSHIP_REFUSED");
      await stage("FENCE", async () => { const proof = await sql("FENCE"); operationProof(proof, currentOperation, "reserved"); if (proof.users.some(user => user.id === target())) fail("PERSISTENCE_NOT_PROVEN"); });
      allow({ url: ADMIN_NATIVE_API + "/auth/v1/admin/users", method: "POST", owner: "server", kind: "authMutationRequests", write: true, authWrite: true, check: body(value) }); const response = await server.auth.admin.createUser(value); takeFailure();
      if (!response.error && response.data.user?.id === target() && response.data.user.app_metadata?.sc_admin_operation === currentOperation.operation_id) {
        counts.authEffects++; await stage("CREATED_FENCE", async () => { const proof = await sql("CREATED_FENCE"); operationProof(proof, currentOperation, "reserved"); const mod = moderation(proof, target()), user = proof.users.find(row => row.id === target()); if (!banned(proof, target()) || !mod || mod.status !== "blocked" || mod.must_change_password !== true || user?.app_metadata.sc_admin_operation !== currentOperation.operation_id || !noSessions(proof, target())) fail("PERSISTENCE_NOT_PROVEN"); });
      } else if (!response.error) unknown = true;
      return response;
    },
    async updateUserById(id, value) {
      if (unknown || id !== target() || !same(value, { ban_duration: c.case === "BLOCK_OLD_JWT" ? "876000h" : "none" })) fail("OWNERSHIP_REFUSED");
      if (c.case === "BLOCK_OLD_JWT") await stage("FENCE", async () => { const proof = await sql("FENCE"); operationProof(proof, currentOperation, "reserved"); const mod = moderation(proof, id); if (!mod || mod.status !== "blocked" || noSessions(proof, id)) fail("PERSISTENCE_NOT_PROVEN"); });
      allow({ url: ADMIN_NATIVE_API + "/auth/v1/admin/users/" + id, method: "PUT", owner: "server", kind: "authMutationRequests", write: true, authWrite: true, check: body(value) }); const response = await server.auth.admin.updateUserById(id, value); takeFailure(); if (!response.error && response.data.user?.id === id) counts.authEffects++; else if (!response.error) unknown = true; return response;
    },
  };
  async function execute(request) {
    counts.coreCommands++; const response = await p.executeAdminCommand(port, p.createAdminAuthPort(port, { auth: { admin: observedAdmin } }), commit, request); live(); return response;
  }
  async function baselineProof() {
    await getOwn(a); identity = await access(a, "master"); await getOwn(b); await access(b, "user"); if (c.case === "BLOCK_OLD_JWT") await protectedRead(b, false);
    baseline = await sql("BASELINE");
    if (!same(baseline.users.map(user => user.id).sort(), [a.id, b.id].sort()) || !same(baseline.sessions.map(row => [row.user_id, row.id]).sort(), [[a.id, a.sessionId], [b.id, b.sessionId]].sort()) || !same(baseline.usableMasters, [a.id]) || baseline.operations.length || baseline.audit.length || baseline.receipts.length || baseline.entitlements.length || owners().some(owner => { const user = baseline.users.find(user => user.id === owner.id), mod = moderation(baseline, owner.id); return !user || user.email !== owner.email || user.app_metadata[MARKER] !== runtime.namespace || user.deleted_at !== null || user.is_anonymous !== false || banned(baseline, owner.id) || !mod || mod.status !== "active" || mod.must_change_password; })) fail("PERSISTENCE_NOT_PROVEN");
    const original = p.createAdminPort(identity, adminRpc, execution);
    port = { ...original, async reserve(intent) { const operation = await original.reserve(intent); currentOperation = clone(operation); return operation; } };
  }
  function terminalProof(proof, operation) {
    operationProof(proof, operation, "complete"); if (proof.operations.some(row => row.phase !== "complete" || row.active_execution !== null) || !noSessions(proof, operation.target_user_id)) fail("SAGA_NOT_TERMINAL");
    const mod = moderation(proof, operation.target_user_id); if (!mod || mod.status !== (operation.command === "admin.user.block" ? "blocked" : "active") || mod.must_change_password !== (operation.command === "admin.user.create") || banned(proof, operation.target_user_id) !== (operation.command === "admin.user.block")) fail("PERSISTENCE_NOT_PROVEN");
    terminalKnown = true;
  }
  function eventMatches(event, userId, entityType, action, canal, before, after) {
    return event.user_id === userId && event.entity_id === userId && event.entity_type === entityType && event.action === action && event.canal === canal && same(event.before, before) && same(event.after, after);
  }
  function exactEventLedger(proof) {
    const delta = proof.events.filter(row => !baseline.events.some(old => old.id === row.id)), used = new Set();
    const requireEvent = predicate => { const matches = delta.filter(predicate); if (matches.length !== 1 || used.has(matches[0].id)) fail("PERSISTENCE_NOT_PROVEN"); used.add(matches[0].id); };
    for (const audit of proof.audit) requireEvent(event => eventMatches(event, a.id, "authentication", "updated", "web", null, { operation: "admin_operation", operation_id: audit.operation_id, target_user_id: audit.target_user_id, action: audit.action, phase: audit.phase }) && Date.parse(event.occurred_at) === Date.parse(audit.occurred_at));
    if (c.case === "BLOCK_OLD_JWT") {
      const active = { user_id: b.id, status: "active", must_change_password: false }, blocked = { ...active, status: "blocked" };
      requireEvent(event => eventMatches(event, b.id, "moderation", "status_changed", "web", active, blocked));
      requireEvent(event => eventMatches(event, b.id, "moderation", "status_changed", "web", blocked, blocked));
    } else if (c.case === "SELF_AND_LAST_MASTER") {
      requireEvent(event => eventMatches(event, b.id, "role", "updated", "web", { user_id: b.id, role: "user" }, { user_id: b.id, role: "master" }));
      requireEvent(event => eventMatches(event, b.id, "role", "updated", "web", { user_id: b.id, role: "master" }, { user_id: b.id, role: "user" }));
    } else {
      const id = target(), blocked = { user_id: id, status: "blocked", must_change_password: true }, active = { ...blocked, status: "active" };
      requireEvent(event => eventMatches(event, id, "moderation", "status_changed", "api", null, blocked));
      requireEvent(event => eventMatches(event, id, "moderation", "status_changed", "web", blocked, active));
      // Canonical provision_user emits four default identity events. Compare
      // every allowed field, including the profile's later avatar_file_id.
      const stamp = event => Number.isFinite(Date.parse(event.occurred_at));
      requireEvent(event => { const after = event.after, time = after?.created_at; return stamp(event) && eventMatches(event, id, "profile", "created", "api", null, { user_id: id, display_name: null, avatar_url: null, avatar_file_id: null, timezone: "America/Sao_Paulo", locale: "pt-BR", created_at: time, updated_at: time }) && Date.parse(time) === Date.parse(event.occurred_at); });
      requireEvent(event => { const after = event.after, time = after?.created_at; return stamp(event) && eventMatches(event, id, "preference", "created", "api", null, { user_id: id, theme: "system", week_starts_on: 1, default_calendar_view: "week", values_hidden: false, meeting_reminders_enabled: true, meeting_reminder_minutes: 10, created_at: time, updated_at: time }) && Date.parse(time) === Date.parse(event.occurred_at); });
      requireEvent(event => { const time = event.after?.granted_at; return stamp(event) && eventMatches(event, id, "role", "created", "api", null, { user_id: id, role: "user", granted_by: null, granted_at: time }) && Date.parse(time) === Date.parse(event.occurred_at); });
      requireEvent(event => { const time = event.after?.changed_at; return stamp(event) && eventMatches(event, id, "moderation", "created", "api", null, { user_id: id, status: "active", must_change_password: false, changed_by: null, changed_at: time }) && Date.parse(time) === Date.parse(event.occurred_at); });
    }
    if (used.size !== delta.length) fail("PERSISTENCE_NOT_PROVEN");
  }
  function finalMetadata(proof) {
    const maximum = ADMIN_NATIVE_PASS_COUNTS[c.case], expectedPhases = c.case === "SELF_AND_LAST_MASTER" ? ["complete", "complete"] : ["reserved", "auth_applied", "revoked", "complete"];
    if (proof.operations.length !== maximum.operations || proof.audit.length !== maximum.auditEntries || proof.receipts.length !== maximum.receipts || !same(proof.audit.map(row => row.phase), expectedPhases) || proof.events.length - baseline.events.length !== maximum.events || proof.operations.some(op => op.phase !== "complete" || op.active_execution !== null)) fail("PERSISTENCE_NOT_PROVEN");
    const retained = proof.events.filter(row => baseline.events.some(old => old.id === row.id)); if (!same(retained, baseline.events)) fail("PERSISTENCE_NOT_PROVEN");
    exactEventLedger(proof);
    for (const receipt of proof.receipts) { const operation = proof.operations.find(row => row.command === receipt.command && row.client_id === receipt.client_id); if (!operation || receipt.user_id !== a.id || !same(receipt.request, { commitment: commit(commandFor(operation)) }) || !same(receipt.result, Object.fromEntries(Object.keys(currentOperation).map(key => [key, operation[key]])))) fail("PERSISTENCE_NOT_PROVEN"); }
    for (const row of proof.audit) if (!same(Object.keys(row).sort(), ["id", "actor_user_id", "target_user_id", "operation_id", "action", "phase", "occurred_at"].sort()) || !proof.operations.some(op => op.operation_id === row.operation_id && op.command === row.action)) fail("PERSISTENCE_NOT_PROVEN");
    for (const op of proof.operations) if (op.commitment !== commit(commandFor(op))) fail("PERSISTENCE_NOT_PROVEN");
    const forbidden = /email|password|token|secret|ciphertext|content/i; for (const row of [...proof.operations, ...proof.audit, ...proof.receipts]) for (const key of Object.keys(row)) if (forbidden.test(key) && key !== "prior_must_change_password") fail("PERSISTENCE_NOT_PROVEN");
    for (const [key, expected] of Object.entries(maximum)) if (!["operations", "auditEntries", "receipts", "events"].includes(key) && counts[key] !== expected) fail("CALL_LIMIT_REFUSED");
    for (const key of ["operations", "auditEntries", "receipts", "events"]) counts[key] = maximum[key];
  }
  async function rejectCore(request, code, sqlCode) {
    lastSqlCode = null; let rejected = false; try { await execute(request); } catch (error) { if (unknown || lastTransportFailure || error.code !== code || lastSqlCode !== sqlCode) throw error; rejected = true; } if (!rejected) fail("PERSISTENCE_NOT_PROVEN");
  }
  async function replayAndConflict(request) {
    await stage("REPLAY", async () => { const effects = counts.authEffects, attempts = counts.authMutationRequests, op = await execute(request); if (!same(op, currentOperation) || effects !== counts.authEffects || attempts !== counts.authMutationRequests) fail("PERSISTENCE_NOT_PROVEN"); unchanged(terminal, await sql("UNCHANGED")); });
    await stage("CONFLICT", async () => { const altered = clone(request); if (c.case === "CREATE_FORCED") altered.input.temporary_password += "x"; else altered.input.target_user_id = a.id; const effects = counts.authEffects; await rejectCore(altered, "CONFLICT", "23505"); if (counts.authEffects !== effects) fail("PERSISTENCE_NOT_PROVEN"); unchanged(terminal, await sql("UNCHANGED")); });
  }
  async function publicDenials() {
    const ordinary = clients.get(b.id), url = new URL(ADMIN_NATIVE_API + "/rest/v1/user_moderation"); url.searchParams.set("user_id", "eq." + b.id); url.searchParams.set("select", "user_id,status,must_change_password");
    allow({ url: url.href, method: "PATCH", owner: b, kind: "publicRequests", sql: true, check: body({ status: "active", must_change_password: false }) }); const update = await ordinary.from("user_moderation").update({ status: "active", must_change_password: false }).eq("user_id", b.id).select("user_id,status,must_change_password"); takeFailure(); if (update.error?.code !== "42501" || lastSqlCode !== "42501") fail("PERSISTENCE_NOT_PROVEN");
    for (const [name, args] of [["admin_reserve", { p_actor: b.id, p_session: b.sessionId, p_execution: execution, p_intent: { command: "admin.user.unblock", client_id: randomUUID(), target_user_id: b.id, commitment: hash("ordinary-direct-attempt") } }], ["admin_complete", { p_actor: b.id, p_session: b.sessionId, p_execution: execution, p_operation: currentOperation.operation_id }]]) { allow({ url: ADMIN_NATIVE_API + "/rest/v1/rpc/" + name, method: "POST", owner: b, kind: "publicRequests", sql: true, check: body(args) }); const response = await ordinary.rpc(name, args); takeFailure(); if (response.error?.code !== "42501" || lastSqlCode !== "42501") fail("PERSISTENCE_NOT_PROVEN"); }
    await protectedRead(b, true); live(); unchanged(terminal, await sql("UNCHANGED"));
  }
  async function forcedLogin() {
    allow({ url: ADMIN_NATIVE_API + "/auth/v1/token?grant_type=password", method: "POST", owner: { accessToken: pub }, kind: "authLoginRequests", write: true, authWrite: true, check: value => { const parsed = JSON.parse(value); if (parsed.email !== temporaryEmail || parsed.password !== temporaryPassword || Object.keys(parsed).some(key => !["email", "password", "gotrue_meta_security"].includes(key)) || parsed.gotrue_meta_security !== undefined && !same(parsed.gotrue_meta_security, {})) fail("TRANSPORT_REFUSED"); } });
    const response = await p.createClient(ADMIN_NATIVE_API, pub, settings).auth.signInWithPassword({ email: temporaryEmail, password: temporaryPassword }); takeFailure();
    if (response.error || !response.data.session || response.data.user?.id !== target() || response.data.user.app_metadata?.sc_admin_operation !== currentOperation.operation_id) { unknown = true; fail("AUTH_NOT_PROVEN"); }
    created = actor({ id: target(), email: temporaryEmail, sessionId: JSON.parse(Buffer.from(response.data.session.access_token.split(".")[1], "base64url").toString("utf8")).session_id, accessToken: response.data.session.access_token, expiresAt: response.data.session.expires_at * 1000 }); clients.set(created.id, client(created)); await getOwn(created); await access(created, "forced"); await protectedRead(created, true);
    const proof = await sql("FORCED_SESSION"); if (moderation(proof, created.id)?.must_change_password !== true || !proof.sessions.some(row => row.id === created.sessionId && row.user_id === created.id) || banned(proof, created.id)) fail("PERSISTENCE_NOT_PROVEN");
    createdVerified = true;
  }
  async function run() {
    if (state !== "prepared") fail("STATE_REFUSED"); state = "running";
    try {
      await stage("BASELINE", baselineProof);
      if (c.case === "SELF_AND_LAST_MASTER") {
        await stage("SELF_REFUSALS", async () => { for (const command of ["admin.user.unblock", "admin.user.block", "admin.user.role"]) { await rejectCore({ command, input: { client_id: randomUUID(), target_user_id: a.id, ...(command === "admin.user.role" ? { role: "user" } : {}) } }, "VALIDATION", "23514"); unchanged(baseline, await sql("UNCHANGED")); } });
        await stage("SECOND_MASTER", async () => { const op = await execute({ command: "admin.user.role", input: { client_id: clientId, target_user_id: b.id, role: "master" } }); await access(b, "master"); const proof = await sql("SECOND_MASTER"); operationProof(proof, op, "complete"); if (!same(proof.usableMasters.slice().sort(), [a.id, b.id].sort())) fail("PERSISTENCE_NOT_PROVEN"); });
        await stage("DEMOTION", async () => { const op = await execute({ command: "admin.user.role", input: { client_id: randomUUID(), target_user_id: b.id, role: "user" } }); await access(b, "user"); const proof = await sql("DEMOTION"); operationProof(proof, op, "complete"); if (!same(proof.usableMasters, [a.id]) || proof.operations.some(row => row.phase !== "complete" || row.active_execution !== null)) fail("SAGA_NOT_TERMINAL"); terminalKnown = true; terminal = proof; });
        await stage("LAST_MASTER", async () => { const proof = await sql("ASSERT_LAST_MASTER"); if (proof.preserveSqlState !== "23514") fail("PERSISTENCE_NOT_PROVEN"); const normalized = { ...proof, preserveSqlState: null }; unchanged(terminal, normalized);
          const eligibility = id => { const user = proof.users.find(user => user.id === id), role = proof.roles.find(row => row.user_id === id), mod = moderation(proof, id); if (!user || !role || !mod) fail("PERSISTENCE_NOT_PROVEN"); return { role: role.role, status: mod.status, must_change_password: mod.must_change_password, admin_allowed: !proof.entitlements.some(row => row.user_id === id && row.feature_key === "admin" && !row.allowed), auth_banned: banned(proof, id), deleted: user.deleted_at !== null, anonymous: user.is_anonymous }; };
          if (!same(proof.usableMasters, [a.id]) || !p.usableMaster(eligibility(a.id))) fail("PERSISTENCE_NOT_PROVEN"); counts.coreSafetyChecks++; let refused = false; try { p.preserveUsableMaster(eligibility(a.id), proof.users.filter(user => user.id !== a.id).map(user => eligibility(user.id))); } catch (error) { if (error.code !== "VALIDATION") throw error; refused = true; } if (!refused) fail("PERSISTENCE_NOT_PROVEN");
        });
      } else {
        failurePoint = "FENCE"; const request = c.case === "BLOCK_OLD_JWT" ? { command: "admin.user.block", input: { client_id: clientId, target_user_id: b.id } } : { command: "admin.user.create", input: { client_id: clientId, email: temporaryEmail, temporary_password: temporaryPassword } };
        const op = await execute(request); await stage(c.case === "BLOCK_OLD_JWT" ? "TERMINAL" : "COMPLETE", async () => { terminal = await sql("TERMINAL"); terminalProof(terminal, op); }); await replayAndConflict(request);
        if (c.case === "BLOCK_OLD_JWT") { await stage("PUBLIC_DENIAL", publicDenials); await stage("MASTER_RETAINED", async () => { await getOwn(a); await access(a, "master"); }); }
        else await stage("FORCED_LOGIN", forcedLogin);
      }
      await stage("SQL_FINAL", async () => { const proof = await sql("FINAL"); finalMetadata(proof); terminal = proof; }); if (unknown) fail("WRITE_OUTCOME_UNCERTAIN"); state = "passed";
      pipelineReport = validateAdminNativeReport(makeReport("passed", "PASSED", null));
    } catch (error) {
      if (state === "disposed") unknown ||= pendingWrites > 0; else state = "failed";
      if (failurePoint !== "PREREQUISITE" && stages.at(-1)?.name !== failurePoint) stages.push({ name: failurePoint, passed: false });
      pipelineReport = validateAdminNativeReport(makeReport("failed", unknown ? "WRITE_OUTCOME_UNCERTAIN" : firstFailureCode ?? (error instanceof NativeFailure ? error.message : "PERSISTENCE_NOT_PROVEN"), failurePoint));
    }
    return pipelineReport;
  }
  function makeReport(status, code, failed) { return { schemaVersion: 1, scenario: "admin-native-backend", provenance: "protocol-only", case: c.case, sourceSha: c.sourceSha, sourceHashes, status, code, failurePoint: failed, stages, counts, checks: Object.fromEntries(ADMIN_NATIVE_CHECKS[c.case].map((key, index) => [key, stages[index]?.passed === true])), terminalKnown, writeOutcomeUncertain: unknown }; }
  function cleanupReport(status, code, failed) { return validateAdminNativeCleanup({ schemaVersion: 1, scenario: "admin-native-backend-cleanup", provenance: "protocol-only", case: c.case, sourceSha: c.sourceSha, status, code, failurePoint: failed, stages: cleanupStages, counts: cleanupCounts, terminalKnown, exactInventory: status === "passed", accountsAbsent: status === "passed", receiptsAbsent: status === "passed", retainedAdminMetadataExact: status === "passed", writeOutcomeUncertain: unknown }); }
  async function cleanupStage(name, action) { if (ADMIN_NATIVE_CLEANUP_STAGES[c.case][cleanupStages.length] !== name) fail("STATE_REFUSED"); cleanupPoint = name; await action(); cleanupStages.push({ name, passed: true }); }
  const completeInventory = () => c.case !== "CREATE_FORCED" || created !== null && createdVerified && created.id === currentOperation?.target_user_id;
  async function cleanupAuth() {
    if (!["passed", "failed"].includes(state) || cleanupStarted || pendingRequests || pendingInspections) fail("STATE_REFUSED"); cleanupStarted = true;
    if (unknown || !terminalKnown) return cleanupReport("failed", unknown ? "WRITE_OUTCOME_UNCERTAIN" : "SAGA_NOT_TERMINAL", "PREREQUISITE");
    // Creation can be SQL-terminal before its forced-login identity is bound.
    // Never delete only A/B while an already-created C is missing from inventory.
    if (!completeInventory()) return cleanupReport("failed", "CLEANUP_NOT_PROVEN", "PREREQUISITE");
    state = "cleaning"; const inventory = [a, b, ...(created ? [created] : [])];
    try {
      await cleanupStage("INVENTORY", async () => {
        for (const owner of inventory) { allow({ url: ADMIN_NATIVE_API + "/auth/v1/admin/users/" + owner.id, method: "GET", owner: "server", kind: "authReadRequests", check: value => { if (value !== undefined) fail("TRANSPORT_REFUSED"); } }); const response = await server.auth.admin.getUserById(owner.id); takeFailure(); if (response.error || !userMatches(response.data.user, owner)) fail("OWNERSHIP_REFUSED"); }
        const proof = await sql("CLEANUP_INVENTORY"); if (!same(proof.operations, terminal.operations) || !same(proof.audit, terminal.audit) || proof.operations.some(row => row.phase !== "complete" || row.active_execution !== null)) fail("SAGA_NOT_TERMINAL");
      });
      await cleanupStage("REVOKE", async () => { for (const owner of inventory.filter(owner => c.case !== "BLOCK_OLD_JWT" || owner !== b)) { allow({ url: ADMIN_NATIVE_API + "/auth/v1/logout?scope=global", method: "POST", owner: "server", authToken: owner.accessToken, kind: "revokeRequests", logout: true, write: true, authWrite: true, check: value => { if (value !== undefined) fail("TRANSPORT_REFUSED"); } });
        // GoTrueAdminApi.signOut preserves errors; transport separately demands
        // actual HTTP204. SDK.error=null alone never certifies revocation.
        const response = await server.auth.admin.signOut(owner.accessToken, "global"); takeFailure(); if (response.error) fail("CLEANUP_NOT_PROVEN"); }
        const proof = await sql("CLEANUP_REVOKED"); if (proof.sessions.length || proof.refreshTokens.length || !same(proof.operations, terminal.operations) || !same(proof.audit, terminal.audit)) fail("CLEANUP_NOT_PROVEN");
      });
      for (const [index, owner] of inventory.entries()) { const label = ["A", "B", "C"][index];
        await cleanupStage("DELETE_" + label, async () => { if (unknown) fail("WRITE_OUTCOME_UNCERTAIN"); allow({ url: ADMIN_NATIVE_API + "/auth/v1/admin/users/" + owner.id, method: "DELETE", owner: "server", kind: "deleteRequests", write: true, authWrite: true, check: body({ should_soft_delete: false }) }); const response = await server.auth.admin.deleteUser(owner.id, false); takeFailure(); if (response.error || !userMatches(response.data.user, owner)) { if (!response.error) unknown = true; fail("CLEANUP_NOT_PROVEN"); } });
        await cleanupStage("ABSENT_" + label, async () => { allow({ url: ADMIN_NATIVE_API + "/auth/v1/admin/users/" + owner.id, method: "GET", owner: "server", kind: "absenceReads", check: value => { if (value !== undefined) fail("TRANSPORT_REFUSED"); } }); const response = await server.auth.admin.getUserById(owner.id); takeFailure(); if (response.data.user || response.error?.status !== 404 || response.error?.code !== "user_not_found") fail("CLEANUP_NOT_PROVEN"); cleanupCounts.removedUsers++; });
      }
      await cleanupStage("RETAINED_SQL", async () => { const proof = await sql("CLEANUP_RETAINED"); if (proof.users.length || proof.sessions.length || proof.refreshTokens.length || proof.roles.length || proof.moderation.length || proof.entitlements.length || proof.receipts.length || proof.events.length || !same(proof.operations, terminal.operations) || !same(proof.audit, terminal.audit)) fail("CLEANUP_NOT_PROVEN"); cleanupCounts.retainedOperations = proof.operations.length; cleanupCounts.retainedAuditEntries = proof.audit.length; });
      cleaned = true; state = pipelineReport.status === "passed" ? "passed" : "failed"; return cleanupReport("passed", "PASSED", null);
    } catch (error) { if (state !== "disposed") state = "failed"; if (cleanupPoint !== "PREREQUISITE") cleanupStages.push({ name: cleanupPoint, passed: false }); return cleanupReport("failed", unknown ? "WRITE_OUTCOME_UNCERTAIN" : error instanceof NativeFailure ? error.message : "CLEANUP_NOT_PROVEN", cleanupPoint); }
  }
  return Object.freeze({ run, cleanupAuth, metadata() { return Object.freeze({ case: c.case, state, pipelinePassed: pipelineReport?.status === "passed", terminalKnown, authCleanupConfirmed: cleaned, authDeletionAllowed: terminalKnown && completeInventory() && !unknown && pendingRequests === 0 && pendingInspections === 0 && !cleanupStarted && ["passed", "failed"].includes(state), writeOutcomeUncertain: unknown, pendingRequests, pendingInspections, moduleCount: modules.length }); }, dispose() { if (state === "disposed") return; if (pendingWrites > 0 || state === "running" || state === "cleaning") unknown = true; state = "disposed"; for (const controller of controllers) controller.abort(); a = b = created = null; pub = secret = temporaryPassword = ""; clients.clear(); permit = null; } });
}
