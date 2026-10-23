import { financeGoalsGatewayForRequest } from "@/adapters/db/finance-goals-runtime";
import { parseGoalReceipt } from "@/adapters/db/finance-goals-protocol";
import { authorizeGoalHttp, GoalReceiptPending, goalHttpBound, goalHttpCommand, goalHttpFailure, goalHttpHeaders, goalHttpNoQuery } from "@/adapters/http/finance-goals-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = goalHttpHeaders();
  try {
    const { config, actor } = await authorizeGoalHttp(request, headers, true); goalHttpNoQuery(request);
    const intent = await goalHttpCommand(request), gateway = financeGoalsGatewayForRequest(config, actor, intent.command);
    // Deliberately no enabled gate, Core executor, Store or commit. A stopped
    // rollout must still allow this owner's original receipt to be queried.
    const snapshot = await gateway.snapshot(structuredClone(intent));
    if (snapshot.receipt === null) throw new GoalReceiptPending();
    return goalHttpBound(intent, parseGoalReceipt(snapshot.receipt, actor.userId, intent).result, headers);
  } catch (error) { return goalHttpFailure(error, headers); }
}
