import { financeGoalsGatewayForRequest } from "@/adapters/db/finance-goals-runtime";
import { requireFinanceGoalsAvailable } from "@/adapters/db/finance-goals-availability";
import { prepareFinanceGoal } from "@/adapters/db/finance-goals-preview";
import { authorizeGoalHttp, goalHttpBound, goalHttpCommand, goalHttpFailure, goalHttpHeaders, goalHttpNoQuery } from "@/adapters/db/finance-goals-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = goalHttpHeaders();
  try {
    const { config, actor } = await authorizeGoalHttp(request, headers, true); requireFinanceGoalsAvailable(); goalHttpNoQuery(request);
    const intent = await goalHttpCommand(request), result = await prepareFinanceGoal(financeGoalsGatewayForRequest(config, actor, intent.command), intent, actor.userId);
    return goalHttpBound(intent, result, headers);
  } catch (error) { return goalHttpFailure(error, headers); }
}
