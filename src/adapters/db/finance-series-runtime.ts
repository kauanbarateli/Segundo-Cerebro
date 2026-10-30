import "server-only";
import { isTrustedHostedDatabaseOrigin } from "../../lib/auth/database-origin-server";
import { authDeploymentAllowed } from "../../lib/environment/application-destination";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { ErroDeDominio } from "../../core/contracts/base";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { FinanceRateLimitError } from "./finance-gateway";
import { createFinanceSeriesGateway } from "./finance-series-gateway";
import { seriesEnsure, seriesRecord, type FinanceSeriesOperation, type FinanceSeriesRpc, type FinanceSeriesRpcName } from "./finance-series-protocol";

const RPC_NAMES: readonly FinanceSeriesRpcName[] = ["finance_series_snapshot", "finance_series_page", "finance_series_detail", "finance_series_commit"];
const READ_LIMIT = 4 * 1024 * 1024, WRITE_LIMIT = 8 * 1024 * 1024;
function unknown(writing: boolean): never { if (writing) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
/** Closed server PostgREST transport until supervised installation supplies official generated types. */
export function financeSeriesRpcForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, transport: typeof fetch = fetch): FinanceSeriesRpc {
  if (!isTrustedHostedDatabaseOrigin(config) || !authDeploymentAllowed(process.env, config)) throw new AuthGuardError("unavailable");
  return async (name, args, writing) => {
    seriesEnsure(RPC_NAMES.includes(name) && args.p_user === actor.userId && args.p_session === actor.sessionId && writing === (name === "finance_series_commit"));
    const url = new URL(`/rest/v1/rpc/${name}`, config.supabaseUrl), payload = JSON.stringify(args);
    seriesEnsure(Buffer.byteLength(payload, "utf8") <= (writing ? WRITE_LIMIT : 64 * 1024));
    let response: Response;
    try {
      response = await transport(url, { method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/json", "User-Agent": "SegundoCerebro-FinanceSeries/2" }, body: payload });
    } catch { return unknown(writing); }
    const reader = response.body?.getReader(); if (!reader) return unknown(writing);
    const parts: Uint8Array[] = []; let length = 0;
    try {
      while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > READ_LIMIT) { await reader.cancel(); return unknown(writing); } parts.push(next.value); }
      const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts)));
      if (!response.ok) {
        const code = seriesRecord(data) ? data.code : null;
        if (code === "42501") throw new AuthGuardError("forbidden");
        if (code === "PT429") throw new FinanceRateLimitError();
        if (code === "23505" || code === "40001" || code === "40P01") throw new ErroDeDominio("CONFLICT", "Os dados financeiros mudaram. Confira a prévia antes de reenviar.");
        if (["22023", "23514", "23503", "22P02"].includes(String(code))) throw new ErroDeDominio("VALIDATION", "Revise os dados da operação.");
        return unknown(writing);
      }
      return data;
    } catch (error) {
      if (error instanceof AuthGuardError || error instanceof ErroDeDominio || error instanceof FinanceRateLimitError || error instanceof CommitOutcomeUnknown) throw error;
      return unknown(writing);
    } finally { reader.releaseLock(); }
  };
}
export function financeSeriesGatewayForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, operation: FinanceSeriesOperation) {
  return createFinanceSeriesGateway(actor.userId, actor.sessionId, operation, financeSeriesRpcForRequest(config, actor));
}
