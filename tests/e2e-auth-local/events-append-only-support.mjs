// Local disposable-CI protocol support. No default network transport, env, CLI or import IO.
import { performance } from "node:perf_hooks";

export const EVENT_LOCAL_API = "http://127.0.0.1:54321";
export const EVENT_LOCAL_APP = "http://127.0.0.1:3117";
export const EVENT_METADATA = Object.freeze(["id", "user_id", "entity_type", "entity_id", "action", "canal", "occurred_at"]);
export const EVENT_STAGES = Object.freeze(["A_BASELINE", "B_BASELINE", "EVENT_RPC", "A_DELTA", "B_FOREIGN_BEFORE", "EVENT_UPDATE", "EVENT_AFTER_UPDATE", "EVENT_DELETE", "EVENT_AFTER_DELETE", "A_FINAL", "B_FINAL", "B_FOREIGN_AFTER"]);
const CHECKS = ["ownANonempty", "ownBNonempty", "legitimateEventCreated", "metadataOnly", "updateDenied", "deleteDenied", "eventUnchanged", "bUnchanged", "foreignHidden"];
const CODES = new Set(["SETUP_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SQL_REFUSAL_NOT_PROVEN", "SNAPSHOT_CHANGED", "EVENT_CREATION_REFUSED", "RPC_ACK_REFUSED", "TOKEN_LIFETIME_REFUSED"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 1_048_576, NAME = "Append-only fixture";
const plain = value => !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(Object.getOwnPropertyDescriptors(value)).every(key => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"));
const exact = (value, expected) => plain(value) && Reflect.ownKeys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const timestamp = value => {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && hour <= 23 && minute <= 59 && second <= 59;
};
class EventFailure extends Error {}
const fail = code => { throw new EventFailure(CODES.has(code) ? code : "RESPONSE_REFUSED"); };
const immutable = value => { if (value && typeof value === "object") { for (const item of Object.values(value)) immutable(item); Object.freeze(value); } return value; };

function actorFrom(value) {
  if (!exact(value, ["id", "accessToken", "sessionId", "expiresAt"]) || !UUID.test(value.id) || !UUID.test(value.sessionId) || typeof value.accessToken !== "string" || value.accessToken.length > 32_768 || !Number.isSafeInteger(value.expiresAt)) fail("SETUP_REFUSED");
  // Hints only: the caller must already have verified this same token using
  // GoTrue getUser + my_access_state (ordinary user, false flag, cfg permitted).
  try {
    const parts = value.accessToken.split(".");
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) fail("SETUP_REFUSED");
    const bytes = Buffer.from(parts[1], "base64url");
    try {
      if (bytes.toString("base64url") !== parts[1]) fail("SETUP_REFUSED");
      const claims = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!plain(claims) || claims.sub !== value.id || claims.session_id !== value.sessionId || claims.role !== "authenticated" || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 !== value.expiresAt) fail("SETUP_REFUSED");
    } finally { bytes.fill(0); }
  } catch { fail("SETUP_REFUSED"); }
  return { ...value };
}

function ownEvents(response, owner, count) {
  if (response.status !== 200 || !Array.isArray(response.data) || response.data.length > 64 || (count === undefined ? response.data.length === 0 : response.data.length !== count)) fail("OWNERSHIP_REFUSED");
  const ids = new Set();
  const rows = [];
  for (const row of response.data) {
    // Fresh ordinary identity fixtures, not a general all-module event reader.
    if (!exact(row, EVENT_METADATA) || !UUID.test(row.id) || ids.has(row.id) || row.user_id !== owner.id || !UUID.test(row.entity_id) || !["profile", "preference", "module_preference", "role", "moderation", "entitlement"].includes(row.entity_type) || !["created", "updated", "deleted", "restored", "status_changed"].includes(row.action) || !["web", "api", "cron"].includes(row.canal) || !timestamp(row.occurred_at)) fail("OWNERSHIP_REFUSED");
    ids.add(row.id); rows.push(Object.fromEntries(EVENT_METADATA.map(key => [key, row[key]])));
  }
  return rows;
}
const sameEvent = (a, b) => EVENT_METADATA.every(key => a[key] === b[key]);
function sameRows(a, b) {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map(row => [row.id, row]));
  return a.every(row => byId.has(row.id) && sameEvent(row, byId.get(row.id)));
}
function rpcAcknowledged(response, a) {
  const row = response.data;
  // Current profiles ROW, including avatar_file_id introduced by Storage.
  if (response.status !== 200 || !exact(row, ["user_id", "display_name", "avatar_url", "avatar_file_id", "timezone", "locale", "created_at", "updated_at"]) || row.user_id !== a.id || row.display_name !== NAME || row.avatar_url !== null || row.avatar_file_id !== null || row.timezone !== "America/Sao_Paulo" || row.locale !== "pt-BR" || !timestamp(row.created_at) || !timestamp(row.updated_at)) fail("RPC_ACK_REFUSED");
}
function sqlRefused(response) {
  const data = response.data;
  if (response.status !== 403 || !plain(data) || data.code !== "42501" || typeof data.message !== "string" || data.message.length > 2048 || Reflect.ownKeys(data).some(key => !["code", "message", "details", "hint"].includes(key)) || ["details", "hint"].some(key => Object.hasOwn(data, key) && data[key] !== null && (typeof data[key] !== "string" || data[key].length > 4096))) fail("SQL_REFUSAL_NOT_PROVEN");
}

export function createEventAppendOnlyAcceptance(context, options) {
  if (!exact(context, ["runtime", "publishableKey", "a", "b"]) || !exact(context.runtime, ["ci", "githubActions", "localAuthRun", "appUrl", "supabaseUrl"]) || context.runtime.ci !== true || context.runtime.githubActions !== true || context.runtime.localAuthRun !== true || context.runtime.appUrl !== EVENT_LOCAL_APP || context.runtime.supabaseUrl !== EVENT_LOCAL_API || typeof context.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(context.publishableKey) || !exact(options, Object.hasOwn(options ?? {}, "timeoutMs") ? ["transport", "clientId", "timeoutMs"] : ["transport", "clientId"]) || typeof options.transport !== "function" || typeof options.clientId !== "string" || !UUID.test(options.clientId)) fail("SETUP_REFUSED");
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15_000) fail("SETUP_REFUSED");
  let a = actorFrom(context.a), b = actorFrom(context.b), publishable = context.publishableKey, clientId = options.clientId;
  if (a.id === b.id || a.sessionId === b.sessionId || a.accessToken === b.accessToken) fail("SETUP_REFUSED");
  const transport = options.transport;
  let state = "prepared", uncertain = false, finalReport = null, baselineA = null, baselineB = null, afterA = null, newEvent = null;
  const live = actor => { if (!actor || actor.expiresAt <= Date.now() + 60_000) fail("TOKEN_LIFETIME_REFUSED"); };
  const columns = EVENT_METADATA.join(",");
  function operationSpec(operation, owner) {
    const events = `/rest/v1/domain_events?select=${encodeURIComponent(columns)}&order=occurred_at.asc%2Cid.asc&limit=65`;
    const eventId = newEvent?.id;
    switch (operation) {
      case "own": return { path: `${events}&user_id=eq.${owner.id}`, method: "GET" };
      case "foreign": if (!eventId) fail("STATE_REFUSED"); return { path: `${events}&user_id=eq.${a.id}&id=eq.${eventId}`, method: "GET" };
      case "exact": if (!eventId) fail("STATE_REFUSED"); return { path: `${events}&user_id=eq.${a.id}&id=eq.${eventId}`, method: "GET" };
      case "create": return { path: "/rest/v1/rpc/update_identity", method: "POST", body: { p_resource: "profile", p_patch: { display_name: NAME }, p_client_id: clientId, p_canal: "web" } };
      case "update": if (!eventId) fail("STATE_REFUSED"); return { path: `/rest/v1/domain_events?id=eq.${eventId}&user_id=eq.${a.id}`, method: "PATCH", body: { canal: "api" } };
      case "delete": if (!eventId) fail("STATE_REFUSED"); return { path: `/rest/v1/domain_events?id=eq.${eventId}&user_id=eq.${a.id}`, method: "DELETE" };
      default: return fail("STATE_REFUSED");
    }
  }
  async function request(operation, owner, counts) {
    live(owner);
    const spec = operationSpec(operation, owner), url = EVENT_LOCAL_API + spec.path;
    const write = spec.method !== "GET";
    const controller = new AbortController();
    let reader, timer, settled = false;
    const pieces = [], deadline = performance.now() + timeoutMs;
    const checkTime = () => { if (settled || performance.now() >= deadline) fail("DEADLINE_EXCEEDED"); };
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new EventFailure("DEADLINE_EXCEEDED")); }, timeoutMs); });
    counts.requests++;
    if (write) { uncertain = true; if (spec.method === "POST") counts.rpcWriteAttempts++; else counts.directWriteAttempts++; }
    else counts.readRequests++;
    try {
      return await Promise.race([timeout, (async () => {
        const headers = { apikey: publishable, Authorization: `Bearer ${owner.accessToken}`, Accept: "application/json" };
        if (spec.body) headers["Content-Type"] = "application/json";
        if (["PATCH", "DELETE"].includes(spec.method)) headers.Prefer = "return=minimal";
        const response = await transport(url, { method: spec.method, headers, ...(spec.body ? { body: JSON.stringify(spec.body) } : {}), redirect: "error", cache: "no-store", signal: controller.signal });
        checkTime();
        if (!(response instanceof Response) || response.redirected || response.url && response.url !== url || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !response.body) fail("RESPONSE_REFUSED");
        const declared = response.headers.get("content-length");
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > LIMIT)) fail("RESPONSE_REFUSED");
        reader = response.body.getReader(); let size = 0;
        for (;;) {
          checkTime(); const part = await reader.read(); checkTime();
          if (part.done) break;
          if (!(part.value instanceof Uint8Array) || size + part.value.byteLength > LIMIT) fail("RESPONSE_REFUSED");
          pieces.push(part.value.slice()); size += part.value.byteLength;
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength; piece.fill(0); }
        let data;
        try { data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
        catch { fail("RESPONSE_REFUSED"); }
        finally { bytes.fill(0); }
        checkTime(); return { status: response.status, data };
      })()]);
    } catch (error) { fail(error instanceof EventFailure ? error.message : "TRANSPORT_FAILED"); }
    finally { settled = true; if (timer) clearTimeout(timer); controller.abort(); for (const piece of pieces) piece.fill(0); if (reader) void reader.cancel().catch(() => undefined); }
  }

  const report = () => ({ schemaVersion: 1, scenario: "events-append-only", status: "failed", code: "STATE_REFUSED", failurePoint: "PREREQUISITE", stages: [], counts: { requests: 0, readRequests: 0, rpcWriteAttempts: 0, directWriteAttempts: 0, sqlRefusals: 0, baselineARecords: 0, baselineBRecords: 0, eventCreated: 0 }, checks: Object.fromEntries(CHECKS.map(key => [key, false])), writeOutcomeUncertain: uncertain });
  async function run() {
    if (state !== "prepared") return immutable(report());
    state = "running";
    const result = report(); let point = "A_BASELINE";
    const step = async (next, work) => { point = next; await work(); result.stages.push({ name: next, passed: true }); };
    try {
      await step("A_BASELINE", async () => { baselineA = ownEvents(await request("own", a, result.counts), a); result.counts.baselineARecords = baselineA.length; result.checks.ownANonempty = true; });
      await step("B_BASELINE", async () => { baselineB = ownEvents(await request("own", b, result.counts), b); result.counts.baselineBRecords = baselineB.length; result.checks.ownBNonempty = true; });
      await step("EVENT_RPC", async () => { rpcAcknowledged(await request("create", a, result.counts), a); uncertain = false; });
      await step("A_DELTA", async () => {
        afterA = ownEvents(await request("own", a, result.counts), a);
        const old = new Map(baselineA.map(row => [row.id, row])), added = afterA.filter(row => !old.has(row.id));
        if (afterA.length !== baselineA.length + 1 || added.length !== 1 || !sameRows(baselineA, afterA.filter(row => old.has(row.id)))) fail("EVENT_CREATION_REFUSED");
        const candidate = added[0];
        if (candidate.entity_type !== "profile" || candidate.entity_id !== a.id || candidate.action !== "updated" || candidate.canal !== "web") fail("EVENT_CREATION_REFUSED");
        newEvent = { ...candidate }; result.counts.eventCreated = 1; result.checks.legitimateEventCreated = true; result.checks.metadataOnly = true;
      });
      await step("B_FOREIGN_BEFORE", async () => { ownEvents(await request("foreign", b, result.counts), b, 0); });
      await step("EVENT_UPDATE", async () => { sqlRefused(await request("update", a, result.counts)); uncertain = false; result.counts.sqlRefusals++; result.checks.updateDenied = true; });
      await step("EVENT_AFTER_UPDATE", async () => { const rows = ownEvents(await request("exact", a, result.counts), a, 1); if (!sameEvent(rows[0], newEvent)) fail("SNAPSHOT_CHANGED"); });
      await step("EVENT_DELETE", async () => { sqlRefused(await request("delete", a, result.counts)); uncertain = false; result.counts.sqlRefusals++; result.checks.deleteDenied = true; });
      await step("EVENT_AFTER_DELETE", async () => { const rows = ownEvents(await request("exact", a, result.counts), a, 1); if (!sameEvent(rows[0], newEvent)) fail("SNAPSHOT_CHANGED"); });
      await step("A_FINAL", async () => { if (!sameRows(ownEvents(await request("own", a, result.counts), a), afterA)) fail("SNAPSHOT_CHANGED"); result.checks.eventUnchanged = true; });
      await step("B_FINAL", async () => { if (!sameRows(ownEvents(await request("own", b, result.counts), b), baselineB)) fail("SNAPSHOT_CHANGED"); result.checks.bUnchanged = true; });
      await step("B_FOREIGN_AFTER", async () => { ownEvents(await request("foreign", b, result.counts), b, 0); live(a); live(b); result.checks.foreignHidden = true; });
      result.status = "passed"; result.code = "PASSED"; result.failurePoint = null; state = "passed";
    } catch (error) { result.code = error instanceof EventFailure ? error.message : "RESPONSE_REFUSED"; result.failurePoint = point; result.stages.push({ name: point, passed: false }); state = "failed"; }
    result.writeOutcomeUncertain = uncertain; finalReport = immutable(result); return finalReport;
  }
  function metadata() { return immutable({ state, passed: finalReport?.status === "passed", writeOutcomeUncertain: uncertain }); }
  function dispose() {
    if (state === "running") fail("STATE_REFUSED");
    if (a) a.accessToken = ""; if (b) b.accessToken = "";
    a = null; b = null; publishable = ""; clientId = ""; baselineA = null; baselineB = null; afterA = null; newEvent = null; state = "disposed";
  }
  return Object.freeze({ run, metadata, dispose });
}
