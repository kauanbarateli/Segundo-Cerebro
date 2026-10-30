import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assinatura } from "../../src/core/contracts/base";
import { encerrarSerieFinanceira } from "../../src/core/financeiro";
import { classifyFinanceSeriesGroup, withLegacySeriesStopGuard } from "../../src/adapters/db/finance-series-classification";
import { financeSeriesAvailable, financeSeriesSchemaState } from "../../src/adapters/db/finance-series-availability";
import { createFinanceStore, type FinanceCommit, type FinanceGateway, type FinanceSnapshot } from "../../src/adapters/db/finance-store";
import { AuthGuardError } from "../../src/lib/auth/types";
import { decodeSeriesGroupClassification } from "../../src/lib/finance-series-classification-contract";
import { managedOccurrence, managedSeries, seriesAccount, seriesCategory, seriesId, SERIES_NOW, SERIES_OWNER } from "../fixtures/finance-series";
const series = managedSeries(), row = managedOccurrence(series).row, input = { client_id: "legacy-replay", installment_group_id: series.id, from_on: "2026-10-23" };
const context = { user_id: SERIES_OWNER, canal: "web" as const };
function request(): FinanceCommit { return { expectedRevision: "0", context, changes: [], events: [], receipt: { user_id: SERIES_OWNER, command: "finance.series.stop", client_id: input.client_id, fingerprint: assinatura(input), result: { group_id: series.id, transactions: [] } } }; }
function gateway() {
  const state: FinanceSnapshot = { revision: "0", accounts: [seriesAccount], categories: [seriesCategory], tags: [], transactions: [row], budgets: [], events: [], receipts: [] };
  const commit = vi.fn<FinanceGateway["commit"]>().mockImplementation(async body => ({ status: "committed", result: body.receipt.result }));
  const receipt = vi.fn<FinanceGateway["receipt"]>().mockResolvedValue(null);
  return { state, commit, receipt, port: { actorId: SERIES_OWNER, snapshot: async () => structuredClone(state), currentRevision: async () => state.revision, commit, receipt } satisfies FinanceGateway };
}
describe("#78 — classificação positiva independente da disponibilidade", () => {
  it("pré-schema declara legado próprio, sem tentar RPC v2", async () => {
    const legacy = vi.fn(async () => ({ transactions: [row] })), managed = vi.fn();
    expect(await classifyFinanceSeriesGroup(SERIES_OWNER, series.id, { legacy, managed, environment: {} })).toEqual({ version: 2, group_id: series.id, kind: "legacy" }); expect(legacy).toHaveBeenCalledOnce(); expect(managed).not.toHaveBeenCalled();
    expect(financeSeriesSchemaState({})).toBe("legacy_only"); expect(financeSeriesAvailable({ FINANCE_SERIES_V2_ENABLED: "true" })).toBe(false);
  });
  it("inexistência e dados estrangeiros não são classificação legado", async () => {
    const managed = vi.fn(); await expect(classifyFinanceSeriesGroup(SERIES_OWNER, series.id, { legacy: async () => ({ transactions: [] }), managed, environment: {} })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(classifyFinanceSeriesGroup(SERIES_OWNER, series.id, { legacy: async () => ({ transactions: [{ ...row, user_id: seriesId(9999) }] }), managed, environment: {} })).rejects.toMatchObject({ code: "unavailable" }); expect(managed).not.toHaveBeenCalled();
  });
  it("classified consulta o próprio detalhe mesmo com flag desligada", async () => {
    const managed = vi.fn(async () => ({ series })), environment = { FINANCE_SERIES_V2_SCHEMA_STATE: "classified" };
    expect(await classifyFinanceSeriesGroup(SERIES_OWNER, series.id, { legacy: async () => ({ transactions: [row] }), managed, environment })).toEqual({ version: 2, group_id: series.id, kind: "managed", available: false }); expect(managed).toHaveBeenCalledExactlyOnceWith(series.id);
    expect(await classifyFinanceSeriesGroup(SERIES_OWNER, series.id, { legacy: async () => ({ transactions: [row] }), managed: async () => null, environment })).toEqual({ version: 2, group_id: series.id, kind: "legacy" });
    await expect(classifyFinanceSeriesGroup(SERIES_OWNER, series.id, { legacy: async () => ({ transactions: [row] }), managed: async () => { throw new AuthGuardError("forbidden"); }, environment })).rejects.toMatchObject({ code: "forbidden" });
  });
  it.each(["", "true", "LEGACY_ONLY", "classified "])("estado inválido %j recusa antes de ler dados", async value => {
    const legacy = vi.fn(), managed = vi.fn(); expect(() => financeSeriesAvailable({ FINANCE_SERIES_V2_SCHEMA_STATE: value })).toThrow();
    await expect(classifyFinanceSeriesGroup(SERIES_OWNER, series.id, { legacy, managed, environment: { FINANCE_SERIES_V2_SCHEMA_STATE: value } })).rejects.toMatchObject({ code: "unavailable" }); expect(legacy).not.toHaveBeenCalled(); expect(managed).not.toHaveBeenCalled();
  });
  it("DTO precisa ser explícito e vinculado; erro/404 não é legado", () => {
    for (const value of [null, {}, { version: 2, group_id: seriesId(9999), kind: "legacy" }, { version: 2, group_id: series.id, kind: "legacy", available: false }, { version: 2, group_id: series.id, kind: "managed" }, { ok: false, code: "NOT_FOUND", message: "closed" }]) expect(() => decodeSeriesGroupClassification(value, series.id)).toThrow();
  });
});
describe("#78 — wrapper somente commit de stop v1, preservando recibo primeiro", () => {
  it("novo legado com classificação positiva conserva o mesmo envelope", async () => {
    const h = gateway(), classify = vi.fn(async () => ({ version: 2 as const, group_id: series.id, kind: "legacy" as const })), body = request();
    expect(await withLegacySeriesStopGuard(h.port, series.id, classify).commit(body)).toEqual({ status: "committed", result: body.receipt.result }); expect(classify).toHaveBeenCalledOnce(); expect(h.commit).toHaveBeenCalledExactlyOnceWith(body);
  });
  it("gerido, consulta recusada e DTO malformado não alcançam commit v1", async () => {
    const h = gateway(), before = structuredClone(h.state);
    await expect(withLegacySeriesStopGuard(h.port, series.id, async () => ({ version: 2, group_id: series.id, kind: "managed", available: false })).commit(request())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(withLegacySeriesStopGuard(h.port, series.id, async () => { throw new AuthGuardError("unavailable"); }).commit(request())).rejects.toMatchObject({ code: "unavailable" }); expect(h.commit).not.toHaveBeenCalled(); expect(h.state).toEqual(before);
  });
  it("replay real Core/Store retorna recibo mesmo se classificador atual falha", async () => {
    const h = gateway(), saved = request().receipt; h.receipt.mockResolvedValue(structuredClone(saved)); const classify = vi.fn(async () => { throw new AuthGuardError("unavailable"); });
    const store = createFinanceStore(withLegacySeriesStopGuard(h.port, series.id, classify));
    expect(await encerrarSerieFinanceira(store, { clock: { now: () => SERIES_NOW }, ids: { next: () => seriesId(888) } }, context, input)).toEqual(saved.result);
    expect(classify).not.toHaveBeenCalled(); expect(h.commit).not.toHaveBeenCalled(); expect(h.state.events).toEqual([]); expect(h.state.receipts).toEqual([]);
  });
  it("recibo de outro dono ou fingerprint não autoriza replay nem classificação", async () => {
    const h = gateway(), classify = vi.fn(); h.receipt.mockResolvedValue({ ...request().receipt, user_id: seriesId(9999) }); await expect(withLegacySeriesStopGuard(h.port, series.id, classify).commit(request())).rejects.toMatchObject({ code: "unavailable" });
    h.receipt.mockResolvedValue({ ...request().receipt, fingerprint: "{}" }); await expect(withLegacySeriesStopGuard(h.port, series.id, classify).commit(request())).rejects.toMatchObject({ code: "CONFLICT" }); expect(classify).not.toHaveBeenCalled(); expect(h.commit).not.toHaveBeenCalled();
  });
});
