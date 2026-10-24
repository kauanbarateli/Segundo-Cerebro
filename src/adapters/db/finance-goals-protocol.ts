import "server-only";
import { assinatura, type ContextoDeEscrita } from "../../core/contracts/base";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import type { FinancialGoal, GoalAccount, GoalAccountTotals, GoalCommand, GoalCommandResult, GoalEvent, GoalHighlight, GoalImage, GoalRelease, GoalReleaseTotals, GoalReservation, GoalRow, GoalTotals } from "../../core/financeiro/goals/goal-types";
import { decodeFinancialGoal, decodeGoalCommand, decodeGoalHighlight, decodeGoalRelease, decodeGoalReservation, goalCents, goalRecord, goalRevision, goalTimestamp, goalUuid } from "../../core/financeiro/goals/goal-validation";
import { decodeGoalCommandResult } from "../../core/financeiro/goals/goal-use-cases";
import { AuthGuardError } from "../../lib/auth/types";

export const GOAL_COMMANDS = ["finance.goal.create", "finance.goal.update", "finance.goal.archive", "finance.goal.restore", "finance.goal.highlight", "finance.goal.contribute", "finance.goal.release"] as const;
export type GoalOperation = GoalCommand["command"] | "read.finance.goals";
export type GoalKind = GoalEvent["entity_type"];
export interface GoalChange { type: GoalKind; before: GoalRow | null; after: GoalRow }
export interface GoalSnapshot {
  version: 1; finance_revision: string; goals: FinancialGoal[]; reservations: GoalReservation[]; highlights: GoalHighlight[];
  accounts: GoalAccount[]; images: GoalImage[]; account_totals: GoalAccountTotals[]; goal_totals: GoalTotals[];
  release_totals: GoalReleaseTotals[]; receipt: ReciboIdempotente | null;
}
export interface GoalCommit { request: GoalCommand; expected_finance_revision: string; context: ContextoDeEscrita; changes: GoalChange[]; events: GoalEvent[]; receipt: ReciboIdempotente }
export interface GoalPageQuery { cursor: string | null; limit: number; archived: "active" | "archived" | "all" }
export interface GoalHistoryCursor { created_at: string; id: string }
export interface GoalHistoryQuery { id: string; cursor: GoalHistoryCursor | null; limit: number }
export interface GoalPage { version: 1; finance_revision: string; items: { goal: FinancialGoal; totals: GoalTotals }[]; highlight: GoalHighlight | null; next_cursor: string | null }
export interface GoalDetail { version: 1; finance_revision: string; goal: FinancialGoal; totals: GoalTotals; highlight: GoalHighlight | null }
export interface GoalReservationsPage { version: 1; finance_revision: string; items: { reservation: GoalReservation; totals: GoalReleaseTotals }[]; next_cursor: GoalHistoryCursor | null }
export interface GoalReleasesPage { version: 1; finance_revision: string; items: GoalRelease[]; next_cursor: GoalHistoryCursor | null }
export type GoalRpcName = "finance_goals_snapshot" | "finance_goals_page" | "finance_goal_detail" | "finance_goal_reservations_page" | "finance_goal_releases_page" | "finance_goals_commit";
export type GoalRpc = (name: GoalRpcName, args: Record<string, unknown>, writing: boolean) => Promise<unknown>;
export interface GoalGateway {
  readonly actorId: string;
  snapshot(request: GoalCommand): Promise<GoalSnapshot>;
  page(query: GoalPageQuery): Promise<GoalPage>;
  detail(id: string): Promise<GoalDetail | null>;
  reservations(query: GoalHistoryQuery): Promise<GoalReservationsPage>;
  releases(query: GoalHistoryQuery): Promise<GoalReleasesPage>;
  commit(request: GoalCommit): Promise<{ status: "stale" } | { status: "committed" | "replayed"; result: GoalCommandResult }>;
}
export const goalSame = (a: unknown, b: unknown) => assinatura(a) === assinatura(b);
export function goalEnsure(value: unknown): asserts value { if (!value) throw new AuthGuardError("unavailable"); }
export function goalChecked<T>(work: () => T): T { try { return work(); } catch { throw new AuthGuardError("unavailable"); } }
export function ownGoalRow<T extends { user_id: string }>(value: T, actor: string): T { goalEnsure(value.user_id === actor); return structuredClone(value); }
export function parseGoalRow(value: unknown, kind: GoalKind, actor: string): GoalRow {
  return ownGoalRow(kind === "finance_goal" ? decodeFinancialGoal(value) : kind === "finance_goal_reservation" ? decodeGoalReservation(value) : kind === "finance_goal_release" ? decodeGoalRelease(value) : decodeGoalHighlight(value), actor);
}
export function parseGoalReceipt(value: unknown, actor: string, intent: GoalCommand): ReciboIdempotente & { result: GoalCommandResult } {
  return goalChecked(() => {
    const row = goalRecord(value, ["user_id", "command", "client_id", "fingerprint", "result"]);
    goalEnsure(row.user_id === actor && row.command === intent.command && row.client_id === intent.input.client_id && row.fingerprint === assinatura(intent.input));
    return { user_id: actor, command: intent.command, client_id: intent.input.client_id, fingerprint: assinatura(intent.input), result: decodeGoalCommandResult(row.result, intent, actor) };
  });
}
export function parseGoalTotals(value: unknown, actor: string, revision: string, kind: "account" | "goal" | "release") {
  const key = kind === "account" ? "account_id" : kind === "goal" ? "goal_id" : "reservation_id";
  const fields = kind === "account" ? ["real_balance_cents", "reserved_cents"] : kind === "goal" ? ["saved_cents"] : ["released_cents"];
  const row = goalRecord(value, ["user_id", key, "finance_revision", ...fields]); goalUuid(row[key]);
  goalEnsure(row.user_id === actor && row.finance_revision === revision);
  for (const field of fields) goalCents(row[field], true, field === "real_balance_cents");
  return structuredClone(row) as unknown as GoalAccountTotals | GoalTotals | GoalReleaseTotals;
}
const collections = ["goals", "reservations", "highlights", "accounts", "images", "account_totals", "goal_totals", "release_totals"] as const;
/** The snapshot contains only references required by ONE exact intent. */
export function parseGoalSnapshot(value: unknown, actor: string, request: GoalCommand): GoalSnapshot {
  return goalChecked(() => {
    const intent = decodeGoalCommand(request), row = goalRecord(value, ["version", "finance_revision", ...collections, "receipt"]);
    goalEnsure(row.version === 1 && Buffer.byteLength(JSON.stringify(row), "utf8") <= 512 * 1024); goalRevision(row.finance_revision);
    for (const key of collections) goalEnsure(Array.isArray(row[key]) && row[key].length <= 1);
    if (row.receipt !== null) {
      const receipt = parseGoalReceipt(row.receipt, actor, intent); goalEnsure(collections.every(key => (row[key] as unknown[]).length === 0));
      return { ...row, receipt } as unknown as GoalSnapshot;
    }
    const snapshot = structuredClone(row) as unknown as GoalSnapshot;
    snapshot.goals = snapshot.goals.map(item => ownGoalRow(decodeFinancialGoal(item), actor));
    snapshot.reservations = snapshot.reservations.map(item => ownGoalRow(decodeGoalReservation(item), actor));
    snapshot.highlights = snapshot.highlights.map(item => ownGoalRow(decodeGoalHighlight(item), actor));
    snapshot.accounts = snapshot.accounts.map(item => { const account = goalRecord(item, ["id", "user_id", "kind", "currency", "archived_at"]); goalUuid(account.id); goalEnsure(account.user_id === actor && ["checking", "savings", "cash", "investment", "other", "credit_card"].includes(String(account.kind)) && account.currency === "BRL"); if (account.archived_at !== null) goalTimestamp(account.archived_at); return structuredClone(account) as unknown as GoalAccount; });
    snapshot.images = snapshot.images.map(item => { const image = goalRecord(item, ["id", "user_id", "purpose", "status", "deleted_at"]); goalUuid(image.id); goalEnsure(image.user_id === actor && image.purpose === "finance_goal_image" && image.status === "finalized" && image.deleted_at === null); return structuredClone(image) as unknown as GoalImage; });
    snapshot.account_totals = snapshot.account_totals.map(item => parseGoalTotals(item, actor, snapshot.finance_revision, "account") as GoalAccountTotals);
    snapshot.goal_totals = snapshot.goal_totals.map(item => parseGoalTotals(item, actor, snapshot.finance_revision, "goal") as GoalTotals);
    snapshot.release_totals = snapshot.release_totals.map(item => parseGoalTotals(item, actor, snapshot.finance_revision, "release") as GoalReleaseTotals);
    const command = intent.command, input = intent.input;
    const goalId = "goal_id" in input ? input.goal_id : null;
    const reservationId = intent.command === "finance.goal.release" ? intent.input.reservation_id : null;
    const accountId = intent.command === "finance.goal.contribute" ? intent.input.account_id : null;
    const imageId = intent.command === "finance.goal.create" ? intent.input.image_file_id : intent.command === "finance.goal.update" && intent.input.patch.image_file_id !== snapshot.goals[0]?.image_file_id ? intent.input.patch.image_file_id : null;
    goalEnsure(snapshot.goals.every(item => item.id === goalId) && snapshot.reservations.every(item => item.id === reservationId));
    goalEnsure(snapshot.accounts.every(item => item.id === accountId) && snapshot.images.every(item => item.id === imageId));
    goalEnsure(snapshot.account_totals.every(item => item.account_id === accountId) && snapshot.goal_totals.every(item => command === "finance.goal.contribute" && item.goal_id === goalId) && snapshot.release_totals.every(item => item.reservation_id === reservationId));
    goalEnsure(snapshot.highlights.length === 0 || ["finance.goal.archive", "finance.goal.restore", "finance.goal.highlight"].includes(command));
    goalEnsure(snapshot.account_totals.length === snapshot.accounts.length && snapshot.goal_totals.length === (command === "finance.goal.contribute" ? snapshot.goals.length : 0) && snapshot.release_totals.length === snapshot.reservations.length);
    return snapshot;
  });
}
export function validateGoalEvent(value: GoalEvent, actor: string, context: ContextoDeEscrita) {
  const event = goalRecord(value, ["id", "user_id", "entity_type", "entity_id", "action", "canal", "occurred_at", "before", "after"]);
  goalUuid(event.id); goalUuid(event.entity_id); goalTimestamp(event.occurred_at);
  goalEnsure(["finance_goal", "finance_goal_reservation", "finance_goal_release", "finance_goal_highlight"].includes(String(event.entity_type)) && event.user_id === actor && event.canal === context.canal);
  const after = parseGoalRow(event.after, event.entity_type as GoalKind, actor), before = event.before === null ? null : parseGoalRow(event.before, event.entity_type as GoalKind, actor);
  goalEnsure(after.id === event.entity_id && (!before || before.id === after.id));
  const action = before === null ? "created" : event.entity_type === "finance_goal" && (before as FinancialGoal).archived_at !== (after as FinancialGoal).archived_at ? "status_changed" : "updated";
  goalEnsure(event.action === action && (!["finance_goal_reservation", "finance_goal_release"].includes(String(event.entity_type)) || before === null));
}
