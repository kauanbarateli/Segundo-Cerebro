import { financeGoalsAvailable } from "@/adapters/db/finance-goals-availability";
import { authorizeGoalHttp, goalHttpFailure, goalHttpHeaders, goalHttpNoQuery, goalHttpRead } from "@/adapters/http/finance-goals-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = goalHttpHeaders();
  try { await authorizeGoalHttp(request, headers); goalHttpNoQuery(request); return goalHttpRead({ available: financeGoalsAvailable() }, headers); }
  catch (error) { return goalHttpFailure(error, headers); }
}
