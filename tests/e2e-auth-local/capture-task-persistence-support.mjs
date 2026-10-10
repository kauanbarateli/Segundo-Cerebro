// Finite persistence acceptance protocol using the actual Core and adapters.
// A protocol PASS has no native provenance by itself; only its own CI envelope
// can establish real execution. No default transport, environment, SDK or IO.
import { randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = "tests/e2e-auth-local/capture-task-persistence.entry.ts";
export const CAPTURE_NATIVE_API = "http://127.0.0.1:54321";
export const CAPTURE_NATIVE_APP = "http://127.0.0.1:3117";
export const CAPTURE_NATIVE_MODULES = Object.freeze([
  ENTRY, "src/adapters/db/capture-task-gateway.ts", "src/adapters/db/capture-task-store.ts", "src/adapters/db/capture-task-commands.ts",
  "src/lib/auth/types.ts", "src/core/contracts/base.ts", "src/core/contracts/index.ts", "src/core/contracts/modules.ts", "src/core/contracts/unit-of-work.ts", "src/core/contracts/operations.ts",
  "src/core/capturas/index.ts", "src/core/capturas/types.ts", "src/core/capturas/use-cases.ts", "src/core/capturas/wiki.ts", "src/core/capturas/attachments.ts",
  "src/core/tarefas/index.ts", "src/core/tarefas/types.ts", "src/core/tarefas/use-cases.ts", "src/core/tarefas/model.ts", "node_modules/server-only/empty.js",
]);
const REQUIRED_MODULES = [ENTRY, "src/adapters/db/capture-task-gateway.ts", "src/adapters/db/capture-task-store.ts", "src/adapters/db/capture-task-commands.ts", "src/core/contracts/base.ts", "src/core/contracts/operations.ts", "src/core/capturas/use-cases.ts", "src/core/tarefas/use-cases.ts", "node_modules/server-only/empty.js"];
const CORE_EXPORTS = ["createCaptureTaskGateway", "parseCaptureTaskSnapshot", "createCaptureTaskStore", "CommitOutcomeUnknown", "decodeCaptureTaskRequest", "executeCaptureTaskCommand", "ErroDeDominio", "AuthGuardError"];
export const CAPTURE_NATIVE_STAGES = Object.freeze(["BASELINE", "CREATE", "UPDATE", "CONVERT", "CORE_REPLAY", "RPC_REPLAY", "TASK_DELETE", "TASK_RESTORE", "CAPTURE_DELETE", "CAPTURE_RESTORE", "FINAL"]);
const COMMANDS = ["capture.create", "capture.update", "capture.convert", "task.delete", "task.restore", "capture.delete", "capture.restore"];
export const CAPTURE_NATIVE_CHECKS = Object.freeze(["freshOwnBaseline", "createPersisted", "updatePersisted", "conversionLinked", "coreReplayUnchanged", "rpcReplayUnchanged", "taskTrashPreserved", "taskRestored", "captureTrashPreserved", "captureRestored", "publicOwnAndForeign", "eventsAndReceiptsAtomic"]);
export const CAPTURE_NATIVE_FAILURE_CODES = Object.freeze(["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SNAPSHOT_CHANGED", "DOMAIN_REFUSED", "COMMIT_UNCONFIRMED", "REPLAY_NOT_PROVEN", "EVENT_NOT_PROVEN", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED"]);
const CODES = new Set(CAPTURE_NATIVE_FAILURE_CODES);
export const CAPTURE_NATIVE_PASS_COUNTS = Object.freeze({ requests: 45, rpcRequests: 29, publicRequests: 16, coreCommands: 8, commitAttempts: 9, committedReplies: 7, replayedReplies: 2, events: 8, receipts: 7 });
export const CAPTURE_NATIVE_COUNT_LIMITS = Object.freeze({ ...CAPTURE_NATIVE_PASS_COUNTS, requests: 64, rpcRequests: 64, publicRequests: 64 });
const SQL_ROLLBACK = new Set(["PT429", "42501", "23505", "40001", "40P01", "22023", "23514", "23503", "22P02"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 1_048_576;
class NativeFailure extends Error {}
const fail = code => { throw new NativeFailure(CODES.has(code) ? code : "RESPONSE_REFUSED"); };
const exact = (value, names) => {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) fail("SETUP_REFUSED");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== names.length || keys.some(key => typeof key !== "string" || !names.includes(key)) || names.some(name => !Object.hasOwn(descriptors, name) || !Object.hasOwn(descriptors[name], "value") || !descriptors[name].enumerable)) fail("SETUP_REFUSED");
};
const copy = value => structuredClone(value);
const immutable = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) immutable(child); Object.freeze(value); } return value; };
// PostgreSQL JSONB can return object keys in a different order. Compare every
// field without depending on transport/property ordering (arrays stay ordered).
const signature = value => Array.isArray(value) ? "[" + value.map(signature).join(",") + "]" : value && typeof value === "object"
  ? "{" + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key) + ":" + signature(value[key])).join(",") + "}" : JSON.stringify(value);
const same = (a, b) => signature(a) === signature(b);
const canonical = path => path.replaceAll("\\", "/");

/** A readonly inventory hook observes resolution; it never aliases, transforms,
 * loads fabricated source, replaces a module, or bypasses server-only. */
export function validateCaptureNativeInventory(paths) {
  if (!Array.isArray(paths) || paths.some(path => typeof path !== "string" || !CAPTURE_NATIVE_MODULES.includes(path)) || new Set(paths).size !== paths.length || REQUIRED_MODULES.some(path => !paths.includes(path))) fail("GRAPH_REFUSED");
  return Object.freeze([...paths].sort());
}
let corePromise;
export async function loadCaptureNativeCore() {
  corePromise ??= (async () => {
    const marker = JSON.parse(await readFile(resolve(ROOT, "node_modules/server-only/package.json"), "utf8"));
    if (marker.name !== "server-only" || marker.version !== "0.0.1" || marker.exports?.["."]?.["react-server"] !== "./empty.js" || marker.exports?.["."]?.default !== "./index.js" || (await readFile(resolve(ROOT, "node_modules/server-only/empty.js"))).length !== 0) fail("GRAPH_REFUSED");
    const { rolldown } = await import("rolldown");
    const inventory = new Set();
    const build = await rolldown({ input: resolve(ROOT, ENTRY), platform: "node", logLevel: "silent", resolve: { conditionNames: ["react-server", "node", "import", "default"] },
      plugins: [{ name: "fixed-readonly-module-inventory", async moduleParsed(info) {
        if (info.isExternal || info.dynamicallyImportedIds.length || canonical(await realpath(info.id)) !== canonical(info.id)) fail("GRAPH_REFUSED");
        const name = canonical(relative(ROOT, info.id));
        if (!CAPTURE_NATIVE_MODULES.includes(name)) fail("GRAPH_REFUSED");
        inventory.add(name);
      } }],
    });
    try {
      const generated = await build.generate({ format: "es", codeSplitting: false, sourcemap: false });
      const modules = validateCaptureNativeInventory([...inventory]);
      if (generated.output.length !== 1 || generated.output[0].type !== "chunk" || generated.output[0].imports.length || generated.output[0].dynamicImports.length || Buffer.byteLength(generated.output[0].code) > 262_144) fail("GRAPH_REFUSED");
      const core = await import("data:text/javascript;base64," + Buffer.from(generated.output[0].code).toString("base64"));
      if (Reflect.ownKeys(core).filter(key => typeof key === "string").sort().join() !== [...CORE_EXPORTS].sort().join() || CORE_EXPORTS.some(name => typeof core[name] !== "function")) fail("GRAPH_REFUSED");
      return Object.freeze({ core, modules });
    } finally { await build.close(); }
  })().catch(() => { fail("GRAPH_REFUSED"); });
  return corePromise;
}

function actor(value) {
  exact(value, ["id", "accessToken", "sessionId", "expiresAt"]);
  if (typeof value.id !== "string" || !UUID.test(value.id) || typeof value.sessionId !== "string" || !UUID.test(value.sessionId) || typeof value.accessToken !== "string" || value.accessToken.length > 32768 || !Number.isSafeInteger(value.expiresAt)) fail("SETUP_REFUSED");
  try {
    const parts = value.accessToken.split(".");
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) fail("SETUP_REFUSED");
    const bytes = Buffer.from(parts[1], "base64url");
    try {
      if (bytes.toString("base64url") !== parts[1]) fail("SETUP_REFUSED");
      const claims = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (claims.sub !== value.id || claims.session_id !== value.sessionId || claims.role !== "authenticated" || claims.exp * 1000 !== value.expiresAt) fail("SETUP_REFUSED");
    } finally { bytes.fill(0); }
  } catch { fail("SETUP_REFUSED"); }
  return copy(value);
}

/** Caller already verified A/B with GUI, real getUser and ordinary access RPC.
 * Keys stay Node RAM; inherited Chromium process env is NOT proven isolated.
 * No transport, SDK, network or database is provided by this prototype. */
export async function createCaptureTaskNativeAcceptance(context, options) {
  exact(context, ["runtime", "publishableKey", "serverSecretKey", "a", "b"]);
  exact(context.runtime, ["ci", "githubActions", "localAuthRun", "appUrl", "supabaseUrl"]);
  exact(options, Object.hasOwn(options ?? {}, "timeoutMs") ? ["transport", "timeoutMs"] : ["transport"]);
  if (context.runtime.ci !== true || context.runtime.githubActions !== true || context.runtime.localAuthRun !== true || context.runtime.appUrl !== CAPTURE_NATIVE_APP || context.runtime.supabaseUrl !== CAPTURE_NATIVE_API || typeof context.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(context.publishableKey) || typeof context.serverSecretKey !== "string" || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(context.serverSecretKey) || typeof options.transport !== "function") fail("SETUP_REFUSED");
  const timeoutMs = options.timeoutMs ?? 15000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) fail("SETUP_REFUSED");
  let a = actor(context.a), b = actor(context.b), pub = context.publishableKey, secret = context.serverSecretKey;
  if (a.id === b.id || a.sessionId === b.sessionId || a.accessToken === b.accessToken) fail("SETUP_REFUSED");
  const { core, modules } = await loadCaptureNativeCore();
  const transport = options.transport;
  let state = "prepared", unknown = false, finalReport = null, activeOperation = "read.captures", originalConvert = null, capture = null, task = null, priorSnapshot = null;
  let lastCommitRollback = false, pendingCommit = false;
  const clientIds = Object.fromEntries(COMMANDS.map(name => [name, randomUUID()]));
  const expectedEvents = [], expectedReceipts = [];
  const eventKinds = {
    "capture.create": [["capture", "created"]], "capture.update": [["capture", "updated"]],
    "capture.convert": [["task", "created"], ["capture", "status_changed"]],
    "task.delete": [["task", "deleted"]], "task.restore": [["task", "restored"]],
    "capture.delete": [["capture", "deleted"]], "capture.restore": [["capture", "restored"]],
  };
  const counts = { requests: 0, rpcRequests: 0, publicRequests: 0, coreCommands: 0, commitAttempts: 0, committedReplies: 0, replayedReplies: 0, events: 0, receipts: 0 };
  const live = owner => { if (!owner || owner.expiresAt <= Date.now() + 60000) fail("TOKEN_LIFETIME_REFUSED"); };
  async function request(path, method, body, owner, privileged) {
    live(a); live(b);
    if (counts.requests >= CAPTURE_NATIVE_COUNT_LIMITS.requests) fail("CALL_LIMIT_REFUSED");
    counts.requests++;
    if (privileged) counts.rpcRequests++; else counts.publicRequests++;
    const url = CAPTURE_NATIVE_API + path, controller = new AbortController(), deadline = performance.now() + timeoutMs;
    let reader, timer, settled = false; const pieces = [];
    const checkTime = () => { if (settled || performance.now() >= deadline) fail("DEADLINE_EXCEEDED"); };
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new NativeFailure("DEADLINE_EXCEEDED")); }, timeoutMs); });
    try {
      return await Promise.race([timeout, (async () => {
        const headers = { apikey: privileged ? secret : pub, Authorization: `Bearer ${privileged ? secret : owner.accessToken}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) };
        const response = await transport(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error", cache: "no-store", signal: controller.signal });
        checkTime();
        if (!(response instanceof Response) || response.redirected || response.url && response.url !== url || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !response.body) fail("RESPONSE_REFUSED");
        const declared = response.headers.get("content-length");
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > LIMIT)) fail("RESPONSE_REFUSED");
        reader = response.body.getReader(); let length = 0;
        for (;;) {
          checkTime(); const next = await reader.read(); checkTime(); if (next.done) break;
          if (!(next.value instanceof Uint8Array) || length + next.value.byteLength > LIMIT) fail("RESPONSE_REFUSED");
          pieces.push(next.value.slice()); length += next.value.byteLength;
        }
        const bytes = new Uint8Array(length); let offset = 0;
        for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength; piece.fill(0); }
        let data; try { data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { fail("RESPONSE_REFUSED"); } finally { bytes.fill(0); }
        checkTime(); return { status: response.status, data };
      })()]);
    } catch (error) { fail(error instanceof NativeFailure ? error.message : "TRANSPORT_FAILED"); }
    finally { settled = true; clearTimeout(timer); controller.abort(); for (const piece of pieces) piece.fill(0); if (reader) void reader.cancel().catch(() => undefined); }
  }
  async function rpc(name, args) {
    const names = ["capture_task_snapshot", "capture_task_revision", "capture_task_receipt", "capture_task_commit"];
    const extras = name === "capture_task_commit" ? ["p_request"] : name === "capture_task_receipt" ? ["p_command", "p_client_id"] : [];
    if (!names.includes(name)) fail("STATE_REFUSED");
    exact(args, ["p_user", "p_session", "p_operation", ...extras]);
    if (args.p_user !== b.id || args.p_session !== b.sessionId || !["read.captures", ...COMMANDS].includes(args.p_operation)) fail("OWNERSHIP_REFUSED");
    if (name === "capture_task_receipt" && (args.p_operation !== args.p_command || !COMMANDS.includes(args.p_command) || args.p_client_id !== clientIds[args.p_command])) fail("STATE_REFUSED");
    if (name === "capture_task_commit") {
      if (args.p_operation !== activeOperation || args.p_request.context.user_id !== b.id || args.p_request.context.canal !== "web" || args.p_request.receipt.command !== activeOperation || args.p_request.receipt.client_id !== clientIds[activeOperation]) fail("OWNERSHIP_REFUSED");
      counts.commitAttempts++; pendingCommit = true; lastCommitRollback = false;
    }
    try {
      const response = await request("/rest/v1/rpc/" + name, "POST", args, b, true);
      if (response.status !== 200) {
        const code = response.data?.code;
        if ([400, 403, 409, 422, 429].includes(response.status) && SQL_ROLLBACK.has(code)) {
          lastCommitRollback = true; return { data: null, error: { code } };
        }
        if (name === "capture_task_commit") unknown = true;
        fail("RESPONSE_REFUSED");
      }
      return { data: response.data, error: null };
    } catch (error) { if (name === "capture_task_commit") unknown = true; throw error; }
  }
  function gateway(operation) {
    const real = core.createCaptureTaskGateway(b.id, b.sessionId, operation, rpc);
    return { ...real, async commit(value) {
      activeOperation = operation;
      try {
        const response = await real.commit(value);
        if (response.status === "committed") {
          if (!same(response.result, value.receipt.result)) { unknown = true; throw new core.CommitOutcomeUnknown(); }
          if (!same(value.events.map(event => [event.entity_type, event.action]), eventKinds[operation]) || value.events.some(event => event.canal !== "web" || event.user_id !== b.id)) fail("EVENT_NOT_PROVEN");
          counts.committedReplies++; expectedEvents.push(...copy(value.events)); expectedReceipts.push(copy(value.receipt));
          if (operation === "capture.convert" && originalConvert === null) originalConvert = copy(value);
        } else if (response.status === "replayed") counts.replayedReplies++;
        pendingCommit = false;
        return response;
      } catch (error) {
        if (pendingCommit && !lastCommitRollback) unknown = true;
        pendingCommit = false;
        throw error;
      }
    } };
  }
  const readGateway = gateway("read.captures");
  async function snapshot() {
    const value = await readGateway.snapshot();
    if (value.captures.some(row => row.user_id !== b.id) || value.tasks.some(row => row.user_id !== b.id)) fail("OWNERSHIP_REFUSED");
    return value;
  }
  async function publicProfile(owner) {
    const response = await request("/rest/v1/profiles?select=user_id%2Cdisplay_name&limit=2", "GET", null, owner, false);
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.length !== 1) fail("OWNERSHIP_REFUSED");
    exact(response.data[0], ["user_id", "display_name"]);
    if (response.data[0].user_id !== owner.id || !(response.data[0].display_name === null || typeof response.data[0].display_name === "string")) fail("OWNERSHIP_REFUSED");
  }
  async function publicRecord(kind, row, owner, foreign = false) {
    const path = `/rest/v1/${kind === "capture" ? "captures" : "tasks"}?select=id%2Cuser_id%2Cpayload&id=eq.${row.id}&user_id=eq.${b.id}&limit=2`;
    const response = await request(path, "GET", null, owner, false);
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.length !== (foreign ? 0 : 1)) fail("OWNERSHIP_REFUSED");
    if (!foreign) {
      exact(response.data[0], ["id", "user_id", "payload"]);
      if (response.data[0].id !== row.id || response.data[0].user_id !== b.id || !same(response.data[0].payload, row)) fail("SNAPSHOT_CHANGED");
    }
  }
  function validateEvents(value) {
    if (value.events.length !== expectedEvents.length) fail("EVENT_NOT_PROVEN");
    const byId = new Map(value.events.map(row => [row.id, row]));
    if (byId.size !== expectedEvents.length || expectedEvents.some(row => !same(byId.get(row.id), row))) fail("EVENT_NOT_PROVEN");
    const savedReceipts = new Map(value.receipts.map(row => [row.command, row]));
    if (savedReceipts.size !== counts.committedReplies || value.receipts.length !== expectedReceipts.length || expectedReceipts.some(row => !same(savedReceipts.get(row.command), row))) fail("EVENT_NOT_PROVEN");
  }
  async function command(name, input) {
    counts.coreCommands++;
    const store = core.createCaptureTaskStore(gateway(name), { maxAttempts: 1 });
    const decoded = core.decodeCaptureTaskRequest({ command: name, input: { client_id: clientIds[name], ...input } });
    const result = await core.executeCaptureTaskCommand(store, { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: b.id, canal: "web" }, decoded);
    if (unknown) fail("COMMIT_UNCONFIRMED");
    const next = await snapshot(); validateEvents(next);
    if (name !== "capture.convert" || counts.coreCommands !== 4) {
      if (priorSnapshot && BigInt(next.revision) <= BigInt(priorSnapshot.revision)) fail("SNAPSHOT_CHANGED");
    }
    priorSnapshot = next; return { result, next };
  }
  const report = () => ({ schemaVersion: 1, scenario: "capture-task-persistence", status: "failed", code: "STATE_REFUSED", failurePoint: "PREREQUISITE", stages: [], counts: copy(counts), checks: Object.fromEntries(CAPTURE_NATIVE_CHECKS.map(name => [name, false])), writeOutcomeUncertain: unknown });
  async function run() {
    // Re-entry cannot produce a second report that misrepresents prior writes.
    // The original report and sticky metadata remain intact.
    if (state !== "prepared") fail("STATE_REFUSED");
    state = "running"; const result = report(); let point = "BASELINE";
    const step = async (name, action) => { point = name; await action(); result.stages.push({ name, passed: true }); };
    try {
      await step("BASELINE", async () => {
        live(a); live(b); await publicProfile(a); await publicProfile(b); priorSnapshot = await snapshot();
        if ([priorSnapshot.captures, priorSnapshot.tasks, priorSnapshot.categories, priorSnapshot.projects, priorSnapshot.events, priorSnapshot.receipts].some(rows => rows.length !== 0)) fail("SNAPSHOT_CHANGED");
        result.checks.freshOwnBaseline = true;
      });
      await step("CREATE", async () => {
        const observed = await command("capture.create", { type: "note", title: "Native capture", content: "Synthetic short content", category_id: null, project_id: null });
        capture = observed.result;
        if (capture.user_id !== b.id || capture.client_id !== clientIds["capture.create"] || capture.type !== "note" || capture.title !== "Native capture" || capture.content !== "Synthetic short content" || capture.status !== "inbox" || [capture.category_id, capture.project_id, capture.converted_task_id, capture.organized_at, capture.archived_at, capture.deleted_at].some(value => value !== null) || capture.captured_at !== capture.created_at || capture.updated_at !== capture.created_at || observed.next.captures.length !== 1 || observed.next.tasks.length !== 0 || !same(observed.next.captures[0], capture)) fail("SNAPSHOT_CHANGED");
        await publicRecord("capture", capture, b); result.checks.createPersisted = true;
      });
      await step("UPDATE", async () => {
        const previous = copy(capture), observed = await command("capture.update", { id: capture.id, patch: { title: "Updated native capture", content: "Updated synthetic content" } }); capture = observed.result;
        if (!same({ ...capture, title: previous.title, content: previous.content, updated_at: previous.updated_at }, previous) || capture.title !== "Updated native capture" || capture.content !== "Updated synthetic content") fail("SNAPSHOT_CHANGED");
        await publicRecord("capture", capture, b); result.checks.updatePersisted = true;
      });
      await step("CONVERT", async () => {
        const previous = copy(capture), observed = await command("capture.convert", { capture_id: capture.id }); capture = observed.result.captura; task = observed.result.tarefa;
        if (!same({ ...capture, converted_task_id: previous.converted_task_id, status: previous.status, organized_at: previous.organized_at, archived_at: previous.archived_at, updated_at: previous.updated_at }, previous) || capture.status !== "organized" || capture.organized_at !== capture.updated_at || !UUID.test(task.id) || capture.converted_task_id !== task.id || task.origin_capture_id !== capture.id || task.user_id !== b.id || task.client_id !== clientIds["capture.convert"] || task.source !== "manual" || task.title !== capture.title || task.description !== capture.content || task.status !== "todo" || task.priority !== "medium" || task.category_id !== previous.category_id || task.project_id !== previous.project_id || task.all_day !== false || [task.due_at, task.scheduled_start_at, task.scheduled_end_at, task.estimated_minutes, task.board_position, task.completed_at, task.archived_at, task.deleted_at].some(value => value !== null) || task.created_at !== capture.updated_at || task.updated_at !== task.created_at || observed.next.tasks.length !== 1 || observed.next.captures.length !== 1) fail("SNAPSHOT_CHANGED");
        await publicRecord("capture", capture, b); await publicRecord("task", task, b); await publicRecord("capture", capture, a, true); await publicRecord("task", task, a, true); result.checks.conversionLinked = true;
      });
      await step("CORE_REPLAY", async () => {
        const previous = copy(priorSnapshot), commits = counts.commitAttempts;
        const observed = await command("capture.convert", { capture_id: capture.id });
        if (!same(observed.result, { captura: capture, tarefa: task }) || !same(observed.next, previous) || counts.commitAttempts !== commits + 1 || counts.replayedReplies !== 1) fail("REPLAY_NOT_PROVEN");
        result.checks.coreReplayUnchanged = true;
      });
      await step("RPC_REPLAY", async () => {
        if (!originalConvert) fail("REPLAY_NOT_PROVEN");
        const previous = copy(priorSnapshot), replayed = await gateway("capture.convert").commit(copy(originalConvert));
        const next = await snapshot();
        if (unknown || replayed.status !== "replayed" || !same(replayed.result, { captura: capture, tarefa: task }) || !same(next, previous) || counts.replayedReplies !== 2) fail("REPLAY_NOT_PROVEN");
        const saved = await gateway("capture.convert").receipt("capture.convert", clientIds["capture.convert"]);
        if (!saved || !same(saved, originalConvert.receipt)) fail("REPLAY_NOT_PROVEN");
        result.checks.rpcReplayUnchanged = true;
      });
      for (const [stage, name, kind, deleted, check] of [["TASK_DELETE", "task.delete", "task", true, "taskTrashPreserved"], ["TASK_RESTORE", "task.restore", "task", false, "taskRestored"], ["CAPTURE_DELETE", "capture.delete", "capture", true, "captureTrashPreserved"], ["CAPTURE_RESTORE", "capture.restore", "capture", false, "captureRestored"]]) {
        await step(stage, async () => {
          const before = copy(kind === "task" ? task : capture), observed = await command(name, { id: before.id }), after = observed.result;
          if (!same({ ...after, deleted_at: before.deleted_at, updated_at: before.updated_at }, before) || (deleted ? typeof after.deleted_at !== "string" : after.deleted_at !== null) || after.user_id !== b.id) fail("SNAPSHOT_CHANGED");
          if (kind === "task") task = after; else capture = after;
          if (!same(observed.next.captures[0], capture) || !same(observed.next.tasks[0], task) || capture.converted_task_id !== task.id || task.origin_capture_id !== capture.id) fail("SNAPSHOT_CHANGED");
          await publicRecord(kind, after, b); result.checks[check] = true;
        });
      }
      await step("FINAL", async () => {
        await publicRecord("capture", capture, b); await publicRecord("task", task, b); await publicRecord("capture", capture, a, true); await publicRecord("task", task, a, true);
        const current = await readGateway.currentRevision(); if (current !== priorSnapshot.revision) fail("SNAPSHOT_CHANGED");
        live(a); live(b); validateEvents(priorSnapshot);
        if (counts.coreCommands !== 8 || counts.commitAttempts !== 9 || counts.committedReplies !== 7 || counts.replayedReplies !== 2 || expectedEvents.length !== 8 || priorSnapshot.receipts.length !== 7 || unknown) fail("REPLAY_NOT_PROVEN");
        counts.events = expectedEvents.length; counts.receipts = priorSnapshot.receipts.length;
        result.checks.publicOwnAndForeign = result.checks.eventsAndReceiptsAtomic = true;
      });
      result.status = "passed"; result.code = "PASSED"; result.failurePoint = null; state = "passed";
    } catch (error) {
      result.code = error instanceof NativeFailure ? error.message : error instanceof core.CommitOutcomeUnknown ? "COMMIT_UNCONFIRMED" : "DOMAIN_REFUSED";
      result.failurePoint = point; result.stages.push({ name: point, passed: false }); state = "failed";
    }
    result.counts = copy(counts); result.writeOutcomeUncertain = unknown; finalReport = immutable(result); return finalReport;
  }
  function metadata() { return immutable({ state, passed: finalReport?.status === "passed", writeOutcomeUncertain: unknown, moduleCount: modules.length }); }
  function dispose() {
    if (state === "running") fail("STATE_REFUSED");
    if (a) a.accessToken = ""; if (b) b.accessToken = ""; a = null; b = null; pub = ""; secret = "";
    capture = null; task = null; priorSnapshot = null; originalConvert = null; expectedEvents.length = 0; expectedReceipts.length = 0; state = "disposed";
  }
  return Object.freeze({ run, metadata, dispose });
}
