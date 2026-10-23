import "server-only";
import { assinatura, ErroDeDominio, exigir, type ContextoDeEscrita } from "../../core/contracts/base";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import type { FinanceSeriesRead, FinanceSeriesTransaction, FinanceSeriesUnitOfWork } from "../../core/financeiro/series/series-ports";
import type { FinanceSeriesCommand, FinanceSeriesEvent, ManagedFinanceSeries, ManagedSeriesOccurrence } from "../../core/financeiro/series/series-types";
import { decodeFinanceSeriesCommand, validateManagedOccurrence, validateManagedSeries } from "../../core/financeiro/series/series-validation";
import { assertSeriesOccurrenceBinding } from "../../core/financeiro/series/series-policy";
import type { LancamentoFinanceiro } from "../../core/financeiro/fused";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { parseSeriesReceipt, parseSeriesResult, sameSeriesValue, validateSeriesEvent, type FinanceSeriesChange, type FinanceSeriesGateway, type FinanceSeriesRow, type FinanceSeriesSnapshot } from "./finance-series-protocol";
import { validateFinanceRow } from "./finance-gateway";

const copy = <T>(value: T): T => structuredClone(value);
type Kind = FinanceSeriesChange["type"];
function collections(snapshot: FinanceSeriesSnapshot): Record<Kind, FinanceSeriesRow[]> { return { finance_series: snapshot.series, finance_series_occurrence: snapshot.occurrences, finance_transaction: snapshot.transactions }; }
function rowCheck(row: FinanceSeriesRow, kind: Kind, actor: string) {
  exigir(row.user_id === actor, "Escrita fora do Usuário.");
  if (kind === "finance_series") validateManagedSeries(row);
  else if (kind === "finance_series_occurrence") validateManagedOccurrence(row);
  else validateFinanceRow(row, "finance_transaction", actor);
}
function finalIntegrity(snapshot: FinanceSeriesSnapshot, actor: string) {
  exigir(snapshot.series.length <= 1 && snapshot.occurrences.length <= 120 && snapshot.transactions.length === snapshot.occurrences.length, "Agregado da série incompleto.");
  const series = snapshot.series[0], indices = new Set<number>(), mapped = new Set<string>();
  for (const occurrence of snapshot.occurrences) {
    const row = snapshot.transactions.find(item => item.id === occurrence.transaction_id), account = snapshot.accounts.find(item => item.id === row?.account_id);
    exigir(series && row && account && !indices.has(occurrence.index) && !mapped.has(row.id), "Mapa de série inválido.");
    assertSeriesOccurrenceBinding(series, occurrence, row, account); indices.add(occurrence.index); mapped.add(row.id);
    exigir((row.category_id === null || snapshot.categories.some(item => item.id === row.category_id && item.user_id === actor)) && (row.tag_ids ?? []).every(id => snapshot.tags.some(tag => tag.id === id && tag.user_id === actor)), "Referência da ocorrência indisponível.");
  }
  if (series) {
    validateManagedSeries(series);
    const last = snapshot.occurrences.map(item => item.occurred_on).sort().at(-1) ?? null;
    exigir(series.user_id === actor && series.materialized_through === last && snapshot.occurrences.every(item => item.index < series.next_index && BigInt(item.configuration_revision) <= BigInt(series.revision)), "Cursor da série diverge do mapa.");
  }
}
export function createFinanceSeriesStore(gateway: FinanceSeriesGateway, command: FinanceSeriesCommand): FinanceSeriesUnitOfWork {
  const actor = gateway.actorId, request = decodeFinanceSeriesCommand(command);
  function readPorts(snapshot: FinanceSeriesSnapshot, guard: () => void): FinanceSeriesRead {
    const get = <T extends { id: string }>(rows: T[]) => ({ async get(id: string) { guard(); return copy(rows.find(row => row.id === id) ?? null); } });
    return {
      series: { ...get(snapshot.series), page: query => { guard(); return gateway.page(copy(query)); } },
      occurrences: { ...get(snapshot.occurrences), async forSeries(id) { guard(); return copy(snapshot.occurrences.filter(row => row.series_id === id)); } },
      transactions: get(snapshot.transactions), accounts: get(snapshot.accounts), categories: get(snapshot.categories), tags: get(snapshot.tags),
    };
  }
  return {
    read(userId) {
      exigir(userId === actor, "Leitura fora do Usuário autenticado.");
      const load = () => gateway.snapshot(copy(request));
      return {
        series: { async get(id) { return readPorts(await load(), () => undefined).series.get(id); }, page: query => gateway.page(copy(query)) },
        occurrences: { async get(id) { return readPorts(await load(), () => undefined).occurrences.get(id); }, async forSeries(id) { return readPorts(await load(), () => undefined).occurrences.forSeries(id); } },
        accounts: { async get(id) { return readPorts(await load(), () => undefined).accounts.get(id); } }, categories: { async get(id) { return readPorts(await load(), () => undefined).categories.get(id); } },
        tags: { async get(id) { return readPorts(await load(), () => undefined).tags.get(id); } }, transactions: { async get(id) { return readPorts(await load(), () => undefined).transactions.get(id); } },
      };
    },
    async transaction<T>(context: ContextoDeEscrita, work: (tx: FinanceSeriesTransaction) => Promise<T>): Promise<T> {
      const current = copy(context); exigir(current.user_id === actor && current.canal === "web", "Escrita fora do contexto autenticado.");
      const initial = copy(await gateway.snapshot(copy(request))), snapshot = copy(initial), changes: FinanceSeriesChange[] = [], events: FinanceSeriesEvent[] = [], receipts: ReciboIdempotente[] = [];
      let active = true; const guard = () => { if (!active) throw new ErroDeDominio("TRANSACTION_CLOSED", "Transação encerrada."); };
      const ports = readPorts(snapshot, guard);
      function writer<R extends FinanceSeriesRow>(kind: Kind, rows: R[]) {
        return {
          async get(id: string) { guard(); return copy(rows.find(row => row.id === id) ?? null); },
          async insert(row: R) {
            guard(); rowCheck(row, kind, actor); exigir(!Object.values(collections(snapshot)).some(items => items.some(item => item.id === row.id)) && ![...snapshot.accounts, ...snapshot.categories, ...snapshot.tags].some(item => item.id === row.id), "Identificador já utilizado.");
            rows.push(copy(row)); changes.push({ type: kind, before: null, after: copy(row) });
          },
          async replace(row: R) {
            guard(); rowCheck(row, kind, actor); const index = rows.findIndex(item => item.id === row.id); exigir(index >= 0, "Registro da série não encontrado.");
            const before = rows[index]!; exigir(before.user_id === row.user_id && before.created_at === row.created_at, "Dono e criação são imutáveis."); rows[index] = copy(row); changes.push({ type: kind, before: copy(before), after: copy(row) });
          },
        };
      }
      const tx: FinanceSeriesTransaction = {
        financeRevision: initial.finance_revision,
        ...ports,
        series: writer<ManagedFinanceSeries>("finance_series", snapshot.series),
        occurrences: { ...writer<ManagedSeriesOccurrence>("finance_series_occurrence", snapshot.occurrences), forSeries: ports.occurrences.forSeries },
        transactions: writer<LancamentoFinanceiro>("finance_transaction", snapshot.transactions),
        events: { async append(event) {
          guard(); validateSeriesEvent(event, actor, current);
          exigir(!events.some(item => item.id === event.id) && !Object.values(collections(snapshot)).some(rows => rows.some(row => row.id === event.id)) && ![...snapshot.accounts, ...snapshot.categories, ...snapshot.tags].some(row => row.id === event.id), "Identificador de evento já utilizado."); events.push(copy(event));
        } },
        receipts: {
          async get(name, clientId) { guard(); exigir(name === request.command && clientId === request.input.client_id, "Consulta de recibo fora da intenção."); return copy(initial.receipt); },
          async insert(receipt) { guard(); parseSeriesReceipt(receipt, actor, request); exigir(receipts.length === 0 && initial.receipt === null && receipt.fingerprint === assinatura(request.input), "Recibo incompatível com a intenção."); receipts.push(copy(receipt)); },
        },
      };
      let result: T;
      try { result = copy(await work(tx)); finalIntegrity(snapshot, actor); }
      finally { active = false; }
      const remaining = [...events];
      exigir(changes.length <= 241 && new Set(changes.map(change => `${change.type}:${change.after.id}`)).size === changes.length, "Mudanças repetidas ou fora do limite da série.");
      for (const change of changes) { const index = remaining.findIndex(event => event.entity_type === change.type && event.entity_id === change.after.id && sameSeriesValue(event.before, change.before) && sameSeriesValue(event.after, change.after)); exigir(index >= 0, "Escrita sem evento exato."); remaining.splice(index, 1); }
      exigir(remaining.length === 0, "Evento sem escrita correspondente.");
      const receipt = receipts[0] ?? initial.receipt; exigir(receipt && (receipts.length === 1 || changes.length === 0 && events.length === 0) && receipt.fingerprint === assinatura(request.input) && sameSeriesValue(receipt.result, result), "Comando exige um recibo exato.");
      if (receipts.length === 0) return copy(result);
      try {
        const response = await gateway.commit({ request: copy(request), expected_finance_revision: request.input.expected_finance_revision, context: current, changes, events, receipt });
        if (response.status === "stale") throw new ErroDeDominio("CONFLICT", "Os dados financeiros mudaram. Confira a prévia antes de reenviar.");
        if (response.status === "committed" && !sameSeriesValue(response.result, result)) throw new CommitOutcomeUnknown(); return copy(response.result as T);
      } catch (error) {
        if (!(error instanceof CommitOutcomeUnknown)) throw error;
        try {
          const reconciled = await gateway.snapshot(copy(request)), saved = reconciled.receipt;
          if (!saved || saved.user_id !== actor || saved.command !== request.command || saved.client_id !== request.input.client_id || saved.fingerprint !== receipt.fingerprint) throw new CommitOutcomeUnknown();
          const confirmed = parseSeriesResult(saved.result, actor); return copy(confirmed as T);
        } catch { throw new CommitOutcomeUnknown(); }
      }
    },
  };
}
