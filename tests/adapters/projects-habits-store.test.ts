import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assinatura, ErroDeDominio, type Projeto, type ReciboIdempotente } from "../../src/core/contracts";
import { editarProjeto, excluirProjeto, restaurarProjeto, criarContainerProjeto } from "../../src/core/projetos";
import { criarHabito, marcarHabito, type HabitTransaction } from "../../src/core/habitos";
import { createRoutineStore, type RoutineGateway, type RoutineSnapshot, type RoutineCommit, type RoutineKind, type RoutineChange } from "../../src/adapters/db/projects-habits-store";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { AuthGuardError } from "../../src/lib/auth/types";
const now = "2026-10-09T12:00:00Z", actor = "alice", context = { user_id: actor, canal: "web" as const };
const project: Projeto = { id: "project", user_id: actor, name: "Projeto", description: null, color_key: "work", position: 0, deleted_at: null, created_at: now, updated_at: now };
/** An injected transactional double, never evidence of PostgreSQL behavior. */
class AtomicGateway implements RoutineGateway {
  readonly actorId = actor;
  state: RoutineSnapshot = { revision: "0", projects: [project], habits: [], entries: [], pauses: [], containers: [], events: [], receipts: [] };
  attempts = 0; fail = false; loseResponse = false; denied: Error | null = null;
  async snapshot() { if (this.denied) throw this.denied; return structuredClone(this.state); }
  async receipt(command: string, clientId: string): Promise<ReciboIdempotente | null> { if (this.denied) throw this.denied; return structuredClone(this.state.receipts.find(row => row.command === command && row.client_id === clientId) ?? null); }
  async commit(request: RoutineCommit) {
    if (this.denied) throw this.denied; this.attempts++;
    const receipt = await this.receipt(request.receipt.command, request.receipt.client_id); if (receipt) { if (receipt.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "Conflict"); return { status: "replayed" as const, result: receipt.result }; }
    if (request.expectedRevision !== this.state.revision) return { status: "stale" as const };
    const draft = structuredClone(this.state), sets: Record<RoutineKind, NonNullable<RoutineChange["after"]>[]> = { project: draft.projects, habit: draft.habits, habit_entry: draft.entries, habit_pause: draft.pauses, project_container: draft.containers };
    for (const change of request.changes) { const rows = sets[change.type], row = change.after ?? change.before!, index = rows.findIndex(item => item.id === row.id); if (assinatura(index < 0 ? null : rows[index]) !== assinatura(change.before)) throw new Error("Stale before"); if (change.after === null) rows.splice(index, 1); else if (index < 0) rows.push(structuredClone(change.after)); else rows[index] = structuredClone(change.after); }
    if (this.fail) throw new Error("Injected failure before commit"); draft.events.push(...structuredClone(request.events)); draft.receipts.push(structuredClone(request.receipt)); draft.revision = String(BigInt(draft.revision) + 1n); this.state = draft;
    if (this.loseResponse) { this.loseResponse = false; throw new CommitOutcomeUnknown(); } return { status: "committed" as const, result: structuredClone(request.receipt.result) };
  }
}
function setup() { let id = 0; const gateway = new AtomicGateway(), store = createRoutineStore(gateway), deps = { clock: { now: () => now }, ids: { next: () => `generated-${++id}` } }; return { gateway, store, deps }; }
describe("T023 routine adapter on injected atomic transport", () => {
  it("concurrent replay has one effect and divergent input is rejected", async () => {
    const h = setup(), input = { id: project.id, patch: { name: "Renomeado" }, client_id: "edit" }; const [a, b] = await Promise.all([editarProjeto(h.store, h.deps, context, input), editarProjeto(h.store, h.deps, context, input)]);
    expect(a).toEqual(b); expect(h.gateway.state.events).toHaveLength(1); expect(h.gateway.state.receipts).toHaveLength(1);
    await expect(editarProjeto(h.store, h.deps, context, { ...input, patch: { name: "Outro" } })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("competing commands retry CAS from fresh source state", async () => {
    const h = setup(); await Promise.all([criarContainerProjeto(h.store, h.deps, context, { project_id: project.id, name: "A", kind: "notebook", client_id: "a" }), criarContainerProjeto(h.store, h.deps, context, { project_id: project.id, name: "B", kind: "capture", client_id: "b" })]);
    expect(h.gateway.state.containers).toHaveLength(2); expect(h.gateway.attempts).toBeGreaterThan(2);
  });
  it("response loss reconciles the same receipt without another effect", async () => {
    const h = setup(); h.gateway.loseResponse = true; expect((await editarProjeto(h.store, h.deps, context, { id: project.id, patch: { name: "Confirmado" }, client_id: "lost" })).name).toBe("Confirmado"); expect(h.gateway.attempts).toBe(1); expect(h.gateway.state.events).toHaveLength(1);
  });
  it("failed atomic commit leaves row, event and receipt unchanged; same request can retry", async () => {
    const h = setup(); h.gateway.fail = true; const input = { id: project.id, client_id: "delete" };
    await expect(excluirProjeto(h.store, h.deps, context, input)).rejects.toThrow("Injected"); expect(h.gateway.state.projects).toEqual([project]); expect(h.gateway.state.events).toEqual([]); expect(h.gateway.state.receipts).toEqual([]);
    h.gateway.fail = false; await excluirProjeto(h.store, h.deps, context, input); await restaurarProjeto(h.store, h.deps, context, { id: project.id, client_id: "restore" }); expect(h.gateway.state.projects[0]!.deleted_at).toBeNull();
  });
  it("ports expire and unauthorized replays do not return old results", async () => {
    const h = setup(); let held: HabitTransaction | null = null; await h.store.transaction(context, async tx => { held = tx; return null; }); await expect(held!.habitos.list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
    const input = { id: project.id, patch: { name: "Antes do veto" }, client_id: "same" }; await editarProjeto(h.store, h.deps, context, input); h.gateway.denied = new AuthGuardError("forbidden"); await expect(editarProjeto(h.store, h.deps, context, input)).rejects.toMatchObject({ code: "forbidden" });
    expect(() => h.store.read("bob")).toThrow();
  });
  it("physical mark removal has an exact deletion event and sparse storage", async () => {
    const h = setup(), row = await criarHabito(h.store, h.deps, context, { name: "Ler", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-01-01", color_key: "personal", icon_key: null, position: 0, client_id: "habit" });
    await marcarHabito(h.store, h.deps, context, { habit_id: row.id, done_on: "2026-10-08", done: true, client_id: "mark" }); await marcarHabito(h.store, h.deps, context, { habit_id: row.id, done_on: "2026-10-08", done: false, client_id: "unmark" });
    expect(h.gateway.state.entries).toEqual([]); expect(h.gateway.state.events.at(-1)).toMatchObject({ entity_type: "habit_entry", action: "deleted", after: null });
  });
  it("missing events or receipts never reach commit", async () => {
    const h = setup(); await expect(h.store.transaction(context, async tx => { await tx.projetos.replace({ ...project, name: "Sem recibo" }); })).rejects.toThrow("recibo");
    await expect(h.store.transaction(context, async tx => { await tx.projetos.replace({ ...project, name: "Sem evento" }); await tx.recibos.insert({ user_id: actor, command: "project.update", client_id: "orphan", fingerprint: "{}", result: null }); return null; })).rejects.toMatchObject({ code: "EVENT_REQUIRED" }); expect(h.gateway.attempts).toBe(0);
  });
  it("malformed staged event timestamps are rejected before transport", async () => {
    const h = setup(), after = { ...project, name: "Inválido" };
    await expect(h.store.transaction(context, async tx => {
      await tx.projetos.replace(after);
      await tx.eventos.append({ id: "bad-time", user_id: actor, entity_type: "project", entity_id: project.id, action: "updated", canal: "web", occurred_at: "not-a-date", before: project, after });
      await tx.recibos.insert({ user_id: actor, command: "project.update", client_id: "bad-time", fingerprint: "{}", result: after });
      return after;
    })).rejects.toThrow("Evento fora do domínio");
    expect(h.gateway.attempts).toBe(0); expect(h.gateway.state.projects).toEqual([project]);
  });
});
