/** Canonical disposable SQL -> production SDK/runtime/Gateway -> real GETs.
 * Auth identity/config and closed RPC fetch are explicit seams. No hosted Auth,
 * PostgREST, runtime credentials, browser, CSS or static successful RPC pages.
 * Independent SELECTs are the oracle; the browser bridge is compared separately.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import type { CaptureTaskUnitOfWork, ContextoDeEscrita, DependenciasDeDominio } from "../../src/core/contracts";
import type { ActivityCursor, ActivityPage } from "../../src/core/activity";
import type { DemoQueries } from "../../src/lib/demo/types";
const seams = vi.hoisted(() => ({ config: vi.fn(), identity: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: async () => ({ gateway: { readIdentity: seams.identity } }) }));
import { GET as captureTaskGet } from "../../src/app/api/capture-tasks/route";
import { GET as activityGet } from "../../src/app/api/activity/route";
import { createCaptureTaskGateway, type CaptureTaskCommand, type CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import { captureTaskGatewayForRequest } from "../../src/adapters/db/capture-task-runtime";
import { createCaptureTaskStore } from "../../src/adapters/db/capture-task-store";
import { createActivityGateway, type ActivityRpc } from "../../src/adapters/db/activity-gateway";
import { activityQuery } from "../../src/adapters/db/activity-query";
import { arquivarCaptura, converterCapturaEmTarefa, criarCaptura, editarCaptura, excluirCaptura, type NovaCaptura } from "../../src/core/capturas";
import { criarTarefa, type NovaTarefa } from "../../src/core/tarefas";
import { projectCaptures, projectTasks } from "../../src/components/features/inicio/projections";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";

const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://read-composition.invalid", supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co",
  publishableKey: "sb_publishable_SYNTHETIC", secretKey: "sb_secret_SYNTHETIC", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
const frozenNow = "2026-10-11T02:30:00.000Z";
let db: PGlite, owner: AuthenticatedIdentity, foreign: AuthenticatedIdentity, now: string, sequence = 0;
const uuid = () => `53000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
const deps: DependenciasDeDominio = { ids: { next: uuid }, clock: { now: () => now } };
type RpcName = Parameters<CaptureTaskRpc>[0] | "activity_page";
const signatures: Record<RpcName, { sql: string; extra: readonly string[]; optional?: readonly string[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: ["p_operation"] },
  capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: ["p_operation"] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_operation", "p_command", "p_client_id"] },
  capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_operation", "p_request"] },
  activity_page: { sql: "select public.activity_page($1::uuid,$2::uuid,$3::integer,$4::timestamptz,$5::uuid) as data", extra: ["p_limit"], optional: ["p_before_time", "p_before_id"] },
};
const rpcCalls: { name: RpcName; args: Record<string, unknown> }[] = [];
function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("RPC arguments must be an object.");
}
async function canonicalRpc(name: RpcName, value: unknown): Promise<{ data: unknown; error: { code?: string } | null }> {
  record(value); const args = value, signature = signatures[name];
  const actor = [owner, foreign].find(actor => actor.userId === args.p_user);
  expect(actor).toBeDefined(); expect(args.p_session).toBe(actor!.sessionId);
  const optional = signature.optional ?? [];
  expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", ...signature.extra, ...optional.filter(key => Object.hasOwn(args, key))].sort());
  if (name === "activity_page") expect(Object.hasOwn(args, "p_before_time")).toBe(Object.hasOwn(args, "p_before_id"));
  rpcCalls.push({ name, args: structuredClone(args) });
  const values = [args.p_user, args.p_session, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key]), ...optional.map(key => args[key] ?? null)];
  try {
    const result = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{ data: unknown }>(signature.sql, values);
    });
    return { data: result.rows[0]!.data, error: null };
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error;
    return { data: null, error: { code: error.code } };
  }
}
const rpcFetch = vi.fn<typeof fetch>(async (input, options) => {
  const request = new Request(input, options), url = new URL(request.url);
  const name = url.pathname.slice("/rest/v1/rpc/".length);
  if (url.origin !== config.supabaseUrl || url.search || !url.pathname.startsWith("/rest/v1/rpc/") || !Object.hasOwn(signatures, name)) throw new Error("Only fixed offline RPC targets are allowed.");
  expect(request.method).toBe("POST"); expect(options?.cache).toBe("no-store");
  const result = await canonicalRpc(name as RpcName, await request.json());
  return result.error ? Response.json(result.error, { status: 400 }) : Response.json(result.data);
});
const captureRpc: CaptureTaskRpc = canonicalRpc;
const activityRpc: ActivityRpc = args => canonicalRpc("activity_page", args);
beforeAll(async () => { db = await createLocalCanonicalSql(); }, 30_000);
beforeEach(async () => {
  now = frozenNow; rpcCalls.length = 0; rpcFetch.mockClear();
  async function actor(label: string): Promise<AuthenticatedIdentity> {
    const userId = uuid(), sessionId = uuid();
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [userId, `${label}-${userId}@read.invalid`]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [sessionId, userId]);
    return { userId, sessionId, role: "user", mustChangePassword: false, entitlements: {} };
  }
  owner = await actor("owner"); foreign = await actor("foreign");
  seams.config.mockReturnValue(config); seams.identity.mockResolvedValue(owner);
  vi.stubGlobal("fetch", rpcFetch);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => { await db?.close(); });

function run<T>(actor: AuthenticatedIdentity, operation: CaptureTaskCommand, work: (store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita) => Promise<T>) {
  const gateway = captureTaskGatewayForRequest(config, actor, operation);
  return work(createCaptureTaskStore(gateway), deps, { user_id: actor.userId, canal: "web" });
}
const capture = (actor: AuthenticatedIdentity, client_id: string, title: string, patch: Partial<NovaCaptura> = {}) => run(actor, "capture.create", (store, deps, context) => criarCaptura(store, deps, context, { client_id, type: "note", title, content: "PRIVATE_CAPTURE_BODY", category_id: null, project_id: null, ...patch }));
const task = (actor: AuthenticatedIdentity, client_id: string, title: string, patch: Partial<NovaTarefa> = {}) => run(actor, "task.create", (store, deps, context) => criarTarefa(store, deps, context, { client_id, title, description: "PRIVATE_TASK_BODY", category_id: null, project_id: null, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null, ...patch }));
function request(path: string, expected = owner.userId) { return new Request(config.appOrigin + path, { headers: { "X-Expected-User-ID": expected } }); }
function privateRead(response: Response) {
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}
async function expectedCaptureTask(kind: "captures" | "tasks", userId: string) {
  // Literal SELECTs, not capture_task_snapshot or gateway-derived expectations.
  const rows = kind === "captures"
    ? await db.query<{ payload: unknown }>("select payload from public.captures where user_id=$1 order by created_at,id", [userId])
    : await db.query<{ payload: unknown }>("select payload from public.tasks where user_id=$1 order by created_at,id", [userId]);
  return rows.rows.map(row => row.payload);
}
async function bridgeCaptureTask(kind: "captures" | "tasks", actor = owner) {
  const { snapshot, projectsVisible } = await createCaptureTaskGateway(actor.userId, actor.sessionId, kind === "captures" ? "read.captures" : "read.tasks", captureRpc).presentation();
  // Exact declared browser bridge projection, compared against independent SQL too.
  return { items: kind === "captures" ? snapshot.captures : snapshot.tasks, categories: snapshot.categories,
    projects: projectsVisible ? snapshot.projects.filter(project => !project.deleted_at) : [],
    ...(kind === "captures" && snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) };
}

it("real Capture/Task GETs carry owner SQL rows through SDK/runtime to DTO and São Paulo home projections; refetch observes a Core edit", async () => {
  const inbox = await capture(owner, "inbox", "SQL_INBOX");
  const origin = await capture(owner, "organized", "SQL_ORGANIZED");
  const converted = await run(owner, "capture.convert", (store, deps, context) => converterCapturaEmTarefa(store, deps, context, { capture_id: origin.id, client_id: "convert" }));
  await capture(owner, "draft", "SQL_DRAFT", { status: "draft" });
  const archived = await capture(owner, "archive", "SQL_ARCHIVE");
  await run(owner, "capture.archive", (store, deps, context) => arquivarCaptura(store, deps, context, { id: archived.id, client_id: "archive" }));
  const trash = await capture(owner, "trash", "SQL_TRASH");
  await run(owner, "capture.delete", (store, deps, context) => excluirCaptura(store, deps, context, { id: trash.id, client_id: "trash" }));
  const today = await task(owner, "due-today", "SQL_DUE_PREVIOUS_SP_DAY", { due_at: "2026-10-11T02:59:59Z" });
  const tomorrow = await task(owner, "due-tomorrow", "SQL_DUE_NEXT_SP_DAY", { due_at: "2026-10-11T03:00:00Z" });
  const done = await task(owner, "done", "SQL_DONE_PREVIOUS_SP_DAY", { status: "done" });
  await task(owner, "task-archive", "SQL_TASK_ARCHIVE", { status: "archived" });
  await capture(foreign, "foreign", "FOREIGN_CAPTURE"); await task(foreign, "foreign", "FOREIGN_TASK");

  const dto = {} as { captures: DemoQueries["captures"]; tasks: DemoQueries["tasks"] };
  for (const kind of ["captures", "tasks"] as const) {
    const response = await captureTaskGet(request(`/api/capture-tasks?query=${kind}`)); privateRead(response);
    dto[kind] = await response.json();
    expect(dto[kind].items).toEqual(await expectedCaptureTask(kind, owner.userId));
    expect(dto[kind]).toEqual(await bridgeCaptureTask(kind));
    expect(dto[kind].categories).toEqual([]); expect(dto[kind].projects).toEqual([]);
    expect(Object.keys(dto[kind]).sort()).toEqual((kind === "captures" ? ["items", "categories", "projects", "readonlyCaptureIds"] : ["items", "categories", "projects"]).sort());
    expect(JSON.stringify(dto[kind])).not.toMatch(/FOREIGN_CAPTURE|FOREIGN_TASK|receipts|events|revision|projects_visible/);
  }
  const projectedCaptures = projectCaptures(dto.captures.items), projectedTasks = projectTasks(dto.tasks.items, frozenNow);
  expect(projectedCaptures.inbox.map(row => row.id)).toEqual([inbox.id]);
  expect(projectedCaptures).toMatchObject({ organized: 1, total: 2 });
  expect(projectedTasks.focus?.id).toBe(today.id);
  expect(projectedTasks.today.map(row => row.id)).toEqual([today.id, done.id]);
  expect(projectedTasks.today.some(row => row.id === tomorrow.id)).toBe(false);
  expect(projectedTasks).toMatchObject({ openCount: 3, completedWeek: 1 });
  expect(dto.tasks.items.find(row => row.id === converted.tarefa.id)?.origin_capture_id).toBe(origin.id);

  await run(owner, "capture.update", (store, deps, context) => editarCaptura(store, deps, context, { id: inbox.id, client_id: "refetch-edit", patch: { title: "SQL_REFETCH_UPDATED" } }));
  const refetch = await captureTaskGet(request("/api/capture-tasks?query=captures")); privateRead(refetch);
  const updated = await refetch.json() as DemoQueries["captures"];
  expect(updated.items).toEqual(await expectedCaptureTask("captures", owner.userId));
  expect(updated.items.find(row => row.id === inbox.id)?.title).toBe("SQL_REFETCH_UPDATED");
  expect(updated.items.map(row => row.id)).toEqual(dto.captures.items.map(row => row.id));
  const beforeStale = rpcCalls.length;
  expect((await captureTaskGet(request("/api/capture-tasks?query=tasks", foreign.userId))).status).toBe(409);
  expect(rpcCalls).toHaveLength(beforeStale);
  expect(rpcCalls.filter(call => call.name === "capture_task_snapshot" && call.args.p_user === owner.userId &&
    (call.args.p_operation === "read.captures" || call.args.p_operation === "read.tasks")).map(call => call.args.p_operation)).toEqual(["read.captures", "read.captures", "read.tasks", "read.tasks", "read.captures"]);
});

type SqlActivity = { id: string; occurred_at: string; entity_type: string; entity_id: string; action: string; canal: string; title: string | null };
async function independentActivity(cursor: ActivityCursor | null = null) {
  // Preserve provisioned domain records. No audit deletion or activity_page call
  // is used to build the oracle; Auth-only authentication events are not Activity.
  return (await db.query<SqlActivity>(`select id,to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as occurred_at,
    entity_type,entity_id,action,canal,coalesce(after->>'title',after->>'name',before->>'title',before->>'name') as title
    from public.domain_events where user_id=$1 and entity_type<>'authentication'
      and ($2::timestamptz is null or (occurred_at,id)<($2::timestamptz,$3::uuid))
    order by occurred_at desc,id desc`, [owner.userId, cursor?.occurred_at ?? null, cursor?.id ?? null])).rows;
}
it("real Activity GET paginates canonical SQL with owner binding, UUID ties and UTC microsecond cursors; its DTO equals the browser bridge", async () => {
  const provisioned = await independentActivity();
  for (let index = 0; index < 22; index++) {
    now = index < 5 ? "2026-10-11T01:30:00.000Z" : frozenNow;
    await capture(owner, `activity-${index}`, `ACTIVITY_SQL_${index}`);
  }
  now = "2026-10-11T03:00:00.000Z"; await capture(foreign, "foreign-latest", "FOREIGN_ACTIVITY_TITLE");
  const oracle = await independentActivity(); expect(oracle).toHaveLength(provisioned.length + 22);
  const all: ActivityPage["items"] = []; let cursor: ActivityCursor | null = null, pages = 0;
  do {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) { params.set("before_time", cursor.occurred_at); params.set("before_id", cursor.id); }
    const url = `/api/activity?${params}`;
    const response = await activityGet(request(url)); privateRead(response);
    expect(rpcCalls.at(-1)).toEqual({ name: "activity_page", args: { p_user: owner.userId, p_session: owner.sessionId, p_limit: 20,
      ...(cursor ? { p_before_time: cursor.occurred_at, p_before_id: cursor.id } : {}) } });
    const page = await response.json() as ActivityPage;
    const remaining = await independentActivity(cursor), expected = remaining.slice(0, 20), last = expected.at(-1);
    expect(page.items.map(({ changed_fields, ...row }) => { expect(Array.isArray(changed_fields)).toBe(true); return row; })).toEqual(expected);
    const expectedCursor = remaining.length > 20 ? { id: last!.id, occurred_at: last!.occurred_at } : null;
    expect(page.next_cursor).toEqual(expectedCursor);
    const bridge = await createActivityGateway(owner, activityRpc).page(activityQuery(new URL(config.appOrigin + url).searchParams));
    expect(page).toEqual(bridge);
    for (const row of page.items) {
      expect(Object.keys(row).sort()).toEqual(["id", "occurred_at", "entity_type", "entity_id", "action", "canal", "title", "changed_fields"].sort());
      if (row.entity_type === "capture") expect(row.changed_fields).toEqual(["title", "content", "type", "status"]);
    }
    expect(JSON.stringify(page)).not.toMatch(/FOREIGN_ACTIVITY_TITLE|PRIVATE_CAPTURE_BODY|PRIVATE_TASK_BODY|user_id|before"|after"|capture_task_payload|receipt|session/);
    all.push(...page.items); cursor = page.next_cursor; pages++;
  } while (cursor);
  expect(pages).toBe(2); expect(all.map(row => row.id)).toEqual(oracle.map(row => row.id));
  expect(new Set(all.map(row => row.id)).size).toBe(all.length);
  const recent = await activityGet(request("/api/activity?limit=20")); privateRead(recent);
  expect((await recent.json() as ActivityPage).items.map(row => row.id)).toEqual(oracle.slice(0, 20).map(row => row.id));
  const beforeStale = rpcCalls.length;
  expect((await activityGet(request("/api/activity?limit=20", foreign.userId))).status).toBe(409);
  expect(rpcCalls).toHaveLength(beforeStale);
  const sdkReads = rpcFetch.mock.calls.filter(([input]) => String(input).endsWith("/rpc/activity_page"));
  expect(sdkReads).toHaveLength(3); // Two real GET pages and refresh, not bridge RPCs.
});
