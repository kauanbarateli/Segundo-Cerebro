// Test-owned Node channel. Original Core/ports/SDK remain byte unchanged.
import { randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { resolve, relative, isAbsolute, basename, dirname } from "node:path";
import { ADMIN_BROWSER_CASES, ADMIN_BROWSER_LIMITS, ADMIN_BROWSER_STAGES, ADMIN_BROWSER_CODES, blankAdminBrowserCase, validateAdminBrowserCase, closedAdminBrowserValue } from "./admin-browser-contract.mjs";
import { loadAdminNativeBackend, acceptsAdminNativeDeleteAcknowledgement } from "./admin-native-backend-case.mjs";
export const ADMIN_BROWSER_APP = "http://127.0.0.1:3117";
export const ADMIN_BROWSER_API = "http://127.0.0.1:54321";
export const ADMIN_BROWSER_PAGES = Object.freeze(["/", "/capturar", "/tarefas", "/calendario", "/conhecimento", "/drive", "/projetos", "/habitos", "/financeiro", "/cofre", "/configuracoes", "/integracoes", "/admin", "/ajuda", "/atividade", "/sair"]);
const fixtureId = "11111111-1111-4111-8111-111111111111";
const probes = [
  ["GET", "/api/capture-tasks?query=captures"], ["GET", "/api/capture-tasks?query=tasks"], ["POST", "/api/capture-tasks"],
  ["GET", "/api/finance"], ["POST", "/api/finance"], ["GET", "/api/knowledge"], ["POST", "/api/knowledge"],
  ["GET", "/api/projects-habits?domain=projects"], ["GET", "/api/projects-habits?domain=habits"], ["POST", "/api/projects-habits", { command: "project.create", input: { name: "Prova isolada", client_id: "admin-browser-denied-project" } }],
  ["GET", "/api/files"], ["POST", "/api/files"], ["POST", "/api/files/uploads"], ["GET", "/api/files/read?id=" + fixtureId],
  ["GET", "/api/vault"], ["POST", "/api/vault"], ["GET", "/api/settings"], ["POST", "/api/settings"], ["GET", "/api/activity"],
  ["GET", "/api/calendar"], ["POST", "/api/calendar"], ["GET", "/api/calendar/admin-runs"], ["POST", "/api/calendar/oauth/start"],
  ["GET", "/api/search?q=prova"], ["GET", "/api/admin"], ["POST", "/api/admin"],
];
export const ADMIN_BROWSER_PROBES = Object.freeze(probes.map(([method, path, body]) => Object.freeze({ method, path, body: method === "POST" ? Object.freeze(body ?? {}) : null })));
export const ADMIN_BROWSER_AUTOMATIC = Object.freeze([Object.freeze({ method: "GET", path: "/api/calendar", authority: "ordinary-shell-only" })]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NS = /^sc-admin-native-[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
export function adminBrowserRefuse(code) { const e = new Error(ADMIN_BROWSER_CODES.includes(code) ? code : "BROWSER_REFUSED"); e.name = "AdminBrowserFailure"; e.stack = e.name + ": " + e.message; throw e; }
export async function closedBrowserOperation(operation, code = "BROWSER_REFUSED") { try { return await operation(); } catch { adminBrowserRefuse(code); } }
export function adminBrowserEnvironment(env, platform = process.platform) {
  if (platform !== "linux" || env.CI !== "true" || env.GITHUB_ACTIONS !== "true" || env.SC_ADMIN_BROWSER_RUN !== "1" || env.APP_MODE !== "supabase" || env.NODE_ENV !== "development" || env.APP_URL !== ADMIN_BROWSER_APP || env.SUPABASE_URL !== ADMIN_BROWSER_API || !ADMIN_BROWSER_CASES.includes(env.SC_ADMIN_BROWSER_CASE) || !NS.test(env.SC_ADMIN_BROWSER_NAMESPACE) || !SHA.test(env.GITHUB_SHA) || !/^sc-auth-ci-[a-f0-9]{24}$/.test(env.SC_ADMIN_BROWSER_PROJECT) || !/^[0-9]{16,20}$/.test(env.SC_ADMIN_BROWSER_SYSTEM) || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(env.SUPABASE_PUBLISHABLE_KEY) || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(env.SUPABASE_SECRET_KEY) || [env.AUTH_STATE_SECRET, env.AUTH_RATE_LIMIT_SECRET, env.ADMIN_COMMAND_SECRET].some(s => typeof s !== "string" || Buffer.byteLength(s) < 32) || new Set([env.AUTH_STATE_SECRET, env.AUTH_RATE_LIMIT_SECRET, env.ADMIN_COMMAND_SECRET, env.SUPABASE_SECRET_KEY]).size !== 4 || Object.keys(env).some(k => /^(?:NEXT_PUBLIC_|GOOGLE_|SENTRY_|VERCEL_|GH_TOKEN$|GITHUB_TOKEN$|SUPABASE_ACCESS_TOKEN$|SUPABASE_DB_PASSWORD$|DATABASE_URL$)/.test(k))) adminBrowserRefuse("ENVIRONMENT_REFUSED");
  const path = env.SC_ADMIN_BROWSER_REPORT, parent = env.RUNNER_TEMP;
  if (!path || !parent || !isAbsolute(path) || !isAbsolute(parent) || relative(parent, path).startsWith("..") || dirname(path) === resolve(parent) || basename(path) !== "admin-browser-case-report.json") adminBrowserRefuse("ENVIRONMENT_REFUSED");
  return Object.freeze({ case: env.SC_ADMIN_BROWSER_CASE, namespace: env.SC_ADMIN_BROWSER_NAMESPACE, sourceSha: env.GITHUB_SHA, projectId: env.SC_ADMIN_BROWSER_PROJECT, systemIdentifier: env.SC_ADMIN_BROWSER_SYSTEM, publishableKey: env.SUPABASE_PUBLISHABLE_KEY, secretKey: env.SUPABASE_SECRET_KEY, commitmentSecret: env.ADMIN_COMMAND_SECRET, reportPath: path });
}
/** Browser request observer consumes no response bodies, cookies or bundles. */
export function acceptAdminBrowserRequest(url, method) {
  try {
    const u = new URL(url); if (u.origin !== ADMIN_BROWSER_APP || u.username || u.password || u.hash || !["GET", "POST"].includes(method)) return false;
    if (method === "POST") return u.pathname === "/entrar" ? u.search === "?returnTo=%2Fajuda" || !u.search : ["/trocar-senha", "/api/monitoring"].includes(u.pathname) && !u.search;
    // Next15.5.27 development adds Date.now() as the sole asset version query.
    if (u.pathname.startsWith("/_next/static/") && /^\/_next\/static\/[A-Za-z0-9_@%\[\]()./-]+$/.test(u.pathname) && !decodeURIComponent(u.pathname).includes("..") && !/%(?:2f|5c|00)/i.test(u.pathname) && (!u.search || /^\?v=\d{13}$/.test(u.search))) return true;
    if (["/_next/webpack-hmr", "/favicon.ico"].includes(u.pathname)) return !u.search;
    if (u.pathname === "/api/calendar") return !u.search;
    if (![...ADMIN_BROWSER_PAGES, "/entrar", "/trocar-senha", "/design-system"].includes(u.pathname)) return false;
    return new Set([...u.searchParams.keys()]).size === [...u.searchParams].length && [...u.searchParams].every(([key, value]) => key === "_rsc" && /^[A-Za-z0-9_-]{1,100}$/.test(value) || key === "returnTo" && ADMIN_BROWSER_PAGES.includes(value) || key === "notice" && ["session-required", "password-updated"].includes(value));
  } catch { return false; }
}
const sorted = v => Array.isArray(v) ? "[" + v.map(sorted).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + sorted(v[k])).join(",") + "}" : JSON.stringify(v);
const same = (a, b) => sorted(a) === sorted(b);
export const ADMIN_BROWSER_INSPECTION_ORDER = Object.freeze({
  BLOCK_LIVE_BROWSER: Object.freeze(["ACTORS_BOUND", "MASTER_BOUND", "ADMIN_FENCE", "ADMIN_TERMINAL", "ACCESS_DENIED", "UNCHANGED", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]),
  FIRST_FORCED_BROWSER: Object.freeze(["ACTORS_BOUND", "MASTER_BOUND", "ADMIN_FENCE", "CREATED_FENCE", "ADMIN_TERMINAL", "ACCESS_DENIED", "UNCHANGED", "PASSWORD_COMPLETE", "CREDENTIALS_CHANGED", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]),
});
export const ADMIN_BROWSER_SQL_QUERIES = Object.freeze([...new Set(Object.values(ADMIN_BROWSER_INSPECTION_ORDER).flat())]);
const variables = v => Object.entries(v).map(([k, value]) => `\\set ${k} ${value}`).join("\n") + "\n";
/** READONLY fixed metadata SQL; no password/token columns or arbitrary query. */
export function adminBrowserInspectionInput(context, query) {
  if (!NS.test(context.namespace) || !SHA.test(context.sourceSha) || !/^[0-9]{16,20}$/.test(context.systemIdentifier) || !/^sc-auth-ci-[a-f0-9]{24}$/.test(context.projectId) || !ADMIN_BROWSER_SQL_QUERIES.includes(query)) adminBrowserRefuse("SQL_REFUSED");
  return variables({ sc_ns: context.namespace, sc_sha: context.sourceSha, sc_system: context.systemIdentifier, sc_project: context.projectId }) + `begin read only;set local statement_timeout='10s';set local lock_timeout='2s';
select jsonb_build_object(
'provenance',jsonb_build_object('namespace',:'sc_ns','sourceSha',:'sc_sha','systemIdentifier',(select system_identifier::text from pg_control_system()),'database',current_database(),'currentUser',current_user,'serverVersion',current_setting('server_version_num')::integer,'markerRows',(select coalesce(jsonb_agg(jsonb_build_object('namespace',namespace,'sourceSha',source_sha,'systemIdentifier',system_identifier)),'[]'::jsonb) from app_private.sc_admin_ci_marker where namespace=:'sc_ns' and source_sha=:'sc_sha' and system_identifier=:'sc_system' and project_id=:'sc_project' and (select count(*) from app_private.sc_admin_ci_marker)=1)),
'users',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'app_metadata',raw_app_meta_data,'banned_until',banned_until,'deleted_at',deleted_at,'is_anonymous',is_anonymous) order by id),'[]'::jsonb) from auth.users),
'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id) order by user_id,id),'[]'::jsonb) from auth.sessions),
'refreshTokens',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'session_id',session_id,'revoked',revoked) order by id),'[]'::jsonb) from auth.refresh_tokens),
'roles',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id),'[]'::jsonb) from (select user_id,role from public.user_roles) r),
'moderation',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id),'[]'::jsonb) from (select user_id,status,must_change_password from public.user_moderation) r),
'entitlements',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id,feature_key),'[]'::jsonb) from public.user_entitlements r),
'operations',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at,ctid),'[]'::jsonb) from app_private.admin_operations r),
'audit',(select coalesce(jsonb_agg(to_jsonb(r) order by occurred_at,ctid),'[]'::jsonb) from public.admin_audit_events r),
'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at,command,client_id),'[]'::jsonb) from app_private.command_receipts r),
'events',(select coalesce(jsonb_agg(to_jsonb(r) order by occurred_at,ctid),'[]'::jsonb) from public.domain_events r),
'personalRows',(select count(*) from (select 1 from public.captures union all select 1 from public.tasks union all select 1 from public.knowledge_pages union all select 1 from public.projects union all select 1 from public.habits union all select 1 from public.fin_transactions union all select 1 from public.drive_files union all select 1 from public.vault_items) rows));rollback;`;
}
export function acceptAdminBrowserProof(input, context, owners) {
  const v = closedAdminBrowserValue(input), keys = ["provenance", "users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "operations", "audit", "receipts", "events", "personalRows"];
  if (!v || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) adminBrowserRefuse("SQL_REFUSED");
  const p = v.provenance;
  if (!p || Object.keys(p).length !== 7 || p.namespace !== context.namespace || p.sourceSha !== context.sourceSha || p.systemIdentifier !== context.systemIdentifier || p.database !== "postgres" || p.currentUser !== "postgres" || !Number.isInteger(p.serverVersion) || p.serverVersion < 170000 || p.serverVersion >= 180000 || !same(p.markerRows, [{ namespace: context.namespace, sourceSha: context.sourceSha, systemIdentifier: context.systemIdentifier }]) || v.personalRows !== 0) adminBrowserRefuse("SQL_REFUSED");
  for (const k of keys.slice(1, -1)) if (!Array.isArray(v[k]) || v[k].length > 128) adminBrowserRefuse("SQL_REFUSED");
  const ids = owners.map(o => o.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !UUID.test(id)) || new Set(v.users.map(u => u.id)).size !== v.users.length || v.users.some(u => !ids.includes(u.id)) || v.sessions.some(s => !ids.includes(s.user_id) || !UUID.test(s.id)) || ["roles", "moderation", "entitlements", "receipts", "events"].some(k => v[k].some(r => !ids.includes(r.user_id))) || v.refreshTokens.some(r => !ids.includes(r.user_id)) || v.operations.some(r => r.actor_user_id !== ids[0] || !ids.includes(r.target_user_id)) || v.audit.some(r => r.actor_user_id !== ids[0] || !ids.includes(r.target_user_id))) adminBrowserRefuse("OWNERSHIP_REFUSED");
  for (const u of v.users) { const o = owners.find(o => o.id === u.id); if (u.email !== o.email || u.is_anonymous !== false || u.deleted_at !== null || (o.operationId ? u.app_metadata?.sc_admin_operation !== o.operationId : u.app_metadata?.sc_admin_native_fixture !== context.namespace)) adminBrowserRefuse("OWNERSHIP_REFUSED"); }
  return v;
}
export function adminBrowserBootstrapInput(context, owners, sessions) {
  const block = context.case === "BLOCK_LIVE_BROWSER";
  if (!ADMIN_BROWSER_CASES.includes(context.case) || owners.length !== (block ? 2 : 1) || sessions.length !== (block ? 3 : 1) || new Set([...owners.map(o => o.id), ...sessions.map(s => s.sessionId)]).size !== owners.length + sessions.length || owners.some(o => !UUID.test(o.id)) || sessions.some(s => !UUID.test(s.sessionId) || !owners.some(o => o.id === s.id)) || sessions.filter(s => s.id === owners[0].id).length !== 1 || block && sessions.filter(s => s.id === owners[1].id).length !== 2) adminBrowserRefuse("SQL_REFUSED");
  const list = values => values.map(v => `'${v}'::uuid`).join(",");
  // Values are exclusively validated UUIDs/namespace. Credentials never enter SQL.
  return variables({ sc_ns: context.namespace, sc_a: owners[0].id }) + `begin;set local statement_timeout='10s';
do $bound$ begin
if (select count(*) from auth.users) <> ${owners.length} or (select count(*) from auth.sessions) <> ${sessions.length} or exists(select 1 from auth.users where id not in (${list(owners.map(o => o.id))}) or is_anonymous is distinct from false or deleted_at is not null or raw_app_meta_data->>'sc_admin_native_fixture' <> current_setting('sc.admin_browser_namespace')) or exists(select 1 from public.user_roles where role <> 'user') or exists(select 1 from public.user_moderation where status <> 'active' or must_change_password) then raise exception 'Inventory refused.' using errcode='23514';end if;
${sessions.map(s => `if not exists(select 1 from auth.sessions where id='${s.sessionId}'::uuid and user_id='${s.id}'::uuid) then raise exception 'Session refused.' using errcode='23514';end if;`).join("\n")}
end $bound$;
select public.bootstrap_master(:'sc_a');commit;` .replace("do $bound$", "set local sc.admin_browser_namespace=:'sc_ns';\ndo $bound$");
}
export function createAdminBrowserState(kind, { now = () => performance.now(), deadlineMs = ADMIN_BROWSER_LIMITS.caseMs } = {}) {
  if (!ADMIN_BROWSER_CASES.includes(kind) || typeof now !== "function" || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > ADMIN_BROWSER_LIMITS.caseMs) adminBrowserRefuse("ENVIRONMENT_REFUSED");
  const value = structuredClone(blankAdminBrowserCase(kind)), started = now(); let closed = false, failed = false;
  value.status = "failed"; value.code = "BROWSER_REFUSED";
  const expired = () => { if (now() - started >= deadlineMs) { failed = true; value.code = "DEADLINE_EXCEEDED"; } return failed && value.code === "DEADLINE_EXCEEDED"; };
  const active = () => { expired(); if (closed || failed) adminBrowserRefuse(value.code); };
  return Object.freeze({
    active, value,
    count(key) { active(); const max = ADMIN_BROWSER_LIMITS[key] ?? ({ fixturesCreated: 2, contexts: kind === "BLOCK_LIVE_BROWSER" ? 3 : 2, loginPosts: kind === "BLOCK_LIVE_BROWSER" ? 3 : 4, passwordPosts: kind === "BLOCK_LIVE_BROWSER" ? 0 : 1, adminRpc: kind === "BLOCK_LIVE_BROWSER" ? 8 : 12, adminAuth: kind === "BLOCK_LIVE_BROWSER" ? 1 : 4, pageProbes: 16, apiProbes: 26, nextProbeRequests:kind === "BLOCK_LIVE_BROWSER"?2:29, cleanupHttp: 8, deleted: 2, absenceReads: 2, revocationAcks: 2, alreadyRevoked: 1, cleanupSql: 3 })[key]; if (max === undefined || value.counts[key] >= max) adminBrowserRefuse("REQUEST_REFUSED"); value.counts[key]++; },
    stage(stage) { active(); if (ADMIN_BROWSER_STAGES[kind][value.stages.length] !== stage) adminBrowserRefuse("REPORT_REFUSED"); value.stages.push({ stage, passed: true }); },
    unknown() { value.writeOutcomeUncertain = true; },
    fail(code) { if (!failed) { value.code = ADMIN_BROWSER_CODES.includes(code) && !["PASSED", "NOT_RUN"].includes(code) ? code : "BROWSER_REFUSED"; failed = true; } },
    finish(pendingRequests, pendingInspections) { expired(); closed = true; value.pendingRequests = pendingRequests; value.pendingInspections = pendingInspections; if (!failed && !value.writeOutcomeUncertain && !pendingRequests && !pendingInspections) { value.status = "passed"; value.code = "PASSED"; } return validateAdminBrowserCase(value); },
  });
}
/** Each SDK HTTP operation needs a single exact caller permit before it starts. */
export function createAdminBrowserTransport(state, nativeFetch = fetch) {
  let permit = null, pending = 0, last = null;
  const allowed = new Set(), controllers = new Set();
  const set = slot => { state.active(); if (permit || !slot || typeof slot.url !== "string" || new URL(slot.url).origin !== ADMIN_BROWSER_API || !["GET", "POST", "PUT", "DELETE"].includes(slot.method) || typeof slot.check !== "function") adminBrowserRefuse("REQUEST_REFUSED"); permit = slot; };
  const transport = async (input, init = {}) => {
    state.active(); const slot = permit; permit = null;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url, headers = new Headers(init.headers);
    if (!slot || url !== slot.url || (init.method ?? "GET").toUpperCase() !== slot.method || headers.get("apikey") !== slot.key || headers.get("authorization") !== "Bearer " + slot.token || ![null, "2024-01-01"].includes(headers.get("x-supabase-api-version"))) adminBrowserRefuse("REQUEST_REFUSED");
    try { if (slot.check(init.body) !== true) adminBrowserRefuse("REQUEST_REFUSED"); } catch { adminBrowserRefuse("REQUEST_REFUSED"); }
    state.count("ownedSdkRequests"); if (slot.category) state.count(slot.category);
    const c = new AbortController(); controllers.add(c); pending++; let timer, expired = false;
    const owned = (async () => {
      const response = await nativeFetch(url, { ...init, signal: c.signal, redirect: "error", cache: "no-store", credentials: "omit" });
      if (!(response instanceof Response) || response.redirected || response.url && response.url !== url) adminBrowserRefuse("REQUEST_REFUSED");
      const chunks = []; let n = 0, reader;
      try {
        if (response.body) { reader = response.body.getReader(); for (;;) { const part = await reader.read(); if (part.done) break; n += part.value.byteLength; if (n > ADMIN_BROWSER_LIMITS.responseBytes) adminBrowserRefuse("REQUEST_REFUSED"); chunks.push(part.value); } }
        state.active(); if (expired) adminBrowserRefuse("DEADLINE_EXCEEDED");
        const bytes = Buffer.concat(chunks, n); last = { status: response.status, code: null };
        if (bytes.length) { let json; try { json = JSON.parse(bytes.toString("utf8")); } catch { adminBrowserRefuse("REQUEST_REFUSED"); } last.code = typeof json.code === "string" ? json.code : null; }
        if (slot.write && response.status >= 500) state.unknown();
        return new Response(response.body ? bytes : null, { status: response.status, headers: response.headers });
      } finally { chunks.forEach(b => b.fill(0)); if (reader) await reader.cancel().catch(() => {}); }
    })().finally(() => { pending--; controllers.delete(c); allowed.delete(owned); }); allowed.add(owned);
    try { return await Promise.race([owned, new Promise((_, reject) => { timer = setTimeout(() => { expired = true; c.abort(); if (slot.write) state.unknown(); reject(new Error("DEADLINE_EXCEEDED")); }, ADMIN_BROWSER_LIMITS.requestMs); })]); }
    catch { if (slot.write) state.unknown(); state.fail(expired ? "DEADLINE_EXCEEDED" : "TRANSPORT_FAILED"); adminBrowserRefuse(expired ? "DEADLINE_EXCEEDED" : "TRANSPORT_FAILED"); }
    finally { clearTimeout(timer); c.abort(); }
  };
  return Object.freeze({ permit: set, transport, clearCachedJwksPermit() { if (permit?.method !== "GET" || permit.url !== ADMIN_BROWSER_API + "/auth/v1/.well-known/jwks.json") adminBrowserRefuse("REQUEST_REFUSED"); permit = null; }, metadata: () => ({ pending, permitted: permit !== null, last: last ? { ...last } : null }), async settle() { await Promise.race([Promise.allSettled([...allowed]), new Promise(r => setTimeout(r, 2000))]); return pending === 0; }, close() { for (const c of controllers) c.abort(); permit = null; } });
}
// Separate Node-to-Next channel. This does not measure the browser or the SDK's
// requests, and never asks APIRequestContext to buffer an unbounded response.
export function createAdminBrowserNextTransport(state,nativeFetch=fetch){
  const pending=new Set(),controllers=new Set();let closed=false;
  const request=async({path,method,body,cookies,userId})=>{
    state.active();if(closed||!UUID.test(userId)||!Array.isArray(cookies)||cookies.length>32||cookies.some(c=>!c||typeof c.name!=="string"||typeof c.value!=="string"||!/^(?:sc-auth(?:\.[0-9]+)?|sc-flow-(?:request|recovery|password))$/.test(c.name)||!/^[\x21-\x2b\x2d-\x3a\x3c-\x7e]{1,16384}$/.test(c.value))||new Set(cookies.map(c=>c.name)).size!==cookies.length)adminBrowserRefuse("REQUEST_REFUSED");
    const known=ADMIN_BROWSER_PROBES.find(p=>p.path===path&&p.method===method),extra=method==="GET"&&["/ajuda?_rsc=adminbrowser","/api/calendar/oauth/callback?error=access_denied"].includes(path)||method==="POST"&&path==="/api/monitoring";
    if(!known&&!extra||known&&!same(body,known.body)||extra&&!same(body,method==="POST"?{}:null))adminBrowserRefuse("REQUEST_REFUSED");
    state.count("nextProbeRequests");const controller=new AbortController();controllers.add(controller);let timer,expired=false;
    const url=ADMIN_BROWSER_APP+path,headers={Origin:ADMIN_BROWSER_APP,"Content-Type":"application/json","X-Expected-User-ID":userId,Cookie:cookies.map(c=>c.name+"="+c.value).join("; "),...(path==="/ajuda?_rsc=adminbrowser"?{RSC:"1"}:{})};
    const owned=(async()=>{const response=await nativeFetch(url,{method,headers,...(body!==null?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:"manual",cache:"no-store",credentials:"omit"});if(!(response instanceof Response)||response.redirected||response.url&&response.url!==url)adminBrowserRefuse("REQUEST_REFUSED");const chunks=[];let size=0,reader;try{if(response.body){reader=response.body.getReader();for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>ADMIN_BROWSER_LIMITS.responseBytes)adminBrowserRefuse("REQUEST_REFUSED");chunks.push(next.value);}}state.active();if(expired)adminBrowserRefuse("DEADLINE_EXCEEDED");return{status:response.status,contentType:response.headers.get("content-type"),cacheControl:response.headers.get("cache-control"),location:response.headers.get("location"),bytes:Buffer.concat(chunks,size)};}finally{chunks.forEach(c=>c.fill(0));await reader?.cancel().catch(()=>{});}})().finally(()=>{pending.delete(owned);controllers.delete(controller);});pending.add(owned);
    try{return await Promise.race([owned,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();state.fail("DEADLINE_EXCEEDED");if(method==="POST")state.unknown();reject(Error("DEADLINE_EXCEEDED"));},ADMIN_BROWSER_LIMITS.requestMs);})]);}catch{if(method==="POST")state.unknown();state.fail(expired?"DEADLINE_EXCEEDED":"TRANSPORT_FAILED");adminBrowserRefuse(expired?"DEADLINE_EXCEEDED":"TRANSPORT_FAILED");}finally{clearTimeout(timer);controller.abort();}
  };
  return Object.freeze({request,metadata:()=>({pending:pending.size}),close(){closed=true;for(const c of controllers)c.abort();},async settle(){await Promise.race([Promise.allSettled([...pending]),new Promise(r=>setTimeout(r,2000))]);return pending.size===0;}});
}
export function acceptsAdminBrowserDenial(path,status,input){try{const v=closedAdminBrowserValue(input),search=path==="/api/search?q=prova",keys=search?["code","message"]:["ok","code","message"];return[401,403].includes(status)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))&&(!Object.hasOwn(v,"ok")||v.ok===false)&&typeof v.message==="string"&&v.code===(search?"UNAVAILABLE":status===401?"UNAUTHENTICATED":"FORBIDDEN");}catch{return false;}}
export async function createAdminBrowserHarness(context, options) {
  if (!ADMIN_BROWSER_CASES.includes(context.case) || !NS.test(context.namespace) || !SHA.test(context.sourceSha) || !/^sc-auth-ci-[a-f0-9]{24}$/.test(context.projectId) || !/^[0-9]{16,20}$/.test(context.systemIdentifier) || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(context.publishableKey) || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(context.secretKey) || typeof context.commitmentSecret!=="string" || Buffer.byteLength(context.commitmentSecret)<32 || context.commitmentSecret===context.secretKey || ["query","write","cleanupAllowed"].some(k=>typeof Object.getOwnPropertyDescriptor(options??{},k)?.value!=="function") || options.transport!==undefined&&typeof Object.getOwnPropertyDescriptor(options,"transport")?.value!=="function") adminBrowserRefuse("ENVIRONMENT_REFUSED");
  const { product } = await loadAdminNativeBackend(), state = createAdminBrowserState(context.case), io = createAdminBrowserTransport(state, options.transport ?? fetch),nextIo=createAdminBrowserNextTransport(state);
  const settings = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch: io.transport } };
  const server = product.createClient(ADMIN_BROWSER_API, context.secretKey, settings), owners = [], sessions = []; let operation = null, executionId = randomUUID(), terminalKnown = false, inventoryComplete = false, pendingSql = 0, baseline = null, inspectionIndex = 0;
  const allow = (path, method, key, token, check, write = false, category) => io.permit({ url: ADMIN_BROWSER_API + path, method, key, token, check, write, category });
  const noBody = b => b === undefined;
  const jsonBody = expected => b => typeof b === "string" && sorted(JSON.parse(b)) === sorted(expected);
  const matches = (u, o) => !!u && u.id === o.id && u.email === o.email && u.role === "authenticated" && u.is_anonymous === false && (o.operationId ? u.app_metadata?.sc_admin_operation === o.operationId : u.app_metadata?.sc_admin_native_fixture === context.namespace);
  const inspect = async query => { state.active(); if (pendingSql || ADMIN_BROWSER_INSPECTION_ORDER[context.case][inspectionIndex] !== query) adminBrowserRefuse("SQL_REFUSED"); state.count("sqlInspections"); if (query.startsWith("CLEANUP_")) state.count("cleanupSql"); pendingSql++; try { const p = acceptAdminBrowserProof(await options.query(adminBrowserInspectionInput(context, query)), context, owners); state.active(); inspectionIndex++; return p; } catch { state.fail("SQL_REFUSED"); adminBrowserRefuse("SQL_REFUSED"); } finally { pendingSql--; } };
  const noSessions = (p, id) => !p.sessions.some(s => s.user_id === id) && !p.refreshTokens.some(s => s.user_id === id);
  const user = (p, id) => p.users.find(u => u.id === id);
  const moderation = (p, id) => p.moderation.find(u => u.user_id === id);
  const ordinaryFixture = async () => {
    const o = { id: randomUUID(), email: "admin-browser-" + randomBytes(16).toString("hex") + "@example.invalid", password: randomBytes(24).toString("base64url") + "-Aa1!" }; owners.push(o);
    const input = { id: o.id, email: o.email, password: o.password, email_confirm: true, app_metadata: { sc_admin_native_fixture: context.namespace } };
    allow("/auth/v1/admin/users", "POST", context.secretKey, context.secretKey, jsonBody(input), true);
    const r = await server.auth.admin.createUser(input); if (r.error || !matches(r.data.user, o)) { state.unknown(); adminBrowserRefuse("AUTH_NOT_PROVEN"); } state.count("fixturesCreated"); return o;
  };
  const client = s => product.createClient(ADMIN_BROWSER_API, context.publishableKey, { ...settings, global: { fetch: io.transport, headers: { Authorization: "Bearer " + s.accessToken } } });
  const verifySession = async (o, hint, expectedRole) => {
    if (!UUID.test(hint.sessionId) || hint.expiresAt <= Date.now() + 60000 || typeof hint.accessToken !== "string") adminBrowserRefuse("AUTH_NOT_PROVEN");
    const s = { ...hint, id: o.id, email: o.email }; const c = client(s);
    allow("/auth/v1/user", "GET", context.publishableKey, s.accessToken, noBody); const r = await c.auth.getUser(s.accessToken); if (r.error || !matches(r.data.user, o)) adminBrowserRefuse("AUTH_NOT_PROVEN");
    // getClaims verifies the original JWT. For asymmetric local keys, its exact
    // JWKS GET is also one owned permit; symmetric fallback reuses getUser.
    const claimsHeader = JSON.parse(Buffer.from(s.accessToken.split(".")[0], "base64url").toString("utf8"));
    allow(claimsHeader.alg === "HS256" ? "/auth/v1/user" : "/auth/v1/.well-known/jwks.json", "GET", context.publishableKey, s.accessToken, noBody);
    const claims = await c.auth.getClaims(s.accessToken); if (claims.error || claims.data?.claims.sub !== o.id || claims.data.claims.session_id !== s.sessionId || claims.data.claims.exp * 1000 <= Date.now() + 60000) adminBrowserRefuse("AUTH_NOT_PROVEN");
    if (io.metadata().permitted) io.clearCachedJwksPermit();
    allow("/rest/v1/rpc/my_access_state", "POST", context.publishableKey, s.accessToken, jsonBody({})); const access = await c.rpc("my_access_state");
    const expected = expectedRole === "forced" ? { user_id: o.id, must_change_password: true } : { user_id: o.id, role: expectedRole, must_change_password: false, entitlements: {} };
    if (access.error || sorted(access.data) !== sorted(expected)) adminBrowserRefuse("AUTH_NOT_PROVEN");
    if (!sessions.some(old => old.sessionId === s.sessionId)) sessions.push(s); o.current = s; return s;
  };
  const bootstrap = async () => { const p = await inspect("ACTORS_BOUND"); if (p.users.length !== owners.length || p.sessions.length !== sessions.length || sessions.some(s => !p.sessions.some(row => row.id === s.sessionId && row.user_id === s.id)) || p.roles.some(r => r.role !== "user") || p.moderation.some(r => r.status !== "active" || r.must_change_password)) adminBrowserRefuse("OWNERSHIP_REFUSED"); pendingSql++;try{await options.write(adminBrowserBootstrapInput(context, owners, sessions));state.active();}catch{state.unknown();state.fail("SQL_REFUSED");adminBrowserRefuse("SQL_REFUSED");}finally{pendingSql--;} const after = await inspect("MASTER_BOUND"); if (after.roles.filter(r => r.role === "master").length !== 1 || after.roles.find(r => r.user_id === owners[0].id)?.role !== "master") adminBrowserRefuse("AUTH_NOT_PROVEN"); baseline = after; };
  const runAdmin = async () => {
    const a = owners[0], s = a.current; await verifySession(a, s, "master");
    const actor = { userId: a.id, sessionId: s.sessionId, role: "master", mustChangePassword: false, entitlements: {} };
    const creating = context.case === "FIRST_FORCED_BROWSER", target = creating ? { email: "admin-browser-created-" + randomBytes(16).toString("hex") + "@example.invalid", password: randomBytes(24).toString("base64url") + "-Aa1!" } : owners[1];
    const command = creating ? { command: "admin.user.create", input: { client_id: randomUUID(), email: target.email, temporary_password: target.password } } : { command: "admin.user.block", input: { client_id: randomUUID(), target_user_id: target.id } };
    const commitment = product.adminCommitment({ mode: "supabase" }, { ADMIN_COMMAND_SECRET: context.commitmentSecret });
    const rpc = async (name, args) => {
      if (!["admin_snapshot", "admin_reserve", "admin_operation_guard", "admin_transition", "admin_complete"].includes(name) || args.p_actor !== a.id || args.p_session !== s.sessionId) adminBrowserRefuse("REQUEST_REFUSED");
      allow("/rest/v1/rpc/" + name, "POST", context.secretKey, context.secretKey, jsonBody(args), name !== "admin_snapshot" && name !== "admin_operation_guard", "adminRpc");
      const r = await server.rpc(name, args);
      if (r.error) adminBrowserRefuse("SAGA_NOT_PROVEN");
      if (name === "admin_reserve") {
        operation = r.data; if (!operation || !UUID.test(operation.operation_id) || operation.operation_id === executionId || !UUID.test(operation.target_user_id)) adminBrowserRefuse("SAGA_NOT_PROVEN");
        if (creating) { target.id = operation.target_user_id; target.operationId = operation.operation_id; owners.push(target); }
        const fence = await inspect("ADMIN_FENCE"); const row = fence.operations.find(o => o.operation_id === operation.operation_id);
        if (!row || row.phase !== "reserved" || row.active_execution !== executionId || row.actor_user_id !== a.id || row.target_user_id !== target.id || row.commitment !== commitment(command) || (creating ? user(fence, target.id) !== undefined || moderation(fence, target.id) !== undefined : moderation(fence, target.id)?.status !== "blocked")) adminBrowserRefuse("SAGA_NOT_PROVEN");
        state.stage("admin-fence");
      }
      return r;
    };
    const admin = { async getUserById(id) { if (id !== target.id) adminBrowserRefuse("OWNERSHIP_REFUSED"); allow("/auth/v1/admin/users/" + id, "GET", context.secretKey, context.secretKey, noBody, false, "adminAuth"); const r = await server.auth.admin.getUserById(id); if (creating && io.metadata().last?.status === 404) { if (r.error?.code !== "user_not_found") adminBrowserRefuse("AUTH_NOT_PROVEN"); } else if (r.error || !matches(r.data.user, target)) adminBrowserRefuse("AUTH_NOT_PROVEN"); return r; },
      async createUser(input) { if (!creating || input.id !== target.id || input.email !== target.email || input.password !== target.password || input.app_metadata?.sc_admin_operation !== operation.operation_id) adminBrowserRefuse("OWNERSHIP_REFUSED"); allow("/auth/v1/admin/users", "POST", context.secretKey, context.secretKey, jsonBody(input), true, "adminAuth"); const r = await server.auth.admin.createUser(input); if (r.error || !matches(r.data.user, target)) { state.unknown(); adminBrowserRefuse("AUTH_NOT_PROVEN"); } state.count("fixturesCreated"); const p = await inspect("CREATED_FENCE"); if (!user(p, target.id)?.banned_until || Date.parse(user(p, target.id).banned_until) <= Date.now() || moderation(p, target.id)?.must_change_password !== true || moderation(p, target.id)?.status !== "blocked" || !noSessions(p, target.id)) adminBrowserRefuse("SAGA_NOT_PROVEN"); state.stage("created-fence"); return r; },
      async updateUserById(id, input) { if (id !== target.id || !input.ban_duration) adminBrowserRefuse("OWNERSHIP_REFUSED"); allow("/auth/v1/admin/users/" + id, "PUT", context.secretKey, context.secretKey, jsonBody(input), true, "adminAuth"); const r = await server.auth.admin.updateUserById(id, input); if (r.error || !matches(r.data.user, target)) { state.unknown(); adminBrowserRefuse("AUTH_NOT_PROVEN"); } return r; },
    };
    const port = product.createAdminPort(actor, rpc, executionId), auth = product.createAdminAuthPort(port, { auth: { admin } });
    const result = await product.executeAdminCommand(port, auth, commitment, command);
    const p = await inspect("ADMIN_TERMINAL"), row = p.operations.find(o => o.operation_id === operation.operation_id), m = moderation(p, target.id);
    if (!row || row.phase !== "complete" || row.active_execution !== null || row.client_id !== command.input.client_id || !noSessions(p, target.id) || m?.status !== (creating ? "active" : "blocked") || m.must_change_password !== creating || p.operations.length !== 1 || p.audit.length !== 4 || p.receipts.length !== 1 || p.receipts[0].user_id !== a.id || p.receipts[0].command !== command.command || p.events.length !== baseline.events.length + (creating ? 10 : 6) || !same(p.audit.map(r => r.phase), ["reserved", "auth_applied", "revoked", "complete"]) || result.operation_id !== operation.operation_id) adminBrowserRefuse("SAGA_NOT_PROVEN");
    terminalKnown = true; state.stage("admin-terminal"); return target;
  };
  const deniedToken = async s => { if (s.expiresAt <= Date.now() + 60000) adminBrowserRefuse("AUTH_NOT_PROVEN"); allow("/rest/v1/rpc/my_access_state", "POST", context.publishableKey, s.accessToken, jsonBody({})); const r = await client(s).rpc("my_access_state"); if (!r.error || r.error.code !== "42501") adminBrowserRefuse("AUTH_NOT_PROVEN"); };
  const passwordProof = async (o, priorSession) => { const p = await inspect("PASSWORD_COMPLETE"), receipts = p.receipts.filter(r => r.command === "auth.password_changed"), events = p.events.filter(e => e.user_id === o.id && e.entity_type === "authentication" && e.action === "updated" && e.after?.operation === "password_changed"); if (moderation(p, o.id)?.must_change_password !== false || !noSessions(p, o.id) || events.length !== 1 || !same(events[0].after, { operation: "password_changed", forced: true }) || receipts.length !== 1 || receipts[0].user_id !== o.id || !UUID.test(receipts[0].request?.session_id) || receipts[0].request.session_id === priorSession.sessionId) adminBrowserRefuse("AUTH_NOT_PROVEN"); return receipts[0].request.session_id; };
  const completeInventory = () => { inventoryComplete = terminalKnown && owners.length === 2 && owners.every(o => o.current && sessions.some(s => s.id === o.id && s.sessionId === o.current.sessionId)); };
  const cleanup = async () => {
    completeInventory(); if (!inventoryComplete || state.value.writeOutcomeUncertain || pendingSql || io.metadata().pending || nextIo.metadata().pending || io.metadata().permitted || options.cleanupAllowed?.() !== true) adminBrowserRefuse("CLEANUP_NOT_PROVEN");
    const before = await inspect("CLEANUP_INVENTORY"); if (before.users.length !== 2 || before.operations.some(o => o.phase !== "complete" || o.active_execution !== null)) adminBrowserRefuse("CLEANUP_NOT_PROVEN");
    for (const o of owners) { allow("/auth/v1/admin/users/" + o.id, "GET", context.secretKey, context.secretKey, noBody, false, "cleanupHttp"); const r = await server.auth.admin.getUserById(o.id); if (r.error || !matches(r.data.user, o)) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); }
    state.stage("cleanup-inventory");
    for (const [i, o] of owners.entries()) {
      if (context.case === "BLOCK_LIVE_BROWSER" && i === 1) { if (!noSessions(before, o.id) || !user(before, o.id)?.banned_until || Date.parse(user(before, o.id).banned_until) <= Date.now() || moderation(before, o.id)?.status !== "blocked") adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.count("alreadyRevoked"); continue; }
      allow("/auth/v1/logout?scope=global", "POST", context.secretKey, o.current.accessToken, noBody, true, "cleanupHttp"); const r = await server.auth.admin.signOut(o.current.accessToken, "global"); if (r.error || io.metadata().last?.status !== 204) { state.unknown(); adminBrowserRefuse("CLEANUP_NOT_PROVEN"); } state.count("revocationAcks");
    }
    const revoked = await inspect("CLEANUP_REVOKED"); if (!owners.every(o => noSessions(revoked, o.id)) || !same(revoked.operations, before.operations) || !same(revoked.audit, before.audit) || !same(revoked.receipts, before.receipts) || !same(revoked.events, before.events)) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.stage("cleanup-revoked");
    for (const o of owners) {
      allow("/auth/v1/admin/users/" + o.id, "DELETE", context.secretKey, context.secretKey, jsonBody({ should_soft_delete: false }), true, "cleanupHttp"); const r = await server.auth.admin.deleteUser(o.id, false);
      if (io.metadata().last?.status !== 200 || !acceptsAdminNativeDeleteAcknowledgement(r, row => matches(row, o))) { state.unknown(); adminBrowserRefuse("CLEANUP_NOT_PROVEN"); }
      allow("/auth/v1/admin/users/" + o.id, "GET", context.secretKey, context.secretKey, noBody, false, "cleanupHttp"); const absent = await server.auth.admin.getUserById(o.id);
      if (io.metadata().last?.status !== 404 || absent.error?.code !== "user_not_found" || absent.data.user !== null) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.count("absenceReads"); state.count("deleted");
    }
    const retained = await inspect("CLEANUP_RETAINED"); if (["users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "receipts", "events"].some(k => retained[k].length) || !same(retained.operations, before.operations) || !same(retained.audit, before.audit)) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.stage("cleanup-retained");
  };
  return Object.freeze({ state, io, nextIo, owners, sessions, ordinaryFixture, verifySession, bootstrap, runAdmin, inspect, deniedToken, passwordProof, cleanup, metadata: () => ({ pendingRequests: io.metadata().pending+nextIo.metadata().pending, pendingInspections: pendingSql, terminalKnown, inventoryComplete }), async dispose() { io.close();nextIo.close();await Promise.all([io.settle(),nextIo.settle()]); } });
}
