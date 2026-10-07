import { describe, expect, expectTypeOf, it } from "vitest";
import { criarAdapterMemoria, type PontoDeFalha } from "../../src/adapters/memory";
import { arquivarCaptura, converterCapturaEmTarefa, criarCaptura, desarquivarCaptura, editarCaptura, excluirCaptura, organizarCaptura, restaurarCaptura, type NovaCaptura } from "../../src/core/capturas";
import { alterarStatusTarefa, criarTarefa, editarTarefa, excluirTarefa, restaurarTarefa, type NovaTarefa } from "../../src/core/tarefas";
import type { CaptureTaskRead, CaptureTaskTransaction, CaptureTaskUnitOfWork, Categoria, ContextoDeEscrita, EntidadeDoUsuario, Leitor, Projeto, Repositorio, UnitOfWork } from "../../src/core/contracts";

const now = "2026-10-07T12:00:00.000Z";
const context: ContextoDeEscrita = { user_id: "owner", canal: "web" };
const captureInput = (client_id: string, patch: Partial<NovaCaptura> = {}): NovaCaptura => ({ client_id, type: "note", title: "Nota", content: "Conteúdo", category_id: null, project_id: null, ...patch });
const taskInput = (client_id: string): NovaTarefa => ({ client_id, title: "Tarefa", description: null, category_id: null, project_id: null, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null });

function reader<T extends EntidadeDoUsuario>(port: Leitor<T>): Leitor<T> {
  return { get: (id) => port.get(id), list: (query) => port.list(query) };
}
function writer<T extends EntidadeDoUsuario>(port: Repositorio<T>): Pick<Repositorio<T>, "get" | "list" | "insert" | "replace"> {
  return { ...reader(port), insert: (row) => port.insert(row), replace: (row) => port.replace(row) };
}

/** Real forwarding boundary: unavailable capabilities are absent at runtime too. */
function narrow(full: UnitOfWork): CaptureTaskUnitOfWork {
  return {
    read(userId): CaptureTaskRead {
      const ports = full.read(userId);
      return { capturas: reader(ports.capturas), tarefas: reader(ports.tarefas), categorias: reader(ports.categorias), projetos: reader(ports.projetos), eventos: ports.eventos };
    },
    transaction(context, work) {
      return full.transaction(context, (tx) => work({
        capturas: writer(tx.capturas), tarefas: writer(tx.tarefas), categorias: reader(tx.categorias), projetos: reader(tx.projetos), eventos: tx.eventos, recibos: tx.recibos,
      }));
    },
  };
}

function setup() {
  let sequence = 0;
  let failure: PontoDeFalha | null = null;
  const deps = { clock: { now: () => now }, ids: { next: () => `capability-${++sequence}` } };
  const full = criarAdapterMemoria({ ...deps, initial: {
    category: [{ id: "category", user_id: context.user_id, name: "Pessoal", normalized_name: "pessoal", color_key: "blue", is_system: false, created_at: now, updated_at: now }],
    project: [{ id: "project", user_id: context.user_id, name: "Projeto", description: null, color_key: "blue", position: 0, deleted_at: null, created_at: now, updated_at: now }],
  }, beforeOperation(point) { if (point === failure) { failure = null; throw new Error("Falha de infraestrutura"); } } });
  return { store: narrow(full), full, deps, failNext(point: PontoDeFalha) { failure = point; } };
}

describe("T015: capacidades transacionais de Capturas/Tarefas", () => {
  it("aceita o contrato completo estruturalmente sem exigir outros módulos do estreito", async () => {
    expectTypeOf<UnitOfWork>().toExtend<CaptureTaskUnitOfWork>();
    expectTypeOf<CaptureTaskUnitOfWork>().not.toExtend<UnitOfWork>();
    expectTypeOf<keyof CaptureTaskTransaction>().toEqualTypeOf<"capturas" | "tarefas" | "categorias" | "projetos" | "eventos" | "recibos">();
    expectTypeOf<CaptureTaskTransaction["categorias"]>().toEqualTypeOf<Leitor<Categoria>>();
    expectTypeOf<CaptureTaskTransaction["projetos"]>().toEqualTypeOf<Leitor<Projeto>>();
    expectTypeOf<keyof CaptureTaskTransaction["capturas"]>().toEqualTypeOf<"get" | "list" | "insert" | "replace">();
    const h = setup();
    await h.store.transaction(context, async (tx) => {
      expect(Object.keys(tx).sort()).toEqual(["capturas", "categorias", "eventos", "projetos", "recibos", "tarefas"]);
      expect(Object.keys(tx.categorias).sort()).toEqual(["get", "list"]);
      expect(Object.keys(tx.projetos).sort()).toEqual(["get", "list"]);
      expect(tx.capturas).not.toHaveProperty("remove");
    });
  });

  it("executa o ciclo de captura e rename das referências usando somente as capacidades declaradas", async () => {
    const h = setup();
    const first = await criarCaptura(h.store, h.deps, context, captureInput("first", { category_id: "category", project_id: "project" }));
    const related = await criarCaptura(h.store, h.deps, context, captureInput("related", { title: "Outra", content: "Leia [[Nota]]", linked_capture_ids: [first.id] }));
    await editarCaptura(h.store, h.deps, context, { id: first.id, client_id: "rename", patch: { title: "Renomeada" } });
    expect(await h.store.read(context.user_id).capturas.get(related.id)).toMatchObject({ content: "Leia [[Renomeada]]", linked_capture_ids: [first.id] });
    await organizarCaptura(h.store, h.deps, context, { id: first.id, client_id: "organize", destination: "knowledge" });
    await arquivarCaptura(h.store, h.deps, context, { id: first.id, client_id: "archive" });
    expect((await desarquivarCaptura(h.store, h.deps, context, { id: first.id, client_id: "unarchive" })).status).toBe("organized");
    await excluirCaptura(h.store, h.deps, context, { id: first.id, client_id: "delete" });
    expect((await restaurarCaptura(h.store, h.deps, context, { id: first.id, client_id: "restore" })).deleted_at).toBeNull();
    expect(await h.store.read("other").capturas.get(first.id)).toBeNull();
    expect(await h.store.read(context.user_id).eventos.list()).toHaveLength(9);
  });

  it("converte com replay, vínculo recíproco e eventos atômicos; suporta todo o ciclo da tarefa", async () => {
    const h = setup();
    const capture = await criarCaptura(h.store, h.deps, context, captureInput("capture", { category_id: "category", project_id: "project" }));
    const input = { capture_id: capture.id, client_id: "convert" };
    const converted = await converterCapturaEmTarefa(h.store, h.deps, context, input);
    expect(await converterCapturaEmTarefa(h.store, h.deps, context, input)).toEqual(converted);
    expect(converted.captura.converted_task_id).toBe(converted.tarefa.id);
    expect(converted.tarefa).toMatchObject({ origin_capture_id: capture.id, category_id: "category", project_id: "project" });
    expect(await h.store.read(context.user_id).eventos.list()).toHaveLength(3);
    const task = await criarTarefa(h.store, h.deps, context, taskInput("task"));
    await editarTarefa(h.store, h.deps, context, { id: task.id, client_id: "edit", patch: { title: "Editada", category_id: "category", project_id: "project" } });
    expect((await alterarStatusTarefa(h.store, h.deps, context, { id: task.id, client_id: "done", status: "done" })).completed_at).toBe(now);
    await excluirTarefa(h.store, h.deps, context, { id: task.id, client_id: "delete" });
    expect((await restaurarTarefa(h.store, h.deps, context, { id: task.id, client_id: "restore" })).deleted_at).toBeNull();
    expect(await h.store.read(context.user_id).tarefas.list()).toHaveLength(2);
  });

  it.each(["event", "commit"] as const)("reverte conversão, eventos e recibo após falha em %s", async (point) => {
    const h = setup();
    const capture = await criarCaptura(h.store, h.deps, context, captureInput("capture"));
    const input = { capture_id: capture.id, client_id: "conversion" };
    h.failNext(point);
    await expect(converterCapturaEmTarefa(h.store, h.deps, context, input)).rejects.toThrow("Falha de infraestrutura");
    expect(await h.store.read(context.user_id).capturas.get(capture.id)).toEqual(capture);
    expect(await h.store.read(context.user_id).tarefas.list()).toEqual([]);
    expect(await h.store.read(context.user_id).eventos.list()).toHaveLength(1);
    expect(await h.store.transaction(context, (tx) => tx.recibos.get("capture.convert", input.client_id))).toBeNull();
    const result = await converterCapturaEmTarefa(h.store, h.deps, context, input);
    expect(await converterCapturaEmTarefa(h.store, h.deps, context, input)).toEqual(result);
    expect(await h.store.read(context.user_id).tarefas.list()).toHaveLength(1);
  });

  it("preserva conflito de payload, validação das referências e encerramento da transação", async () => {
    const h = setup();
    await criarCaptura(h.store, h.deps, context, captureInput("same"));
    await expect(criarCaptura(h.store, h.deps, context, captureInput("same", { title: "Outro conteúdo" }))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(criarCaptura(h.store, h.deps, { user_id: "other", canal: "web" }, captureInput("foreign", { project_id: "project" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    let closed!: CaptureTaskTransaction;
    await h.store.transaction(context, async (tx) => { closed = tx; });
    await expect(closed.tarefas.list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
    expect(await h.store.read(context.user_id).capturas.list()).toHaveLength(1);
  });
});
