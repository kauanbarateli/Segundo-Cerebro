/** Caller-owned setup only. No hosted URLs, browser or personal factory.
 * Injected transports/acceptance in unit tests do not attest native provenance. */
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_NATIVE_API, createAdminNativeBackendAcceptance } from "./admin-native-backend-case.mjs";
import { ADMIN_NATIVE_CASES } from "./admin-native-backend-contract.mjs";
import { ADMIN_LOCAL_CASE_CHECKS, ADMIN_LOCAL_CODES, validateAdminLocalCaseReport } from "./admin-native-backend-local-ci-contract.mjs";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail = code => { throw new Error(code); };
export const ADMIN_SETUP_LIMITS = Object.freeze({ requests: 8, bytes: 1048576, timeoutMs: 15000 });
export function validateAdminLocalSetup(context, options) {
  if (!context || context.ci !== true || context.githubActions !== true || context.localAdminRun !== true || context.supabaseUrl !== ADMIN_NATIVE_API || !ADMIN_NATIVE_CASES.includes(context.case) || !/^[a-f0-9]{40}$/.test(context.sourceSha) || !/^sc-admin-native-[a-f0-9]{32}$/.test(context.namespace) || !/^[0-9]{16,20}$/.test(context.systemIdentifier) || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(context.publishableKey) || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(context.serverSecretKey) || typeof context.commitmentSecret !== "string" || Buffer.byteLength(context.commitmentSecret) < 32 || context.commitmentSecret === context.serverSecretKey || !options || ["transport", "registerActors", "inspectSql", "retainedSql", "cleanupAllowed"].some(k => typeof Object.getOwnPropertyDescriptor(options, k)?.value !== "function") || options.createAcceptance !== undefined && typeof options.createAcceptance !== "function") fail("ENVIRONMENT_REFUSED");
}
export function adminSessionHint(token, owner) {
  if (typeof token !== "string" || token.length > 16384 || token.split(".").length !== 3) fail("SESSION_REFUSED");
  let claims; try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { fail("SESSION_REFUSED"); }
  if (claims.sub !== owner || claims.role !== "authenticated" || !UUID.test(claims.session_id) || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= Date.now() + 120000) fail("SESSION_REFUSED");
  return { accessToken: token, sessionId: claims.session_id, expiresAt: claims.exp * 1000 };
}
const matches = (user, fixture, namespace) => !!user && user.id === fixture.id && user.email === fixture.email && user.role === "authenticated" && user.is_anonymous === false && user.app_metadata?.sc_admin_native_fixture === namespace;
export async function runAdminLocalCase(context, options) {
  validateAdminLocalSetup(context, options);
  const report = { schemaVersion: 1, scenario: "admin-native-backend-local-case", case: context.case, sourceSha: context.sourceSha, status: "failed", code: "CASE_FAILED", phase: "fixture-create", counts: { setupRequests: 0, fixtureCreated: 0, sessionsVerified: 0, fixtureRemoved: 0 }, checks: Object.fromEntries(ADMIN_LOCAL_CASE_CHECKS.map(k => [k, false])), pipeline: null, cleanup: null, writeOutcomeUncertain: false, pendingRequests: 0, pendingInspections: 0 };
  const make = () => ({ id: randomUUID(), email: `admin-local-${randomBytes(16).toString("hex")}@example.invalid`, password: randomBytes(24).toString("base64url") + "-Aa1!", session: null });
  const actors = [make(), make()], tokens = new Set(); let expected, unknown = false, pending = 0, closed = false, deadlineSeen = false, acceptance, firstFailure;
  const keep = code => { firstFailure ??= { code: ADMIN_LOCAL_CODES.includes(code) ? code : "CASE_FAILED", phase: report.phase }; };
  const cleanupAllowed = () => { try { return options.cleanupAllowed() === true; } catch { return false; } };
  const setupFetch = async (input, init = {}) => {
    if (closed || deadlineSeen || !expected) fail("SESSION_REFUSED");
    let url; try { url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); } catch { fail("SESSION_REFUSED"); }
    const slot = expected; expected = undefined;
    const method = (init.method ?? "GET").toUpperCase(), headers = new Headers(init.headers), key = slot.kind === "login" || slot.kind === "access" ? context.publishableKey : context.serverSecretKey;
    const bearer = slot.kind === "getUser" || slot.kind === "access" ? slot.actor.session?.accessToken : key;
    if (url.origin !== ADMIN_NATIVE_API || url.username || url.password || url.hash || url.pathname + url.search !== slot.path || method !== slot.method || headers.get("apikey") !== key || headers.get("authorization") !== "Bearer " + bearer || !["2024-01-01", null].includes(headers.get("x-supabase-api-version")) || report.counts.setupRequests >= 8) fail("SESSION_REFUSED");
    let body; if (init.body !== undefined) { if (typeof init.body !== "string" || Buffer.byteLength(init.body) > 1048576) fail("SESSION_REFUSED"); try { body = JSON.parse(init.body); } catch { fail("SESSION_REFUSED"); } }
    const f = slot.actor;
    if (slot.kind === "create" && JSON.stringify(body) !== JSON.stringify({ id: f.id, email: f.email, password: f.password, email_confirm: true, app_metadata: { sc_admin_native_fixture: context.namespace } }) || slot.kind === "login" && (body?.email !== f.email || body?.password !== f.password || Object.keys(body).some(k => !["email", "password", "gotrue_meta_security"].includes(k))) || slot.kind === "getUser" && body !== undefined || slot.kind === "access" && JSON.stringify(body) !== "{}") fail("SESSION_REFUSED");
    report.counts.setupRequests++; pending++;
    const controller = new AbortController(); let timer, reader, expired = false;
    const owned = (async () => {
      const response = await options.transport(url.href, { ...init, method, signal: controller.signal, redirect: "error", cache: "no-store", credentials: "omit" });
      if (expired || closed || !(response instanceof Response) || response.redirected) fail("SESSION_REFUSED");
      const pieces = []; let size = 0;
      try {
        if (response.body) { reader = response.body.getReader(); for (;;) { const part = await reader.read(); if (expired || closed) fail("SESSION_REFUSED"); if (part.done) break; size += part.value.byteLength; if (size > 1048576) fail("SESSION_REFUSED"); pieces.push(part.value); } }
        const bytes = new Uint8Array(size); let at = 0; for (const piece of pieces) { bytes.set(piece, at); at += piece.byteLength; }
        return new Response(response.body ? bytes : null, { status: response.status, headers: response.headers });
      } finally { for (const piece of pieces) piece.fill(0); }
    })().finally(() => { pending--; });
    try { return await Promise.race([owned, new Promise((_, reject) => { timer = setTimeout(() => { expired = deadlineSeen = true; if (slot.kind === "create" || slot.kind === "login") unknown = true; controller.abort(); reject(new Error("SESSION_REFUSED")); }, ADMIN_SETUP_LIMITS.timeoutMs); })]); }
    catch { if (slot.kind === "create" || slot.kind === "login") unknown = true; fail("SESSION_REFUSED"); }
    finally { clearTimeout(timer); controller.abort(); if (reader) void reader.cancel().catch(() => {}); }
  };
  const client = (key, token) => createClient(ADMIN_NATIVE_API, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch: setupFetch, ...(token ? { headers: { Authorization: "Bearer " + token } } : {}) } });
  const admin = client(context.serverSecretKey);
  const permit = (kind, actor, path, method) => { if (expected) fail("SESSION_REFUSED"); expected = { kind, actor, path, method }; };
  try {
    for (const actor of actors) {
      permit("create", actor, "/auth/v1/admin/users", "POST"); const result = await admin.auth.admin.createUser({ id: actor.id, email: actor.email, password: actor.password, email_confirm: true, app_metadata: { sc_admin_native_fixture: context.namespace } });
      if (result.error || !matches(result.data.user, actor, context.namespace)) { if (!result.error) unknown = true; fail("FIXTURE_CREATE_FAILED"); } report.counts.fixtureCreated++;
    }
    for (const actor of actors) {
      report.phase = "login"; permit("login", actor, "/auth/v1/token?grant_type=password", "POST"); const login = await client(context.publishableKey).auth.signInWithPassword({ email: actor.email, password: actor.password });
      if (login.error || !matches(login.data.user, actor, context.namespace) || !login.data.session) { if (!login.error) unknown = true; fail("LOGIN_FAILED"); } actor.session = adminSessionHint(login.data.session.access_token, actor.id); tokens.add(actor.session.accessToken);
      report.phase = "session-verification"; permit("getUser", actor, "/auth/v1/user", "GET"); const identity = await admin.auth.getUser(actor.session.accessToken); if (identity.error || !matches(identity.data.user, actor, context.namespace)) fail("SESSION_REFUSED"); report.counts.sessionsVerified++;
      report.phase = "ordinary-access"; permit("access", actor, "/rest/v1/rpc/my_access_state", "POST"); const access = await client(context.publishableKey, actor.session.accessToken).rpc("my_access_state"), value = access.data;
      if (access.error || !value || value.user_id !== actor.id || value.role !== "user" || value.must_change_password !== false || !value.entitlements || Array.isArray(value.entitlements) || Object.keys(value.entitlements).length || Object.keys(value).sort().join("|") !== "entitlements|must_change_password|role|user_id") fail("ORDINARY_ACCESS_REFUSED");
    }
    if (new Set(actors.flatMap(a => [a.id, a.session.sessionId])).size !== 4 || pending || expected) fail("SESSION_REFUSED"); report.checks.ordinaryVerified = true;
    report.phase = "bootstrap";
    const binding = Object.freeze({ a: Object.freeze({ id: actors[0].id, sessionId: actors[0].session.sessionId, marker: context.namespace }), b: Object.freeze({ id: actors[1].id, sessionId: actors[1].session.sessionId, marker: context.namespace }) });
    await options.registerActors(binding); report.checks.actorsRegistered = report.checks.masterBootstrapVerified = true;
    report.phase = "protocol";
    acceptance = await (options.createAcceptance ?? createAdminNativeBackendAcceptance)({ case: context.case, sourceSha: context.sourceSha, publishableKey: context.publishableKey, serverSecretKey: context.serverSecretKey, commitmentSecret: context.commitmentSecret, runtime: { ci: true, githubActions: true, localAdminRun: true, supabaseUrl: ADMIN_NATIVE_API, namespace: context.namespace, systemIdentifier: context.systemIdentifier }, a: { id: actors[0].id, email: actors[0].email, ...actors[0].session }, b: { id: actors[1].id, email: actors[1].email, ...actors[1].session } }, { transport: options.transport, inspectSql: options.inspectSql });
    report.pipeline = await acceptance.run(); report.checks.pipelinePassed = report.pipeline.status === "passed"; unknown ||= acceptance.metadata().writeOutcomeUncertain;
    if (!report.checks.pipelinePassed) keep("PROTOCOL_FAILED");
  } catch (error) { keep(error?.message); }
  finally {
    if (acceptance) {
      const state = acceptance.metadata(); unknown ||= state.writeOutcomeUncertain;
      if (!unknown && !pending && !deadlineSeen && cleanupAllowed() && state.authDeletionAllowed) {
        try { report.phase = "auth-cleanup"; report.cleanup = await acceptance.cleanupAuth(); unknown ||= acceptance.metadata().writeOutcomeUncertain; report.counts.fixtureRemoved = report.cleanup.counts.removedUsers; report.checks.sdkCleanupConfirmed = report.cleanup.status === "passed"; if (!report.checks.sdkCleanupConfirmed) keep("AUTH_CLEANUP_UNCONFIRMED"); }
        catch { unknown ||= acceptance.metadata().writeOutcomeUncertain; keep("AUTH_CLEANUP_UNCONFIRMED"); }
      } else keep(unknown ? "WRITE_OUTCOME_UNCERTAIN" : "AUTH_CLEANUP_UNCONFIRMED");
      if (report.checks.sdkCleanupConfirmed && !unknown && !pending && cleanupAllowed()) {
        try { report.phase = "retained-sql"; if (await options.retainedSql() !== true) fail("RETAINED_SQL_REFUSED"); report.checks.retainedSqlConfirmed = true; } catch { keep("RETAINED_SQL_REFUSED"); }
      }
      const final = acceptance.metadata(); report.pendingRequests = final.pendingRequests; report.pendingInspections = final.pendingInspections; unknown ||= final.writeOutcomeUncertain;
      // No authority is recreated by disposal, nor is it a settlement proof.
      acceptance.dispose();
      unknown ||= acceptance.metadata().writeOutcomeUncertain;
    }
    closed = true; report.pendingRequests += pending; report.writeOutcomeUncertain = unknown;
    if (!firstFailure && !report.checks.retainedSqlConfirmed) keep("CASE_FAILED");
    report.status = firstFailure ? "failed" : "passed"; report.code = firstFailure?.code ?? "PASSED"; report.phase = firstFailure?.phase ?? "complete";
    // Ongoing transport has its original promise retained by the caller. These
    // closures no longer authorize calls; clearing fields is not quiescence.
    tokens.clear(); for (const actor of actors) { actor.password = ""; actor.email = ""; actor.session = null; }
  }
  return validateAdminLocalCaseReport(report);
}
