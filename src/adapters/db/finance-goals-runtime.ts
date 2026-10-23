import "server-only";
import { isTrustedHostedDatabaseOrigin } from "../../lib/auth/database-origin-server";
import { authDeploymentAllowed } from "../../lib/environment/application-destination";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { ErroDeDominio } from "../../core/contracts/base";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { FinanceRateLimitError } from "./finance-gateway";
import { createFinanceGoalsGateway } from "./finance-goals-gateway";
import { goalEnsure, type GoalOperation, type GoalRpc, type GoalRpcName } from "./finance-goals-protocol";

const names: readonly GoalRpcName[] = ["finance_goals_snapshot", "finance_goals_page", "finance_goal_detail", "finance_goal_reservations_page", "finance_goal_releases_page", "finance_goals_commit"];
function unavailable(writing: boolean): never { if (writing) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
/** No generated Functions until Root supervises the additive schema. No browser import. */
export function financeGoalsRpcForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, transport: typeof fetch = fetch): GoalRpc {
  if (!isTrustedHostedDatabaseOrigin(config) || !authDeploymentAllowed(process.env, config)) throw new AuthGuardError("unavailable");
  const actorId = actor.userId, sessionId = actor.sessionId, origin = config.supabaseUrl, key = config.secretKey;
  return async (name, args, writing) => {
    goalEnsure(names.includes(name) && args.p_user === actorId && args.p_session === sessionId && writing === (name === "finance_goals_commit"));
    const payload = JSON.stringify(args); goalEnsure(Buffer.byteLength(payload, "utf8") <= (writing ? 1024 * 1024 : 64 * 1024)); let response: Response;
    try { response = await transport(new URL(`/rest/v1/rpc/${name}`, origin), { method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "User-Agent": "SegundoCerebro-FinanceGoals/1" }, body: payload }); }
    catch { return unavailable(writing); }
    const reader = response.body?.getReader(); if (!reader) return unavailable(writing); const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > 512 * 1024) { await reader.cancel(); return unavailable(writing); } chunks.push(next.value); }
      const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
      if (!response.ok) {
        const code = data && typeof data === "object" && !Array.isArray(data) && "code" in data ? String(data.code) : "";
        if (code === "42501") throw new AuthGuardError("forbidden"); if (code === "PT429") throw new FinanceRateLimitError();
        if (["23505", "40001", "40P01"].includes(code)) throw new ErroDeDominio("CONFLICT", "Os dados financeiros mudaram. Confira novamente antes de reenviar.");
        if (["22023", "23514", "23503", "22P02"].includes(code)) throw new ErroDeDominio("VALIDATION", "Revise os dados da operação.");
        return unavailable(writing);
      }
      return data;
    } catch (error) { if (error instanceof AuthGuardError || error instanceof ErroDeDominio || error instanceof FinanceRateLimitError || error instanceof CommitOutcomeUnknown) throw error; return unavailable(writing); }
    finally { reader.releaseLock(); }
  };
}
export function financeGoalsGatewayForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, operation: GoalOperation) {
  return createFinanceGoalsGateway(actor.userId, actor.sessionId, operation, financeGoalsRpcForRequest(config, actor));
}
