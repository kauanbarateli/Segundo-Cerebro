import { describe, expect, it, vi } from "vitest";
import { assinatura, ErroDeDominio, type CaptureTaskTransaction, type ContextoDeEscrita, type DependenciasDeDominio, type ReciboIdempotente } from "../../src/core/contracts";
import { converterCapturaEmTarefa, criarCaptura, editarCaptura, type Captura, type NovaCaptura } from "../../src/core/capturas";
import { criarTarefa, type NovaTarefa } from "../../src/core/tarefas";
import { AuthGuardError } from "../../src/lib/auth/types";

vi.mock("server-only", () => ({}));
import { CommitOutcomeUnknown, createCaptureTaskStore, type CaptureTaskCommit, type CaptureTaskCommitResult, type CaptureTaskGateway, type CaptureTaskSnapshot } from "../../src/adapters/db/capture-task-store";

const actor = "10000000-0000-4000-8000-000000000001";
const context: ContextoDeEscrita = { user_id: actor, canal: "web" };
const now = "2026-10-07T12:00:00.000Z";
const clone = <T>(value: T): T => structuredClone(value);
const input = (client_id: string, patch: Partial<NovaCaptura> = {}): NovaCaptura => ({ client_id, type: "note", title: "Original", content: "Conteúdo", category_id: null, project_id: null, ...patch });
function dependencies(prefix = "generated"): DependenciasDeDominio {
  let id = 0;
  return { clock: { now: () => now }, ids: { next: () => `${prefix}-${++id}` } };
}
function capture(id: string, user_id = actor): Captura {
  return { ...input(`create-${id}`), id, user_id, status: "inbox", converted_task_id: null, captured_at: now, organized_at: null, archived_at: null, deleted_at: null, created_at: now, updated_at: now };
}

/** Test transport only. The critical section has no awaits and publishes one clone. */
class AtomicGateway implements CaptureTaskGateway {
  readonly actorId = actor;
  state: CaptureTaskSnapshot;
  requests: CaptureTaskCommit[] = [];
  snapshotCalls = 0;
  revisionCalls = 0;
  receiptCalls = 0;
  staleCommits = 0;
  replayedCommits = 0;
  accessError: Error | null = null;
  commitError: Error | null = null;
  receiptError: Error | null = null;
  loseNextResponse = false;
  corruptCommittedResponse = false;
  afterSnapshot?: (snapshot: CaptureTaskSnapshot) => Promise<void>;
  beforeCommit?: (request: CaptureTaskCommit) => Promise<void>;
  constructor(initial: Partial<CaptureTaskSnapshot> = {}) {
    this.state = clone({ revision: "0", captures: [], tasks: [], categories: [], projects: [], events: [], receipts: [], ...initial });
  }
  private authorize() { if (this.accessError) throw this.accessError; }
  async snapshot() {
    this.authorize(); this.snapshotCalls++;
    const snapshot = clone(this.state);
    await this.afterSnapshot?.(snapshot);
    return snapshot;
  }
  async currentRevision() { this.authorize(); this.revisionCalls++; return this.state.revision; }
  async receipt(command: string, clientId: string) {
    this.authorize(); this.receiptCalls++;
    if (this.receiptError) throw this.receiptError;
    return clone(this.state.receipts.find((receipt) => receipt.command === command && receipt.client_id === clientId) ?? null);
  }
  async commit(request: CaptureTaskCommit): Promise<CaptureTaskCommitResult> {
    this.requests.push(clone(request));
    await this.beforeCommit?.(clone(request));
    this.authorize();
    if (this.commitError) throw this.commitError;
    expect(request.context.user_id).toBe(actor);
    const saved = this.state.receipts.find((receipt) => receipt.command === request.receipt.command && receipt.client_id === request.receipt.client_id);
    if (saved) {
      if (saved.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "client_id já usado com outro conteúdo.");
      this.replayedCommits++;
      return { status: "replayed", result: clone(saved.result) };
    }
    if (request.expectedRevision !== this.state.revision) { this.staleCommits++; return { status: "stale" }; }
    const next = clone(this.state);
    for (const change of request.changes) {
      if (change.type === "capture") {
        const index = next.captures.findIndex((row) => row.id === change.after.id);
        expect(index === -1 ? null : next.captures[index]).toEqual(change.before);
        if (index === -1) next.captures.push(clone(change.after)); else next.captures[index] = clone(change.after);
      } else {
        const index = next.tasks.findIndex((row) => row.id === change.after.id);
        expect(index === -1 ? null : next.tasks[index]).toEqual(change.before);
        if (index === -1) next.tasks.push(clone(change.after)); else next.tasks[index] = clone(change.after);
      }
    }
    next.events.push(...clone(request.events)); next.receipts.push(clone(request.receipt));
    next.revision = String(BigInt(next.revision) + 1n);
    this.state = next;
    if (this.loseNextResponse) { this.loseNextResponse = false; throw new CommitOutcomeUnknown(); }
    if (this.corruptCommittedResponse) return { status: "committed", result: { unexpected: true } };
    return { status: "committed", result: clone(request.receipt.result) };
  }
}

describe("T015: staging/CAS com transporte atômico sem banco", () => {
  it("protege o conteúdo da origem promovida sem impedir renomear outra captura", async () => {
    const original = capture("original"), historical = { ...capture("historical"), status: "archived" as const, title: "Original", content: "[[Original]]", archived_at: now }, related = { ...capture("related"), title: "Outra", content: "[[Original]]" };
    const gateway = new AtomicGateway({ captures: [original, historical, related], readonlyCaptureIds: [historical.id] }), store = createCaptureTaskStore(gateway);
    await expect(editarCaptura(store, dependencies(), context, { client_id: "change-source", id: historical.id, patch: { content: "Modificar origem" } })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(gateway.requests).toHaveLength(0);
    await editarCaptura(store, dependencies(), context, { client_id: "rename-other", id: original.id, patch: { title: "Atual" } });
    expect(gateway.state.captures.find(row => row.id === historical.id)).toEqual(historical);
    expect(gateway.state.captures.find(row => row.id === related.id)?.content).toBe("[[Atual]]");
    expect(gateway.state.events).toHaveLength(2);
  });
  it("cria com evento/recibo, conserva snapshot do replay e recusa payload diferente", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), deps = dependencies();
    const first = await criarCaptura(store, deps, context, input("same"));
    expect(gateway.state.captures).toEqual([first]);
    expect(gateway.state.events).toEqual([expect.objectContaining({ before: null, after: first, canal: "web" })]);
    expect(gateway.state.receipts).toEqual([expect.objectContaining({ command: "capture.create", client_id: "same", fingerprint: assinatura(input("same")), result: first })]);
    await editarCaptura(store, deps, context, { id: first.id, client_id: "edit", patch: { title: "Atual" } });
    expect(await criarCaptura(store, deps, context, input("same"))).toEqual(first);
    expect(gateway.state.captures[0]?.title).toBe("Atual");
    expect(gateway.replayedCommits).toBe(1);
    await expect(criarCaptura(store, deps, context, input("same", { title: "Diferente" }))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(gateway.state.events).toHaveLength(2); expect(gateway.state.receipts).toHaveLength(2);
  });

  it("duas conversões concorrentes resolvem CAS sem duplicar tarefa ou eventos", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), other = createCaptureTaskStore(gateway), deps = dependencies();
    const source = await criarCaptura(store, deps, context, input("create"));
    let arrivals = 0, release!: () => void;
    const bothPrepared = new Promise<void>((resolve) => { release = resolve; });
    gateway.beforeCommit = async (request) => {
      if (request.receipt.command !== "capture.convert" || arrivals >= 2) return;
      if (++arrivals === 2) release();
      await bothPrepared;
    };
    const [first, second] = await Promise.all([
      converterCapturaEmTarefa(store, deps, context, { capture_id: source.id, client_id: "convert-a" }),
      converterCapturaEmTarefa(other, deps, context, { capture_id: source.id, client_id: "convert-b" }),
    ]);
    expect(first.tarefa.id).toBe(second.tarefa.id);
    expect(gateway.staleCommits).toBe(1);
    expect(gateway.state.tasks).toHaveLength(1); expect(gateway.state.events).toHaveLength(3);
    expect(gateway.state.receipts).toHaveLength(3);
    expect(gateway.state.captures[0]?.converted_task_id).toBe(first.tarefa.id);
    expect(gateway.state.tasks[0]?.origin_capture_id).toBe(source.id);
  });

  it("replay concorrente vence o CAS e devolve o ID já confirmado", async () => {
    const gateway = new AtomicGateway();
    let arrivals = 0, release!: () => void;
    const bothPrepared = new Promise<void>((resolve) => { release = resolve; });
    gateway.beforeCommit = async () => { if (++arrivals === 2) release(); await bothPrepared; };
    const [first, second] = await Promise.all([
      criarCaptura(createCaptureTaskStore(gateway), dependencies("first"), context, input("same")),
      criarCaptura(createCaptureTaskStore(gateway), dependencies("second"), context, input("same")),
    ]);
    expect(first).toEqual(second);
    expect(gateway.requests.map((request) => request.changes[0]?.after.id)).toEqual(["first-1", "second-1"]);
    expect(gateway.replayedCommits).toBe(1); expect(gateway.staleCommits).toBe(0);
    expect(gateway.state.captures).toEqual([first]);
    expect(gateway.state.events).toHaveLength(1); expect(gateway.state.receipts).toHaveLength(1);
  });

  it("reconcilia resposta perdida pelo recibo sem repetir a escrita", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    gateway.loseNextResponse = true;
    const result = await criarCaptura(store, dependencies(), context, input("lost"));
    expect(result).toEqual(gateway.state.captures[0]);
    expect(gateway.requests).toHaveLength(1); expect(gateway.receiptCalls).toBe(1);
    expect(gateway.state.events).toHaveLength(1); expect(gateway.state.receipts).toHaveLength(1);
  });

  it("preserva resultado desconhecido sem recibo, sem retry cego", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), unknown = new CommitOutcomeUnknown();
    gateway.commitError = unknown;
    await expect(criarCaptura(store, dependencies(), context, input("unknown"))).rejects.toBe(unknown);
    expect(gateway.requests).toHaveLength(1); expect(gateway.receiptCalls).toBe(1);
    expect(gateway.state.captures).toEqual([]); expect(gateway.state.events).toEqual([]); expect(gateway.state.receipts).toEqual([]);
  });

  it("reconcilia resposta committed divergente em vez de aceitar resultado arbitrário", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    gateway.corruptCommittedResponse = true;
    const result = await criarCaptura(store, dependencies(), context, input("divergent"));
    expect(result).toEqual(gateway.state.captures[0]);
    expect(gateway.receiptCalls).toBe(1); expect(gateway.requests).toHaveLength(1);
  });

  it("não confirma resposta divergente se o recibo não está disponível", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    gateway.corruptCommittedResponse = true;
    vi.spyOn(gateway, "receipt").mockResolvedValue(null);
    await expect(criarCaptura(store, dependencies(), context, input("divergent"))).rejects.toBeInstanceOf(CommitOutcomeUnknown);
    expect(gateway.requests).toHaveLength(1);
  });

  it("falha de rede na reconciliação mantém resultado desconhecido", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    gateway.loseNextResponse = true; gateway.receiptError = new Error("network down");
    await expect(criarCaptura(store, dependencies(), context, input("lost"))).rejects.toBeInstanceOf(CommitOutcomeUnknown);
    expect(gateway.requests).toHaveLength(1); expect(gateway.state.captures).toHaveLength(1);
  });

  it.each(["unauthenticated", "forbidden"] as const)("propaga %s durante reconciliação sem devolver recibo", async (code) => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), revoked = new AuthGuardError(code);
    gateway.loseNextResponse = true; gateway.receiptError = revoked;
    await expect(criarCaptura(store, dependencies(), context, input("lost"))).rejects.toBe(revoked);
    expect(gateway.requests).toHaveLength(1); expect(gateway.receiptCalls).toBe(1);
  });

  it("recusa reconciliação de outro dono ou payload com client_id reutilizado", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), row = capture("receipt");
    const receipt: ReciboIdempotente = { user_id: "other-user", command: "capture.create", client_id: "lost", fingerprint: assinatura(input("lost")), result: row };
    gateway.commitError = new CommitOutcomeUnknown();
    const lookup = vi.spyOn(gateway, "receipt").mockResolvedValue(receipt);
    await expect(criarCaptura(store, dependencies(), context, input("lost"))).rejects.toMatchObject({ code: "VALIDATION" });
    lookup.mockResolvedValue({ ...receipt, user_id: actor, fingerprint: "different" });
    await expect(criarCaptura(store, dependencies(), context, input("lost"))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(gateway.state.captures).toEqual([]);
  });

  it("propaga revogação no commit sem reconciliar como falha de rede", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), revoked = new AuthGuardError("unauthenticated");
    gateway.beforeCommit = async () => { gateway.accessError = revoked; };
    await expect(criarCaptura(store, dependencies(), context, input("revoked"))).rejects.toBe(revoked);
    expect(gateway.receiptCalls).toBe(0); expect(gateway.state.captures).toEqual([]);
  });

  it("rename reexecuta e reescreve referência inserida depois do snapshot inicial", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), deps = dependencies();
    const source = await criarCaptura(store, deps, context, input("source"));
    let inserted = false;
    gateway.beforeCommit = async (request) => {
      if (request.receipt.command !== "capture.update" || inserted) return;
      inserted = true;
      await criarCaptura(createCaptureTaskStore(gateway), deps, context, input("incoming", { title: "Referência", content: "Leia [[Original]]." }));
    };
    await editarCaptura(store, deps, context, { id: source.id, client_id: "rename", patch: { title: "Novo título" } });
    expect(gateway.staleCommits).toBe(1);
    expect(gateway.state.captures.map((row) => [row.title, row.content])).toEqual([["Novo título", "Conteúdo"], ["Referência", "Leia [[Novo título]]."]]);
    expect(gateway.state.events).toHaveLength(4);
    expect(gateway.requests.at(-1)?.changes).toHaveLength(2);
  });

  it("reexecuta erro de domínio produzido por snapshot ultrapassado", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    gateway.afterSnapshot = async () => {
      gateway.afterSnapshot = undefined;
      await criarCaptura(createCaptureTaskStore(gateway), dependencies("incoming"), context, input("incoming"));
    };
    const result = await editarCaptura(store, dependencies(), context, { id: "incoming-1", client_id: "update", patch: { title: "Encontrada após retry" } });
    expect(result.title).toBe("Encontrada após retry");
    expect(gateway.revisionCalls).toBe(1); expect(gateway.snapshotCalls).toBe(3);
    expect(gateway.state.events).toHaveLength(2);
  });

  it("mantém erro de domínio quando a revisão não mudou", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    await expect(editarCaptura(store, dependencies(), context, { id: "absent", client_id: "update", patch: { title: "Título" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(gateway.snapshotCalls).toBe(1); expect(gateway.requests).toEqual([]);
  });

  it("fecha portas escapadas e devolve cópias que não alteram persistência", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    const created = await criarCaptura(store, dependencies(), context, input("create"));
    let escaped!: CaptureTaskTransaction;
    await store.transaction(context, async (tx) => { escaped = tx; return tx.capturas.get(created.id); });
    await expect(escaped.capturas.list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
    await expect(escaped.recibos.get("capture.create", "create")).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
    created.title = "Mutado";
    const read = await store.read(actor).capturas.get(created.id); if (read) read.title = "Mutado de novo";
    expect(gateway.state.captures[0]?.title).toBe("Original");
    expect(gateway.requests).toHaveLength(1);
  });

  it("falha do callback não persiste nem consulta revisão para retry", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), failure = new Error("callback failed");
    await expect(store.transaction(context, async (tx) => { await tx.capturas.insert(capture("new")); throw failure; })).rejects.toBe(failure);
    expect(gateway.requests).toEqual([]); expect(gateway.revisionCalls).toBe(0); expect(gateway.state.captures).toEqual([]);
  });

  it("escrita sem evento correspondente nunca alcança o gateway", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway), row = capture("new");
    await expect(store.transaction(context, async (tx) => {
      await tx.capturas.insert(row);
      await tx.recibos.insert({ user_id: actor, command: "capture.create", client_id: "missing-event", fingerprint: "{}", result: row });
      return row;
    })).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
    expect(gateway.requests).toEqual([]); expect(gateway.state.receipts).toEqual([]);
  });

  it("recusa snapshot de outro dono antes de executar o caso de uso", async () => {
    const gateway = new AtomicGateway({ captures: [capture("foreign", "other-user")] }), store = createCaptureTaskStore(gateway), work = vi.fn();
    await expect(store.transaction(context, work)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(store.read(actor).capturas.list()).rejects.toMatchObject({ code: "VALIDATION" });
    expect(work).not.toHaveBeenCalled(); expect(gateway.requests).toEqual([]);
    expect(() => store.read("other-user")).toThrow();
  });

  it("recusa recibos de Auth e eventos de roles fora do recorte do gateway", async () => {
    const gateway = new AtomicGateway({ receipts: [{ user_id: actor, command: "auth.password.complete", client_id: "auth", fingerprint: "{}", result: null }] });
    const store = createCaptureTaskStore(gateway), work = vi.fn();
    await expect(store.transaction(context, work)).rejects.toMatchObject({ code: "VALIDATION" });
    gateway.state.receipts = [];
    // A deliberately malformed transport payload checks the runtime boundary.
    Object.assign(gateway.state, { events: [{ id: "role-event", user_id: actor, entity_type: "user_role", entity_id: actor, action: "updated", canal: "web", occurred_at: now, before: null, after: null }] });
    await expect(store.transaction(context, work)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(work).not.toHaveBeenCalled(); expect(gateway.requests).toEqual([]);
  });

  it("limita conflitos CAS e não retorna resultado não confirmado", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway, { maxAttempts: 2 });
    gateway.beforeCommit = async () => { gateway.state.revision = String(BigInt(gateway.state.revision) + 1n); };
    await expect(criarCaptura(store, dependencies(), context, input("busy"))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(gateway.requests).toHaveLength(2); expect(gateway.staleCommits).toBe(2);
    expect(gateway.state.captures).toEqual([]); expect(gateway.state.events).toEqual([]); expect(gateway.state.receipts).toEqual([]);
  });

  it("também persiste o caso de uso de tarefa com seu evento e recibo", async () => {
    const gateway = new AtomicGateway(), store = createCaptureTaskStore(gateway);
    const fields: NovaTarefa = { client_id: "task", title: "Tarefa real do núcleo", description: null, category_id: null, project_id: null, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null };
    const task = await criarTarefa(store, dependencies(), context, fields);
    expect(gateway.state.tasks).toEqual([task]);
    expect(gateway.state.events[0]).toMatchObject({ entity_type: "task", after: task });
    expect(gateway.state.receipts[0]).toMatchObject({ command: "task.create", result: task });
  });
});
