import { captureGoalTerminalAttempt } from "@/adapters/db/finance-goals-terminal-canonical";
import { financeGoalsTerminalForRequest } from "@/adapters/db/finance-goals-terminal-runtime";
import { authorizeGoalHttp, goalHttpCommand, goalHttpFailure, goalHttpHeaders, goalHttpNoQuery, goalHttpRead } from "@/adapters/db/finance-goals-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = goalHttpHeaders();
  try {
    const { config, actor } = await authorizeGoalHttp(request, headers, true); goalHttpNoQuery(request);
    const intent = await goalHttpCommand(request), captured = captureGoalTerminalAttempt(actor.userId, intent);
    // Capture synchronously, then call only status. Flag-off does not revoke
    // Auth/feature/deployment checks or turn this read into settle/execute.
    const result = await financeGoalsTerminalForRequest(config, actor, fetch, request.signal).status(captured);
    return goalHttpRead(result, headers);
  } catch (error) { return goalHttpFailure(error, headers); }
}
