import "server-only";
import type { GoalReleaseTotals, GoalTotals } from "../../core/financeiro/goals/goal-types";
import { decodeFinancialGoal, decodeGoalHighlight, decodeGoalRelease, decodeGoalReservation, goalRecord, goalRevision, goalTimestamp, goalUuid } from "../../core/financeiro/goals/goal-validation";
import { goalChecked, goalEnsure, goalSame, ownGoalRow, parseGoalTotals, type GoalDetail, type GoalHistoryCursor, type GoalHistoryQuery, type GoalPage, type GoalPageQuery, type GoalReleasesPage, type GoalReservationsPage } from "./finance-goals-protocol";

export function validateGoalPageQuery(value: GoalPageQuery): GoalPageQuery {
  const query = goalRecord(value, ["cursor", "limit", "archived"]); if (query.cursor !== null) goalUuid(query.cursor);
  goalEnsure(typeof query.limit === "number" && Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 50 && ["active", "archived", "all"].includes(String(query.archived))); return structuredClone(query) as unknown as GoalPageQuery;
}
export function validateGoalHistoryQuery(value: GoalHistoryQuery): GoalHistoryQuery {
  const query = goalRecord(value, ["id", "cursor", "limit"]); goalUuid(query.id); goalEnsure(typeof query.limit === "number" && Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 50);
  if (query.cursor !== null) { const cursor = goalRecord(query.cursor, ["created_at", "id"]); goalTimestamp(cursor.created_at); goalUuid(cursor.id); query.cursor = cursor; }
  return structuredClone(query) as unknown as GoalHistoryQuery;
}
function base(value: unknown, fields: string[]) { const row = goalRecord(value, ["version", "finance_revision", ...fields]); goalEnsure(row.version === 1 && Buffer.byteLength(JSON.stringify(row), "utf8") <= 512 * 1024); goalRevision(row.finance_revision); return row; }
export function parseGoalPage(value: unknown, actor: string, query: GoalPageQuery): GoalPage {
  return goalChecked(() => {
    const checked = validateGoalPageQuery(query), row = base(value, ["items", "highlight", "next_cursor"]);
    goalEnsure(Array.isArray(row.items) && row.items.length <= checked.limit); let previous = checked.cursor;
    const items = row.items.map(value => { const item = goalRecord(value, ["goal", "totals"]), goal = ownGoalRow(decodeFinancialGoal(item.goal), actor), totals = parseGoalTotals(item.totals, actor, row.finance_revision as string, "goal") as GoalTotals;
      goalEnsure((previous === null || goal.id > previous) && totals.goal_id === goal.id && (checked.archived === "all" || checked.archived === (goal.archived_at === null ? "active" : "archived"))); previous = goal.id; return { goal, totals }; });
    goalEnsure(row.next_cursor === null || items.length === checked.limit && row.next_cursor === previous);
    return { version: 1, finance_revision: row.finance_revision as string, items, highlight: row.highlight === null ? null : ownGoalRow(decodeGoalHighlight(row.highlight), actor), next_cursor: row.next_cursor as string | null };
  });
}
export function parseGoalDetail(value: unknown, actor: string, id: string): GoalDetail | null {
  return goalChecked(() => { goalUuid(id); if (value === null) return null; const row = base(value, ["goal", "totals", "highlight"]), goal = ownGoalRow(decodeFinancialGoal(row.goal), actor), totals = parseGoalTotals(row.totals, actor, row.finance_revision as string, "goal") as GoalTotals;
    goalEnsure(goal.id === id && totals.goal_id === id); return { version: 1, finance_revision: row.finance_revision as string, goal, totals, highlight: row.highlight === null ? null : ownGoalRow(decodeGoalHighlight(row.highlight), actor) }; });
}
function pgInstant(value: string): bigint {
  // Postgres timestamptz orders to microseconds; Date.parse alone collapses
  // different valid instants inside the same millisecond and can lose a page.
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  const milliseconds = Number(fraction.slice(0, 3).padEnd(3, "0"));
  const micros = BigInt(fraction.slice(0, 6).padEnd(6, "0")) + (Number(fraction[6] ?? "0") >= 5 ? 1n : 0n);
  return BigInt(Date.parse(value) - milliseconds) * 1000n + micros;
}
function cursorAfter(next: GoalHistoryCursor, previous: GoalHistoryCursor | null) { return previous === null || pgInstant(next.created_at) > pgInstant(previous.created_at) || pgInstant(next.created_at) === pgInstant(previous.created_at) && next.id > previous.id; }
function history(value: unknown, query: GoalHistoryQuery) {
  const checked = validateGoalHistoryQuery(query), row = base(value, ["items", "next_cursor"]); goalEnsure(Array.isArray(row.items) && row.items.length <= checked.limit);
  return { row, query: checked, values: row.items };
}
function nextCursor(value: unknown, size: number, query: GoalHistoryQuery, previous: GoalHistoryCursor | null) { if (value === null) return null; const cursor = goalRecord(value, ["created_at", "id"]); goalTimestamp(cursor.created_at); goalUuid(cursor.id); goalEnsure(size === query.limit && goalSame(cursor, previous)); return structuredClone(cursor) as unknown as GoalHistoryCursor; }
export function parseGoalReservationsPage(value: unknown, actor: string, query: GoalHistoryQuery): GoalReservationsPage {
  return goalChecked(() => {
    const h = history(value, query); let previous = h.query.cursor;
    const items = h.values.map(value => { const item = goalRecord(value, ["reservation", "totals"]), reservation = ownGoalRow(decodeGoalReservation(item.reservation), actor), totals = parseGoalTotals(item.totals, actor, h.row.finance_revision as string, "release") as GoalReleaseTotals, cursor = { created_at: reservation.created_at, id: reservation.id };
      goalEnsure(reservation.goal_id === h.query.id && totals.reservation_id === reservation.id && totals.released_cents <= reservation.amount_cents && cursorAfter(cursor, previous)); previous = cursor; return { reservation, totals }; });
    return { version: 1, finance_revision: h.row.finance_revision as string, items, next_cursor: nextCursor(h.row.next_cursor, items.length, h.query, previous) };
  });
}
export function parseGoalReleasesPage(value: unknown, actor: string, query: GoalHistoryQuery): GoalReleasesPage {
  return goalChecked(() => {
    const h = history(value, query); let previous = h.query.cursor;
    const items = h.values.map(value => { const release = ownGoalRow(decodeGoalRelease(value), actor), cursor = { created_at: release.created_at, id: release.id }; goalEnsure(release.reservation_id === h.query.id && cursorAfter(cursor, previous)); previous = cursor; return release; });
    return { version: 1, finance_revision: h.row.finance_revision as string, items, next_cursor: nextCursor(h.row.next_cursor, items.length, h.query, previous) };
  });
}
