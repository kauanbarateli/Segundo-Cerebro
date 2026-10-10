import "server-only";
import { assinatura, ErroDeDominio, exigir, instanteValido, naoEncontrado, type ContextoDeEscrita, type EntidadeDoUsuario } from "../../core/contracts/base";
import type { Captura } from "../../core/capturas/types";
import type { Tarefa } from "../../core/tarefas/types";
import type { Categoria, ConsultaLista, EventoDominio, Leitor, Projeto } from "../../core/contracts/modules";
import type { CaptureTaskRead, CaptureTaskTransaction, CaptureTaskUnitOfWork, ReciboIdempotente } from "../../core/contracts/unit-of-work";
import { AuthGuardError } from "../../lib/auth/types";

type RecordKind = "capture" | "task";
type Row = Captura | Tarefa;
export interface CaptureTaskSnapshot {
  /** An opaque, monotonic revision. The gateway must read the entire snapshot atomically. */
  revision: string;
  captures: Captura[];
  tasks: Tarefa[];
  categories: Categoria[];
  projects: Projeto[];
  events: EventoDominio[];
  receipts: ReciboIdempotente[];
  readonlyCaptureIds?: string[];
}
export type CaptureTaskChange =
  | { type: "capture"; before: Captura | null; after: Captura }
  | { type: "task"; before: Tarefa | null; after: Tarefa };
export interface CaptureTaskCommit {
  expectedRevision: string;
  context: ContextoDeEscrita;
  changes: CaptureTaskChange[];
  events: EventoDominio[];
  receipt: ReciboIdempotente;
}
export type CaptureTaskCommitResult = { status: "stale" } | { status: "committed" | "replayed"; result: unknown };
/**
 * Request-scoped server boundary; never exposed as a client action.
 * Every method must revalidate the bound session, owner and current entitlements.
 * snapshot must be complete (no silent pagination). commit must check receipts before
 * revision, then atomically persist changes + matching events + receipt + new revision.
 * Authenticated roles must not be able to submit arbitrary batches directly.
 */
export interface CaptureTaskGateway {
  readonly actorId: string;
  snapshot(): Promise<CaptureTaskSnapshot>;
  currentRevision(): Promise<string>;
  commit(request: CaptureTaskCommit): Promise<CaptureTaskCommitResult>;
  receipt(command: string, clientId: string): Promise<ReciboIdempotente | null>;
}
/** Gateway only uses this when the request may have committed but its response was lost. */
export class CommitOutcomeUnknown extends Error {
  constructor() { super("Não foi possível confirmar o resultado. Preserve o identificador desta operação para consultar ou tentar novamente."); this.name = "CommitOutcomeUnknown"; }
}
const copy = <T>(value: T): T => structuredClone(value);
const receiptKey = (r: Pick<ReciboIdempotente, "command" | "client_id">) => JSON.stringify([r.command, r.client_id]);
function revision(value: string) { exigir(typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value), "Revisão de persistência inválida."); }
function same(a: unknown, b: unknown) { return assinatura(a) === assinatura(b); }
function own(value: EntidadeDoUsuario, actor: string) {
  exigir(value && typeof value.id === "string" && value.id.length > 0 && value.user_id === actor, "Registro fora do usuário autenticado.");
}
function validateSnapshot(snapshot: CaptureTaskSnapshot, actor: string) {
  revision(snapshot.revision);
  const ids = new Set<string>();
  for (const list of [snapshot.captures, snapshot.tasks, snapshot.categories, snapshot.projects]) {
    exigir(Array.isArray(list), "Snapshot de persistência inválido.");
    for (const row of list) { own(row, actor); exigir(!ids.has(row.id), "Identificador repetido no snapshot."); ids.add(row.id); }
  }
  exigir(Array.isArray(snapshot.events) && Array.isArray(snapshot.receipts), "Snapshot de persistência inválido.");
  exigir(snapshot.readonlyCaptureIds === undefined || Array.isArray(snapshot.readonlyCaptureIds) && snapshot.readonlyCaptureIds.every(id => snapshot.captures.some(row => row.id === id)), "Origem promovida fora do snapshot.");
  for (const event of snapshot.events) {
    own(event, actor);
    exigir((event.entity_type === "capture" || event.entity_type === "task") && !ids.has(event.id), "Evento fora do recorte.");
    ids.add(event.id);
  }
  const receipts = new Set<string>();
  for (const receipt of snapshot.receipts) {
    exigir(receipt.user_id === actor && validCommand(receipt.command) && typeof receipt.client_id === "string" && receipt.client_id.length > 0 && typeof receipt.fingerprint === "string" && receipt.fingerprint.length > 0, "Recibo inválido.");
    exigir(!receipts.has(receiptKey(receipt)), "Recibo repetido no snapshot."); receipts.add(receiptKey(receipt));
  }
}
const commands = new Set(["capture.create", "capture.update", "capture.archive", "capture.unarchive", "capture.delete", "capture.restore", "capture.organize", "capture.convert", "task.create", "task.update", "task.status", "task.delete", "task.restore"]);
const validCommand = (command: string) => commands.has(command);
function reader<T extends EntidadeDoUsuario>(rows: T[], guard: () => void): Leitor<T> {
  return {
    async get(id) { guard(); return copy(rows.find(row => row.id === id) ?? null); },
    async list(query: ConsultaLista = {}) {
      guard();
      return rows.filter(row =>
        (query.includeDeleted || !("deleted_at" in row && row.deleted_at)) &&
        (query.includeArchived || !("archived_at" in row && row.archived_at) && !("status" in row && row.status === "archived")))
        .sort((a, b) => String("created_at" in a ? a.created_at : "").localeCompare(String("created_at" in b ? b.created_at : "")) || a.id.localeCompare(b.id)).map(copy);
    },
  };
}
function reads(snapshot: CaptureTaskSnapshot, guard: () => void): CaptureTaskRead {
  return { capturas: { ...reader(snapshot.captures, guard), async isContentReadOnly(id) { guard(); return snapshot.readonlyCaptureIds?.includes(id) ?? false; } }, tarefas: reader(snapshot.tasks, guard), categorias: reader(snapshot.categories, guard), projetos: reader(snapshot.projects, guard), eventos: { async list() { guard(); return copy(snapshot.events); } } };
}
function immutable(before: Row, after: Row) {
  exigir(before.id === after.id && before.user_id === after.user_id && before.client_id === after.client_id && before.created_at === after.created_at, "Identidade e criação são imutáveis.");
  if ("source" in before && "source" in after) exigir(before.source === after.source && before.origin_capture_id === after.origin_capture_id, "Origem da tarefa é imutável.");
  if ("captured_at" in before && "captured_at" in after) exigir(before.captured_at === after.captured_at && (before.converted_task_id === null || before.converted_task_id === after.converted_task_id), "Origem da captura é imutável.");
}
function references(snapshot: CaptureTaskSnapshot) {
  const exists = (rows: EntidadeDoUsuario[], id: string | null) => { if (id !== null && !rows.some(row => row.id === id)) naoEncontrado(); };
  for (const row of snapshot.captures) {
    exists(snapshot.categories, row.category_id); exists(snapshot.projects, row.project_id); exists(snapshot.tasks, row.converted_task_id);
    for (const id of row.linked_capture_ids ?? []) { exigir(id !== row.id, "Vínculo com a própria captura."); exists(snapshot.captures, id); }
    if (row.converted_task_id) exigir(snapshot.tasks.find(t => t.id === row.converted_task_id)?.origin_capture_id === row.id, "Conversão inconsistente.");
  }
  for (const row of snapshot.tasks) {
    exists(snapshot.categories, row.category_id); exists(snapshot.projects, row.project_id); exists(snapshot.captures, row.origin_capture_id);
    if (row.origin_capture_id) exigir(snapshot.captures.find(c => c.id === row.origin_capture_id)?.converted_task_id === row.id, "Conversão inconsistente.");
  }
}
function stage(snapshot: CaptureTaskSnapshot, context: ContextoDeEscrita) {
  let active = true;
  const changes: CaptureTaskChange[] = [], events: EventoDominio[] = [], addedReceipts: ReciboIdempotente[] = [];
  const lookedUp = new Map<string, ReciboIdempotente>();
  const guard = () => { if (!active) throw new ErroDeDominio("TRANSACTION_CLOSED", "Transação encerrada."); };
  const ports = reads(snapshot, guard);
  const usedIds = new Set([...snapshot.captures, ...snapshot.tasks, ...snapshot.categories, ...snapshot.projects, ...snapshot.events].map(row => row.id));
  function newId(id: string) { if (usedIds.has(id)) throw new ErroDeDominio("CONFLICT", "Identificador já utilizado."); usedIds.add(id); }
  function repo<T extends Row>(type: RecordKind, rows: T[]) {
    return { ...reader(rows, guard),
      async insert(value: T) {
        guard(); own(value, context.user_id); newId(value.id); const after = copy(value); rows.push(after);
        // The discriminator and collection are paired by the two private calls below.
        changes.push({ type, before: null, after: copy(after) } as CaptureTaskChange);
      },
      async replace(value: T) {
        guard(); own(value, context.user_id); const index = rows.findIndex(row => row.id === value.id);
        const existing = rows[index];
        if (!existing) naoEncontrado();
        const before = copy(existing); immutable(before, value); rows[index] = copy(value);
        changes.push({ type, before, after: copy(value) } as CaptureTaskChange);
      },
    };
  }
  const tx: CaptureTaskTransaction = {
    ...ports, capturas: { ...repo("capture", snapshot.captures), isContentReadOnly: ports.capturas.isContentReadOnly }, tarefas: repo("task", snapshot.tasks),
    eventos: { ...ports.eventos, async append(event) {
      guard(); own(event, context.user_id);
      exigir((event.entity_type === "capture" || event.entity_type === "task") && event.canal === context.canal && instanteValido(event.occurred_at), "Evento fora do contexto.");
      exigir(["created", "updated", "deleted", "restored", "status_changed"].includes(event.action), "Ação do evento inválida.");
      exigir(event.action === "created" ? event.before === null && event.after !== null : event.before !== null && event.after !== null, "Estados do evento inválidos.");
      for (const row of [event.before, event.after]) if (row) { own(row, context.user_id); exigir(row.id === event.entity_id, "Evento aponta outro registro."); }
      newId(event.id); events.push(copy(event)); snapshot.events.push(copy(event));
    } },
    recibos: {
      async get(command, clientId) {
        guard(); exigir(validCommand(command), "Comando fora do recorte.");
        const found = snapshot.receipts.find(r => r.command === command && r.client_id === clientId) ?? null;
        if (found) lookedUp.set(receiptKey(found), copy(found));
        return copy(found);
      },
      async insert(receipt) {
        guard(); exigir(receipt.user_id === context.user_id && validCommand(receipt.command) && typeof receipt.client_id === "string" && receipt.client_id.length > 0 && receipt.client_id.length <= 200 && typeof receipt.fingerprint === "string" && receipt.fingerprint.length > 0, "Recibo fora do contexto.");
        exigir(!snapshot.receipts.some(r => receiptKey(r) === receiptKey(receipt)), "Recibo já existente.");
        exigir(addedReceipts.length === 0, "Uma transação confirma somente um comando.");
        addedReceipts.push(copy(receipt)); snapshot.receipts.push(copy(receipt));
      },
    },
  };
  return {
    tx, close() { active = false; },
    finish(result: unknown): CaptureTaskCommit | null {
      references(snapshot);
      const remaining = [...events];
      for (const change of changes) {
        const index = remaining.findIndex(e => e.entity_type === change.type && e.entity_id === change.after.id && same(e.before, change.before) && same(e.after, change.after));
        if (index < 0) throw new ErroDeDominio("EVENT_REQUIRED", "Escrita sem evento correspondente.");
        remaining.splice(index, 1);
      }
      if (remaining.length) throw new ErroDeDominio("EVENT_REQUIRED", "Evento sem escrita correspondente.");
      const candidates = addedReceipts.length ? addedReceipts : [...lookedUp.values()];
      if (candidates.length === 0 && changes.length === 0 && events.length === 0) return null;
      exigir(candidates.length === 1 && (addedReceipts.length === 1 || changes.length === 0 && events.length === 0), "Comando precisa de recibo atômico.");
      const receipt = candidates[0];
      exigir(receipt !== undefined, "Comando precisa de recibo atômico.");
      exigir(same(receipt.result, result), "Resultado difere do recibo.");
      return copy({ expectedRevision: snapshot.revision, context, changes, events, receipt });
    },
  };
}
/** Infrastructure staging only. It does not provide a Supabase gateway or enable real UI data. */
export function createCaptureTaskStore(gateway: CaptureTaskGateway, options: { maxAttempts?: number } = {}): CaptureTaskUnitOfWork {
  const actor = gateway.actorId, maxAttempts = options.maxAttempts ?? 3;
  exigir(typeof actor === "string" && actor.length > 0 && Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 5, "Configuração de transação inválida.");
  const snapshot = async () => { const value = copy(await gateway.snapshot()); validateSnapshot(value, actor); references(value); return value; };
  return {
    read(userId) {
      exigir(userId === actor, "Leitura fora do usuário autenticado.");
      const read = async () => reads(await snapshot(), () => undefined);
      const port = <K extends "capturas" | "tarefas" | "categorias" | "projetos">(key: K): CaptureTaskRead[K] => ({
        get: async (id: string) => (await read())[key].get(id),
        list: async (query?: ConsultaLista) => (await read())[key].list(query),
      }) as CaptureTaskRead[K];
      return { capturas: { ...port("capturas"), async isContentReadOnly(id) { return (await read()).capturas.isContentReadOnly?.(id) ?? false; } }, tarefas: port("tarefas"), categorias: port("categorias"), projetos: port("projetos"), eventos: { async list() { return (await read()).eventos.list(); } } };
    },
    async transaction<T>(context: ContextoDeEscrita, work: (tx: CaptureTaskTransaction) => Promise<T>): Promise<T> {
      context = copy(context);
      exigir(context.user_id === actor && ["web", "api", "cron"].includes(context.canal), "Escrita fora do usuário autenticado.");
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const initial = await snapshot(), staged = stage(initial, context);
        let result: T, request: CaptureTaskCommit | null;
        try { result = copy(await work(staged.tx)); request = staged.finish(result); }
        catch (error) {
          staged.close();
          if (!(error instanceof ErroDeDominio)) throw error;
          const current = await gateway.currentRevision(); revision(current);
          if (current !== initial.revision) continue;
          throw error;
        } finally { staged.close(); }
        if (!request) {
          const current = await gateway.currentRevision(); revision(current);
          if (current !== initial.revision) continue;
          return result;
        }
        try {
          const response = await gateway.commit(copy(request));
          if (response.status === "stale") continue;
          if (response.status !== "committed" && response.status !== "replayed") throw new CommitOutcomeUnknown();
          if (response.status === "committed" && !same(response.result, request.receipt.result)) throw new CommitOutcomeUnknown();
          // Results on replay can legitimately differ from this attempt's newly generated IDs.
          return copy(response.result as T);
        } catch (error) {
          if (!(error instanceof CommitOutcomeUnknown)) throw error;
          let receipt: ReciboIdempotente | null;
          try { receipt = await gateway.receipt(request.receipt.command, request.receipt.client_id); }
          catch (reconciliationError) {
            // A revoked session/entitlement must remain a denial, never return saved data.
            if (reconciliationError instanceof AuthGuardError && (reconciliationError.code === "unauthenticated" || reconciliationError.code === "forbidden")) throw reconciliationError;
            throw new CommitOutcomeUnknown();
          }
          if (!receipt) throw error;
          exigir(receipt.user_id === actor && receipt.command === request.receipt.command && receipt.client_id === request.receipt.client_id, "Recibo de reconciliação fora do contexto.");
          if (receipt.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "client_id já usado com outro conteúdo.");
          return copy(receipt.result as T);
        }
      }
      throw new ErroDeDominio("CONFLICT", "Os dados mudaram durante a operação. Tente novamente com o mesmo identificador.");
    },
  };
}
