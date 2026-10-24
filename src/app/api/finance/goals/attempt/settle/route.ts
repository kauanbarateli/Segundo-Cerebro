import { captureGoalTerminalAttempt } from "@/adapters/db/finance-goals-terminal-canonical";
import { financeGoalsTerminalForRequest } from "@/adapters/db/finance-goals-terminal-runtime";
import { authorizeGoalHttp, goalHttpCommand, goalHttpFailure, goalHttpHeaders, goalHttpNoQuery, goalHttpRead } from "@/adapters/db/finance-goals-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = goalHttpHeaders(); let entered = false;
  try {
    const { config, actor } = await authorizeGoalHttp(request, headers, true); goalHttpNoQuery(request);
    const intent = await goalHttpCommand(request), captured = captureGoalTerminalAttempt(actor.userId, intent);
    const terminal = financeGoalsTerminalForRequest(config, actor, fetch, request.signal); entered = true;
    // Explicit control write only. Quota and receipt-first/fence decision are
    // atomic in SQL; no automatic status/retry or financial commit fallback.
    const result = await terminal.settle(captured);
    return goalHttpRead(result, headers);
  } catch (error) { return goalHttpFailure(error, headers, entered); }
}
