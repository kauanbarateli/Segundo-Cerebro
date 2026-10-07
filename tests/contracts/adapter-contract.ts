import { describe, expect, it } from "vitest";
import { arquivarCaptura, converterCapturaEmTarefa, criarCaptura, editarCaptura, excluirCaptura, restaurarCaptura, type NovaCaptura } from "../../src/core/capturas";
import { alterarStatusTarefa, criarTarefa, editarTarefa, excluirTarefa, restaurarTarefa, type NovaTarefa } from "../../src/core/tarefas";
import type { ContextoDeEscrita, DependenciasDeDominio, Entidades, EventoDominio, TipoEntidade, Transacao, UnitOfWork } from "../../src/core/contracts";

/** Future adapters run the same suite by providing an isolated, disposable factory. */
export type ContractSeed = Partial<{ [K in TipoEntidade]: readonly Entidades[K][] }>;
export interface ContractHarness {
  store: UnitOfWork;
  deps: DependenciasDeDominio;
  failNext(point: "read" | "write" | "event" | "commit"): void;
  setTime(iso: string): void;
  dispose?(): Promise<void>;
}
export type ContractFactory = (seed?: ContractSeed) => Promise<ContractHarness>;
const instant = "2026-10-07T12:00:00.000Z";
const alice: ContextoDeEscrita = { user_id: "contract-alice", canal: "web" };
const bob: ContextoDeEscrita = { user_id: "contract-bob", canal: "api" };

function seed(): ContractSeed {
  return {
    category: [alice, bob].map(({ user_id }) => ({ id: `${user_id}-category`, user_id, name: "Categoria de contrato", normalized_name: "categoria de contrato", color_key: "blue", is_system: false, created_at: instant, updated_at: instant })),
    project: [alice, bob].map(({ user_id }) => ({ id: `${user_id}-project`, user_id, name: "Projeto de contrato", description: null, color_key: "blue", position: 0, deleted_at: null, created_at: instant, updated_at: instant })),
    habit: [alice, bob].map(({ user_id }) => ({ id: `${user_id}-habit`, user_id, name: "Hábito de contrato", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-10-01", archived_at: null, color_key: "blue", icon_key: null, position: 0, created_at: instant, updated_at: instant })),
  };
}
const captureInput = (overrides: Partial<NovaCaptura> = {}): NovaCaptura => ({ client_id: "capture-command", type: "idea", title: "Ideia de contrato", content: "Texto de contrato", category_id: null, project_id: null, ...overrides });
const taskInput = (overrides: Partial<NovaTarefa> = {}): NovaTarefa => ({ client_id: "task-command", title: "Tarefa de contrato", description: "Descrição de contrato", category_id: null, project_id: null, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null, ...overrides });
function event<K extends TipoEntidade>(h: ContractHarness, context: ContextoDeEscrita, type: K, before: Entidades[K] | null, after: Entidades[K] | null): EventoDominio {
  return { id: h.deps.ids.next(), user_id: context.user_id, entity_type: type, entity_id: (after ?? before)!.id, canal: context.canal, occurred_at: h.deps.clock.now(), action: before === null ? "created" : after === null ? "deleted" : "updated", before, after } as EventoDominio;
}

export function adapterContract(name: string, factory: ContractFactory) {
  describe(`${name}: contrato público`, () => {
    // Cleanup is local to each case, so database adapters can dispose even on failure.
    const check = (label: string, work: (h: ContractHarness) => Promise<void>, initial = true) => it(label, async () => {
      const h = await factory(initial ? seed() : undefined);
      try { await work(h); } finally { await h.dispose?.(); }
    });

    check("preserva todos os campos de captura, relógio e evento de criação", async (h) => {
      const input = captureInput({ type: "reminder", status: "draft", category_id: "contract-alice-category", project_id: "contract-alice-project" });
      const result = await criarCaptura(h.store, h.deps, alice, input);
      expect(result).toEqual({ ...input, id: expect.any(String), user_id: alice.user_id, captured_at: instant, organized_at: null, converted_task_id: null, archived_at: null, deleted_at: null, created_at: instant, updated_at: instant });
      expect(await h.store.read(alice.user_id).capturas.get(result.id)).toEqual(result);
      expect(await h.store.read(alice.user_id).eventos.list()).toEqual([expect.objectContaining({ entity_type: "capture", entity_id: result.id, user_id: alice.user_id, canal: "web", action: "created", occurred_at: instant, before: null, after: result })]);
    });

    check("preserva todos os campos de tarefa e horários com fuso", async (h) => {
      const input = taskInput({ status: "done", priority: "urgent", category_id: "contract-alice-category", project_id: "contract-alice-project", due_at: "2026-10-10T17:00:00-03:00", scheduled_start_at: "2026-10-09T08:00:00-03:00", scheduled_end_at: "2026-10-09T09:00:00-03:00", all_day: true, estimated_minutes: 60, board_position: 2.5 });
      const result = await criarTarefa(h.store, h.deps, alice, input);
      expect(result).toEqual({ ...input, id: expect.any(String), user_id: alice.user_id, source: "manual", origin_capture_id: null, completed_at: instant, archived_at: null, deleted_at: null, created_at: instant, updated_at: instant });
      expect(await h.store.read(alice.user_id).tarefas.list()).toEqual([result]);
    });

    check("isola listagens, identificadores e eventos por usuário", async (h) => {
      const a = await criarCaptura(h.store, h.deps, alice, captureInput());
      const b = await criarCaptura(h.store, h.deps, bob, captureInput());
      expect(await h.store.read(alice.user_id).capturas.get(b.id)).toBeNull();
      expect(await h.store.read(bob.user_id).capturas.get(a.id)).toBeNull();
      expect(await h.store.read(alice.user_id).capturas.list()).toEqual([a]);
      expect(await h.store.read(bob.user_id).eventos.list()).toEqual([expect.objectContaining({ user_id: bob.user_id, canal: "api", entity_id: b.id })]);
      for (const id of [b.id, "missing"]) await expect(editarCaptura(h.store, h.deps, alice, { id, client_id: id, patch: { title: "Inválido" } })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Registro não encontrado." });
    });

    for (const key of ["category_id", "project_id"] as const) check(`rejeita referência ${key} estrangeira e não deixa escrita/evento/recibo`, async (h) => {
      const bad = captureInput({ [key]: `contract-bob-${key === "category_id" ? "category" : "project"}` });
      await expect(criarCaptura(h.store, h.deps, alice, bad)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await h.store.read(alice.user_id).capturas.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).eventos.list()).toEqual([]);
      expect(await criarCaptura(h.store, h.deps, alice, captureInput())).toMatchObject({ title: "Ideia de contrato" });
    });

    check("copia entrada antes de aguardar a fila e saídas não alteram o armazenamento", async (h) => {
      const input = captureInput(); const context = { ...alice };
      const pending = criarCaptura(h.store, h.deps, context, input);
      input.title = "Mutação externa"; context.user_id = bob.user_id;
      const result = await pending; const id = result.id;
      result.title = "Mutação do resultado";
      const list = await h.store.read(alice.user_id).capturas.list(); list[0]!.title = "Mutação da lista";
      const events = await h.store.read(alice.user_id).eventos.list(); events[0]!.after!.user_id = bob.user_id;
      expect(await h.store.read(alice.user_id).capturas.get(id)).toMatchObject({ title: "Ideia de contrato", user_id: alice.user_id });
      expect((await h.store.read(alice.user_id).eventos.list())[0]!.after?.user_id).toBe(alice.user_id);
      expect(await h.store.read(bob.user_id).capturas.list()).toEqual([]);
    });

    check("replay retorna snapshot original sem reverter alterações posteriores", async (h) => {
      const first = await criarCaptura(h.store, h.deps, alice, captureInput());
      await editarCaptura(h.store, h.deps, alice, { id: first.id, client_id: "edit", patch: { title: "Título editado" } });
      expect(await criarCaptura(h.store, h.deps, alice, captureInput())).toEqual(first);
      expect(await h.store.read(alice.user_id).capturas.get(first.id)).toMatchObject({ title: "Título editado" });
      expect(await h.store.read(alice.user_id).eventos.list()).toHaveLength(2);
      await expect(criarCaptura(h.store, h.deps, alice, captureInput({ title: "Payload incompatível" }))).rejects.toMatchObject({ code: "CONFLICT" });
    });

    check("client_id tem escopo por usuário e por comando", async (h) => {
      const input = captureInput({ client_id: "shared" });
      const first = await criarCaptura(h.store, h.deps, alice, input);
      const second = await criarCaptura(h.store, h.deps, bob, input);
      expect(second.id).not.toBe(first.id);
      const converted = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: first.id, client_id: "shared" });
      const edited = await editarTarefa(h.store, h.deps, alice, { id: converted.tarefa.id, client_id: "shared", patch: { title: "Outra operação" } });
      expect(edited.title).toBe("Outra operação");
      expect(await h.store.read(alice.user_id).tarefas.list()).toHaveLength(1);
    });

    check("conversão preserva origem e organização com dois eventos atômicos", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput({ category_id: "contract-alice-category", project_id: "contract-alice-project" }));
      const converted = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" });
      expect(converted.captura).toMatchObject({ converted_task_id: converted.tarefa.id, status: "organized", organized_at: instant, captured_at: capture.captured_at });
      expect(converted.tarefa).toMatchObject({ origin_capture_id: capture.id, source: "manual", title: capture.title, description: capture.content, category_id: capture.category_id, project_id: capture.project_id, status: "todo", priority: "medium" });
      expect((await h.store.read(alice.user_id).eventos.list()).slice(1)).toEqual([expect.objectContaining({ entity_type: "task", before: null, after: converted.tarefa }), expect.objectContaining({ entity_type: "capture", before: capture, after: converted.captura })]);
    });

    check("conversões concorrentes e novas tentativas produzem somente uma tarefa", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput());
      const [a, b, c] = await Promise.all(["convert", "convert", "other-convert"].map((client_id) => converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id })));
      expect(a!.tarefa.id).toBe(b!.tarefa.id); expect(a!.tarefa.id).toBe(c!.tarefa.id);
      expect(await h.store.read(alice.user_id).tarefas.list()).toHaveLength(1);
      expect(await h.store.read(alice.user_id).eventos.list()).toHaveLength(3);
      const edited = await editarTarefa(h.store, h.deps, alice, { id: a!.tarefa.id, client_id: "edit", patch: { title: "Título atual", status: "done", project_id: "contract-alice-project" } });
      expect((await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "new-retry" })).tarefa).toEqual(edited);
    });

    check("reutilizar client_id de conversão com outra captura conflita", async (h) => {
      const a = await criarCaptura(h.store, h.deps, alice, captureInput());
      const b = await criarCaptura(h.store, h.deps, alice, captureInput({ client_id: "second" }));
      await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: a.id, client_id: "convert" });
      await expect(converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: b.id, client_id: "convert" })).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await h.store.read(alice.user_id).capturas.get(b.id)).toMatchObject({ converted_task_id: null });
    });

    check("preserva texto longo da captura em conversão e edição não relacionada", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput({ content: "x".repeat(10_000) }));
      const { tarefa } = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" });
      expect((await editarTarefa(h.store, h.deps, alice, { id: tarefa.id, client_id: "edit", patch: { title: "Texto preservado" } })).description).toBe(capture.content);
      await expect(editarTarefa(h.store, h.deps, alice, { id: tarefa.id, client_id: "edit-description", patch: { description: "y".repeat(5_001) } })).rejects.toMatchObject({ code: "VALIDATION" });
    });

    check("conversão só de conteúdo abrevia título e preserva texto que não cabe nele", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput({ title: null, content: "a".repeat(200) }));
      const { tarefa } = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" });
      expect(tarefa.title).toBe("a".repeat(120)); expect(tarefa.description).toBe(capture.content);
      expect((await h.store.read(alice.user_id).capturas.get(capture.id))?.content).toHaveLength(200);
      const short = await criarCaptura(h.store, h.deps, alice, captureInput({ client_id: "short", title: null, content: "b".repeat(120) }));
      const result = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: short.id, client_id: "convert-short" });
      expect(result.tarefa.title).toBe(short.content); expect(result.tarefa.description).toBeNull();
    });

    check("projeto excluído fica no histórico e não passa à nova tarefa", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput({ project_id: "contract-alice-project" }));
      const task = await criarTarefa(h.store, h.deps, alice, taskInput({ project_id: "contract-alice-project" }));
      await h.store.transaction(alice, async (tx) => {
        const before = (await tx.projetos.get("contract-alice-project"))!; const after = { ...before, deleted_at: instant };
        await tx.projetos.replace(after); await tx.eventos.append(event(h, alice, "project", before, after));
      });
      expect((await editarCaptura(h.store, h.deps, alice, { id: capture.id, client_id: "edit-capture", patch: { title: "Editada" } })).project_id).toBe(capture.project_id);
      expect((await editarTarefa(h.store, h.deps, alice, { id: task.id, client_id: "edit-task", patch: { title: "Editada" } })).project_id).toBe(task.project_id);
      expect((await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" })).tarefa.project_id).toBeNull();
      await expect(criarTarefa(h.store, h.deps, alice, taskInput({ client_id: "new-task", project_id: capture.project_id }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    for (const point of ["write", "event", "commit"] as const) check(`falha em ${point} desfaz conversão, eventos e recibo`, async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput());
      h.failNext(point);
      await expect(converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" })).rejects.toThrow("Falha injetada");
      expect(await h.store.read(alice.user_id).capturas.get(capture.id)).toEqual(capture);
      expect(await h.store.read(alice.user_id).tarefas.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).eventos.list()).toHaveLength(1);
      await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" });
      expect(await h.store.read(alice.user_id).tarefas.list()).toHaveLength(1);
      expect(await h.store.read(alice.user_id).eventos.list()).toHaveLength(3);
    });

    check("erro de leitura é propagado sem fingir lista vazia", async (h) => {
      h.failNext("read");
      await expect(h.store.read(alice.user_id).capturas.list()).rejects.toThrow("Falha injetada");
    });

    check("callback que lança erro desfaz estado e evento", async (h) => {
      const before = (await h.store.read(alice.user_id).projetos.get("contract-alice-project"))!;
      await expect(h.store.transaction(alice, async (tx) => {
        const after = { ...before, name: "Mutação" }; await tx.projetos.replace(after);
        await tx.eventos.append(event(h, alice, "project", before, after)); throw new Error("abort");
      })).rejects.toThrow("abort");
      expect(await h.store.read(alice.user_id).projetos.get(before.id)).toEqual(before);
      expect(await h.store.read(alice.user_id).eventos.list()).toEqual([]);
    });

    check("escrita sem evento e evento sem escrita não podem ser confirmados", async (h) => {
      const before = (await h.store.read(alice.user_id).projetos.get("contract-alice-project"))!;
      const after = { ...before, name: "Mutação" };
      await expect(h.store.transaction(alice, async (tx) => { await tx.projetos.replace(after); })).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
      await expect(h.store.transaction(alice, async (tx) => { await tx.eventos.append(event(h, alice, "project", before, after)); })).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
      expect(await h.store.read(alice.user_id).projetos.get(before.id)).toEqual(before);
    });

    check("evento exige snapshots exatos e contexto do comando", async (h) => {
      const before = (await h.store.read(alice.user_id).projetos.get("contract-alice-project"))!;
      const after = { ...before, name: "Mutação" };
      await expect(h.store.transaction(alice, async (tx) => {
        await tx.projetos.replace(after); await tx.eventos.append(event(h, alice, "project", before, before));
      })).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
      await expect(h.store.transaction(alice, async (tx) => {
        await tx.projetos.replace(after); await tx.eventos.append({ ...event(h, alice, "project", before, after), canal: "cron" });
      })).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await h.store.read(alice.user_id).projetos.get(before.id)).toEqual(before);
    });

    check("capacidade transacional expira após commit e rollback", async (h) => {
      let saved!: Transacao;
      await h.store.transaction(alice, async (tx) => { saved = tx; });
      await expect(saved.capturas.list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
      await expect(h.store.transaction(alice, async (tx) => { saved = tx; throw new Error("abort"); })).rejects.toThrow("abort");
      await expect(saved.eventos.list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
      expect("insert" in h.store.read(alice.user_id).capturas).toBe(false);
    });

    check("editar título de tarefa concluída preserva conclusão; reabrir limpa timestamp", async (h) => {
      const first = await criarTarefa(h.store, h.deps, alice, taskInput({ status: "done" }));
      h.setTime("2026-10-08T12:00:00.000Z");
      const edited = await editarTarefa(h.store, h.deps, alice, { id: first.id, client_id: "edit", patch: { title: "Editada" } });
      expect(edited).toMatchObject({ status: "done", completed_at: first.completed_at, updated_at: "2026-10-08T12:00:00.000Z" });
      const reopened = await alterarStatusTarefa(h.store, h.deps, alice, { id: first.id, client_id: "reopen", status: "in_progress" });
      expect(reopened.completed_at).toBeNull();
      const archived = await alterarStatusTarefa(h.store, h.deps, alice, { id: first.id, client_id: "archive", status: "archived" });
      expect(archived.archived_at).toBe("2026-10-08T12:00:00.000Z");
      expect(await h.store.read(alice.user_id).tarefas.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).tarefas.list({ includeArchived: true })).toEqual([archived]);
    });

    check("lixeira e restauração preservam conteúdo, origem e arquivamento", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput());
      const { tarefa } = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" });
      const archived = await arquivarCaptura(h.store, h.deps, alice, { id: capture.id, client_id: "archive" });
      await excluirCaptura(h.store, h.deps, alice, { id: capture.id, client_id: "delete" });
      await excluirTarefa(h.store, h.deps, alice, { id: tarefa.id, client_id: "delete" });
      expect(await h.store.read(alice.user_id).capturas.list({ includeArchived: true })).toEqual([]);
      expect(await h.store.read(alice.user_id).tarefas.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).tarefas.list({ includeDeleted: true })).toHaveLength(1);
      expect(await restaurarCaptura(h.store, h.deps, alice, { id: capture.id, client_id: "restore" })).toEqual(archived);
      expect(await restaurarTarefa(h.store, h.deps, alice, { id: tarefa.id, client_id: "restore" })).toEqual(tarefa);
    });

    check("origem e client_id não podem ser alterados no repositório", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput());
      const { tarefa } = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" });
      for (const patch of [{ origin_capture_id: null }, { client_id: "changed" }]) await expect(h.store.transaction(alice, async (tx) => {
        const after = { ...tarefa, ...patch }; await tx.tarefas.replace(after); await tx.eventos.append(event(h, alice, "task", tarefa, after));
      })).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await h.store.read(alice.user_id).tarefas.get(tarefa.id)).toEqual(tarefa);
    });

    check("reconverter não ressuscita tarefa na lixeira nem duplica sua origem", async (h) => {
      const capture = await criarCaptura(h.store, h.deps, alice, captureInput());
      const { tarefa } = await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "convert" });
      const deleted = await excluirTarefa(h.store, h.deps, alice, { id: tarefa.id, client_id: "delete" });
      expect((await converterCapturaEmTarefa(h.store, h.deps, alice, { capture_id: capture.id, client_id: "retry" })).tarefa).toEqual(deleted);
      expect(await h.store.read(alice.user_id).tarefas.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).tarefas.list({ includeDeleted: true })).toEqual([deleted]);
    });

    check("leitura externa não observa escrita e evento antes do commit", async (h) => {
      const before = (await h.store.read(alice.user_id).projetos.get("contract-alice-project"))!;
      let announce!: () => void; let release!: () => void;
      const written = new Promise<void>((resolve) => { announce = resolve; });
      const proceed = new Promise<void>((resolve) => { release = resolve; });
      const after = { ...before, name: "Só depois do commit" };
      const pending = h.store.transaction(alice, async (tx) => {
        await tx.projetos.replace(after); await tx.eventos.append(event(h, alice, "project", before, after));
        expect(await tx.projetos.get(before.id)).toEqual(after);
        announce(); await proceed;
      });
      await written;
      try {
        expect(await h.store.read(alice.user_id).projetos.get(before.id)).toEqual(before);
        expect(await h.store.read(alice.user_id).eventos.list()).toEqual([]);
      } finally { release(); await pending; }
      expect(await h.store.read(alice.user_id).projetos.get(before.id)).toEqual(after);
      expect(await h.store.read(alice.user_id).eventos.list()).toHaveLength(1);
    });

    check("referências de origem estrangeiras falham mesmo na fronteira do adapter", async (h) => {
      const foreign = await criarCaptura(h.store, h.deps, bob, captureInput());
      const own = await criarTarefa(h.store, h.deps, alice, taskInput());
      await expect(h.store.transaction(alice, async (tx) => {
        const forged = { ...own, id: h.deps.ids.next(), client_id: "forged", origin_capture_id: foreign.id };
        await tx.tarefas.insert(forged); await tx.eventos.append(event(h, alice, "task", null, forged));
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await h.store.read(alice.user_id).tarefas.list()).toEqual([own]);
    });

    check("marcação esparsa tem unicidade, isolamento e remoção com evento", async (h) => {
      const mark: Entidades["habit_entry"] = { id: h.deps.ids.next(), user_id: alice.user_id, habit_id: "contract-alice-habit", done_on: "2026-10-07", note: null, created_at: instant };
      await h.store.transaction(alice, async (tx) => { await tx.marcacoes.insert(mark); await tx.eventos.append(event(h, alice, "habit_entry", null, mark)); });
      for (const habit_id of [mark.habit_id, "contract-bob-habit"]) await expect(h.store.transaction(alice, async (tx) => {
        const other = { ...mark, id: h.deps.ids.next(), habit_id }; await tx.marcacoes.insert(other); await tx.eventos.append(event(h, alice, "habit_entry", null, other));
      })).rejects.toMatchObject({ code: habit_id === mark.habit_id ? "CONFLICT" : "NOT_FOUND" });
      expect(await h.store.read(bob.user_id).marcacoes.list()).toEqual([]);
      await h.store.transaction(alice, async (tx) => { await tx.marcacoes.remove(mark.id); await tx.eventos.append(event(h, alice, "habit_entry", mark, null)); });
      expect(await h.store.read(alice.user_id).marcacoes.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).eventos.list()).toHaveLength(2);
      await expect(h.store.transaction(alice, async (tx) => { await tx.marcacoes.insert(mark); })).rejects.toMatchObject({ code: "CONFLICT" });
    });

    check("port financeiro persiste campos integrais com evento e isolamento", async (h) => {
      const account: Entidades["finance_account"] = { id: h.deps.ids.next(), user_id: alice.user_id, name: "Conta de contrato", kind: "checking", institution: null, currency: "BRL", opening_balance_cents: 12345, color_key: "blue", archived_at: null, created_at: instant, updated_at: instant, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null };
      await h.store.transaction(alice, async (tx) => { await tx.financeiro.contas.insert(account); await tx.eventos.append(event(h, alice, "finance_account", null, account)); });
      expect(await h.store.read(alice.user_id).financeiro.contas.list()).toEqual([account]);
      expect(await h.store.read(bob.user_id).financeiro.contas.get(account.id)).toBeNull();
    });

    check("lançamento financeiro não pode referenciar conta ou categoria estrangeira", async (h) => {
      for (const context of [alice, bob]) await h.store.transaction(context, async (tx) => {
        const account: Entidades["finance_account"] = { id: `${context.user_id}-account`, user_id: context.user_id, name: "Conta de contrato", kind: "checking", institution: null, currency: "BRL", opening_balance_cents: 0, color_key: "blue", archived_at: null, created_at: instant, updated_at: instant, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null };
        const category: Entidades["finance_category"] = { id: `${context.user_id}-financial-category`, user_id: context.user_id, name: "Categoria de contrato", normalized_name: "categoria de contrato", kind: "expense", parent_id: null, color_key: "blue", created_at: instant, updated_at: instant };
        await tx.financeiro.contas.insert(account); await tx.eventos.append(event(h, context, "finance_account", null, account));
        await tx.financeiro.categorias.insert(category); await tx.eventos.append(event(h, context, "finance_category", null, category));
      });
      for (const foreign of ["account", "category"] as const) await expect(h.store.transaction(alice, async (tx) => {
        const entry: Entidades["finance_transaction"] = { id: h.deps.ids.next(), user_id: alice.user_id, account_id: `${foreign === "account" ? bob.user_id : alice.user_id}-account`, category_id: `${foreign === "category" ? bob.user_id : alice.user_id}-financial-category`, kind: "expense", amount_cents: 100, description: "Contrato de referência", payee: null, occurred_on: "2026-10-07", transfer_group_id: null, notes: null, paid_cents: 0, created_at: instant, updated_at: instant, installment_group_id: null, installment_no: null, installment_total: null, statement_month: null, serie_tipo: null, status: "pending", source: "manual", due_date: null, deleted_at: null };
        await tx.financeiro.lancamentos.insert(entry); await tx.eventos.append(event(h, alice, "finance_transaction", null, entry));
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await h.store.read(alice.user_id).financeiro.lancamentos.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).eventos.list()).toHaveLength(2);
    });

    check("identificadores são únicos entre tipos de entidade e eventos", async (h) => {
      const task = await criarTarefa(h.store, h.deps, alice, taskInput());
      await expect(h.store.transaction(alice, async (tx) => {
        await tx.projetos.insert({ id: task.id, user_id: alice.user_id, name: "Colisão", description: null, color_key: "blue", position: 0, deleted_at: null, created_at: instant, updated_at: instant });
      })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(h.store.transaction(alice, async (tx) => {
        const after = { ...task, title: "Mutação" }; await tx.tarefas.replace(after); await tx.eventos.append({ ...event(h, alice, "task", task, after), id: task.id });
      })).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await h.store.read(alice.user_id).tarefas.get(task.id)).toEqual(task);
    });

    for (const invalid of [{ title: " " }, { due_at: "2026-10-07T12:00:00" }, { due_at: "2026-02-31T12:00:00Z" }, { due_at: "2026-02-29T00:00:00-03:00" }, { due_at: "2026-08-07T24:00:00Z" }, { estimated_minutes: -1 }, { scheduled_start_at: "2026-10-07T13:00:00Z", scheduled_end_at: "2026-10-07T12:00:00Z" }]) check(`entrada de tarefa inválida é atômica: ${JSON.stringify(invalid)}`, async (h) => {
      await expect(criarTarefa(h.store, h.deps, alice, taskInput(invalid))).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await h.store.read(alice.user_id).tarefas.list()).toEqual([]);
      expect(await h.store.read(alice.user_id).eventos.list()).toEqual([]);
    });

    check("relógio inválido desfaz criação em vez de normalizar data impossível", async (h) => {
      h.setTime("2026-02-31T12:00:00Z");
      await expect(criarCaptura(h.store, h.deps, alice, captureInput())).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await h.store.read(alice.user_id).capturas.list()).toEqual([]);
      h.setTime("2028-02-29T12:00:00Z");
      expect(await criarCaptura(h.store, h.deps, alice, captureInput())).toMatchObject({ created_at: "2028-02-29T12:00:00Z" });
    });
  });
}
