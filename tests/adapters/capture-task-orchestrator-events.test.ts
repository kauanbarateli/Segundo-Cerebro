/** Canonical disposable SQL + real decoders/orchestrators/Gateways/Stores.
 * Auth is a local catalogue fixture and RPC HTTP is an injected double, not
 * Supabase Auth, PostgREST, a runtime factory, hosted persistence or browser UI.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "../../src/adapters/db/capture-task-commands";
import { CAPTURE_TASK_COMMANDS, createCaptureTaskGateway, type CaptureTaskOperation, type CaptureTaskRpc, type CaptureTaskRpcArguments } from "../../src/adapters/db/capture-task-gateway";
import { createCaptureTaskStore, type CaptureTaskCommit } from "../../src/adapters/db/capture-task-store";
import { decodeKnowledgeCommand } from "../../src/adapters/db/knowledge-commands";
import { createKnowledgeGateway, type KnowledgeRpc, type KnowledgeRpcArguments, type KnowledgeRpcName } from "../../src/adapters/db/knowledge-gateway";
import { createKnowledgeStore } from "../../src/adapters/db/knowledge-store";
import { executarConhecimento, type Caderno, type Pagina } from "../../src/core/conhecimento";
import type { Captura, ConversaoCaptura } from "../../src/core/capturas";
import type { Tarefa } from "../../src/core/tarefas";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";

const owner = "41000000-0000-4000-8000-000000000001", session = "41000000-0000-4000-8000-000000000002";
const foreign = "41000000-0000-4000-8000-000000000003", origin = "https://orchestrator-fixture.invalid";
const context = { user_id: owner, canal: "web" as const };
let db: PGlite, sequence = 20, tick = 0;
const uuid = () => `41000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
const deps = { ids: { next: uuid }, clock: { now: () => new Date(Date.UTC(2026, 9, 10, 12, 0, tick)).toISOString() } };
beforeAll(async () => {
  db = await createLocalCanonicalSql();
  await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','orchestrator@example.invalid')", [owner]);
  await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [session, owner]);
}, 30_000);
afterAll(async () => { await db?.close(); });

type RpcName = Parameters<CaptureTaskRpc>[0] | KnowledgeRpcName;
type Args = CaptureTaskRpcArguments | KnowledgeRpcArguments;
const signatures: Record<RpcName, { sql: string; extra: readonly string[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  knowledge_snapshot: { sql: "select public.knowledge_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  knowledge_receipt: { sql: "select public.knowledge_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  knowledge_commit: { sql: "select public.knowledge_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
const captureBatches: CaptureTaskCommit[] = [];
const refusals: { name: string; code: string }[] = [];
let addExtraChange = false;
const transport = vi.fn<typeof fetch>(async (input, options) => {
  const request = new Request(input, options), url = new URL(request.url), name = url.pathname.slice("/rpc/".length);
  if (url.origin !== origin || url.search || !url.pathname.startsWith("/rpc/") || !Object.hasOwn(signatures, name) || request.method !== "POST") throw new Error("Only fixed offline RPC targets are allowed.");
  const args = await request.json() as Args;
  const signature = signatures[name as RpcName];
  expect(args.p_user).toBe(owner); expect(args.p_session).toBe(session);
  expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", "p_operation", ...signature.extra].sort());
  if (name === "capture_task_commit") {
    const batch = args.p_request as CaptureTaskCommit;
    captureBatches.push(structuredClone(batch));
    if (addExtraChange) {
      addExtraChange = false;
      // Corrupt only this HTTP fixture: an otherwise genuine archive batch
      // gains a duplicate change and matching new event. Real SQL must refuse.
      batch.changes.push(structuredClone(batch.changes[0]!));
      batch.events.push({ ...structuredClone(batch.events[0]!), id: uuid() });
    }
  }
  const values = [args.p_user, args.p_session, args.p_operation, ...signature.extra.map(key => {
    const value = args[key as keyof Args]; return key === "p_request" ? JSON.stringify(value) : value;
  })];
  try {
    const result = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{ data: unknown }>(signature.sql, values);
    });
    return Response.json({ data: result.rows[0]!.data, error: null });
  } catch (error) {
    // Preserve only SQLSTATE in the offline transport. A structured refusal is
    // a rollback, never a fabricated successful response or unknown commit.
    const code = (error as { code?: unknown }).code;
    if (typeof code !== "string") throw error;
    refusals.push({ name, code });
    return Response.json({ data: null, error: { code } });
  }
});
async function rpc(name: RpcName, args: Args): Promise<{ data: unknown; error: { code?: string } | null }> {
  return (await transport(`${origin}/rpc/${name}`, { method: "POST", body: JSON.stringify(args), headers: { "Content-Type": "application/json" } })).json();
}
const captureRpc: CaptureTaskRpc = rpc, knowledgeRpc: KnowledgeRpc = rpc;
const captureGateway = (operation: CaptureTaskOperation) => createCaptureTaskGateway(owner, session, operation, captureRpc);
async function capture(value: unknown) {
  const decoded = decodeCaptureTaskRequest(value);
  return executeCaptureTaskCommand(createCaptureTaskStore(captureGateway(decoded.command), { maxAttempts: 1 }), deps, context, decoded);
}
async function knowledge(value: unknown) {
  const decoded = decodeKnowledgeCommand(value);
  return executarConhecimento(createKnowledgeStore(createKnowledgeGateway(owner, session, decoded.command, knowledgeRpc)), deps, context, decoded);
}

type Entity = { type: string; id: string; payload: Record<string, unknown> };
type AuditEvent = { id: string; user_id: string; entity_type: string; entity_id: string; action: string; canal: string; occurred_at: Date; before: Record<string, unknown> | null; after: Record<string, unknown> };
async function persisted() {
  const entities = (await db.query<Entity>(`select type,id,payload from (
    select 'capture'::text as type,id,payload,user_id from public.captures
    union all select 'task',id,payload,user_id from public.tasks
    union all select 'knowledge_notebook',id,payload,user_id from public.knowledge_notebooks
    union all select 'knowledge_page',id,payload,user_id from public.knowledge_pages
    union all select 'knowledge_link',id,payload,user_id from public.links
  ) records where user_id=$1 order by type,id`, [owner])).rows;
  const events = (await db.query<AuditEvent>("select id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after from public.domain_events where user_id=$1 order by occurred_at,id", [owner])).rows;
  return { entities, events };
}
type Expected = { type: string; id: string; action: string };
const key = (row: { type: string; id: string }) => `${row.type}:${row.id}`;
async function audit<T>(work: () => Promise<T>, expected: (result: T) => Expected[]) {
  const before = await persisted(); tick++;
  const result = await work(), after = await persisted(), targets = expected(result);
  const old = new Map(before.entities.map(row => [key(row), row.payload]));
  const changed = after.entities.filter(row => JSON.stringify(old.get(key(row)) ?? null) !== JSON.stringify(row.payload));
  expect(changed.map(key).sort()).toEqual(targets.map(key).sort());
  expect(after.entities.map(key)).toEqual(expect.arrayContaining(before.entities.map(key)));
  const prior = new Map(before.events.map(event => [event.id, event]));
  const added = after.events.filter(event => !prior.has(event.id));
  expect(after.events.filter(event => prior.has(event.id))).toEqual(before.events);
  expect(added).toHaveLength(targets.length);
  for (const target of targets) {
    const matching = added.filter(event => event.entity_type === target.type && event.entity_id === target.id);
    expect(matching).toHaveLength(1);
    const event = matching[0]!;
    expect(event).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), user_id: owner, entity_type: target.type, entity_id: target.id,
      action: target.action, canal: "web", occurred_at: new Date(deps.clock.now()), before: old.get(key(target)) ?? null,
      after: changed.find(row => key(row) === key(target))!.payload });
  }
  return result;
}

it("persists a coherent web event for every orchestrated Capture/Task write, conversion and knowledge promotion; replay/no-op add none", async () => {
  // Notebook creation is real setup, separate from the 13 Capture/Task commands.
  const notebook = await knowledge({ command: "knowledge.notebook.create", input: { name: "Caderno sintético", client_id: "setup-book" } }) as Caderno;
  const baseline = await persisted();
  const created = await audit(() => capture({ command: "capture.create", input: { client_id: "c-create", type: "note", title: "Origem", content: "Texto original", category_id: null, project_id: null, status: "draft" } }), row => [{ type: "capture", id: (row as Captura).id, action: "created" }]) as Captura;
  expect(created).toMatchObject({ status: "draft", converted_task_id: null, archived_at: null, deleted_at: null });
  const id = created.id;
  const organized = await audit(() => capture({ command: "capture.organize", input: { id, client_id: "c-inbox", destination: "inbox" } }), () => [{ type: "capture", id, action: "status_changed" }]) as Captura;
  expect(organized).toMatchObject({ status: "inbox", organized_at: null });
  const edit = { command: "capture.update", input: { id, client_id: "c-edit", patch: { title: "Origem editada", content: "Texto preservado na promoção" } } };
  const edited = await audit(() => capture(edit), () => [{ type: "capture", id, action: "updated" }]) as Captura;
  expect(edited).toMatchObject(edit.input.patch);
  const archived = await audit(() => capture({ command: "capture.archive", input: { id, client_id: "c-archive" } }), () => [{ type: "capture", id, action: "status_changed" }]) as Captura;
  expect(archived).toMatchObject({ status: "archived", archived_at: deps.clock.now() });
  const unarchived = await audit(() => capture({ command: "capture.unarchive", input: { id, client_id: "c-unarchive" } }), () => [{ type: "capture", id, action: "status_changed" }]) as Captura;
  expect(unarchived).toMatchObject({ status: "inbox", archived_at: null });
  const trashed = await audit(() => capture({ command: "capture.delete", input: { id, client_id: "c-delete" } }), () => [{ type: "capture", id, action: "deleted" }]) as Captura;
  expect(trashed.deleted_at).toBe(deps.clock.now());
  const restored = await audit(() => capture({ command: "capture.restore", input: { id, client_id: "c-restore" } }), () => [{ type: "capture", id, action: "restored" }]) as Captura;
  expect(restored.deleted_at).toBeNull();
  const converted = await audit(() => capture({ command: "capture.convert", input: { capture_id: id, client_id: "c-convert" } }), row => [
    { type: "capture", id, action: "status_changed" }, { type: "task", id: (row as ConversaoCaptura).tarefa.id, action: "created" },
  ]) as ConversaoCaptura;
  expect(converted.captura).toMatchObject({ converted_task_id: converted.tarefa.id, status: "organized", organized_at: deps.clock.now() });
  expect(converted.tarefa).toMatchObject({ origin_capture_id: id, title: edited.title, description: edited.content, status: "todo" });
  const task = await audit(() => capture({ command: "task.create", input: { client_id: "t-create", title: "Tarefa manual", description: null, category_id: null, project_id: null, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null } }), row => [{ type: "task", id: (row as Tarefa).id, action: "created" }]) as Tarefa;
  expect(task).toMatchObject({ source: "manual", origin_capture_id: null, completed_at: null });
  const updatedTask = await audit(() => capture({ command: "task.update", input: { id: task.id, client_id: "t-edit", patch: { title: "Tarefa editada", priority: "high" } } }), () => [{ type: "task", id: task.id, action: "updated" }]) as Tarefa;
  expect(updatedTask).toMatchObject({ title: "Tarefa editada", priority: "high", status: "todo" });
  const done = await audit(() => capture({ command: "task.status", input: { id: task.id, client_id: "t-done", status: "done" } }), () => [{ type: "task", id: task.id, action: "status_changed" }]) as Tarefa;
  expect(done).toMatchObject({ status: "done", completed_at: deps.clock.now() });
  const taskTrash = await audit(() => capture({ command: "task.delete", input: { id: task.id, client_id: "t-delete" } }), () => [{ type: "task", id: task.id, action: "deleted" }]) as Tarefa;
  expect(taskTrash).toMatchObject({ deleted_at: deps.clock.now(), status: "done", completed_at: done.completed_at });
  const taskRestore = await audit(() => capture({ command: "task.restore", input: { id: task.id, client_id: "t-restore" } }), () => [{ type: "task", id: task.id, action: "restored" }]) as Tarefa;
  expect(taskRestore).toMatchObject({ deleted_at: null, status: "done", completed_at: done.completed_at });
  expect(captureBatches).toHaveLength(13);
  expect(captureBatches.map(batch => batch.receipt.command).sort()).toEqual([...CAPTURE_TASK_COMMANDS].sort());
  expect(refusals).toEqual([]);
  expect((await persisted()).events.length - baseline.events.length).toBe(14);

  // A genuine Core batch with an extra mutation must rollback atomically.
  const beforeRefusal = await persisted(); addExtraChange = true; tick++;
  await expect(capture({ command: "capture.archive", input: { id, client_id: "extra-change" } })).rejects.toMatchObject({ code: "VALIDATION" });
  expect(refusals).toEqual([{ name: "capture_task_commit", code: "23514" }]);
  expect(await persisted()).toEqual(beforeRefusal);
  expect((await db.query("select client_id from app_private.command_receipts where user_id=$1 and client_id='extra-change'", [owner])).rows).toEqual([]);

  const promoted = await audit(() => knowledge({ command: "knowledge.page.promote-capture", input: { capture_id: id, notebook_id: notebook.id, client_id: "promote" } }), row => [
    { type: "capture", id, action: "status_changed" }, { type: "knowledge_page", id: (row as { page: Pagina }).page.id, action: "created" },
  ]) as { page: Pagina; capture_id: string };
  expect(promoted).toMatchObject({ capture_id: id, page: { origin_capture_id: id, title: edited.title, content_text: edited.content } });
  const promotedCapture = (await persisted()).entities.find(row => row.type === "capture" && row.id === id)!.payload;
  expect(promotedCapture).toEqual({ ...converted.captura, status: "archived", archived_at: deps.clock.now(), updated_at: deps.clock.now() });
  expect((await persisted()).events.length - baseline.events.length).toBe(16);
  expect(await audit(() => capture(edit), () => [])).toEqual(edited);
  await audit(() => capture({ command: "task.restore", input: { id: task.id, client_id: "t-restore-noop" } }), () => []);
  expect(await audit(() => knowledge({ command: "knowledge.page.promote-capture", input: { capture_id: id, notebook_id: notebook.id, client_id: "promote" } }), () => [])).toEqual(promoted);
  // Explicit RPC replay of the ORIGINAL batch proves receipt-before-stale-CAS,
  // independently from an orchestrator finding a saved receipt in its snapshot.
  const original = captureBatches.find(batch => batch.receipt.command === "capture.convert")!;
  expect(await audit(() => captureGateway("capture.convert").commit(original), () => [])).toEqual({ status: "replayed", result: converted });

  const callsBefore = captureBatches.length, stateBefore = await persisted();
  await expect(createCaptureTaskStore(captureGateway("task.update"), { maxAttempts: 1 }).transaction(context, async tx => {
    const row = { ...taskRestore, priority: "urgent" as const, updated_at: deps.clock.now() };
    await tx.tarefas.replace(row);
    await tx.recibos.insert({ user_id: owner, command: "task.update", client_id: "missing-event", fingerprint: "{}", result: row });
    return row;
  })).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
  expect(captureBatches).toHaveLength(callsBefore); expect(await persisted()).toEqual(stateBefore);
  expect(() => decodeCaptureTaskRequest({ ...edit, context: { user_id: foreign, canal: "api" } })).toThrow();
  expect(() => decodeCaptureTaskRequest({ ...edit, input: { ...edit.input, user_id: foreign } })).toThrow();
  expect(() => decodeKnowledgeCommand({ command: "knowledge.page.promote-capture", input: { capture_id: id, notebook_id: notebook.id, client_id: "foreign", user_id: foreign } })).toThrow();
  expect(await persisted()).toEqual(stateBefore);
});
