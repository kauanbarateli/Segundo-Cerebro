import { describe, expect, it } from "vitest";
import { criarAdapterMemoria, type PontoDeFalha } from "../../src/adapters/memory";
import type { HabitoDoUsuario } from "../../src/core/contracts";
import { alterarFrequencia, conferirEstadoDaFrequencia, frequenciaInicial, criarHabito, editarHabito, arquivarHabito, restaurarHabito, marcarHabito, podeMarcarDia, type CamposHabito } from "../../src/core/habitos";

const now = "2026-10-22T01:30:00Z"; // 21 October in São Paulo.
const context = { user_id: "alice", canal: "web" as const };
const fields: CamposHabito = { name: "Ler", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-10-19", color_key: "personal", icon_key: null, position: 0 };
const habit: HabitoDoUsuario = { ...fields, id: "habit", user_id: "alice", archived_at: null, created_at: now, updated_at: now };
const weekly = { schedule_kind: "weekly_target" as const, weekdays: [], weekly_target: 3 };
function harness(row = habit) {
  let id = 0, instant = now, captures = 0, failure: PontoDeFalha | null = null;
  const deps = { clock: { now: () => { captures++; return instant; } }, ids: { next: () => `id-${++id}` } };
  const store = criarAdapterMemoria({ ...deps, initial: { habit: [row] }, beforeOperation(point) { if (point === failure) { failure = null; throw new Error("Injected rollback"); } } });
  return { store, deps, now(value: string) { instant = value; }, captures: () => captures, fail(point: PontoDeFalha) { failure = point; } };
}
describe("SPEC08 persisted frequency state", () => {
  it("keeps absent legacy on semantic no-op and starts baseline from BEFORE on change", () => {
    expect(alterarFrequencia(habit, habit, "2026-10-21")).toBeUndefined();
    const state = alterarFrequencia(habit, weekly, "2026-10-21")!;
    expect(state.baseline_origin).toBe("legacy_known_frequency");
    expect(state.changes.map(row => [row.effective_from, row.schedule_kind])).toEqual([["2026-10-19", "daily"], ["2026-10-21", "weekly_target"]]);
  });
  it("replaces today's row, then removes only its redundant A→B→A transition", () => {
    const first = { ...habit, ...weekly, frequency_history: alterarFrequencia(habit, weekly, "2026-10-21")! };
    const second = { ...first, ...weekly, weekly_target: 1, frequency_history: alterarFrequencia(first, { ...weekly, weekly_target: 1 }, "2026-10-21")! };
    expect(second.frequency_history.changes).toHaveLength(2);
    const back = alterarFrequencia(second, habit, "2026-10-21")!;
    expect(back.changes).toHaveLength(1); expect(back.changes[0]!.effective_from).toBe(habit.started_on);
    expect(back.baseline_origin).toBe("legacy_known_frequency");
  });
  it.each(["2026-10-21", "2026-10-26"])("keeps one baseline for a habit starting %s", started_on => {
    const h = { ...habit, started_on }, state = alterarFrequencia(h, weekly, "2026-10-21")!;
    expect(state.changes).toHaveLength(1); expect(state.changes[0]).toMatchObject({ effective_from: started_on, schedule_kind: "weekly_target" });
  });
  it("weekday reordering is not a semantic change", () => {
    const h = { ...habit, schedule_kind: "weekdays" as const, weekdays: [1, 3] };
    expect(alterarFrequencia(h, { ...h, weekdays: [3, 1] }, "2026-10-21")).toBeUndefined();
  });
  it.each([null, undefined, {}, [], { version: 1, baseline_origin: "created_frequency", changes: [] }])("does not coalesce malformed present state to legacy: %j", value => {
    expect(() => conferirEstadoDaFrequencia({ ...habit, frequency_history: value } as HabitoDoUsuario)).toThrow();
  });
  it("rejects owner/identity, origin, top-level cadence, chronology and extras", () => {
    const state = frequenciaInicial(habit), first = state.changes[0]!;
    for (const frequency_history of [
      { ...state, baseline_origin: "supplied_history" }, { ...state, extra: true },
      { ...state, changes: [{ ...first, user_id: "bob" }] }, { ...state, changes: [{ ...first, habit_id: "other" }] },
      { ...state, changes: [{ ...first, ...weekly }] },
      { ...state, changes: [{ ...first, effective_from: "2026-10-21" }, first] },
    ]) expect(() => conferirEstadoDaFrequencia({ ...habit, frequency_history } as HabitoDoUsuario)).toThrow();
  });
  it("resolves historical day eligibility even if today's cadence is weekly", () => {
    const before = { ...habit, schedule_kind: "weekdays" as const, weekdays: [1] };
    const changed = { ...before, ...weekly, frequency_history: alterarFrequencia(before, weekly, "2026-10-21")! };
    expect(podeMarcarDia(changed, "2026-10-20", "2026-10-21")).toBe(false);
    expect(podeMarcarDia(changed, "2026-10-19", "2026-10-21")).toBe(true);
    expect(podeMarcarDia(changed, "2026-10-21", "2026-10-21")).toBe(true);
    expect(podeMarcarDia(changed, "2026-10-22", "2026-10-21")).toBe(false);
  });
});
describe("SPEC08 frequency writes and receipts", () => {
  it("creates a real baseline without a mark, using one instant including event", async () => {
    const h = harness(); const saved = await criarHabito(h.store, h.deps, context, { ...fields, client_id: "create" });
    expect(saved.frequency_history).toMatchObject({ version: 1, baseline_origin: "created_frequency", changes: [{ effective_from: fields.started_on }] });
    expect(await h.store.read("alice").marcacoes.list()).toEqual([]);
    expect(h.captures()).toBe(1); expect((await h.store.read("alice").eventos.list())[0]!.occurred_at).toBe(now);
  });
  it("replays next day after archive without a new clock, event or rewriting the result", async () => {
    const h = harness(), input = { id: habit.id, patch: weekly, client_id: "change" };
    const saved = await editarHabito(h.store, h.deps, context, input);
    expect(h.captures()).toBe(1);
    await arquivarHabito(h.store, h.deps, context, { id: habit.id, client_id: "archive" });
    const captured = h.captures(); h.now("2026-10-23T12:00:00Z");
    expect(await editarHabito(h.store, h.deps, context, input)).toEqual(saved); expect(h.captures()).toBe(captured);
    expect(await h.store.read("alice").eventos.list()).toHaveLength(2);
    await expect(editarHabito(h.store, h.deps, context, { ...input, patch: { ...weekly, weekly_target: 1 } })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rename/archive/restore preserve the complete state and immutable start", async () => {
    const h = harness(); const changed = await editarHabito(h.store, h.deps, context, { id: habit.id, patch: weekly, client_id: "change" });
    await editarHabito(h.store, h.deps, context, { id: habit.id, patch: { name: "Outro" }, client_id: "rename" });
    await arquivarHabito(h.store, h.deps, context, { id: habit.id, client_id: "archive" });
    const restored = await restaurarHabito(h.store, h.deps, context, { id: habit.id, client_id: "restore" });
    expect(restored.frequency_history).toEqual(changed.frequency_history);
    await expect(editarHabito(h.store, h.deps, context, { id: habit.id, patch: { started_on: "2026-10-20" }, client_id: "move" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it.each(["event", "commit"] as const)("rolls back history/event/receipt at %s", async point => {
    const h = harness(); h.fail(point); const input = { id: habit.id, patch: weekly, client_id: "change" };
    await expect(editarHabito(h.store, h.deps, context, input)).rejects.toThrow("Injected rollback");
    expect(await h.store.read("alice").habitos.get(habit.id)).toEqual(habit); expect(await h.store.read("alice").eventos.list()).toEqual([]);
    expect((await editarHabito(h.store, h.deps, context, input)).frequency_history!.changes).toHaveLength(2);
  });
  it("keeps and undoes today's mark when the new frequency excludes today", async () => {
    const h = harness(); await marcarHabito(h.store, h.deps, context, { habit_id: habit.id, done_on: "2026-10-21", done: true, client_id: "mark" });
    const changed = await editarHabito(h.store, h.deps, context, { id: habit.id, patch: { schedule_kind: "weekdays", weekdays: [1] }, client_id: "change" });
    expect(podeMarcarDia(changed, "2026-10-21", "2026-10-21")).toBe(false);
    expect(await h.store.read("alice").marcacoes.list()).toHaveLength(1);
    await marcarHabito(h.store, h.deps, context, { habit_id: habit.id, done_on: "2026-10-21", done: false, client_id: "undo" });
    await expect(marcarHabito(h.store, h.deps, context, { habit_id: habit.id, done_on: "2026-10-21", done: true, client_id: "again" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("does not accept history from the public patch or another owner", async () => {
    const h = harness();
    await expect(editarHabito(h.store, h.deps, context, { id: habit.id, patch: { frequency_history: null } as unknown as CamposHabito, client_id: "inject" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(editarHabito(h.store, h.deps, { ...context, user_id: "bob" }, { id: habit.id, patch: weekly, client_id: "foreign" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
