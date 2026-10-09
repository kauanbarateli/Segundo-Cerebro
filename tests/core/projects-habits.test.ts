import { describe, expect, it } from "vitest";
import { criarAdapterMemoria, type EstadoInicialMemoria, type PontoDeFalha } from "../../src/adapters/memory";
import type { HabitoDoUsuario, Projeto } from "../../src/core/contracts";
import { criarProjeto, editarProjeto, excluirProjeto, restaurarProjeto, criarContainerProjeto, vincularContainerProjeto, desvincularContainerProjeto, type ProjectContainer } from "../../src/core/projetos";
import { criarHabito, editarHabito, arquivarHabito, restaurarHabito, marcarHabito, registrarPausaHabito, removerPausaHabito, sequenciaAtual, celulasDoPeriodo, somarDias } from "../../src/core/habitos";
const now = "2026-10-10T01:30:00Z", today = "2026-10-09", context = { user_id: "alice", canal: "web" as const };
const project: Projeto = { id: "project", user_id: "alice", name: "Projeto", description: null, color_key: "work", position: 0, deleted_at: null, created_at: now, updated_at: now };
const habit: HabitoDoUsuario = { id: "habit", user_id: "alice", name: "Ler", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-05-01", archived_at: null, color_key: "personal", icon_key: null, position: 0, created_at: now, updated_at: now };
const container: ProjectContainer = { id: "container", user_id: "alice", kind: "notebook", name: "Caderno", project_id: project.id, parent_id: null, deleted_at: null, created_at: now, updated_at: now };
function setup(initial: EstadoInicialMemoria = { project: [project], project_container: [container], habit: [habit] }) { let id = 0, failure: PontoDeFalha | null = null; const deps = { clock: { now: () => now }, ids: { next: () => `generated-${++id}` } }, store = criarAdapterMemoria({ ...deps, initial, beforeOperation(point) { if (point === failure) { failure = null; throw new Error("Injected failure"); } } }); return { deps, store, fail(point: PontoDeFalha) { failure = point; } }; }
describe("T023 Projects: containers survive their project", () => {
  it("soft deletion and restoration keep container identity and link untouched", async () => {
    const h = setup(); await excluirProjeto(h.store, h.deps, context, { id: project.id, client_id: "delete" });
    expect(await h.store.read("alice").containers!.get(container.id)).toEqual(container);
    expect(await h.store.read("alice").projetos.list()).toEqual([]);
    await restaurarProjeto(h.store, h.deps, context, { id: project.id, client_id: "restore" });
    expect(await h.store.read("alice").containers!.get(container.id)).toEqual(container);
    expect((await h.store.read("alice").eventos.list()).map(event => event.entity_type)).toEqual(["project", "project"]);
  });
  it("create here, unlink and relink keep the same container and persist metadata events", async () => {
    const h = setup(), row = await criarContainerProjeto(h.store, h.deps, context, { kind: "capture", name: " Captura aqui ", project_id: project.id, client_id: "create" });
    const unlinked = await desvincularContainerProjeto(h.store, h.deps, context, { id: row.id, client_id: "unlink" }); expect(unlinked).toEqual({ ...row, project_id: null });
    const linked = await vincularContainerProjeto(h.store, h.deps, context, { id: row.id, project_id: project.id, client_id: "link" }); expect(linked).toEqual(row);
    const events = await h.store.read("alice").eventos.list(); expect(events).toHaveLength(3); expect(events.every(event => event.entity_type === "project_container")).toBe(true);
    expect(await criarContainerProjeto(h.store, h.deps, context, { kind: "capture", name: " Captura aqui ", project_id: project.id, client_id: "create" })).toEqual(row);
  });
  it("dead projects and other owners cannot receive a container", async () => {
    const h = setup({ project: [project, { ...project, id: "bob-project", user_id: "bob" }], project_container: [container], habit: [habit] });
    await expect(vincularContainerProjeto(h.store, h.deps, context, { id: container.id, project_id: "bob-project", client_id: "foreign" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await excluirProjeto(h.store, h.deps, context, { id: project.id, client_id: "delete" });
    await expect(criarContainerProjeto(h.store, h.deps, context, { kind: "folder", name: "Não criar", project_id: project.id, client_id: "dead" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it.each(["event", "commit"] as const)("failure at %s leaves no project and replay succeeds", async point => {
    const h = setup(); h.fail(point); const input = { name: "Novo", description: null, color_key: "work", position: 0, client_id: "same" };
    await expect(criarProjeto(h.store, h.deps, context, input)).rejects.toThrow("Injected"); expect(await h.store.read("alice").projetos.list()).toEqual([project]);
    const saved = await criarProjeto(h.store, h.deps, context, input); expect((await h.store.read("alice").projetos.list()).map(row => row.id)).toContain(saved.id);
  });
  it("edit changes project fields only and a reused receipt rejects divergence", async () => {
    const h = setup(), input = { id: project.id, patch: { name: "Renomeado" }, client_id: "edit" }; await editarProjeto(h.store, h.deps, context, input); expect(await h.store.read("alice").containers!.get(container.id)).toEqual(container);
    await expect(editarProjeto(h.store, h.deps, context, { ...input, patch: { name: "Outro nome" } })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
describe("T023 Habits: persistence preserves cadence and full history", () => {
  it.each(["daily", "weekdays", "weekly_target"] as const)("creates and edits %s with canonical cadence", async schedule_kind => {
    const h = setup(), row = await criarHabito(h.store, h.deps, context, { ...habit, name: "Novo", schedule_kind, weekdays: [1, 3, 5], weekly_target: 3, client_id: schedule_kind });
    expect(row.weekdays).toEqual(schedule_kind === "weekdays" ? [1, 3, 5] : []); expect(row.weekly_target).toBe(schedule_kind === "weekly_target" ? 3 : null);
    expect((await editarHabito(h.store, h.deps, context, { id: row.id, patch: { name: "Revisado" }, client_id: "edit" })).name).toBe("Revisado");
  });
  it("a 230-day streak is computed from complete history, independently from the 182-day heatmap", async () => {
    const start = somarDias(today, -229), rows = Array.from({ length: 230 }, (_, index) => ({ id: `mark-${index}`, user_id: "alice", habit_id: habit.id, done_on: somarDias(start, index), note: null, created_at: now }));
    const h = setup({ habit: [{ ...habit, started_on: start }], habit_entry: rows }), saved = (await h.store.read("alice").habitos.get(habit.id))!, marks = new Set((await h.store.read("alice").marcacoes.list()).map(row => row.done_on));
    expect(sequenciaAtual(saved, marks, today)).toBe(230); expect(celulasDoPeriodo(saved, marks, today, 182)).toHaveLength(182);
  });
  it("archive and restore keep all entries and pauses; a general and individual pause affect the map", async () => {
    const h = setup(); await marcarHabito(h.store, h.deps, context, { habit_id: habit.id, done_on: today, done: true, client_id: "mark" });
    const general = await registrarPausaHabito(h.store, h.deps, context, { habit_id: null, starts_on: "2026-10-07", ends_on: "2026-10-08", reason: null, client_id: "general" });
    await registrarPausaHabito(h.store, h.deps, context, { habit_id: habit.id, starts_on: today, ends_on: today, reason: null, client_id: "individual" });
    await arquivarHabito(h.store, h.deps, context, { id: habit.id, client_id: "archive" }); expect(await h.store.read("alice").marcacoes.list()).toHaveLength(1); expect(await h.store.read("alice").pausas.list()).toHaveLength(2);
    await restaurarHabito(h.store, h.deps, context, { id: habit.id, client_id: "restore" }); const pauses = await h.store.read("alice").pausas.list(); expect(celulasDoPeriodo(habit, new Set([today]), today, 3, pauses).every(cell => cell.pausado)).toBe(true);
    await removerPausaHabito(h.store, h.deps, context, { id: general.id, client_id: "remove-pause" }); expect(await h.store.read("alice").pausas.list()).toHaveLength(1);
  });
  it("future ceiling uses São Paulo while accepting the preceding local day", async () => {
    const h = setup(); await expect(marcarHabito(h.store, h.deps, context, { habit_id: habit.id, done_on: "2026-10-10", done: true, client_id: "future" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await marcarHabito(h.store, h.deps, context, { habit_id: habit.id, done_on: "2026-10-08", done: true, client_id: "past" })).not.toBeNull();
  });
  it("editing the initial date cannot erase the historical eligibility boundary", async () => {
    const h = setup(); await expect(editarHabito(h.store, h.deps, context, { id: habit.id, patch: { started_on: today }, client_id: "change-start" })).rejects.toMatchObject({ code: "VALIDATION" }); expect(await h.store.read("alice").habitos.get(habit.id)).toEqual(habit);
  });
});
