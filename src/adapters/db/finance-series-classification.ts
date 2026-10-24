import "server-only";
import { ErroDeDominio } from "../../core/contracts/base";
import type { LancamentoFinanceiro } from "../../core/financeiro/fused";
import { decodeSeriesGroupClassification, type SeriesGroupClassification } from "../../lib/finance-series-classification-contract";
import { AuthGuardError } from "../../lib/auth/types";
import { financeSeriesAvailable, financeSeriesSchemaState } from "./finance-series-availability";
import type { FinanceGateway } from "./finance-store";
import { seriesUuid } from "./finance-series-protocol";

export interface SeriesClassificationDependencies {
  legacy(): Promise<{ transactions: LancamentoFinanceiro[] }>;
  /** Created/called only after the supervised schema is declared classified. */
  managed(groupId: string): Promise<{ series: { id: string; user_id: string } } | null>;
  environment?: Readonly<Record<string, string | undefined>>;
}
export async function classifyFinanceSeriesGroup(actorId: string, groupId: string, dependencies: SeriesClassificationDependencies): Promise<SeriesGroupClassification> {
  if (!seriesUuid(actorId) || !seriesUuid(groupId)) throw new ErroDeDominio("VALIDATION", "Grupo financeiro inválido.");
  const state = financeSeriesSchemaState(dependencies.environment);
  const view = await dependencies.legacy();
  if (!Array.isArray(view.transactions) || view.transactions.some(row => row.user_id !== actorId)) throw new AuthGuardError("unavailable");
  if (!view.transactions.some(row => row.installment_group_id === groupId)) throw new ErroDeDominio("NOT_FOUND", "Este grupo não está disponível.");
  if (state === "legacy_only") return decodeSeriesGroupClassification({ version: 2, group_id: groupId, kind: "legacy" }, groupId);
  const detail = await dependencies.managed(groupId);
  if (detail === null) return decodeSeriesGroupClassification({ version: 2, group_id: groupId, kind: "legacy" }, groupId);
  if (detail.series.id !== groupId || detail.series.user_id !== actorId) throw new AuthGuardError("unavailable");
  return decodeSeriesGroupClassification({ version: 2, group_id: groupId, kind: "managed", available: financeSeriesAvailable(dependencies.environment) }, groupId);
}

/** Wrapping commit preserves Core receipt-first replay. It does not replace the
 * SQL guard/financial lock which authorizes the final atomic ledger change. */
export function withLegacySeriesStopGuard(gateway: FinanceGateway, groupId: string, classification: () => Promise<SeriesGroupClassification>): FinanceGateway {
  if (!seriesUuid(groupId)) throw new ErroDeDominio("VALIDATION", "Grupo financeiro inválido.");
  return { ...gateway, async commit(request) {
    if (request.context.user_id !== gateway.actorId || request.receipt.user_id !== gateway.actorId || request.receipt.command !== "finance.series.stop") throw new AuthGuardError("forbidden");
    let input: unknown;
    try { input = JSON.parse(request.receipt.fingerprint); } catch { throw new AuthGuardError("unavailable"); }
    if (!input || typeof input !== "object" || Array.isArray(input) || (input as Record<string, unknown>).installment_group_id !== groupId) throw new AuthGuardError("forbidden");
    // The v1 Store also calls commit for a looked-up receipt with no changes.
    // Re-read under current Auth before classification; concurrent winners and
    // original replays must not depend on today's rollout/group metadata.
    const saved = await gateway.receipt(request.receipt.command, request.receipt.client_id);
    if (saved !== null) {
      if (saved.user_id !== gateway.actorId || saved.command !== request.receipt.command || saved.client_id !== request.receipt.client_id) throw new AuthGuardError("unavailable");
      if (saved.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "O identificador já pertence a outro conteúdo.");
      return { status: "replayed", result: structuredClone(saved.result) };
    }
    const kind = decodeSeriesGroupClassification(await classification(), groupId);
    if (kind.kind !== "legacy") throw new ErroDeDominio("CONFLICT", "Esta recorrência é gerida na seção Dívidas e contas recorrentes.");
    return gateway.commit(request);
  } };
}
