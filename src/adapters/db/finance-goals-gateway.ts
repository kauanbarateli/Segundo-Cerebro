import "server-only";
import { assinatura, ErroDeDominio } from "../../core/contracts/base";
import { decodeGoalCommand, goalRecord, goalUuid } from "../../core/financeiro/goals/goal-validation";
import { decodeGoalCommandResult } from "../../core/financeiro/goals/goal-use-cases";
import { AuthGuardError } from "../../lib/auth/types";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { FinanceRateLimitError } from "./finance-gateway";
import { GOAL_COMMANDS, goalEnsure, goalSame, parseGoalReceipt, parseGoalSnapshot, type GoalGateway, type GoalOperation, type GoalRpc } from "./finance-goals-protocol";
import { parseGoalDetail, parseGoalPage, parseGoalReleasesPage, parseGoalReservationsPage, validateGoalHistoryQuery, validateGoalPageQuery } from "./finance-goals-read-model";

export function createFinanceGoalsGateway(actor: string, session: string, operation: GoalOperation, rpc: GoalRpc): GoalGateway {
  goalUuid(actor); goalUuid(session); goalEnsure(operation === "read.finance.goals" || GOAL_COMMANDS.includes(operation)); const base = { p_user: actor, p_session: session };
  return {
    actorId: actor,
    async snapshot(request) { const intent = decodeGoalCommand(request); goalEnsure(intent.command === operation); return parseGoalSnapshot(await rpc("finance_goals_snapshot", { ...base, p_request: intent }, false), actor, intent); },
    async page(query) { const checked = validateGoalPageQuery(query); return parseGoalPage(await rpc("finance_goals_page", { ...base, p_cursor: checked.cursor, p_limit: checked.limit, p_archived: checked.archived }, false), actor, checked); },
    async detail(id) { goalUuid(id); return parseGoalDetail(await rpc("finance_goal_detail", { ...base, p_goal: id }, false), actor, id); },
    async reservations(query) { const checked = validateGoalHistoryQuery(query); return parseGoalReservationsPage(await rpc("finance_goal_reservations_page", { ...base, p_goal: checked.id, p_cursor: checked.cursor, p_limit: checked.limit }, false), actor, checked); },
    async releases(query) { const checked = validateGoalHistoryQuery(query); return parseGoalReleasesPage(await rpc("finance_goal_releases_page", { ...base, p_reservation: checked.id, p_cursor: checked.cursor, p_limit: checked.limit }, false), actor, checked); },
    async commit(request) {
      const envelope = goalRecord(request, ["request", "expected_finance_revision", "context", "changes", "events", "receipt"]), intent = decodeGoalCommand(envelope.request), context = goalRecord(envelope.context, ["user_id", "canal"]);
      goalEnsure(intent.command === operation && context.user_id === actor && context.canal === "web" && envelope.expected_finance_revision === intent.input.expected_finance_revision);
      const receipt = parseGoalReceipt(envelope.receipt, actor, intent); goalEnsure(receipt.fingerprint === assinatura(intent.input));
      goalEnsure(Array.isArray(envelope.changes) && envelope.changes.length <= 2 && Array.isArray(envelope.events) && envelope.events.length === envelope.changes.length && Buffer.byteLength(JSON.stringify(envelope), "utf8") <= 1024 * 1024);
      let value: unknown;
      try { value = await rpc("finance_goals_commit", { ...base, p_operation: operation, p_request: structuredClone(envelope) }, true); }
      catch (error) { if (error instanceof AuthGuardError || error instanceof ErroDeDominio || error instanceof FinanceRateLimitError || error instanceof CommitOutcomeUnknown) throw error; throw new CommitOutcomeUnknown(); }
      try {
        const status = goalRecord(value, ["status"], ["result"]);
        if (status.status === "stale") { goalEnsure(!Object.hasOwn(status, "result")); return { status: "stale" }; }
        goalEnsure(status.status === "committed" || status.status === "replayed"); const result = decodeGoalCommandResult(status.result, intent, actor);
        if (status.status === "committed") goalEnsure(goalSame(result, receipt.result)); return { status: status.status, result };
      } catch { throw new CommitOutcomeUnknown(); }
    },
  };
}
