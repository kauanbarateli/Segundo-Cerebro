import { randomUUID } from "node:crypto";
import { executeGoalCommand } from "@/core/financeiro/goals/goal-use-cases";
import { createFinanceGoalsStore } from "@/adapters/db/finance-goals-store";
import { financeGoalsGatewayForRequest } from "@/adapters/db/finance-goals-runtime";
import { requireFinanceGoalsAvailable } from "@/adapters/db/finance-goals-availability";
import { authorizeGoalHttp, goalHttpBound, goalHttpCommand, goalHttpFailure, goalHttpHeaders, goalHttpNoQuery, goalHttpQuery, goalHttpRead } from "@/adapters/http/finance-goals-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = goalHttpHeaders();
  try {
    const { config, actor } = await authorizeGoalHttp(request, headers); requireFinanceGoalsAvailable();
    const query = goalHttpQuery(request), gateway = financeGoalsGatewayForRequest(config, actor, "read.finance.goals");
    const result = query.view === "page" ? await gateway.page(query.query) : query.view === "detail" ? await gateway.detail(query.id) : query.view === "reservations" ? await gateway.reservations(query.query) : await gateway.releases(query.query);
    return goalHttpRead(result, headers);
  } catch (error) { return goalHttpFailure(error, headers); }
}
export async function POST(request: Request) {
  const headers = goalHttpHeaders(); let entered = false;
  try {
    const { config, actor } = await authorizeGoalHttp(request, headers, true); requireFinanceGoalsAvailable(); goalHttpNoQuery(request);
    const intent = await goalHttpCommand(request); entered = true;
    const gateway = financeGoalsGatewayForRequest(config, actor, intent.command);
    const result = await executeGoalCommand(createFinanceGoalsStore(gateway, intent), { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: actor.userId, canal: "web" }, intent);
    return goalHttpBound(intent, result, headers);
  } catch (error) { return goalHttpFailure(error, headers, entered); }
}
