import { assinatura, ErroDeDominio, type ContextoDeEscrita } from "../../src/core/contracts/base";
import type { ReciboIdempotente } from "../../src/core/contracts/unit-of-work";
import { saldosFinanceiros, type ContaFinanceira, type LancamentoFinanceiro } from "../../src/core/financeiro/fused";
import { totalExato } from "../../src/core/financeiro/arithmetic";
import type { GoalTransaction, GoalUnitOfWork } from "../../src/core/financeiro/goals/goal-ports";
import type { FinancialGoal, GoalEvent, GoalHighlight, GoalImage, GoalRelease, GoalReservation, GoalRow } from "../../src/core/financeiro/goals/goal-types";

export const goalId = (n: number) => `79000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const GOAL_OWNER = goalId(1), GOAL_OTHER = goalId(2), GOAL_NOW = "2026-10-23T12:00:00.000Z", GOAL_TODAY = "2026-10-23";
export const goalAccount: ContaFinanceira = { id: goalId(3), user_id: GOAL_OWNER, name: "Conta sintética", kind: "checking", institution: null, currency: "BRL", opening_balance_cents: 100000, color_key: "fin-1", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null, created_at: GOAL_NOW, updated_at: GOAL_NOW };
export const goalImage: GoalImage = { id: goalId(4), user_id: GOAL_OWNER, purpose: "finance_goal_image", status: "finalized", deleted_at: null };
export const financialGoal = (patch: Partial<FinancialGoal> = {}): FinancialGoal => ({ version: 1, id: goalId(5), user_id: GOAL_OWNER, name: "Meta sintética", target_cents: 100000, deadline: null, image_file_id: null, archived_at: null, revision: "0", created_at: GOAL_NOW, updated_at: GOAL_NOW, ...structuredClone(patch) });
export const goalReservation = (patch: Partial<GoalReservation> = {}): GoalReservation => ({ version: 1, id: goalId(6), user_id: GOAL_OWNER, goal_id: goalId(5), account_id: goalAccount.id, amount_cents: 20000, occurred_on: GOAL_TODAY, client_id: goalId(7), created_at: GOAL_NOW, ...structuredClone(patch) });
export interface GoalFixtureState { goals: FinancialGoal[]; reservations: GoalReservation[]; releases: GoalRelease[]; highlight: GoalHighlight | null; events: GoalEvent[]; receipts: ReciboIdempotente[]; revision: string }
type Failure = "write" | "event" | "receipt" | "before_commit" | "after_commit";
type Change = { kind: GoalEvent["entity_type"]; before: GoalRow | null; after: GoalRow };
const copy = <T>(value: T): T => structuredClone(value);
/** Injected SERIAL test port. This fixture does not certify PostgreSQL/Auth,
 * actual shared locks, grants, RLS, upload finalization or durable uncertainty. */
export class GoalMemoryFixture implements GoalUnitOfWork {
  state: GoalFixtureState = { goals: [], reservations: [], releases: [], highlight: null, events: [], receipts: [], revision: "0" };
  accounts: ContaFinanceira[] = [copy(goalAccount)]; ledger: LancamentoFinanceiro[] = []; images: GoalImage[] = [copy(goalImage)];
  fail: Failure | null = null; receiptBarrier: Promise<void> | null = null; calls = 0; lastPorts: GoalTransaction | null = null;
  totalsPoison: "owner" | "revision" | null = null;
  private queue: Promise<void> = Promise.resolve();
  private check(point: Failure) { if (this.fail === point) { this.fail = null; throw new Error("SYNTHETIC_" + point.toUpperCase()); } }
  /** Actual existing real-money projection; reservations never enter ledger. */
  balance(accountId = goalAccount.id) { return saldosFinanceiros(this.ledger, this.accounts).find(row => row.account_id === accountId)!.balance_cents; }
  reserved(accountId = goalAccount.id) { return totalExato(this.state.reservations.filter(row => row.user_id === GOAL_OWNER && row.account_id === accountId).reduce((sum, row) => sum + BigInt(row.amount_cents) - this.state.releases.filter(item => item.user_id === GOAL_OWNER && item.reservation_id === row.id).reduce((released, item) => released + BigInt(item.amount_cents), 0n), 0n), "Reserva da fixture"); }
  async transaction<T>(context: ContextoDeEscrita, work: (tx: GoalTransaction) => Promise<T>): Promise<T> {
    const prior = this.queue; let release!: () => void; this.queue = new Promise<void>(resolve => { release = resolve; }); await prior; this.calls++;
    const actor = copy(context), draft = copy(this.state), changes: Change[] = [], events: GoalEvent[] = []; let active = true;
    const guard = () => { if (!active) throw new ErroDeDominio("TRANSACTION_CLOSED", "Port fechado."); if (actor.user_id !== GOAL_OWNER) throw new ErroDeDominio("VALIDATION", "Actor inválido."); };
    const aggregateHeader = (key: string, value: string) => ({ user_id: this.totalsPoison === "owner" ? GOAL_OTHER : GOAL_OWNER, [key]: value, finance_revision: this.totalsPoison === "revision" ? String(BigInt(draft.revision) + 1n) : draft.revision });
    const remaining = (reservation: GoalReservation) => BigInt(reservation.amount_cents) - draft.releases.filter(row => row.user_id === actor.user_id && row.reservation_id === reservation.id).reduce((sum, row) => sum + BigInt(row.amount_cents), 0n);
    const lookup = <T extends { id: string; user_id: string }>(rows: T[], id: string) => copy(rows.find(row => row.id === id && row.user_id === actor.user_id) ?? null);
    const insert = <T extends GoalRow>(rows: T[], kind: Change["kind"], row: T) => {
      guard(); this.check("write"); if (row.user_id !== actor.user_id || [...draft.goals, ...draft.reservations, ...draft.releases].some(item => item.id === row.id)) throw new Error("SYNTHETIC_ROW_ID_OR_OWNER"); rows.push(copy(row)); changes.push({ kind, before: null, after: copy(row) });
    };
    const tx: GoalTransaction = {
      financeRevision: draft.revision,
      goals: { get: async id => { guard(); return lookup(draft.goals, id); }, insert: async row => insert(draft.goals, "finance_goal", row), replace: async row => { guard(); this.check("write"); const index = draft.goals.findIndex(item => item.id === row.id && item.user_id === actor.user_id); if (index < 0 || row.user_id !== actor.user_id || row.created_at !== draft.goals[index]!.created_at) throw new Error("SYNTHETIC_GOAL_IDENTITY"); const before = copy(draft.goals[index]!); draft.goals[index] = copy(row); changes.push({ kind: "finance_goal", before, after: copy(row) }); } },
      reservations: { get: async id => { guard(); return lookup(draft.reservations, id); }, insert: async row => insert(draft.reservations, "finance_goal_reservation", row) },
      releases: { insert: async row => insert(draft.releases, "finance_goal_release", row) },
      highlights: { get: async () => { guard(); return copy(draft.highlight); }, put: async row => { guard(); this.check("write"); if (row.id !== actor.user_id || row.user_id !== actor.user_id) throw new Error("SYNTHETIC_HIGHLIGHT_OWNER"); changes.push({ kind: "finance_goal_highlight", before: copy(draft.highlight), after: copy(row) }); draft.highlight = copy(row); } },
      accounts: { get: async id => { guard(); const row = lookup(this.accounts, id); return row ? { id: row.id, user_id: row.user_id, kind: row.kind, currency: row.currency, archived_at: row.archived_at } : null; } },
      accountTotals: { get: async id => { guard(); if (!lookup(this.accounts, id)) return null; return { ...aggregateHeader("account_id", id), account_id: id, real_balance_cents: this.balance(id), reserved_cents: totalExato(draft.reservations.filter(row => row.user_id === actor.user_id && row.account_id === id).reduce((sum, row) => sum + remaining(row), 0n), "Reservado") }; } },
      goalTotals: { get: async id => { guard(); return { ...aggregateHeader("goal_id", id), goal_id: id, saved_cents: totalExato(draft.reservations.filter(row => row.user_id === actor.user_id && row.goal_id === id).reduce((sum, row) => sum + remaining(row), 0n), "Progresso") }; } },
      releaseTotals: { get: async id => { guard(); return { ...aggregateHeader("reservation_id", id), reservation_id: id, released_cents: totalExato(draft.releases.filter(row => row.user_id === actor.user_id && row.reservation_id === id).reduce((sum, row) => sum + BigInt(row.amount_cents), 0n), "Liberado") }; } },
      images: { getFinalized: async id => { guard(); return lookup(this.images, id); } },
      events: { append: async event => { guard(); this.check("event"); if (event.user_id !== actor.user_id || event.canal !== actor.canal || draft.events.some(row => row.id === event.id)) throw new Error("SYNTHETIC_EVENT_ID_OR_OWNER"); events.push(copy(event)); draft.events.push(copy(event)); } },
      receipts: { get: async (command, clientId) => { guard(); await this.receiptBarrier; guard(); return copy(draft.receipts.find(row => row.user_id === actor.user_id && row.command === command && row.client_id === clientId) ?? null); }, insert: async row => { guard(); this.check("receipt"); if (row.user_id !== actor.user_id || draft.receipts.some(item => item.command === row.command && item.client_id === row.client_id)) throw new Error("SYNTHETIC_RECEIPT_ID_OR_OWNER"); draft.receipts.push(copy(row)); } },
    };
    this.lastPorts = tx;
    try {
      guard(); const result = copy(await work(tx)); active = false;
      if (events.length !== changes.length || changes.some(change => events.filter(event => event.entity_type === change.kind && event.entity_id === change.after.id && assinatura(event.before) === assinatura(change.before) && assinatura(event.after) === assinatura(change.after)).length !== 1)) throw new Error("SYNTHETIC_EXACT_EVENT_REQUIRED");
      for (const row of draft.reservations) if (remaining(row) < 0n) throw new Error("SYNTHETIC_OVER_RELEASE");
      for (const row of draft.releases) if (!draft.reservations.some(item => item.id === row.reservation_id && item.user_id === row.user_id)) throw new Error("SYNTHETIC_RELEASE_WITHOUT_RESERVATION");
      this.check("before_commit"); if (changes.length > 0) draft.revision = String(BigInt(draft.revision) + 1n); this.state = draft; this.check("after_commit"); return result;
    } finally { active = false; release(); }
  }
}
