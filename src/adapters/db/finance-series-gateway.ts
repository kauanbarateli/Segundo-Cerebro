import "server-only";
import { assinatura, ErroDeDominio } from "../../core/contracts/base";
import { AuthGuardError } from "../../lib/auth/types";
import { decodeFinanceSeriesCommand } from "../../core/financeiro/series/series-validation";
import type { FinanceSeriesCommand } from "../../core/financeiro/series/series-types";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { FinanceRateLimitError } from "./finance-gateway";
import { SERIES_COMMANDS, parseSeriesDetail, parseSeriesPage, parseSeriesResult, parseSeriesSnapshot, sameSeriesValue, seriesEnsure, seriesKeys, seriesRecord, seriesUuid, type FinanceSeriesGateway, type FinanceSeriesOperation, type FinanceSeriesRpc } from "./finance-series-protocol";

export function createFinanceSeriesGateway(actor: string, session: string, operation: FinanceSeriesOperation, rpc: FinanceSeriesRpc): FinanceSeriesGateway {
  seriesEnsure(seriesUuid(actor) && seriesUuid(session) && (operation === "read.finance.series" || SERIES_COMMANDS.includes(operation)));
  const base = { p_user: actor, p_session: session };
  function bound(request: FinanceSeriesCommand) { const decoded = decodeFinanceSeriesCommand(request); seriesEnsure(decoded.command === operation); return decoded; }
  return {
    actorId: actor,
    async snapshot(request) {
      const intent = bound(request); return parseSeriesSnapshot(await rpc("finance_series_snapshot", { ...base, p_request: intent }, false), actor, intent);
    },
    async page(query) {
      seriesEnsure((query.cursor === null || seriesUuid(query.cursor)) && Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 50);
      return parseSeriesPage(await rpc("finance_series_page", { ...base, p_cursor: query.cursor, p_limit: query.limit }, false), actor, query);
    },
    async detail(seriesId) {
      seriesEnsure(seriesUuid(seriesId)); return parseSeriesDetail(await rpc("finance_series_detail", { ...base, p_series_id: seriesId }, false), actor, seriesId);
    },
    async commit(request) {
      seriesEnsure(seriesRecord(request)); seriesKeys(request, ["request", "expected_finance_revision", "context", "changes", "events", "receipt"]);
      const intent = bound(request.request);
      seriesEnsure(seriesRecord(request.context)); seriesKeys(request.context, ["user_id", "canal"]);
      seriesEnsure(request.context.user_id === actor && request.context.canal === "web" && request.expected_finance_revision === intent.input.expected_finance_revision && request.receipt.user_id === actor && request.receipt.command === intent.command && request.receipt.client_id === intent.input.client_id && request.receipt.fingerprint === assinatura(intent.input));
      seriesEnsure(Array.isArray(request.changes) && request.changes.length <= 241 && Array.isArray(request.events) && request.events.length === request.changes.length && Buffer.byteLength(JSON.stringify(request), "utf8") <= 8 * 1024 * 1024);
      let value: unknown;
      try { value = await rpc("finance_series_commit", { ...base, p_operation: operation, p_request: structuredClone(request) }, true); }
      catch (error) { if (error instanceof AuthGuardError || error instanceof ErroDeDominio || error instanceof FinanceRateLimitError || error instanceof CommitOutcomeUnknown) throw error; throw new CommitOutcomeUnknown(); }
      try {
        seriesEnsure(seriesRecord(value));
        if (value.status === "stale") { seriesKeys(value, ["status"]); return { status: "stale" }; }
        seriesKeys(value, ["status", "result"]); seriesEnsure(value.status === "committed" || value.status === "replayed");
        const result = parseSeriesResult(value.result, actor);
        if (value.status === "committed") seriesEnsure(sameSeriesValue(result, request.receipt.result)); return { status: value.status, result };
      } catch { throw new CommitOutcomeUnknown(); }
    },
  };
}
