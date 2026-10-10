/** M1 Capture/Task assertions against production Core/Gateway/Store and the
 * complete canonical PostgreSQL schema. Auth catalogue and RPC transport are
 * fixtures. This is neither hosted Auth/PostgREST nor multi-connection PG QA.
 * The original, broader Memory contract remains unchanged and runs separately.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { arquivarCaptura, converterCapturaEmTarefa, criarCaptura, editarCaptura, excluirCaptura, restaurarCaptura, type NovaCaptura } from "../../src/core/capturas";
import { alterarStatusTarefa, criarTarefa, editarTarefa, excluirTarefa, restaurarTarefa, type NovaTarefa } from "../../src/core/tarefas";
import type { CaptureTaskTransaction } from "../../src/core/contracts";
import { assinatura } from "../../src/core/contracts/base";
import { emitirEvento } from "../../src/core/contracts/operations";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import { createContractHarness, installSqlFaultFixture, instant, type RealContractHarness } from "./real-capture-task/harness";

const captureInput = (patch: Partial<NovaCaptura> = {}): NovaCaptura => ({ client_id: "capture-command", type: "idea", title: "Ideia de contrato", content: "Texto de contrato", category_id: null, project_id: null, ...patch });
const taskInput = (patch: Partial<NovaTarefa> = {}): NovaTarefa => ({ client_id: "task-command", title: "Tarefa de contrato", description: "Descrição de contrato", category_id: null, project_id: null, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null, ...patch });
let db: PGlite, h: RealContractHarness;
beforeAll(async () => { db = await createLocalCanonicalSql(); await installSqlFaultFixture(db); }, 30_000);
beforeEach(async () => { h = await createContractHarness(db); });
afterAll(async () => { await db?.close(); });
const createCapture = (input = captureInput()) => h.run(h.a, "capture.create", (store, deps, context) => criarCaptura(store, deps, context, input));
const createTask = (input = taskInput()) => h.run(h.a, "task.create", (store, deps, context) => criarTarefa(store, deps, context, input));
const convert = (capture_id: string, client_id = "convert") => h.run(h.a, "capture.convert", (store, deps, context) => converterCapturaEmTarefa(store, deps, context, { capture_id, client_id }));

describe("SQL real: contrato de Capturas/Tarefas do M1", () => {
  it("preserva todos os campos da captura e seu evento de criação", async () => {
    const input = captureInput({ type: "reminder", status: "draft", category_id: h.a.category.id, project_id: h.a.project.id });
    const result = await createCapture(input);
    expect(result).toEqual({ ...input, id: expect.any(String), user_id: h.a.context.user_id, captured_at: instant, organized_at: null, converted_task_id: null, archived_at: null, deleted_at: null, created_at: instant, updated_at: instant });
    expect(await h.read(h.a).capturas.get(result.id)).toEqual(result);
    expect(await h.read(h.a).eventos.list()).toEqual([expect.objectContaining({ entity_type: "capture", entity_id: result.id, user_id: h.a.context.user_id, canal: "web", action: "created", occurred_at: instant, before: null, after: result })]);
    expect((await h.persisted(h.a)).receipts).toHaveLength(1);
  });

  it("preserva campos integrais da tarefa e offsets sem normalizar o payload", async () => {
    const input = taskInput({ status: "done", priority: "urgent", category_id: h.a.category.id, project_id: h.a.project.id, due_at: "2026-10-10T17:00:00-03:00", scheduled_start_at: "2026-10-09T08:00:00-03:00", scheduled_end_at: "2026-10-09T09:00:00-03:00", all_day: true, estimated_minutes: 60, board_position: 2.5 });
    const result = await createTask(input);
    expect(result).toEqual({ ...input, id: expect.any(String), user_id: h.a.context.user_id, source: "manual", origin_capture_id: null, completed_at: instant, archived_at: null, deleted_at: null, created_at: instant, updated_at: instant });
    expect(await h.read(h.a).tarefas.list()).toEqual([result]);
    expect((await h.read(h.a).eventos.list())[0]).toMatchObject({ entity_type: "task", before: null, after: result });
  });

  it("dois donos escrevem e não alcançam listagens, IDs, eventos ou recibos alheios", async () => {
    const a = await createCapture();
    const b = await h.run(h.b, "capture.create", (store, deps, context) => criarCaptura(store, deps, context, captureInput()));
    const bt = await h.run(h.b, "task.create", (store, deps, context) => criarTarefa(store, deps, context, taskInput()));
    expect(await h.read(h.a).capturas.get(b.id)).toBeNull();
    expect(await h.read(h.b).capturas.get(a.id)).toBeNull();
    expect(await h.read(h.a).tarefas.get(bt.id)).toBeNull();
    expect(await h.read(h.a).capturas.list()).toEqual([a]);
    expect(await h.read(h.b).capturas.list()).toEqual([b]);
    expect(await h.read(h.b).eventos.list()).toEqual([
      expect.objectContaining({ user_id: h.b.context.user_id, canal: "api", entity_id: b.id }),
      expect.objectContaining({ user_id: h.b.context.user_id, canal: "api", entity_id: bt.id }),
    ]);
    const baseline = await h.persisted(h.a);
    for (const id of [b.id, h.deps.ids.next()]) await expect(h.run(h.a, "capture.update", (store, deps, context) => editarCaptura(store, deps, context, { id, client_id: id, patch: { title: "Inválido" } }))).rejects.toMatchObject({ code: "NOT_FOUND", message: "Registro não encontrado." });
    expect(await h.persisted(h.a)).toEqual(baseline);
    expect(await h.bound(h.a, "task.create").gateway.receipt("task.create", bt.client_id)).toBeNull();
  });

  it.each(["category_id", "project_id"] as const)("recusa referência %s estrangeira sem escrita/evento/recibo", async key => {
    const foreign = key === "category_id" ? h.b.category.id : h.b.project.id;
    const baseline = await h.persisted(h.a);
    await expect(createCapture(captureInput({ [key]: foreign }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createTask(taskInput({ [key]: foreign }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await h.persisted(h.a)).toEqual(baseline);
    expect(await createCapture()).toMatchObject({ title: "Ideia de contrato" });
  });

  it("copia entrada e contexto antes de aguardar; mutações de saídas não persistem", async () => {
    const input = captureInput(), context = { ...h.a.context };
    const pending = criarCaptura(h.bound(h.a, "capture.create").store, h.deps, context, input);
    input.title = "Mutação externa"; context.user_id = h.b.context.user_id;
    const result = await pending, id = result.id;
    result.title = "Mutação do resultado";
    const list = await h.read(h.a).capturas.list(); list[0]!.title = "Mutação da lista";
    const events = await h.read(h.a).eventos.list(); events[0]!.after!.user_id = h.b.context.user_id;
    expect(await h.read(h.a).capturas.get(id)).toMatchObject({ title: "Ideia de contrato", user_id: h.a.context.user_id });
    expect((await h.read(h.a).eventos.list())[0]!.after?.user_id).toBe(h.a.context.user_id);
    expect(await h.read(h.b).capturas.list()).toEqual([]);
  });

  it("replay retorna o snapshot original sem reverter edição e payload diferente conflita", async () => {
    const first = await createCapture();
    await h.run(h.a, "capture.update", (store, deps, context) => editarCaptura(store, deps, context, { id: first.id, client_id: "edit", patch: { title: "Título editado" } }));
    const baseline = await h.persisted(h.a);
    expect(await createCapture()).toEqual(first);
    expect(await h.persisted(h.a)).toEqual(baseline);
    expect(await h.read(h.a).capturas.get(first.id)).toMatchObject({ title: "Título editado" });
    await expect(createCapture(captureInput({ title: "Payload incompatível" }))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await h.persisted(h.a)).toEqual(baseline);
  });

  it("client_id é reutilizável por dono e comando; outra captura não reutiliza o recibo de conversão", async () => {
    const first = await createCapture(captureInput({ client_id: "shared" }));
    const second = await h.run(h.b, "capture.create", (store, deps, context) => criarCaptura(store, deps, context, captureInput({ client_id: "shared" })));
    expect(second.id).not.toBe(first.id);
    const converted = await convert(first.id, "shared");
    expect(await h.run(h.a, "task.update", (store, deps, context) => editarTarefa(store, deps, context, { id: converted.tarefa.id, client_id: "shared", patch: { title: "Outra operação" } }))).toMatchObject({ title: "Outra operação" });
    const other = await createCapture(captureInput({ client_id: "second" })), baseline = await h.persisted(h.a);
    await expect(convert(other.id, "shared")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await h.persisted(h.a)).toEqual(baseline);
    expect(await h.read(h.a).capturas.get(other.id)).toMatchObject({ converted_task_id: null });
  });

  it("conversão preserva organização/origem e dois eventos; conteúdo longo sobrevive edição não relacionada", async () => {
    const capture = await createCapture(captureInput({ content: "x".repeat(10_000), category_id: h.a.category.id, project_id: h.a.project.id }));
    const converted = await convert(capture.id);
    expect(converted.captura).toMatchObject({ converted_task_id: converted.tarefa.id, status: "organized", organized_at: instant });
    expect(converted.tarefa).toMatchObject({ origin_capture_id: capture.id, source: "manual", title: capture.title, description: capture.content, category_id: capture.category_id, project_id: capture.project_id, status: "todo", priority: "medium" });
    expect((await h.read(h.a).eventos.list()).slice(1)).toEqual([
      expect.objectContaining({ entity_type: "task", before: null, after: converted.tarefa }),
      expect.objectContaining({ entity_type: "capture", before: capture, after: converted.captura }),
    ]);
    const edited = await h.run(h.a, "task.update", (store, deps, context) => editarTarefa(store, deps, context, { id: converted.tarefa.id, client_id: "edit", patch: { title: "Texto preservado" } }));
    expect(edited.description).toBe(capture.content);
    expect(await h.read(h.a).tarefas.get(edited.id)).toEqual(edited);
    const baseline = await h.persisted(h.a);
    await expect(h.run(h.a, "task.update", (store, deps, context) => editarTarefa(store, deps, context, { id: edited.id, client_id: "bad-description", patch: { description: "y".repeat(5_001) } }))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.persisted(h.a)).toEqual(baseline);
  });

  it("conversão só de conteúdo abrevia título sem perder o texto que não cabe nele", async () => {
    for (const size of [200, 120]) {
      const capture = await createCapture(captureInput({ client_id: `capture-${size}`, title: null, content: "a".repeat(size) }));
      const { tarefa } = await convert(capture.id, `convert-${size}`);
      expect(tarefa.title).toBe("a".repeat(120));
      expect(tarefa.description).toBe(size > 120 ? capture.content : null);
      expect((await h.read(h.a).capturas.get(capture.id))?.content).toHaveLength(size);
    }
  });

  it("referência de projeto excluído permanece no histórico e não passa à nova tarefa", async () => {
    const capture = await createCapture(captureInput({ project_id: h.a.project.id }));
    const task = await createTask(taskInput({ project_id: h.a.project.id }));
    await h.deleteProjectFixture(h.a);
    expect(await h.run(h.a, "capture.update", (store, deps, context) => editarCaptura(store, deps, context, { id: capture.id, client_id: "edit-capture", patch: { title: "Editada" } }))).toMatchObject({ project_id: capture.project_id });
    expect(await h.run(h.a, "task.update", (store, deps, context) => editarTarefa(store, deps, context, { id: task.id, client_id: "edit-task", patch: { title: "Editada" } }))).toMatchObject({ project_id: task.project_id });
    expect((await convert(capture.id)).tarefa.project_id).toBeNull();
    const baseline = await h.persisted(h.a);
    await expect(createTask(taskInput({ client_id: "new-task", project_id: task.project_id }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await h.persisted(h.a)).toEqual(baseline);
  });

  it("edição de tarefa concluída preserva conclusão; reabrir limpa instante e arquivo filtra listagens", async () => {
    const first = await createTask(taskInput({ status: "done" }));
    const later = "2026-10-08T12:00:00.000Z"; h.setTime(later);
    expect(await h.run(h.a, "task.update", (store, deps, context) => editarTarefa(store, deps, context, { id: first.id, client_id: "edit", patch: { title: "Editada" } }))).toMatchObject({ status: "done", completed_at: first.completed_at, updated_at: later });
    expect((await h.run(h.a, "task.status", (store, deps, context) => alterarStatusTarefa(store, deps, context, { id: first.id, client_id: "reopen", status: "in_progress" }))).completed_at).toBeNull();
    const archived = await h.run(h.a, "task.status", (store, deps, context) => alterarStatusTarefa(store, deps, context, { id: first.id, client_id: "archive", status: "archived" }));
    expect(archived.archived_at).toBe(later);
    expect(await h.read(h.a).tarefas.list()).toEqual([]);
    expect(await h.read(h.a).tarefas.list({ includeArchived: true })).toEqual([archived]);
  });

  it("lixeira/restauração preservam conteúdo, origem e arquivo; reconversão não ressuscita a tarefa", async () => {
    const capture = await createCapture(), converted = await convert(capture.id), tarefa = converted.tarefa;
    const archived = await h.run(h.a, "capture.archive", (store, deps, context) => arquivarCaptura(store, deps, context, { id: capture.id, client_id: "archive" }));
    const deleted = await h.run(h.a, "task.delete", (store, deps, context) => excluirTarefa(store, deps, context, { id: tarefa.id, client_id: "delete" }));
    expect((await convert(capture.id, "retry")).tarefa).toEqual(deleted);
    await h.run(h.a, "capture.delete", (store, deps, context) => excluirCaptura(store, deps, context, { id: capture.id, client_id: "delete" }));
    expect(await h.read(h.a).capturas.list({ includeArchived: true })).toEqual([]);
    expect(await h.read(h.a).tarefas.list()).toEqual([]);
    expect(await h.read(h.a).tarefas.list({ includeDeleted: true })).toEqual([deleted]);
    expect(await h.run(h.a, "capture.restore", (store, deps, context) => restaurarCaptura(store, deps, context, { id: capture.id, client_id: "restore" }))).toEqual(archived);
    expect(await h.run(h.a, "task.restore", (store, deps, context) => restaurarTarefa(store, deps, context, { id: tarefa.id, client_id: "restore" }))).toEqual(tarefa);
  });

  it("origem e client_id são imutáveis; referência de origem estrangeira falha no adapter", async () => {
    const capture = await createCapture(), { tarefa } = await convert(capture.id);
    const foreign = await h.run(h.b, "capture.create", (store, deps, context) => criarCaptura(store, deps, context, captureInput()));
    const baseline = await h.persisted(h.a);
    for (const patch of [{ origin_capture_id: null }, { client_id: "changed" }]) await expect(h.bound(h.a, "task.update").store.transaction(h.a.context, async tx => {
      const after = { ...tarefa, ...patch };
      await tx.tarefas.replace(after); await emitirEvento(tx, h.deps, h.a.context, "task", tarefa, after, "updated");
    })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(h.bound(h.a, "task.create").store.transaction(h.a.context, async tx => {
      const forged = { ...tarefa, id: h.deps.ids.next(), client_id: "forged", origin_capture_id: foreign.id };
      await tx.tarefas.insert(forged); await emitirEvento(tx, h.deps, h.a.context, "task", null, forged, "created");
      await tx.recibos.insert({ user_id: h.a.context.user_id, command: "task.create", client_id: "forged", fingerprint: assinatura({ ...taskInput(), client_id: "forged" }), result: forged });
      return forged;
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await h.persisted(h.a)).toEqual(baseline);
  });

  it("callback que lança erro não confirma estado/evento e ports expiram após ambos os desfechos", async () => {
    const first = await createTask(), committed = { ...first, title: "Confirmada" };
    let saved: CaptureTaskTransaction | undefined;
    const store = h.bound(h.a, "task.update").store;
    await store.transaction(h.a.context, async tx => {
      saved = tx;
      await tx.tarefas.replace(committed); await emitirEvento(tx, h.deps, h.a.context, "task", first, committed, "updated");
      await tx.recibos.insert({ user_id: h.a.context.user_id, command: "task.update", client_id: "closed-commit", fingerprint: assinatura({ id: first.id, client_id: "closed-commit", patch: { title: committed.title } }), result: committed });
      return committed;
    });
    expect(saved).toBeDefined();
    await expect(saved!.tarefas.list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
    expect(await h.read(h.a).tarefas.get(first.id)).toEqual(committed);
    const baseline = await h.persisted(h.a);
    await expect(store.transaction(h.a.context, async tx => {
      saved = tx; const after = { ...committed, title: "Mutação" };
      await tx.tarefas.replace(after); await emitirEvento(tx, h.deps, h.a.context, "task", committed, after, "updated");
      throw new Error("abort");
    })).rejects.toThrow("abort");
    await expect(saved!.eventos.list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
    expect(await h.persisted(h.a)).toEqual(baseline);
    expect("insert" in h.read(h.a).capturas).toBe(false);
  });

  it("recusa escrita sem evento, evento sem escrita e snapshot/canal divergentes", async () => {
    const before = await createTask(), after = { ...before, title: "Mutação" }, baseline = await h.persisted(h.a);
    const store = h.bound(h.a, "task.update").store;
    await expect(store.transaction(h.a.context, tx => tx.tarefas.replace(after))).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
    await expect(store.transaction(h.a.context, tx => emitirEvento(tx, h.deps, h.a.context, "task", before, after, "updated"))).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
    await expect(store.transaction(h.a.context, async tx => {
      await tx.tarefas.replace(after); await emitirEvento(tx, h.deps, h.a.context, "task", before, before, "updated");
    })).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
    await expect(store.transaction(h.a.context, async tx => {
      await tx.tarefas.replace(after); await emitirEvento(tx, h.deps, { ...h.a.context, canal: "cron" }, "task", before, after, "updated");
    })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.persisted(h.a)).toEqual(baseline);
  });

  it("leitura externa não observa alteração nem evento antes do commit SQL", async () => {
    const before = await createTask(), after = { ...before, title: "Só depois do commit" };
    let announce!: () => void, release!: () => void;
    const written = new Promise<void>(resolve => { announce = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    const pending = h.bound(h.a, "task.update").store.transaction(h.a.context, async tx => {
      await tx.tarefas.replace(after); await emitirEvento(tx, h.deps, h.a.context, "task", before, after, "updated");
      await tx.recibos.insert({ user_id: h.a.context.user_id, command: "task.update", client_id: "visibility", fingerprint: assinatura({ id: before.id, client_id: "visibility", patch: { title: after.title } }), result: after });
      expect(await tx.tarefas.get(before.id)).toEqual(after);
      announce(); await proceed; return after;
    });
    try {
      await Promise.race([written, pending]);
      expect(await h.read(h.a).tarefas.get(before.id)).toEqual(before);
      expect(await h.read(h.a).eventos.list()).toHaveLength(1);
    } finally { release(); await pending; }
    expect(await h.read(h.a).tarefas.get(before.id)).toEqual(after);
    expect(await h.read(h.a).eventos.list()).toHaveLength(2);
  });

  it.each(["tasks", "domain_events", "command_receipts"] as const)("falha SQL em %s reverte conversão inteira; retry com o mesmo client_id funciona", async table => {
    const capture = await createCapture(), baseline = await h.persisted(h.a);
    await db.query("insert into pg_temp.real_contract_faults(user_id,table_name) values($1,$2)", [h.a.context.user_id, table]);
    try {
      await expect(convert(capture.id)).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await h.persisted(h.a)).toEqual(baseline);
      expect(h.calls.filter(call => call.name === "capture_task_commit").at(-1)?.response).toEqual({ data: null, error: { code: "23514" } });
    } finally { await db.query("delete from pg_temp.real_contract_faults where user_id=$1", [h.a.context.user_id]); }
    const converted = await convert(capture.id);
    expect(await convert(capture.id)).toEqual(converted);
    expect(await h.read(h.a).tarefas.list()).toEqual([converted.tarefa]);
    expect(await h.read(h.a).eventos.list()).toHaveLength(3);
    expect((await h.persisted(h.a)).receipts).toHaveLength(2);
  });

  it("falha do transporte de leitura não inventa uma lista vazia", async () => {
    const baseline = await h.persisted(h.a);
    h.hooks.before = async name => { if (name === "capture_task_snapshot") throw new Error("offline read failure"); };
    await expect(h.read(h.a).capturas.list()).rejects.toMatchObject({ code: "unavailable" });
    h.hooks.before = undefined;
    expect(await h.persisted(h.a)).toEqual(baseline);
  });

  it("resposta perdida após commit real é reconciliada pelo recibo sem duplicação", async () => {
    const capture = await createCapture();
    let lost = false;
    h.hooks.after = async name => { if (name === "capture_task_commit" && !lost) { lost = true; throw new Error("offline response lost after SQL commit"); } };
    const converted = await convert(capture.id);
    expect(lost).toBe(true);
    expect(h.calls.at(-1)?.name).toBe("capture_task_receipt");
    h.hooks.after = undefined;
    const baseline = await h.persisted(h.a);
    expect(await convert(capture.id)).toEqual(converted);
    expect(await h.persisted(h.a)).toEqual(baseline);
    expect(await h.read(h.a).tarefas.list()).toEqual([converted.tarefa]);
    expect(await h.read(h.a).eventos.list()).toHaveLength(3);
  });

  it("três conversões concorrentes, duas com o mesmo client_id, usam replay/CAS SQL e produzem uma única tarefa", async () => {
    const capture = await createCapture();
    let arrivals = 0, release!: () => void;
    const allThree = new Promise<void>(resolve => { release = resolve; });
    h.hooks.before = async (name, args) => {
      if (name === "capture_task_commit" && args.p_operation === "capture.convert" && arrivals < 3) {
        arrivals++; if (arrivals === 3) release(); await allThree;
      }
    };
    const results = await Promise.all(["convert", "convert", "other-convert"].map(client_id => convert(capture.id, client_id)))
      .finally(() => { release(); h.hooks.before = undefined; });
    const [a, b, c] = results;
    expect(arrivals).toBe(3); expect(a!.tarefa.id).toBe(b!.tarefa.id); expect(a!.tarefa.id).toBe(c!.tarefa.id);
    const commits = h.calls.filter(call => call.name === "capture_task_commit" && call.args.p_operation === "capture.convert");
    expect(commits).toHaveLength(4);
    expect(commits.slice(0, 3).map(call => call.args.p_request!.expectedRevision)).toEqual(Array(3).fill(commits[0]!.args.p_request!.expectedRevision));
    expect(commits.slice(0, 3).map(call => ({ client_id: call.args.p_request!.receipt.client_id, data: call.response.data }))).toEqual([
      { client_id: "convert", data: { status: "committed", result: a } },
      { client_id: "convert", data: { status: "replayed", result: a } },
      { client_id: "other-convert", data: { status: "stale" } },
    ]);
    expect(commits[3]).toMatchObject({ args: { p_request: { receipt: { client_id: "other-convert" }, changes: [], events: [] } }, response: { data: { status: "committed", result: c } } });
    expect(await h.read(h.a).tarefas.list()).toEqual([a!.tarefa]);
    expect(await h.read(h.a).eventos.list()).toHaveLength(3);
    expect((await h.persisted(h.a)).receipts).toHaveLength(3);
    const edited = await h.run(h.a, "task.update", (store, deps, context) => editarTarefa(store, deps, context, { id: a!.tarefa.id, client_id: "edit", patch: { title: "Título atual", status: "done", project_id: h.a.project.id } }));
    expect((await convert(capture.id, "new-retry")).tarefa).toEqual(edited);
  });

  it.each([{ title: " " }, { due_at: "2026-10-07T12:00:00" }, { due_at: "2026-02-31T12:00:00Z" }, { due_at: "2026-02-29T00:00:00-03:00" }, { due_at: "2026-08-07T24:00:00Z" }, { estimated_minutes: -1 }, { scheduled_start_at: "2026-10-07T13:00:00Z", scheduled_end_at: "2026-10-07T12:00:00Z" }])("entrada inválida de tarefa é atômica: %j", async invalid => {
    const baseline = await h.persisted(h.a);
    await expect(createTask(taskInput(invalid))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.persisted(h.a)).toEqual(baseline);
  });

  it("relógio inválido não normaliza data impossível; instante bissexto válido persiste", async () => {
    const baseline = await h.persisted(h.a); h.setTime("2026-02-31T12:00:00Z");
    await expect(createCapture()).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.persisted(h.a)).toEqual(baseline);
    h.setTime("2028-02-29T12:00:00Z");
    expect(await createCapture()).toMatchObject({ created_at: "2028-02-29T12:00:00Z" });
  });
});
