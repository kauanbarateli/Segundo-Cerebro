/** Three independent Linux CI stacks. Importing this module starts no service. */
import { createHash, randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CLI_VERSION, requireCiRunner, assertTempDescendant, assertNoEnvironmentFiles, loadCanonicalMigrations, renderLocalConfig, decodeLocalStatus, localPsqlEnvironment, runBoundedProcess, DATABASE_PREFLIGHT, assertDatabasePreflight, LOCAL_INFRASTRUCTURE_FIXTURE } from "./auth-local-ci.mjs";
import { ADMIN_NATIVE_CASES, assembleAdminNativePacket } from "../../tests/e2e-auth-local/admin-native-backend-contract.mjs";
import { runAdminLocalCase } from "../../tests/e2e-auth-local/admin-native-backend-local-case.mjs";
import { ADMIN_LOCAL_INFRA_CHECKS, ADMIN_LOCAL_CODES, ADMIN_LOCAL_LIMITATIONS, ADMIN_LOCAL_SOURCE_PATHS, ADMIN_LOCAL_DEPENDENCY_PATHS, ADMIN_LOCAL_SDK_VERSIONS, validateAdminLocalCiReport } from "../../tests/e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/, SHA = /^[a-f0-9]{40}$/, NS = /^sc-admin-native-[a-f0-9]{32}$/, PROJECT = /^sc-auth-ci-[a-f0-9]{24}$/, SYSTEM = /^[0-9]{16,20}$/;
const fail = code => { throw new Error(code); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const stable = value => Array.isArray(value) ? "[" + value.map(stable).join(",") + "]" : value && typeof value === "object" ? "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}" : JSON.stringify(value);
const exact = (v, keys) => { if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) return false; const d = Object.getOwnPropertyDescriptors(v), names = Reflect.ownKeys(d); return names.length === keys.length && names.every(k => typeof k === "string" && keys.includes(k)) && keys.every(k => d[k]?.enumerable && Object.hasOwn(d[k], "value")); };
export function requireAdminCi(environment, platform = process.platform) { if (environment.SC_ADMIN_NATIVE_LOCAL_CI_RUN !== "1") fail("ENVIRONMENT_REFUSED"); return requireCiRunner(environment, platform); }
export function decodeAdminSql(text) { if (typeof text !== "string" || Buffer.byteLength(text) > 1048576) fail("LOCAL_SQL_REFUSED"); const lines = text.trim().split(/\r?\n/); if (lines.length !== 1) fail("LOCAL_SQL_REFUSED"); try { return JSON.parse(lines[0]); } catch { fail("LOCAL_SQL_REFUSED"); } }
export const ADMIN_INSTANCE_SQL = `begin read only;set local statement_timeout='10s';
select jsonb_build_object('database',current_database(),'currentUser',current_user,'serverVersion',current_setting('server_version_num')::integer,'systemIdentifier',(select system_identifier::text from pg_control_system()));rollback;`;
export function verifyAdminInstance(v, expected) { if (!exact(v, ["database", "currentUser", "serverVersion", "systemIdentifier"]) || v.database !== "postgres" || v.currentUser !== "postgres" || !Number.isSafeInteger(v.serverVersion) || v.serverVersion < 170000 || v.serverVersion >= 180000 || !SYSTEM.test(v.systemIdentifier) || expected !== undefined && v.systemIdentifier !== expected) fail("LOCAL_DATABASE_REFUSED"); return v.systemIdentifier; }
export function validateAdminActors(v, namespace) { if (!NS.test(namespace) || !exact(v, ["a", "b"])) fail("LOCAL_SQL_REFUSED"); for (const actor of [v.a, v.b]) if (!exact(actor, ["id", "sessionId", "marker"]) || !UUID.test(actor.id) || !UUID.test(actor.sessionId) || actor.marker !== namespace) fail("LOCAL_SQL_REFUSED"); if (new Set([v.a.id, v.a.sessionId, v.b.id, v.b.sessionId]).size !== 4) fail("LOCAL_SQL_REFUSED"); return Object.freeze({ a: Object.freeze({ ...v.a }), b: Object.freeze({ ...v.b }) }); }
export const ADMIN_INSPECTION_ORDER = Object.freeze({
  BLOCK_OLD_JWT: Object.freeze(["BASELINE", "FENCE", "TERMINAL", "UNCHANGED", "UNCHANGED", "UNCHANGED", "FINAL", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]),
  SELF_AND_LAST_MASTER: Object.freeze(["BASELINE", "UNCHANGED", "UNCHANGED", "UNCHANGED", "SECOND_MASTER", "DEMOTION", "ASSERT_LAST_MASTER", "FINAL", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]),
  CREATE_FORCED: Object.freeze(["BASELINE", "FENCE", "CREATED_FENCE", "TERMINAL", "UNCHANGED", "UNCHANGED", "FORCED_SESSION", "FINAL", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]),
});
const variables = values => Object.entries(values).map(([name, value]) => `\\set ${name} ${value}`).join("\n") + "\n";
export function adminMarkerInput(context, catalogue) {
  if (catalogue?.version !== 1 || catalogue?.ok !== true || catalogue?.checks !== 1246 || !Array.isArray(catalogue.deviations) || catalogue.deviations.length || !NS.test(context.namespace) || !SHA.test(context.sourceSha) || !SYSTEM.test(context.systemIdentifier) || !PROJECT.test(context.projectId)) fail("LOCAL_SQL_REFUSED");
  return variables({ sc_namespace: context.namespace, sc_sha: context.sourceSha, sc_system: context.systemIdentifier, sc_project: context.projectId }) + `begin;set local statement_timeout='10s';
create table app_private.sc_admin_ci_marker(namespace text primary key, source_sha text not null, system_identifier text not null, project_id text not null);
alter table app_private.sc_admin_ci_marker enable row level security;
revoke all on app_private.sc_admin_ci_marker from public,anon,authenticated,service_role;
insert into app_private.sc_admin_ci_marker values(:'sc_namespace',:'sc_sha',:'sc_system',:'sc_project');commit;`;
}
const PERSONAL = `(select count(*) from (select 1 from public.captures union all select 1 from public.tasks union all select 1 from public.knowledge_pages union all select 1 from public.projects union all select 1 from public.habits union all select 1 from public.fin_transactions union all select 1 from public.drive_files union all select 1 from public.vault_items) rows)`;
const PROOF_SQL = `select jsonb_build_object(
 'provenance',jsonb_build_object('namespace',:'sc_namespace','sourceSha',:'sc_sha','systemIdentifier',(select system_identifier::text from pg_control_system()),'database',current_database(),'currentUser',current_user,'serverVersion',current_setting('server_version_num')::integer,
 'markerRows',(select coalesce(jsonb_agg(jsonb_build_object('namespace',namespace,'sourceSha',source_sha,'systemIdentifier',system_identifier)),'[]'::jsonb) from app_private.sc_admin_ci_marker where namespace=:'sc_namespace' and source_sha=:'sc_sha' and system_identifier=:'sc_system' and project_id=:'sc_project' and (select count(*) from app_private.sc_admin_ci_marker)=1)),
 'users',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'app_metadata',raw_app_meta_data,'banned_until',banned_until,'deleted_at',deleted_at,'is_anonymous',is_anonymous) order by id),'[]'::jsonb) from auth.users),
 'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'not_after',not_after) order by user_id,id),'[]'::jsonb) from auth.sessions),
 'refreshTokens',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'revoked',revoked) order by id),'[]'::jsonb) from auth.refresh_tokens),
 'roles',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id),'[]'::jsonb) from (select user_id,role from public.user_roles) r),
 'moderation',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id),'[]'::jsonb) from (select user_id,status,must_change_password from public.user_moderation) r),
 'entitlements',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id,feature_key),'[]'::jsonb) from (select user_id,feature_key,allowed from public.user_entitlements) r),
 'operations',(select coalesce(jsonb_agg(to_jsonb(o) order by created_at,ctid),'[]'::jsonb) from app_private.admin_operations o),
 'audit',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'actor_user_id',actor_user_id,'target_user_id',target_user_id,'operation_id',operation_id,'action',action,'phase',phase,'occurred_at',occurred_at) order by occurred_at,ctid),'[]'::jsonb) from public.admin_audit_events),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at,command,client_id),'[]'::jsonb) from app_private.command_receipts r),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'entity_type',entity_type,'entity_id',entity_id,'action',action,'canal',canal,'occurred_at',occurred_at,'before',"before",'after',"after") order by occurred_at,ctid),'[]'::jsonb) from public.domain_events),
 'usableMasters',(select coalesce(jsonb_agg(user_id order by user_id),'[]'::jsonb) from public.user_roles where role='master' and app_private.admin_usable_master(user_id)),
 'preserveSqlState',nullif(current_setting('sc.admin_ci_preserve',true),''),'personalRows',${PERSONAL});`;
const LAST_MASTER = `do $probe$ declare state text;begin
 begin perform app_private.admin_preserve_master(current_setting('sc.admin_ci_actor')::uuid);exception when others then get stacked diagnostics state=returned_sqlstate;end;
 if state is distinct from '23514' then raise exception 'CI preservation proof refused.' using errcode='P0001';end if;
 perform set_config('sc.admin_ci_preserve',state,true);end $probe$;`;
function prefix(context, actors, request) { return variables({ sc_namespace: context.namespace, sc_sha: context.sourceSha, sc_system: context.systemIdentifier, sc_project: context.projectId, sc_a: actors.a.id, sc_as: actors.a.sessionId, sc_b: actors.b.id, sc_bs: actors.b.sessionId, sc_execution: request.executionId, sc_operation: request.operationId ?? "null", sc_target: request.targetId ?? "null" }); }
export function adminInspectionInput(context, actors, request) {
  if (!ADMIN_NATIVE_CASES.includes(context.case) || !NS.test(context.namespace) || !SHA.test(context.sourceSha) || !SYSTEM.test(context.systemIdentifier) || !PROJECT.test(context.projectId)) fail("LOCAL_SQL_REFUSED");
  const verified = validateAdminActors(actors, context.namespace);
  if (!exact(request, ["query", "case", "sourceSha", "namespace", "systemIdentifier", "actorId", "targetId", "executionId", "operationId", "signal"]) || !ADMIN_INSPECTION_ORDER[context.case].includes(request.query) || request.case !== context.case || request.sourceSha !== context.sourceSha || request.namespace !== context.namespace || request.systemIdentifier !== context.systemIdentifier || request.actorId !== verified.a.id || !UUID.test(request.executionId) || request.operationId !== null && !UUID.test(request.operationId) || request.targetId !== null && !UUID.test(request.targetId) || !(request.signal instanceof AbortSignal) || request.signal.aborted || [verified.a.id, verified.b.id, verified.a.sessionId, verified.b.sessionId].includes(request.executionId) || request.operationId === request.executionId || context.case !== "CREATE_FORCED" && request.targetId !== verified.b.id || context.case === "CREATE_FORCED" && request.targetId !== null && [verified.a.id, verified.b.id, verified.a.sessionId, verified.b.sessionId].includes(request.targetId)) fail("LOCAL_SQL_REFUSED");
  return prefix(context, verified, request) + `begin read only;set local statement_timeout='10s';set local lock_timeout='2s';\n` + (request.query === "ASSERT_LAST_MASTER" ? `set local sc.admin_ci_actor=:'sc_a';\n${LAST_MASTER}\n` : "") + PROOF_SQL + "\nrollback;";
}
export function acceptAdminProof(value, context) {
  if (!exact(value, ["provenance", "users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "operations", "audit", "receipts", "events", "usableMasters", "preserveSqlState", "personalRows"]) || !exact(value.provenance, ["namespace", "sourceSha", "systemIdentifier", "database", "currentUser", "serverVersion", "markerRows"])) fail("LOCAL_SQL_REFUSED");
  const p = value.provenance; verifyAdminInstance({ database: p.database, currentUser: p.currentUser, serverVersion: p.serverVersion, systemIdentifier: p.systemIdentifier }, context.systemIdentifier);
  if (p.namespace !== context.namespace || p.sourceSha !== context.sourceSha || stable(p.markerRows) !== stable([{ namespace: context.namespace, sourceSha: context.sourceSha, systemIdentifier: context.systemIdentifier }]) || value.personalRows !== 0 || ![null, "23514"].includes(value.preserveSqlState) || ["users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "operations", "audit", "receipts", "events", "usableMasters"].some(k => !Array.isArray(value[k]) || value[k].length > 128)) fail("LOCAL_SQL_REFUSED");
  return value;
}
export function createAdminSqlInspector(options) {
  if (!options || typeof options.query !== "function" || typeof options.allowed !== "function") fail("LOCAL_SQL_REFUSED");
  const context = Object.freeze({ ...options.context }), actors = validateAdminActors(options.actors, context.namespace), order = ADMIN_INSPECTION_ORDER[context.case]; if (!order) fail("LOCAL_SQL_REFUSED");
  let next = 0, pending = 0, closed = false, refused = false, execution, target, operation, retained;
  return Object.freeze({
    async inspect(request) {
      let input;
      try {
        if (closed || refused || pending || options.allowed() !== true || request.query !== order[next]) fail("LOCAL_SQL_REFUSED");
        input = adminInspectionInput(context, actors, request);
        if (execution && execution !== request.executionId || context.case === "CREATE_FORCED" && next === 0 && (request.operationId !== null || request.targetId !== null) || next === 0 && request.operationId !== null || target && request.targetId !== target || operation && request.operationId !== operation && request.query !== "DEMOTION") fail("LOCAL_SQL_REFUSED");
      } catch { refused = true; fail("LOCAL_SQL_REFUSED"); }
      execution ??= request.executionId; pending++; let aborted = false; const revoke = () => { aborted = true; closed = true; }; request.signal.addEventListener("abort", revoke, { once: true });
      try {
        const proof = acceptAdminProof(await options.query(input), context);
        if (closed || aborted || request.signal.aborted || options.allowed() !== true) fail("LOCAL_SQL_REFUSED");
        const ids = [actors.a.id, actors.b.id];
        if (request.targetId !== null && context.case === "CREATE_FORCED") ids.push(request.targetId);
        if (proof.users.some(u => !ids.includes(u.id) || u.id !== request.targetId && u.app_metadata?.sc_admin_native_fixture !== context.namespace) || proof.sessions.some(s => !ids.includes(s.user_id)) || proof.operations.some(o => o.actor_user_id !== actors.a.id || o.target_user_id !== request.targetId)) fail("LOCAL_SQL_REFUSED");
        if (next === 0 && (proof.users.length !== 2 || !actors.a || proof.sessions.length !== 2 || !actorsListBound(proof, actors, context.namespace) || proof.operations.length || proof.audit.length || proof.receipts.length)) fail("LOCAL_SQL_REFUSED");
        if (request.operationId !== null) { const row = proof.operations.find(o => o.operation_id === request.operationId); if (!row || row.actor_user_id !== actors.a.id || row.target_user_id !== request.targetId || row.active_execution !== null && row.active_execution !== execution || row.command !== (context.case === "BLOCK_OLD_JWT" ? "admin.user.block" : context.case === "CREATE_FORCED" ? "admin.user.create" : "admin.user.role")) fail("LOCAL_SQL_REFUSED"); operation = request.operationId; target = request.targetId; }
        if (request.query === "CLEANUP_RETAINED") retained = proof;
        next++; return proof;
      } catch { refused = true; fail("LOCAL_SQL_REFUSED"); }
      finally { request.signal.removeEventListener("abort", revoke); pending--; }
    },
    async retained() {
      if (closed || refused || pending || next !== order.length || !retained || options.allowed() !== true) fail("RETAINED_SQL_REFUSED"); pending++;
      try { const value = acceptAdminProof(await options.query(variables({ sc_namespace: context.namespace, sc_sha: context.sourceSha, sc_system: context.systemIdentifier, sc_project: context.projectId }) + `begin read only;set local statement_timeout='10s';set local lock_timeout='2s';${PROOF_SQL}rollback;`), context); if (closed || options.allowed() !== true || ["users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "receipts", "events"].some(k => value[k].length) || stable(value.operations) !== stable(retained.operations) || stable(value.audit) !== stable(retained.audit) || value.operations.some(o => o.phase !== "complete" || o.active_execution !== null)) fail("RETAINED_SQL_REFUSED"); return true; } finally { pending--; }
    },
    metadata: () => Object.freeze({ pending, closed, refused, completed: next === order.length, queriesCompleted: next }), close() { closed = true; },
  });
}
function actorsListBound(proof, actors, namespace) { return [actors.a, actors.b].every(a => proof.users.some(u => u.id === a.id && u.app_metadata?.sc_admin_native_fixture === namespace && !u.deleted_at && u.is_anonymous === false) && proof.sessions.some(s => s.id === a.sessionId && s.user_id === a.id)); }
export function adminBootstrapInput(context, input) {
  const actors = validateAdminActors(input, context.namespace);
  return variables({ sc_a: actors.a.id, sc_as: actors.a.sessionId, sc_b: actors.b.id, sc_bs: actors.b.sessionId, sc_namespace: context.namespace }) + `begin;set local statement_timeout='10s';
set local sc.admin_ci_a=:'sc_a';set local sc.admin_ci_as=:'sc_as';set local sc.admin_ci_b=:'sc_b';set local sc.admin_ci_bs=:'sc_bs';set local sc.admin_ci_namespace=:'sc_namespace';
do $guard$ begin if (select count(*) from auth.users)<>2 or (select count(*) from auth.sessions)<>2 or (select count(*) from public.user_roles)<>2 or exists(select 1 from public.user_roles where role<>'user') or (select count(*) from public.user_moderation)<>2 or exists(select 1 from public.user_moderation where status<>'active' or must_change_password) or exists(select 1 from public.user_entitlements) or exists(select 1 from app_private.admin_operations) or exists(select 1 from public.admin_audit_events)
or not exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=current_setting('sc.admin_ci_a')::uuid and s.id=current_setting('sc.admin_ci_as')::uuid and u.raw_app_meta_data->>'sc_admin_native_fixture'=current_setting('sc.admin_ci_namespace') and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()))
or not exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=current_setting('sc.admin_ci_b')::uuid and s.id=current_setting('sc.admin_ci_bs')::uuid and u.raw_app_meta_data->>'sc_admin_native_fixture'=current_setting('sc.admin_ci_namespace') and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()))
then raise exception 'CI ordinary fixture refused.';end if;end $guard$;
select app_private.bootstrap_master(:'sc_a'::uuid);commit;
begin read only;select jsonb_build_object('ordinaryBound',exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=:'sc_a'::uuid and s.id=:'sc_as'::uuid and u.raw_app_meta_data->>'sc_admin_native_fixture'=:'sc_namespace') and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=:'sc_b'::uuid and s.id=:'sc_bs'::uuid and u.raw_app_meta_data->>'sc_admin_native_fixture'=:'sc_namespace'),'masters',(select coalesce(jsonb_agg(user_id),'[]'::jsonb) from public.user_roles where role='master' and app_private.admin_usable_master(user_id)));rollback;`;
}
const FORMAT = '{"id":{{json .Id}},"name":{{json .Name}},"label":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"imageId":{{json .Image}},"ports":{{json .NetworkSettings.Ports}}}';
export function acceptAdminContainer(v, projectId, kind) { if (!PROJECT.test(projectId) || !["db", "kong", "auth", "rest", "storage"].includes(kind) || !exact(v, ["id", "name", "label", "running", "imageId", "ports"]) || !/^[a-f0-9]{64}$/.test(v.id) || v.name !== `/supabase_${kind}_${projectId}` || v.label !== projectId || v.running !== true || !/^sha256:[a-f0-9]{64}$/.test(v.imageId) || !v.ports || typeof v.ports !== "object") fail("LOCAL_NAMESPACE_REFUSED"); if (["db", "kong"].includes(kind)) { const list = v.ports[kind === "db" ? "5432/tcp" : "8000/tcp"]; if (!Array.isArray(list) || list.length < 1 || list.length > 2 || list.some(p => !exact(p, ["HostIp", "HostPort"]) || !["127.0.0.1", "0.0.0.0", "::"].includes(p.HostIp) || p.HostPort !== (kind === "db" ? "54322" : "54321"))) fail("LOCAL_NAMESPACE_REFUSED"); } return v.id; }
async function canonical(path) { const file = assertTempDescendant(ROOT, resolve(ROOT, path)), stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || await realpath(file) !== file) fail("SOURCE_REFUSED"); return readFile(file); }
/** The official tslib2.8.1 module scope is not a second npm package. Its exact
 * bytes and the versioned parent tarball pin are both checked before ascent. */
export function verifyAdminTslibScope(path, bytes, rootPackage, rootPin) {
  if (path !== "node_modules/tslib/modules/package.json" || !(bytes instanceof Uint8Array) || bytes.byteLength !== 26 || hash(bytes) !== "f2a77d1fa2e7ee710b2835b2933d75d9c7f5dad4f1bab69e1679876e32b5e9eb") fail("SOURCE_REFUSED");
  let value; try { value = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { fail("SOURCE_REFUSED"); }
  if (!exact(value, ["type"]) || value.type !== "module" || rootPackage?.name !== "tslib" || rootPackage?.version !== "2.8.1" || rootPin?.version !== "2.8.1" || rootPin?.resolved !== "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz" || rootPin?.integrity !== "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==") fail("SOURCE_REFUSED");
  return true;
}
export async function collectAdminSources(run, expectedSha) {
  const sha = (await run("git", ["rev-parse", "HEAD"], 15000)).stdout.trim(); if (!SHA.test(sha) || expectedSha !== undefined && sha !== expectedSha) fail("SOURCE_REFUSED");
  const sourceHashes = []; for (const path of ADMIN_LOCAL_SOURCE_PATHS) { const bytes = await canonical(path), blob = (await run("git", ["show", "HEAD:" + path], 15000)).stdout; if (typeof blob !== "string" || !bytes.equals(Buffer.from(blob))) fail("SOURCE_REFUSED"); sourceHashes.push({ path, sha256: hash(bytes), bytes: bytes.length }); }
  const lock = JSON.parse((await canonical("package-lock.json")).toString("utf8")), dependencyHashes = [];
  for (const path of ADMIN_LOCAL_DEPENDENCY_PATHS) {
    const bytes = await canonical(path); let folder = dirname(resolve(ROOT, path)), verified = false;
    while (folder.startsWith(resolve(ROOT, "node_modules"))) {
      const key = folder.slice(ROOT.length).replaceAll("\\", "/").replace(/^\//, "");
      let packageBytes;
      try { packageBytes = await canonical(key + "/package.json"); } catch (error) { if (error.code !== "ENOENT") fail("SOURCE_REFUSED"); folder = dirname(folder); continue; }
      let pkg; try { pkg = JSON.parse(packageBytes.toString("utf8")); } catch { fail("SOURCE_REFUSED"); }
      if (key === "node_modules/tslib/modules") { const rootPackage = JSON.parse((await canonical("node_modules/tslib/package.json")).toString("utf8")); verifyAdminTslibScope(key + "/package.json", packageBytes, rootPackage, lock.packages["node_modules/tslib"]); folder = dirname(folder); continue; }
      const pin = lock.packages[key];
      if (!pin || pkg.name !== key.slice("node_modules/".length) || pin.version !== pkg.version || !/^https:\/\/registry\.npmjs\.org\//.test(pin.resolved) || !/^sha512-/.test(pin.integrity)) fail("SOURCE_REFUSED");
      verified = true; break;
    }
    if (!verified) fail("SOURCE_REFUSED"); dependencyHashes.push({ path, sha256: hash(bytes), bytes: bytes.length });
  }
  for (const [name, version] of Object.entries(ADMIN_LOCAL_SDK_VERSIONS)) if (JSON.parse(await readFile(resolve(ROOT, "node_modules", name, "package.json"), "utf8")).version !== version || lock.packages["node_modules/" + name]?.version !== version) fail("SOURCE_REFUSED");
  if (sourceHashes.length !== 47 || dependencyHashes.length !== 45) fail("SOURCE_REFUSED"); return { sourceSha: sha, sourceHashes, dependencyHashes };
}
async function freePort(port) { await new Promise((done, reject) => { const s = createServer(); s.once("error", () => reject(new Error("PORT_REFUSED"))); s.listen({ host: "127.0.0.1", port, exclusive: true }, () => s.close(e => e ? reject(new Error("PORT_REFUSED")) : done())); }); }
/** Injectable fetch is a named pure-test seam, never a provenance authority. */
export function createAdminOwnedTransport(nativeFetch = fetch) {
  if (typeof nativeFetch !== "function") fail("ENVIRONMENT_REFUSED"); const owned = new Set();
  return Object.freeze({
    transport(url, init) {
      const task = (async () => {
        const response = await nativeFetch(url, init);
        // Check original URL before rehydration can erase it. Empty URLs on
        // synthetic Response objects are accepted only as explicit test seams.
        if (!(response instanceof Response) || response.redirected || response.url && response.url !== url) { if (response instanceof Response && response.body) await response.body.cancel().catch(() => {}); fail("CASE_FAILED"); }
        const parts = []; let bytes = 0, reader;
        try {
          if (response.body) { reader = response.body.getReader(); for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 1048576) fail("CASE_FAILED"); parts.push(part.value); } }
          const all = new Uint8Array(bytes); let at = 0; for (const p of parts) { all.set(p, at); at += p.byteLength; }
          return new Response(response.body ? all : null, { status: response.status, headers: response.headers });
        } finally { parts.forEach(p => p.fill(0)); if (reader) await reader.cancel().catch(() => {}); }
      })().finally(() => owned.delete(task)); owned.add(task); return task;
    },
    metadata: () => Object.freeze({ pending: owned.size }),
  });
}
function notRun(kind) { return { case: kind, status: "not-run", code: "NOT_RUN", phase: "not-run", migrationsApplied: 0, catalogueChecks: 0, checks: Object.fromEntries(ADMIN_LOCAL_INFRA_CHECKS.map(k => [k, false])), report: null, writeOutcomeUncertain: false }; }
export async function runAdminNativeLocalCi(environment = process.env) {
  const report = { schemaVersion: 1, scenario: "admin-native-backend-local-ci", status: "failed", code: "ENVIRONMENT_REFUSED", phase: "environment", sourceSha: null, sourceHashes: [], dependencyHashes: [], sdkVersions: { ...ADMIN_LOCAL_SDK_VERSIONS }, cliVersion: CLI_VERSION, checks: { environment: false, sources: false }, cases: ADMIN_NATIVE_CASES.map(notRun), packet: null, limitations: Object.fromEntries(ADMIN_LOCAL_LIMITATIONS.map(k => [k, false])), writeOutcomeUncertain: false };
  const retain = code => { report.code = ADMIN_LOCAL_CODES.includes(code) ? code : "CASE_FAILED"; };
  let runnerTemp;
  try {
    ({ runnerTemp } = requireAdminCi(environment)); if (await realpath(runnerTemp) !== runnerTemp || !(await lstat(runnerTemp)).isDirectory()) fail("ENVIRONMENT_REFUSED"); await assertNoEnvironmentFiles(ROOT); report.checks.environment = true;
    const readRun = (command, args, timeoutMs, options = {}) => runBoundedProcess(command, args, { cwd: ROOT, env: { PATH: environment.PATH, LANG: environment.LANG ?? "C.UTF-8", LC_ALL: environment.LC_ALL ?? "C.UTF-8", TZ: "UTC", NO_COLOR: "1" }, timeoutMs, maxBytes: 2097152, ...options });
    report.phase = "sources"; Object.assign(report, await collectAdminSources(readRun, environment.GITHUB_SHA)); report.checks.sources = true;
    const migrations = await loadCanonicalMigrations(ROOT), template = (await canonical("tests/fixtures/supabase-auth-local/config.toml")).toString("utf8");
    for (const entry of report.cases) {
      entry.status = "failed"; entry.code = "CASE_FAILED"; let runRoot, home, project, local, inspector, started = false, groupsKnown = true, unknown = false, caseActive = false, systemIdentifier;
      const projectId = "sc-auth-ci-" + randomBytes(12).toString("hex"), namespace = "sc-admin-native-" + randomBytes(16).toString("hex"), processes = new Set(), ownedHttp = createAdminOwnedTransport(); let child;
      const phase = value => { entry.phase = report.phase = value; };
      const run = async (command, args, timeoutMs, options = {}) => {
        const owned = runBoundedProcess(command, args, { cwd: ROOT, env: child, timeoutMs, maxBytes: 1048576, ...options }).finally(() => processes.delete(owned)); processes.add(owned);
        try { const result = await owned; if (result.groupConfirmed !== true) { groupsKnown = false; fail("COMMAND_GROUP_UNCONFIRMED"); } return result; } catch (error) { if (error.groupConfirmed !== true) groupsKnown = false; throw error; }
      };
      const cli = args => ["--workdir", project, ...args];
      const inventory = async () => { const results = []; for (const args of [["ps", "--all", "--quiet"], ["volume", "ls", "--quiet"], ["network", "ls", "--quiet"]]) results.push(await run("docker", [...args, "--filter", `label=com.supabase.cli.project=${projectId}`], 15000)); return results.every(r => r.stdout.trim() === ""); };
      // Own the original headers AND body promise. Abort is not settlement.
      const transport = ownedHttp.transport;
      try {
        phase("ports"); for (const port of [54320, 54321, 54322]) await freePort(port);
        phase("private-directories"); runRoot = await mkdtemp(join(runnerTemp, "sc-admin-local-ci-")); await chmod(runRoot, 0o700); home = join(runRoot, "home"); project = join(runRoot, "project"); await mkdir(home, { mode: 0o700 }); await mkdir(join(project, "supabase"), { recursive: true, mode: 0o700 }); await writeFile(join(project, "supabase/config.toml"), renderLocalConfig(template, projectId), { flag: "wx", mode: 0o600 });
        child = { PATH: environment.PATH, LANG: environment.LANG ?? "C.UTF-8", LC_ALL: environment.LC_ALL ?? "C.UTF-8", TZ: "UTC", HOME: home, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"), CI: "true", GITHUB_ACTIONS: "true", RUNNER_TEMP: runnerTemp, SC_AUTH_LOCAL_CI_RUN: "1", SC_ADMIN_NATIVE_LOCAL_CI_RUN: "1", NO_COLOR: "1" };
        phase("cli-help"); if ((await run("supabase", ["--version"], 15000)).stdout.trim() !== CLI_VERSION) fail("ENVIRONMENT_REFUSED"); for (const [command, flags] of [["--help", ["--workdir", "start", "stop", "status"]], ["start", []], ["stop", ["--project-id", "--no-backup"]], ["status", ["--output"]]]) { const help = (await run("supabase", command === "--help" ? [command] : [command, "--help"], 15000)).stdout; if (flags.some(f => !help.includes(f))) fail("ENVIRONMENT_REFUSED"); }
        if (!await inventory()) fail("LOCAL_NAMESPACE_REFUSED"); entry.checks.ownedNamespace = true;
        phase("stack-start"); started = true; await run("supabase", cli(["start"]), 600000, { capture: false });
        phase("local-status"); local = decodeLocalStatus((await run("supabase", cli(["status", "-o", "json"]), 30000)).stdout); const pg = localPsqlEnvironment(environment, home, local);
        const query = async input => decodeAdminSql((await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--file=-"], 12000, { env: pg, input })).stdout);
        const write = async input => { try { await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--set", "ON_ERROR_STOP=1", "--file=-"], 60000, { env: pg, input, capture: false }); } catch { unknown = true; fail("WRITE_OUTCOME_UNCERTAIN"); } };
        phase("database-preflight"); systemIdentifier = verifyAdminInstance(await query(ADMIN_INSTANCE_SQL)); entry.checks.pg17 = entry.checks.instanceIdentity = true;
        const containerIds = new Set(); for (const kind of ["db", "kong", "auth", "rest", "storage"]) { const value = decodeAdminSql((await run("docker", ["inspect", "--format", FORMAT, `supabase_${kind}_${projectId}`], 15000)).stdout), id = acceptAdminContainer(value, projectId, kind); if (containerIds.has(id)) fail("LOCAL_NAMESPACE_REFUSED"); containerIds.add(id); } entry.checks.services = true;
        assertDatabasePreflight(await query(DATABASE_PREFLIGHT), false);
        phase("local-infrastructure"); await write(LOCAL_INFRASTRUCTURE_FIXTURE); assertDatabasePreflight(await query(DATABASE_PREFLIGHT));
        phase("migrations"); for (const migration of migrations) { await write(migration.source); entry.migrationsApplied++; }
        phase("catalogue"); const catalogue = await query((await canonical("supabase/tests/release-catalog.sql")).toString("utf8")); if (catalogue?.version !== 1 || catalogue?.ok !== true || catalogue?.checks !== 1246 || !Array.isArray(catalogue.deviations) || catalogue.deviations.length) fail("LOCAL_SQL_REFUSED"); entry.catalogueChecks = 1246; entry.checks.catalogue = true;
        const context = { case: entry.case, namespace, sourceSha: report.sourceSha, systemIdentifier, projectId };
        phase("marker"); await write(adminMarkerInput(context, catalogue)); entry.checks.markerBound = true;
        phase("schema-reload"); await write("notify pgrst, 'reload schema';"); caseActive = true;
        phase("protocol"); entry.report = await runAdminLocalCase({ ci: true, githubActions: true, localAdminRun: true, supabaseUrl: "http://127.0.0.1:54321", ...context, publishableKey: local.publishable, serverSecretKey: local.secret, commitmentSecret: randomBytes(48).toString("base64url") }, {
          transport,
          cleanupAllowed: () => caseActive && !unknown && groupsKnown && !ownedHttp.metadata().pending && !processes.size && inspector?.metadata().pending === 0,
          registerActors: async actors => { if (!caseActive || inspector || unknown) fail("LOCAL_SQL_REFUSED"); const verified = validateAdminActors(actors, namespace); phase("bootstrap"); let value; try { value = await query(adminBootstrapInput(context, verified)); } catch { unknown = true; fail("BOOTSTRAP_REFUSED"); } if (!exact(value, ["ordinaryBound", "masters"]) || value.ordinaryBound !== true || JSON.stringify(value.masters) !== JSON.stringify([verified.a.id])) fail("BOOTSTRAP_REFUSED"); inspector = createAdminSqlInspector({ context, actors: verified, query, allowed: () => caseActive && groupsKnown && !unknown }); phase("protocol"); },
          inspectSql: request => { if (!inspector) fail("LOCAL_SQL_REFUSED"); return inspector.inspect(request); }, retainedSql: () => { if (!inspector) fail("RETAINED_SQL_REFUSED"); return inspector.retained(); },
        }); unknown ||= entry.report.writeOutcomeUncertain; if (entry.report.status !== "passed") fail(entry.report.code);
      } catch (error) { if (caseActive && !entry.report) unknown = true; entry.code = ADMIN_LOCAL_CODES.includes(error?.message) ? error.message : "CASE_FAILED"; }
      finally {
        caseActive = false; inspector?.close();
        // These booleans describe parent exit + the shared group helper, not
        // whether each descendant received a force signal during verification.
        const quiet = groupsKnown && processes.size === 0 && ownedHttp.metadata().pending === 0 && (!inspector || inspector.metadata().pending === 0) && (!entry.report || !entry.report.pendingRequests && !entry.report.pendingInspections); entry.checks.groupsQuiescent = quiet;
        if (quiet && started) { try { phase("teardown"); await run("supabase", cli(["stop", "--project-id", projectId, "--no-backup"]), 120000, { capture: false }); entry.checks.namespaceCleanup = await inventory(); } catch { entry.code = "TEARDOWN_UNCONFIRMED"; } }
        if (quiet && runRoot && (!started || entry.checks.namespaceCleanup)) { try { assertTempDescendant(runnerTemp, runRoot); const st = await lstat(runRoot); if (st.isSymbolicLink() || await realpath(runRoot) !== runRoot) fail("ENVIRONMENT_REFUSED"); await rm(runRoot, { recursive: true, force: false }); entry.checks.directoriesRemoved = true; if (!started) entry.checks.namespaceCleanup = true; } catch { entry.code = "TEARDOWN_UNCONFIRMED"; } }
        entry.checks.groupsQuiescent = quiet && groupsKnown && processes.size === 0;
        if (!entry.checks.groupsQuiescent || started && !entry.checks.namespaceCleanup || runRoot && !entry.checks.directoriesRemoved) entry.code = "TEARDOWN_UNCONFIRMED";
        entry.writeOutcomeUncertain = unknown; report.writeOutcomeUncertain ||= unknown;
        if (entry.report?.status === "passed" && !unknown && ADMIN_LOCAL_INFRA_CHECKS.every(k => entry.checks[k])) { entry.status = "passed"; entry.code = "PASSED"; entry.phase = "complete"; } else entry.status = "failed";
        local = undefined; systemIdentifier = undefined;
      }
      if (entry.status !== "passed") { retain(entry.code); break; }
    }
    if (report.cases.every(e => e.status === "passed")) { report.status = "passed"; report.code = "PASSED"; report.phase = "complete"; }
  } catch (error) { retain(error?.message); }
  if (report.checks.sources) report.packet = assembleAdminNativePacket({ sourceSha: report.sourceSha, cases: report.cases.map(e => ({ case: e.case, report: e.report?.pipeline ?? null, cleanup: e.report?.cleanup ?? null, namespaceCleanup: e.report?.pipeline ? e.checks.namespaceCleanup ? "confirmed" : "failed" : "not-run" })), writeOutcomeUncertain: report.writeOutcomeUncertain });
  return validateAdminLocalCiReport(report);
}
export async function main(argv = process.argv.slice(2), environment = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  if (!argv.length || argv.length === 1 && argv[0] === "--help") { output({ schemaVersion: 1, scenario: "admin-native-backend-local-ci", code: "NO_SERVICE_STARTED", hostedAccess: false }); return 0; }
  if (argv.length !== 1 || argv[0] !== "--execute") { output({ schemaVersion: 1, scenario: "admin-native-backend-local-ci", code: "ARGUMENTS_REFUSED" }); return 1; }
  try { const value = await runAdminNativeLocalCi(environment); output(value); return value.status === "passed" ? 0 : 1; } catch { output({ schemaVersion: 1, scenario: "admin-native-backend-local-ci", status: "failed", code: "REPORT_REFUSED" }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
