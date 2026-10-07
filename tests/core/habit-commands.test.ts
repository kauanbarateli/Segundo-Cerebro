import { describe, expect, it } from "vitest";
import { criarAdapterMemoria, type EstadoInicialMemoria, type PontoDeFalha } from "../../src/adapters/memory";
import type { ContextoDeEscrita, HabitoDoUsuario, MarcacaoHabito } from "../../src/core/contracts";
import { marcarHabito, registrarPausaHabito, type NovaPausaHabito } from "../../src/core/habitos/use-cases";

const now = "2026-09-24T01:30:00.000Z"; // Ainda 23/09, 22h30 em São Paulo.
const context: ContextoDeEscrita = { user_id: "alice", canal: "web" };
const habit = (overrides: Partial<HabitoDoUsuario> = {}): HabitoDoUsuario => ({ id: "habit-alice", user_id: "alice", name: "Ler",
  schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-09-01", archived_at: null,
  color_key: "personal", icon_key: null, position: 0, created_at: now, updated_at: now, ...overrides });
const entry = (overrides: Partial<MarcacaoHabito> = {}): MarcacaoHabito => ({ id: "mark-old", user_id: "alice", habit_id: "habit-alice", done_on: "2026-09-23", note: null, created_at: now, ...overrides });
function harness(initial: EstadoInicialMemoria = { habit: [habit()] }) {
  let id = 0;
  let failure: PontoDeFalha | null = null;
  const deps = { clock: { now: () => now }, ids: { next: () => `generated-${++id}` } };
  const store = criarAdapterMemoria({ ...deps, initial, beforeOperation(point) { if (point === failure) { failure = null; throw new Error("Falha injetada"); } } });
  return { store, deps, fail(point: PontoDeFalha) { failure = point; } };
}
const mark = (client_id = "mark", done = true, done_on = "2026-09-23") => ({ habit_id: "habit-alice", done_on, done, client_id });
const pause = (overrides: Partial<NovaPausaHabito> = {}): NovaPausaHabito => ({ habit_id: "habit-alice", starts_on: "2026-09-22", ends_on: "2026-09-23", reason: "Férias", client_id: "pause", ...overrides });

describe("marcarHabito", () => {
  it("marca uma vez com dono, dia civil e evento no mesmo commit", async () => {
    const h = harness();
    const result = await marcarHabito(h.store, h.deps, context, mark());
    expect(result).toMatchObject({ user_id: "alice", habit_id: "habit-alice", done_on: "2026-09-23", created_at: now, note: null });
    expect(await h.store.read("alice").marcacoes.list()).toEqual([result]);
    expect(await h.store.read("alice").eventos.list()).toEqual([expect.objectContaining({ entity_type: "habit_entry", action: "created", before: null, after: result, canal: "web" })]);
  });

  it("aceita dia passado desde o início e recusa amanhã no fuso do app", async () => {
    const h = harness();
    expect(await marcarHabito(h.store, h.deps, context, mark("past", true, "2026-09-01"))).not.toBeNull();
    await expect(marcarHabito(h.store, h.deps, context, mark("future", true, "2026-09-24"))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(marcarHabito(h.store, h.deps, context, mark("before", true, "2026-08-31"))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it.each(["2026-02-30", "2026-02-29", "2026-13-01", "2026-9-03", "2026-09-23T00:00:00Z"])("recusa dia civil inválido: %s", async (day) => {
    const h = harness();
    await expect(marcarHabito(h.store, h.deps, context, mark("invalid", true, day))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.store.read("alice").marcacoes.list()).toEqual([]);
  });

  it("nega hábito ausente, de outro dono ou arquivado", async () => {
    const h = harness({ habit: [habit({ id: "other", user_id: "bob" }), habit({ archived_at: now })] });
    for (const habit_id of ["other", "missing"]) await expect(marcarHabito(h.store, h.deps, context, { ...mark(habit_id), habit_id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(marcarHabito(h.store, h.deps, context, mark())).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.store.read("alice").eventos.list()).toEqual([]);
  });

  it("cadência por dias barra marcação nova fora do dia, mas alvo semanal permite qualquer dia", async () => {
    const h = harness({ habit: [habit({ schedule_kind: "weekdays", weekdays: [1, 5] }), habit({ id: "weekly", schedule_kind: "weekly_target", weekly_target: 3 })] });
    await expect(marcarHabito(h.store, h.deps, context, mark())).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await marcarHabito(h.store, h.deps, context, { ...mark("weekly"), habit_id: "weekly" })).not.toBeNull();
  });

  it.each([null, "habit-alice"])("pausa geral/individual impede nova marcação: %s", async (habit_id) => {
    const h = harness();
    await registrarPausaHabito(h.store, h.deps, context, pause({ habit_id }));
    await expect(marcarHabito(h.store, h.deps, context, mark())).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.store.read("alice").marcacoes.list()).toEqual([]);
  });

  it("pausa de outro usuário não bloqueia o dia", async () => {
    const h = harness();
    await registrarPausaHabito(h.store, h.deps, { user_id: "bob", canal: "api" }, pause({ habit_id: null }));
    expect(await marcarHabito(h.store, h.deps, context, mark())).not.toBeNull();
    expect(await h.store.read("alice").pausas.list()).toEqual([]);
  });

  it("desmarca mesmo após mudança de pausa e cadência, emitindo before e after=null", async () => {
    const previous = entry();
    const h = harness({ habit: [habit({ schedule_kind: "weekdays", weekdays: [1] })], habit_entry: [previous] });
    await registrarPausaHabito(h.store, h.deps, context, pause());
    expect(await marcarHabito(h.store, h.deps, context, mark("remove", false))).toBeNull();
    expect(await h.store.read("alice").marcacoes.list()).toEqual([]);
    expect((await h.store.read("alice").eventos.list()).at(-1)).toMatchObject({ action: "deleted", entity_id: previous.id, before: previous, after: null });
  });

  it("repetir o estado desejado, inclusive concorrente, não duplica linha nem evento", async () => {
    const h = harness();
    const results = await Promise.all([marcarHabito(h.store, h.deps, context, mark("first")), marcarHabito(h.store, h.deps, context, mark("second"))]);
    expect(results[0]).toEqual(results[1]);
    expect(await h.store.read("alice").eventos.list()).toHaveLength(1);
    await marcarHabito(h.store, h.deps, context, mark("remove", false));
    await marcarHabito(h.store, h.deps, context, mark("remove-again", false));
    expect(await h.store.read("alice").eventos.list()).toHaveLength(2);
  });

  it("replay conserva resposta original sem desfazer escrita posterior; conflito de conteúdo falha", async () => {
    const h = harness();
    const first = await marcarHabito(h.store, h.deps, context, mark());
    await marcarHabito(h.store, h.deps, context, mark("remove", false));
    expect(await marcarHabito(h.store, h.deps, context, mark())).toEqual(first);
    expect(await h.store.read("alice").marcacoes.list()).toEqual([]);
    await expect(marcarHabito(h.store, h.deps, context, mark("mark", false))).rejects.toMatchObject({ code: "CONFLICT" });
    const next = await marcarHabito(h.store, h.deps, context, mark("new-mark"));
    expect(next?.id).not.toBe(first?.id);
  });

  it.each(["event", "commit"] as const)("falha em %s reverte marcação, evento e recibo", async (point) => {
    const h = harness(); h.fail(point);
    await expect(marcarHabito(h.store, h.deps, context, mark())).rejects.toThrow("Falha injetada");
    expect(await h.store.read("alice").marcacoes.list()).toEqual([]);
    expect(await h.store.read("alice").eventos.list()).toEqual([]);
    expect(await marcarHabito(h.store, h.deps, context, mark())).not.toBeNull();
  });

  it("copia entrada/contexto antes da fila; mutar resposta não muda o registro", async () => {
    const h = harness(); const input = mark(); const channel = { ...context };
    const result = marcarHabito(h.store, h.deps, channel, input);
    input.done_on = "2026-09-24"; channel.user_id = "bob";
    const saved = (await result)!; saved.done_on = "2030-01-01";
    expect(await h.store.read("alice").marcacoes.list()).toEqual([expect.objectContaining({ done_on: "2026-09-23", user_id: "alice" })]);
  });
});

describe("registrarPausaHabito", () => {
  it("aceita pausa futura aberta, normaliza motivo e persiste evento", async () => {
    const h = harness();
    const result = await registrarPausaHabito(h.store, h.deps, context, pause({ starts_on: "2026-10-01", ends_on: null, reason: "  Férias  " }));
    expect(result).toMatchObject({ starts_on: "2026-10-01", ends_on: null, reason: "Férias", user_id: "alice", created_at: now });
    expect(await h.store.read("alice").eventos.list()).toEqual([expect.objectContaining({ entity_type: "habit_pause", action: "created", before: null, after: result })]);
  });

  it("pausa global não precisa de hábito e fica restrita ao dono", async () => {
    const h = harness({});
    const result = await registrarPausaHabito(h.store, h.deps, context, pause({ habit_id: null, reason: "   " }));
    expect(result.reason).toBeNull();
    expect(await h.store.read("bob").pausas.list()).toEqual([]);
  });

  it("replay e concorrência com mesmo client_id retornam uma única pausa", async () => {
    const h = harness();
    const results = await Promise.all([registrarPausaHabito(h.store, h.deps, context, pause()), registrarPausaHabito(h.store, h.deps, context, pause())]);
    expect(results[0]).toEqual(results[1]);
    expect(await h.store.read("alice").pausas.list()).toHaveLength(1);
    expect(await h.store.read("alice").eventos.list()).toHaveLength(1);
    await expect(registrarPausaHabito(h.store, h.deps, context, pause({ reason: "Outro motivo" }))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it.each([
    { starts_on: "2026-02-30" }, { ends_on: "2026-02-30" }, { ends_on: "2026-09-21" },
    { starts_on: "2026-08-31" }, { reason: "x".repeat(201) },
  ])("recusa pausa inválida: %j", async (patch) => {
    const h = harness();
    await expect(registrarPausaHabito(h.store, h.deps, context, pause(patch))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.store.read("alice").pausas.list()).toEqual([]);
    expect(await h.store.read("alice").eventos.list()).toEqual([]);
  });

  it("recusa hábito estrangeiro, inexistente e arquivado", async () => {
    const h = harness({ habit: [habit({ archived_at: now }), habit({ id: "other", user_id: "bob" })] });
    for (const habit_id of ["other", "missing"]) await expect(registrarPausaHabito(h.store, h.deps, context, pause({ habit_id, client_id: habit_id }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(registrarPausaHabito(h.store, h.deps, context, pause())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it.each(["event", "commit"] as const)("falha em %s reverte pausa, evento e recibo", async (point) => {
    const h = harness(); h.fail(point);
    await expect(registrarPausaHabito(h.store, h.deps, context, pause())).rejects.toThrow("Falha injetada");
    expect(await h.store.read("alice").pausas.list()).toEqual([]);
    expect(await h.store.read("alice").eventos.list()).toEqual([]);
    expect(await registrarPausaHabito(h.store, h.deps, context, pause())).not.toBeNull();
  });
});
