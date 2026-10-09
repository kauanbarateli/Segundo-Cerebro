import "server-only";
import { assinatura, ErroDeDominio, exigir, instanteValido, naoEncontrado, type ContextoDeEscrita, type EntidadeDoUsuario } from "../../core/contracts/base";
import type { ConsultaLista, EventoDominio, Leitor, Repositorio } from "../../core/contracts/modules";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import type { ContaFinanceira, CategoriaFinanceira, EtiquetaFinanceira, FinanceRead, FinanceTransaction, FinanceUnitOfWork, LancamentoFinanceiro, OrcamentoFinanceiro } from "../../core/financeiro";
import { AuthGuardError } from "../../lib/auth/types";
import { CommitOutcomeUnknown } from "./capture-task-store";

export interface FinanceSnapshot { revision: string; accounts: ContaFinanceira[]; categories: CategoriaFinanceira[]; transactions: LancamentoFinanceiro[]; budgets: OrcamentoFinanceiro[]; tags: EtiquetaFinanceira[]; events: EventoDominio[]; receipts: ReciboIdempotente[] }
type Kind = "finance_account" | "finance_category" | "finance_transaction" | "finance_budget" | "finance_tag";
type Row = ContaFinanceira | CategoriaFinanceira | LancamentoFinanceiro | OrcamentoFinanceiro | EtiquetaFinanceira;
export interface FinanceChange { type: Kind; before: Row | null; after: Row }
export interface FinanceCommit { expectedRevision: string; context: ContextoDeEscrita; changes: FinanceChange[]; events: EventoDominio[]; receipt: ReciboIdempotente }
export interface FinanceGateway {
  readonly actorId: string;
  snapshot(): Promise<FinanceSnapshot>; currentRevision(): Promise<string>;
  commit(request: FinanceCommit): Promise<{ status: "stale" } | { status: "committed" | "replayed"; result: unknown }>;
  receipt(command: string, clientId: string): Promise<ReciboIdempotente | null>;
}
const copy = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown) => assinatura(a) === assinatura(b);
const key = (r: Pick<ReciboIdempotente, "command" | "client_id">) => JSON.stringify([r.command, r.client_id]);
const rowSets = (s: FinanceSnapshot): Record<Kind, Row[]> => ({ finance_account: s.accounts, finance_category: s.categories, finance_transaction: s.transactions, finance_budget: s.budgets, finance_tag: s.tags });
function integrity(s: FinanceSnapshot, actor: string) {
  exigir(/^(0|[1-9][0-9]*)$/.test(s.revision), "Revisão financeira inválida.");
  const ids = new Set<string>();
  for (const rows of Object.values(rowSets(s))) for (const row of rows) {
    exigir(row.user_id === actor && typeof row.id === "string" && !ids.has(row.id), "Registro fora do usuário ou repetido."); ids.add(row.id);
  }
  const own = (rows: EntidadeDoUsuario[], id: string | null) => { if (id !== null && !rows.some(row => row.id === id && row.user_id === actor)) naoEncontrado(); };
  const groups = new Map<string, LancamentoFinanceiro[]>();
  for (const row of s.categories) own(s.categories, row.parent_id);
  for (const row of s.transactions) {
    own(s.accounts, row.account_id); own(s.categories, row.category_id);
    for (const id of row.tag_ids ?? []) own(s.tags, id);
    if (row.transfer_group_id) groups.set(row.transfer_group_id, [...(groups.get(row.transfer_group_id) ?? []), row]);
  }
  for (const rows of groups.values()) exigir(rows.length === 2 && rows[0]!.account_id !== rows[1]!.account_id && rows[0]!.kind !== rows[1]!.kind && rows[0]!.amount_cents === rows[1]!.amount_cents && rows[0]!.deleted_at === rows[1]!.deleted_at, "Transferência sem duas pernas correspondentes.");
  for (const row of s.budgets) own(s.categories, row.category_id);
  for (const event of s.events) exigir(event.user_id === actor && Object.hasOwn(rowSets(s), event.entity_type), "Evento fora do financeiro.");
  const receipts = new Set<string>();
  for (const receipt of s.receipts) { exigir(receipt.user_id === actor && receipt.command.startsWith("finance.") && !receipts.has(key(receipt)), "Recibo fora do financeiro."); receipts.add(key(receipt)); }
}
function reader<T extends EntidadeDoUsuario>(rows: T[], guard: () => void): Leitor<T> {
  return { async get(id) { guard(); return copy(rows.find(row => row.id === id) ?? null); }, async list(query: ConsultaLista = {}) {
    guard(); return rows.filter(row => (query.includeDeleted || !("deleted_at" in row && row.deleted_at)) && (query.includeArchived || !("archived_at" in row && row.archived_at)))
      .sort((a, b) => ("created_at" in a ? String(a.created_at) : "").localeCompare("created_at" in b ? String(b.created_at) : "") || a.id.localeCompare(b.id)).map(copy);
  } };
}
function ports(snapshot: FinanceSnapshot, guard: () => void, changes?: FinanceChange[], actor?: string): FinanceRead | FinanceTransaction {
  function repo<T extends Row>(kind: Kind, rows: T[]): Leitor<T> | Repositorio<T> {
    const read = reader(rows, guard); if (!changes) return read;
    return { ...read, async insert(row) {
      guard(); exigir(row.user_id === actor, "Escrita fora do usuário.");
      exigir(!Object.values(rowSets(snapshot)).some(list => list.some(value => value.id === row.id)), "Identificador já utilizado."); rows.push(copy(row)); changes.push({ type: kind, before: null, after: copy(row) });
    }, async replace(row) {
      guard(); const index = rows.findIndex(value => value.id === row.id); if (index < 0) naoEncontrado();
      const before = rows[index]!; exigir(before.user_id === row.user_id && before.created_at === row.created_at, "Dono e criação são imutáveis.");
      rows[index] = copy(row); changes.push({ type: kind, before: copy(before), after: copy(row) });
    }, async remove() { throw new ErroDeDominio("VALIDATION", "Use exclusão lógica ou arquivamento."); } };
  }
  return { financeiro: { contas: repo("finance_account", snapshot.accounts), categorias: repo("finance_category", snapshot.categories), lancamentos: repo("finance_transaction", snapshot.transactions), orcamentos: repo("finance_budget", snapshot.budgets), etiquetas: repo("finance_tag", snapshot.tags) }, eventos: { async list() { guard(); return copy(snapshot.events); } } } as FinanceRead | FinanceTransaction;
}
export function createFinanceStore(gateway: FinanceGateway, options: { maxAttempts?: number } = {}): FinanceUnitOfWork {
  const actor = gateway.actorId, maxAttempts = options.maxAttempts ?? 3;
  exigir(actor && Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 5, "Configuração financeira inválida.");
  const snapshot = async () => { const result = copy(await gateway.snapshot()); integrity(result, actor); return result; };
  return {
    read(userId) {
      exigir(userId === actor, "Leitura fora do usuário autenticado.");
      const port = <T extends Row>(kind: keyof FinanceRead["financeiro"]) => ({ async get(id: string) { return (ports(await snapshot(), () => undefined).financeiro[kind] as Leitor<T>).get(id); }, async list(query?: ConsultaLista) { return (ports(await snapshot(), () => undefined).financeiro[kind] as Leitor<T>).list(query); } });
      return { financeiro: { contas: port<ContaFinanceira>("contas"), categorias: port<CategoriaFinanceira>("categorias"), lancamentos: port<LancamentoFinanceiro>("lancamentos"), orcamentos: port<OrcamentoFinanceiro>("orcamentos"), etiquetas: port<EtiquetaFinanceira>("etiquetas") }, eventos: { async list() { return copy((await snapshot()).events); } } };
    },
    async transaction<T>(context: ContextoDeEscrita, work: (tx: FinanceTransaction) => Promise<T>): Promise<T> {
      context = copy(context); exigir(context.user_id === actor && ["web", "api", "cron"].includes(context.canal), "Escrita fora do usuário autenticado.");
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const initial = await snapshot(), draft = copy(initial), changes: FinanceChange[] = [], events: EventoDominio[] = [], receipts: ReciboIdempotente[] = [], lookedUp = new Map<string, ReciboIdempotente>();
        let active = true; const guard = () => { if (!active) throw new ErroDeDominio("TRANSACTION_CLOSED", "Transação encerrada."); };
        const tx = ports(draft, guard, changes, actor) as FinanceTransaction;
        tx.eventos.append = async event => {
          guard(); exigir(event.user_id === actor && event.canal === context.canal && Object.hasOwn(rowSets(draft), event.entity_type) && instanteValido(event.occurred_at), "Evento fora do contexto.");
          exigir(["created", "updated", "deleted", "restored", "status_changed"].includes(event.action) && (event.action === "created" ? event.before === null && event.after !== null : event.before !== null && event.after !== null), "Ação incompatível com evento.");
          for (const state of [event.before, event.after]) if (state) exigir(state.user_id === actor && state.id === event.entity_id, "Snapshot de evento fora do contexto.");
          exigir(!draft.events.some(previous => previous.id === event.id) && !Object.values(rowSets(draft)).some(rows => rows.some(row => row.id === event.id)), "Identificador de evento já utilizado.");
          events.push(copy(event)); draft.events.push(copy(event));
        };
        tx.recibos = { async get(command, clientId) { guard(); const found = draft.receipts.find(r => r.command === command && r.client_id === clientId) ?? null; if (found) lookedUp.set(key(found), copy(found)); return copy(found); }, async insert(receipt) { guard(); exigir(receipt.user_id === actor && receipt.command.startsWith("finance.") && receipts.length === 0 && !draft.receipts.some(r => key(r) === key(receipt)), "Recibo inválido."); receipts.push(copy(receipt)); draft.receipts.push(copy(receipt)); } };
        let result: T;
        try { result = copy(await work(tx)); integrity(draft, actor); }
        catch (error) { active = false; if (error instanceof ErroDeDominio && await gateway.currentRevision() !== initial.revision) continue; throw error; }
        finally { active = false; }
        const remaining = [...events];
        for (const change of changes) { const index = remaining.findIndex(e => e.entity_type === change.type && e.entity_id === change.after.id && same(e.before, change.before) && same(e.after, change.after)); if (index < 0) throw new ErroDeDominio("EVENT_REQUIRED", "Escrita sem evento correspondente."); remaining.splice(index, 1); }
        if (remaining.length) throw new ErroDeDominio("EVENT_REQUIRED", "Evento sem escrita correspondente.");
        const candidates = receipts.length ? receipts : [...lookedUp.values()];
        if (candidates.length === 0 && changes.length === 0 && events.length === 0) { if (await gateway.currentRevision() !== initial.revision) continue; return result; }
        exigir(candidates.length === 1 && (receipts.length === 1 || changes.length === 0 && events.length === 0) && same(candidates[0]!.result, result), "Comando exige recibo exato.");
        const request: FinanceCommit = { expectedRevision: initial.revision, context, changes, events, receipt: candidates[0]! };
        try {
          const response = await gateway.commit(copy(request)); if (response.status === "stale") continue;
          if (response.status === "committed" && !same(response.result, result)) throw new CommitOutcomeUnknown(); return copy(response.result as T);
        } catch (error) {
          if (!(error instanceof CommitOutcomeUnknown)) throw error;
          let receipt: ReciboIdempotente | null;
          try { receipt = await gateway.receipt(request.receipt.command, request.receipt.client_id); }
          catch (failure) { if (failure instanceof AuthGuardError && ["unauthenticated", "forbidden"].includes(failure.code)) throw failure; throw new CommitOutcomeUnknown(); }
          if (!receipt) throw error; exigir(receipt.user_id === actor && receipt.command === request.receipt.command && receipt.client_id === request.receipt.client_id, "Recibo fora do contexto.");
          if (receipt.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "client_id já usado com outro conteúdo."); return copy(receipt.result as T);
        }
      }
      throw new ErroDeDominio("CONFLICT", "Os dados mudaram. Repita o mesmo envio.");
    },
  };
}
