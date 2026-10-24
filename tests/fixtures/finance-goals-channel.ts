import { assinatura, ErroDeDominio } from "../../src/core/contracts/base";
import type { ReciboIdempotente } from "../../src/core/contracts/unit-of-work";
import type { FinancialGoal, GoalCommand, GoalCommandResult, GoalHighlight, GoalRelease, GoalReservation } from "../../src/core/financeiro/goals/goal-types";
import type { GoalCommit, GoalGateway, GoalSnapshot } from "../../src/adapters/db/finance-goals-protocol";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { financialGoal, goalAccount, goalId, GOAL_OWNER } from "./finance-goals";

export const GOAL_SESSION = goalId(990);
export const channelGoalCreate = (): Extract<GoalCommand, { command: "finance.goal.create" }> => ({ command: "finance.goal.create", input: { client_id: goalId(991), expected_finance_revision: "0", name: "Meta da fixture", target_cents: 100000, deadline: null, image_file_id: null } });
export const emptyGoalSnapshot = (revision = "0"): GoalSnapshot => ({ version: 1, finance_revision: revision, goals: [], reservations: [], highlights: [], accounts: [], images: [], account_totals: [], goal_totals: [], release_totals: [], receipt: null });
/** Injected gateway only. It does NOT certify PostgreSQL, RLS, session locks or
 * image finalization. Complete totals derive from all in-memory rows. */
export class GoalGatewayFixture implements GoalGateway {
  readonly actorId = GOAL_OWNER;
  goals: FinancialGoal[] = []; reservationsRows: GoalReservation[] = []; releaseRows: GoalRelease[] = []; highlight: GoalHighlight | null = null;
  receipts: ReciboIdempotente[] = []; revision = "0"; account = structuredClone(goalAccount);
  calls = { snapshot: 0, commit: 0 }; lastCommit: GoalCommit | null = null;
  mode: "normal" | "stale" | "unknown_before" | "unknown_after" | "validation" = "normal";
  failSnapshot: (() => void) | null = null;
  released(id: string) { return Number(this.releaseRows.filter(row => row.reservation_id === id).reduce((sum, row) => sum + BigInt(row.amount_cents), 0n)); }
  reserved(kind: "goal_id" | "account_id", id: string) { return Number(this.reservationsRows.filter(row => row[kind] === id).reduce((sum, row) => sum + BigInt(row.amount_cents) - BigInt(this.released(row.id)), 0n)); }
  async snapshot(intent: GoalCommand) {
    this.calls.snapshot++; this.failSnapshot?.(); const result = emptyGoalSnapshot(this.revision);
    result.receipt = structuredClone(this.receipts.find(row => row.command === intent.command && row.client_id === intent.input.client_id) ?? null); if (result.receipt) return result;
    if (intent.command === "finance.goal.release") { const id = intent.input.reservation_id, r = this.reservationsRows.find(row => row.id === id); if (r) { result.reservations.push(structuredClone(r)); result.release_totals.push({ user_id: GOAL_OWNER, reservation_id: r.id, finance_revision: this.revision, released_cents: this.released(r.id) }); } return result; }
    const goalId = "goal_id" in intent.input ? intent.input.goal_id : null, g = this.goals.find(row => row.id === goalId); if (g) result.goals.push(structuredClone(g));
    if (["finance.goal.archive", "finance.goal.restore", "finance.goal.highlight"].includes(intent.command) && this.highlight) result.highlights.push(structuredClone(this.highlight));
    if (intent.command === "finance.goal.contribute") {
      if (intent.input.account_id === this.account.id) { const a = this.account; result.accounts.push({ id: a.id, user_id: a.user_id, kind: a.kind, currency: a.currency, archived_at: a.archived_at }); result.account_totals.push({ user_id: GOAL_OWNER, account_id: a.id, finance_revision: this.revision, real_balance_cents: a.opening_balance_cents, reserved_cents: this.reserved("account_id", a.id) }); }
      if (g) result.goal_totals.push({ user_id: GOAL_OWNER, goal_id: g.id, finance_revision: this.revision, saved_cents: this.reserved("goal_id", g.id) });
    }
    return result;
  }
  async page() { return { version: 1 as const, finance_revision: this.revision, items: [], highlight: structuredClone(this.highlight), next_cursor: null }; }
  async detail(id: string) { const goal = this.goals.find(row => row.id === id); return goal ? { version: 1 as const, finance_revision: this.revision, goal: structuredClone(goal), totals: { user_id: GOAL_OWNER, goal_id: id, finance_revision: this.revision, saved_cents: this.reserved("goal_id", id) }, highlight: structuredClone(this.highlight) } : null; }
  async reservations() { return { version: 1 as const, finance_revision: this.revision, items: [], next_cursor: null }; }
  async releases() { return { version: 1 as const, finance_revision: this.revision, items: [], next_cursor: null }; }
  async commit(request: GoalCommit) {
    this.calls.commit++; this.lastCommit = structuredClone(request);
    if (this.mode === "stale") return { status: "stale" as const }; if (this.mode === "unknown_before") throw new CommitOutcomeUnknown(); if (this.mode === "validation") throw new ErroDeDominio("VALIDATION", "SYNTHETIC_REJECTED");
    const saved = this.receipts.find(row => row.command === request.receipt.command && row.client_id === request.receipt.client_id);
    if (saved) { if (saved.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "SYNTHETIC_REUSED_CLIENT"); return { status: "replayed" as const, result: structuredClone(saved.result) as GoalCommandResult }; }
    if (request.expected_finance_revision !== this.revision) return { status: "stale" as const };
    const draft = structuredClone({ goals: this.goals, reservations: this.reservationsRows, releases: this.releaseRows, highlights: this.highlight ? [this.highlight] : [] });
    for (const change of request.changes) {
      const rows = change.type === "finance_goal" ? draft.goals : change.type === "finance_goal_reservation" ? draft.reservations : change.type === "finance_goal_release" ? draft.releases : draft.highlights;
      const index = rows.findIndex(row => row.id === change.after.id); if (assinatura(index < 0 ? null : rows[index]) !== assinatura(change.before)) throw new ErroDeDominio("CONFLICT", "SYNTHETIC_BEFORE_CHANGED");
      if (index < 0) (rows as unknown[]).push(structuredClone(change.after)); else (rows as unknown[])[index] = structuredClone(change.after);
    }
    this.goals = draft.goals; this.reservationsRows = draft.reservations; this.releaseRows = draft.releases; this.highlight = draft.highlights[0] ?? null;
    if (request.changes.length) this.revision = String(BigInt(this.revision) + 1n); this.receipts.push(structuredClone(request.receipt));
    if (this.mode === "unknown_after") throw new CommitOutcomeUnknown(); return { status: "committed" as const, result: structuredClone(request.receipt.result) as GoalCommandResult };
  }
}
export const initialGoalGateway = () => { const gateway = new GoalGatewayFixture(); gateway.goals.push(financialGoal()); return gateway; };
