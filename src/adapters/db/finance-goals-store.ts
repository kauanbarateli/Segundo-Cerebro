import "server-only";
import { assinatura, ErroDeDominio, exigir, type ContextoDeEscrita } from "../../core/contracts/base";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import type { GoalUnitOfWork, GoalTransaction } from "../../core/financeiro/goals/goal-ports";
import type { FinancialGoal, GoalCommand, GoalEvent, GoalHighlight, GoalRelease, GoalReservation, GoalRow } from "../../core/financeiro/goals/goal-types";
import { decodeGoalCommand } from "../../core/financeiro/goals/goal-validation";
import { decodeGoalCommandResult } from "../../core/financeiro/goals/goal-use-cases";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { goalSame, parseGoalReceipt, parseGoalRow, validateGoalEvent, type GoalChange, type GoalGateway, type GoalKind, type GoalSnapshot } from "./finance-goals-protocol";

const copy = <T>(value: T): T => structuredClone(value);
export function createFinanceGoalsStore(gateway: GoalGateway, command: GoalCommand): GoalUnitOfWork {
  const actor = gateway.actorId, intent = decodeGoalCommand(command);
  return {
    async transaction<T>(context: ContextoDeEscrita, work: (tx: GoalTransaction) => Promise<T>): Promise<T> {
      const current = copy(context); exigir(current.user_id === actor && current.canal === "web", "Escrita fora do contexto autenticado.");
      const initial = copy(await gateway.snapshot(copy(intent))), state = copy(initial), changes: GoalChange[] = [], events: GoalEvent[] = [], receipts: ReciboIdempotente[] = [];
      let active = true; const guard = () => { if (!active) throw new ErroDeDominio("TRANSACTION_CLOSED", "Transação encerrada."); };
      const releases: GoalRelease[] = [];
      function allRows(): GoalRow[] { return [...state.goals, ...state.reservations, ...state.highlights, ...releases]; }
      function newId(id: string) { exigir(!allRows().some(row => row.id === id) && !events.some(event => event.id === id) && ![...state.accounts, ...state.images].some(row => row.id === id), "Identificador já utilizado."); }
      const get = <R extends { id: string }>(rows: R[]) => ({ async get(id: string) { guard(); return copy(rows.find(row => row.id === id) ?? null); } });
      function writer<R extends GoalRow>(kind: GoalKind, rows: R[]) {
        return {
          ...get(rows),
          async insert(value: R) { guard(); const row = parseGoalRow(value, kind, actor) as R; newId(row.id); rows.push(copy(row)); changes.push({ type: kind, before: null, after: copy(row) }); },
          async replace(value: R) { guard(); const row = parseGoalRow(value, kind, actor) as R, index = rows.findIndex(item => item.id === row.id); exigir(index >= 0, "Registro não encontrado."); const before = rows[index]!; exigir(before.created_at === row.created_at, "Criação imutável."); rows[index] = copy(row); changes.push({ type: kind, before: copy(before), after: copy(row) }); },
        };
      }
      const goals = writer<FinancialGoal>("finance_goal", state.goals), reservations = writer<GoalReservation>("finance_goal_reservation", state.reservations), releaseWriter = writer<GoalRelease>("finance_goal_release", releases), highlightWriter = writer<GoalHighlight>("finance_goal_highlight", state.highlights);
      const tx: GoalTransaction = {
        financeRevision: initial.finance_revision,
        goals,
        reservations: { get: reservations.get, insert: reservations.insert }, releases: { insert: releaseWriter.insert },
        highlights: { async get() { guard(); return copy(state.highlights[0] ?? null); }, async put(row) { guard(); if (state.highlights.length === 0) await highlightWriter.insert(row); else await highlightWriter.replace(row); } },
        accounts: get(state.accounts), images: { async getFinalized(id) { guard(); return copy(state.images.find(row => row.id === id) ?? null); } },
        accountTotals: { async get(id) { guard(); return copy(state.account_totals.find(row => row.account_id === id) ?? null); } },
        goalTotals: { async get(id) { guard(); const totals = state.goal_totals.find(row => row.goal_id === id); exigir(totals, "Apuração completa da meta indisponível."); return copy(totals); } },
        releaseTotals: { async get(id) { guard(); const totals = state.release_totals.find(row => row.reservation_id === id); exigir(totals, "Apuração completa da reserva indisponível."); return copy(totals); } },
        events: { async append(event) { guard(); validateGoalEvent(event, actor, current); exigir(!allRows().some(row => row.id === event.id) && !events.some(row => row.id === event.id) && ![...state.accounts, ...state.images].some(row => row.id === event.id), "Identificador de evento já utilizado."); events.push(copy(event)); } },
        receipts: {
          async get(name, clientId) { guard(); exigir(name === intent.command && clientId === intent.input.client_id, "Consulta de recibo fora da intenção."); return copy(initial.receipt); },
          async insert(receipt) { guard(); parseGoalReceipt(receipt, actor, intent); exigir(initial.receipt === null && receipts.length === 0, "Recibo duplicado."); receipts.push(copy(receipt)); },
        },
      };
      let result: T;
      try { result = copy(await work(tx)); } finally { active = false; }
      exigir(changes.length <= 2 && new Set(changes.map(change => `${change.type}:${change.after.id}`)).size === changes.length, "Mudanças duplicadas ou fora do limite.");
      const remaining = [...events];
      for (const change of changes) { const index = remaining.findIndex(event => event.entity_type === change.type && event.entity_id === change.after.id && goalSame(event.before, change.before) && goalSame(event.after, change.after)); exigir(index >= 0, "Escrita sem evento exato."); remaining.splice(index, 1); }
      exigir(remaining.length === 0, "Evento sem escrita correspondente.");
      const receipt = receipts[0] ?? initial.receipt; exigir(receipt && (receipts.length === 1 || changes.length === 0 && events.length === 0) && receipt.fingerprint === assinatura(intent.input) && goalSame(receipt.result, result), "Comando exige um recibo exato.");
      decodeGoalCommandResult(result, intent, actor);
      if (receipts.length === 0) return copy(result);
      try {
        const response = await gateway.commit({ request: copy(intent), expected_finance_revision: intent.input.expected_finance_revision, context: current, changes, events, receipt: copy(receipt) });
        if (response.status === "stale") throw new ErroDeDominio("CONFLICT", "Os dados financeiros mudaram. Confira novamente antes de reenviar.");
        const confirmed = decodeGoalCommandResult(response.result, intent, actor); if (response.status === "committed" && !goalSame(confirmed, result)) throw new CommitOutcomeUnknown(); return copy(confirmed as T);
      } catch (error) {
        if (!(error instanceof CommitOutcomeUnknown)) throw error;
        try { const reconciled: GoalSnapshot = await gateway.snapshot(copy(intent)); const saved = parseGoalReceipt(reconciled.receipt, actor, intent); return copy(decodeGoalCommandResult(saved.result, intent, actor) as T); }
        catch { throw new CommitOutcomeUnknown(); }
      }
    },
  };
}
