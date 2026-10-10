// Local disposable-CI support only. No env reads, default transport, CLI or import-time IO.
import { performance } from "node:perf_hooks";

export const RLS_LOCAL_API = "http://127.0.0.1:54321";
export const RLS_LOCAL_APP = "http://127.0.0.1:3117";
const LIMIT = 1_048_576;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANARY = "RLS refusal canary";
const BEFORE = ["ownA", "foreignA", "ownB", "foreignB", "anonClosed", "moderationUnreadable", "moderationUnwritable", "profileUnwritable", "ownSnapshotsPreserved", "ordinaryAccessPreserved"];
const AFTER = ["oldAUnexpired", "oldAOwnHidden", "oldARpcDenied", "bOwnUnchanged", "bOrdinaryAccessIntact"];
const POINTS = ["OWN_A", "FOREIGN_A", "OWN_B", "FOREIGN_B", "ANON_PROFILES", "MODERATION_READ", "MODERATION_WRITE", "PROFILE_WRITE", "REREAD_A", "REREAD_B", "ACCESS_A", "ACCESS_B", "OLD_A_LIFETIME", "OLD_A_PROFILES", "OLD_A_RPC", "B_PROFILES", "B_RPC", "PREREQUISITE"];
const CODES = new Set(["SETUP_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SQL_REFUSAL_NOT_PROVEN", "SNAPSHOT_CHANGED", "ACCESS_STATE_REFUSED", "TOKEN_LIFETIME_REFUSED"]);
const plain = value => !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(Object.getOwnPropertyDescriptors(value)).every(key => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"));
const keys = (value, expected) => plain(value) && Reflect.ownKeys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
class LocalRlsFailure extends Error {}
const fail = code => { throw new LocalRlsFailure(CODES.has(code) ? code : "RESPONSE_REFUSED"); };
const immutable = value => {
  if (value && typeof value === "object") { for (const item of Object.values(value)) immutable(item); Object.freeze(value); }
  return value;
};

function actorFrom(value) {
  if (!keys(value, ["id", "accessToken", "sessionId", "expiresAt"]) || !UUID.test(value.id) || !UUID.test(value.sessionId) ||
      typeof value.accessToken !== "string" || value.accessToken.length > 32_768 || typeof value.expiresAt !== "number" || !Number.isSafeInteger(value.expiresAt)) fail("SETUP_REFUSED");
  // Routing hints only. The future GUI caller must already have getUser + RPC
  // verified this exact token; the real Data API remains the authority.
  try {
    const pieces = value.accessToken.split(".");
    if (pieces.length !== 3 || pieces.some(piece => !/^[A-Za-z0-9_-]+$/.test(piece))) fail("SETUP_REFUSED");
    const raw = Buffer.from(pieces[1], "base64url");
    if (raw.toString("base64url") !== pieces[1]) fail("SETUP_REFUSED");
    const claims = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    if (!plain(claims) || claims.sub !== value.id || claims.role !== "authenticated" || claims.session_id !== value.sessionId ||
        !Number.isSafeInteger(claims.exp) || claims.exp * 1000 !== value.expiresAt) fail("SETUP_REFUSED");
  } catch { fail("SETUP_REFUSED"); }
  return { ...value };
}

function sqlRefused(result, authenticated, counts) {
  const envelope = result.data;
  if (!(authenticated ? result.status === 403 : [401, 403].includes(result.status)) || !plain(envelope) ||
      envelope.code !== "42501" || typeof envelope.message !== "string" || envelope.message.length > 2048 ||
      Reflect.ownKeys(envelope).some(key => !["code", "message", "details", "hint"].includes(key)) ||
      ["details", "hint"].some(key => Object.hasOwn(envelope, key) && envelope[key] !== null && typeof envelope[key] !== "string")) fail("SQL_REFUSAL_NOT_PROVEN");
  counts.sqlRefusals++;
}

function ownedProfile(result, owner, expectedCount) {
  if (result.status !== 200 || !Array.isArray(result.data) || result.data.length !== expectedCount) fail("OWNERSHIP_REFUSED");
  for (const row of result.data) {
    if (!keys(row, ["user_id", "display_name"]) || row.user_id !== owner.id ||
        !(row.display_name === null || typeof row.display_name === "string" && row.display_name.length <= 120)) fail("OWNERSHIP_REFUSED");
  }
  return result.data.map(row => ({ user_id: row.user_id, display_name: row.display_name }));
}

function ordinaryAccess(result, owner) {
  if (result.status !== 200 || !keys(result.data, ["user_id", "role", "must_change_password", "entitlements"]) ||
      result.data.user_id !== owner.id || result.data.role !== "user" || result.data.must_change_password !== false ||
      !plain(result.data.entitlements) || Reflect.ownKeys(result.data.entitlements).length !== 0) fail("ACCESS_STATE_REFUSED");
}

/** Two phases, memory-only snapshots. This support module can only call an explicitly
 * supplied transport; importing it or constructing it makes zero requests.
 */
export function createIdentityRlsAcceptance(context, options) {
  if (!keys(context, ["runtime", "publishableKey", "a", "b"]) ||
      !keys(context.runtime, ["ci", "githubActions", "localAuthRun", "appUrl", "supabaseUrl"]) ||
      context.runtime.ci !== true || context.runtime.githubActions !== true || context.runtime.localAuthRun !== true ||
      context.runtime.appUrl !== RLS_LOCAL_APP || context.runtime.supabaseUrl !== RLS_LOCAL_API ||
      typeof context.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(context.publishableKey) ||
      !keys(options, Object.hasOwn(options ?? {}, "timeoutMs") ? ["transport", "timeoutMs"] : ["transport"]) || typeof options.transport !== "function") fail("SETUP_REFUSED");
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15_000) fail("SETUP_REFUSED");
  let a = actorFrom(context.a), b = actorFrom(context.b), publishableKey = context.publishableKey;
  if (a.id === b.id || a.sessionId === b.sessionId || a.accessToken === b.accessToken) fail("SETUP_REFUSED");
  let state = "prepared", uncertain = false, beforeReport = null, afterReport = null, baselineA = null, baselineB = null;
  const transport = options.transport;
  const live = owner => { if (!owner || owner.expiresAt <= Date.now() + 60_000) fail("TOKEN_LIFETIME_REFUSED"); };
  const requestSpec = (operation, owner) => {
    // Fixed finite operations. No caller-supplied path, query, SQL or body.
    const profile = "/rest/v1/profiles?select=user_id%2Cdisplay_name&limit=2";
    const byUser = name => `/rest/v1/${name}?user_id=eq.${a.id}`;
    switch (operation) {
      case "own": return { path: profile, method: "GET" };
      case "foreign": return { path: `${profile}&user_id=eq.${owner === a ? b.id : a.id}`, method: "GET" };
      case "anon": return { path: profile, method: "GET" };
      case "moderation-read": return { path: `${byUser("user_moderation")}&select=user_id%2Cmust_change_password&limit=2`, method: "GET" };
      case "moderation-write": return { path: byUser("user_moderation"), method: "PATCH", body: { must_change_password: true } };
      case "profile-write": return { path: byUser("profiles"), method: "PATCH", body: { display_name: CANARY } };
      case "access": return { path: "/rest/v1/rpc/my_access_state", method: "POST", body: {} };
      default: return fail("STATE_REFUSED");
    }
  };

  async function request(operation, owner, counts) {
    if (owner) live(owner);
    const spec = requestSpec(operation, owner), url = RLS_LOCAL_API + spec.path;
    const write = spec.method === "PATCH";
    const controller = new AbortController();
    let reader, timer, settled = false;
    const pieces = [];
    const deadline = performance.now() + timeoutMs;
    const checkTime = () => { if (settled || performance.now() >= deadline) fail("DEADLINE_EXCEEDED"); };
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new LocalRlsFailure("DEADLINE_EXCEEDED")); }, timeoutMs); });
    counts.requests++;
    if (write) { counts.directWriteAttempts++; uncertain = true; }
    try {
      const result = await Promise.race([timeout, (async () => {
        const headers = { apikey: publishableKey, Authorization: `Bearer ${owner ? owner.accessToken : publishableKey}`, Accept: "application/json" };
        if (spec.body) { headers["Content-Type"] = "application/json"; headers.Prefer = "return=minimal"; }
        const response = await transport(url, { method: spec.method, headers, ...(spec.body ? { body: JSON.stringify(spec.body) } : {}), redirect: "error", cache: "no-store", signal: controller.signal });
        checkTime();
        if (!(response instanceof Response) || response.redirected || response.url && response.url !== url ||
            !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !response.body) fail("RESPONSE_REFUSED");
        const declared = response.headers.get("content-length");
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > LIMIT)) fail("RESPONSE_REFUSED");
        reader = response.body.getReader();
        let size = 0;
        for (;;) {
          checkTime();
          const part = await reader.read();
          checkTime();
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
        checkTime();
        return { status: response.status, data };
      })()]);
      return result;
    } catch (error) { fail(error instanceof LocalRlsFailure ? error.message : "TRANSPORT_FAILED"); }
    finally {
      settled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
      for (const piece of pieces) piece.fill(0);
      if (reader) void reader.cancel().catch(() => undefined);
    }
  }

  const report = (scenario, checkNames) => ({ schemaVersion: 1, scenario, status: "failed", code: "STATE_REFUSED", failurePoint: "PREREQUISITE", counts: { requests: 0, directWriteAttempts: 0, sqlRefusals: 0 }, checks: Object.fromEntries(checkNames.map(name => [name, false])), writeOutcomeUncertain: uncertain });
  const finish = (result, error, point) => {
    result.writeOutcomeUncertain = uncertain;
    if (error) { result.code = error instanceof LocalRlsFailure ? error.message : "RESPONSE_REFUSED"; result.failurePoint = POINTS.includes(point) ? point : "PREREQUISITE"; }
    else { result.status = "passed"; result.code = "PASSED"; result.failurePoint = null; }
    return immutable(result);
  };

  async function before() {
    if (state !== "prepared") return immutable(report("identity-rls-before", BEFORE));
    state = "before-running";
    const result = report("identity-rls-before", BEFORE); let point = "OWN_A";
    try {
      baselineA = ownedProfile(await request("own", a, result.counts), a, 1); result.checks.ownA = true;
      point = "FOREIGN_A"; ownedProfile(await request("foreign", a, result.counts), a, 0); result.checks.foreignA = true;
      point = "OWN_B"; baselineB = ownedProfile(await request("own", b, result.counts), b, 1); result.checks.ownB = true;
      point = "FOREIGN_B"; ownedProfile(await request("foreign", b, result.counts), b, 0); result.checks.foreignB = true;
      point = "ANON_PROFILES"; sqlRefused(await request("anon", null, result.counts), false, result.counts); result.checks.anonClosed = true;
      point = "MODERATION_READ"; sqlRefused(await request("moderation-read", a, result.counts), true, result.counts); result.checks.moderationUnreadable = true;
      point = "MODERATION_WRITE"; sqlRefused(await request("moderation-write", a, result.counts), true, result.counts); uncertain = false; result.checks.moderationUnwritable = true;
      point = "PROFILE_WRITE"; sqlRefused(await request("profile-write", a, result.counts), true, result.counts); uncertain = false; result.checks.profileUnwritable = true;
      point = "REREAD_A"; if (JSON.stringify(ownedProfile(await request("own", a, result.counts), a, 1)) !== JSON.stringify(baselineA)) fail("SNAPSHOT_CHANGED");
      point = "REREAD_B"; if (JSON.stringify(ownedProfile(await request("own", b, result.counts), b, 1)) !== JSON.stringify(baselineB)) fail("SNAPSHOT_CHANGED"); result.checks.ownSnapshotsPreserved = true;
      point = "ACCESS_A"; ordinaryAccess(await request("access", a, result.counts), a);
      point = "ACCESS_B"; ordinaryAccess(await request("access", b, result.counts), b); result.checks.ordinaryAccessPreserved = true;
      beforeReport = finish(result); state = "before-passed"; return beforeReport;
    } catch (error) { beforeReport = finish(result, error, point); state = "before-failed"; return beforeReport; }
  }

  async function after() {
    if (state !== "before-passed") return immutable(report("identity-rls-after", AFTER));
    state = "after-running";
    const result = report("identity-rls-after", AFTER); let point = "OLD_A_LIFETIME";
    try {
      live(a); result.checks.oldAUnexpired = true;
      point = "OLD_A_PROFILES"; ownedProfile(await request("own", a, result.counts), a, 0); live(a); result.checks.oldAOwnHidden = true;
      point = "OLD_A_RPC"; sqlRefused(await request("access", a, result.counts), true, result.counts); live(a); result.checks.oldARpcDenied = true;
      point = "B_PROFILES"; if (JSON.stringify(ownedProfile(await request("own", b, result.counts), b, 1)) !== JSON.stringify(baselineB)) fail("SNAPSHOT_CHANGED"); result.checks.bOwnUnchanged = true;
      point = "B_RPC"; ordinaryAccess(await request("access", b, result.counts), b); result.checks.bOrdinaryAccessIntact = true;
      live(a); live(b); afterReport = finish(result); state = "after-passed"; return afterReport;
    } catch (error) { afterReport = finish(result, error, point); state = "after-failed"; return afterReport; }
  }

  function metadata() { return immutable({ state, beforePassed: beforeReport?.status === "passed", afterPassed: afterReport?.status === "passed", writeOutcomeUncertain: uncertain }); }
  function dispose() {
    if (["before-running", "after-running"].includes(state)) fail("STATE_REFUSED");
    if (a) a.accessToken = ""; if (b) b.accessToken = "";
    a = null; b = null; baselineA = null; baselineB = null; publishableKey = ""; state = "disposed";
  }
  return Object.freeze({ before, after, metadata, dispose });
}
