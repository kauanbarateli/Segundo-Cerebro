import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const flags = vi.hoisted(() => ({ trusted: true, allowed: true }));
vi.mock("../../src/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => flags.trusted }));
vi.mock("../../src/lib/environment/application-destination", () => ({ authDeploymentAllowed: () => flags.allowed }));
import { createFinanceSeriesGateway } from "../../src/adapters/db/finance-series-gateway";
import { financeSeriesRpcForRequest } from "../../src/adapters/db/finance-series-runtime";
import { createFinanceSeriesStore } from "../../src/adapters/db/finance-series-store";
import type { FinanceSeriesRpc } from "../../src/adapters/db/finance-series-protocol";
import { executeFinanceSeriesCommand } from "../../src/core/financeiro/series/series-use-cases";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import { SeriesGatewayFixture, channelCreate, emptySeriesSnapshot, SERIES_SESSION } from "../fixtures/finance-series-channel";
import { seriesId, SERIES_NOW, SERIES_OWNER } from "../fixtures/finance-series";

const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.test", supabaseUrl: "https://project.example.test", publishableKey: "synthetic-public-only", secretKey: "synthetic-server-only", rateLimitSecret: "synthetic-rate-only", stateSecret: "synthetic-state-only", secureCookies: true };
const actor = { userId: SERIES_OWNER, sessionId: SERIES_SESSION, mustChangePassword: false, role: "user" as const, entitlements: { financeiro: true } };
async function preparedCommit() {
  const gateway = new SeriesGatewayFixture(), request = channelCreate(); let id = 12000;
  const result = await executeFinanceSeriesCommand(createFinanceSeriesStore(gateway, request), { clock: { now: () => SERIES_NOW }, ids: { next: () => seriesId(++id) } }, { user_id: SERIES_OWNER, canal: "web" }, request);
  return { request, commit: gateway.lastCommit!, result };
}
beforeEach(() => { flags.trusted = true; flags.allowed = true; });
describe("T053-B3: gateway dedicado, certeza do resultado e transporte limitado", () => {
  it("passa somente nomes/argumentos fechados e nunca estende RPC financeiro v1", async () => {
    const request = channelCreate(), rpc = vi.fn<FinanceSeriesRpc>(async () => emptySeriesSnapshot()), gateway = createFinanceSeriesGateway(SERIES_OWNER, SERIES_SESSION, request.command, rpc);
    expect(await gateway.snapshot(request)).toEqual(emptySeriesSnapshot()); expect(rpc).toHaveBeenCalledExactlyOnceWith("finance_series_snapshot", { p_user: SERIES_OWNER, p_session: SERIES_SESSION, p_request: request }, false);
    await expect(gateway.snapshot({ ...request, command: "finance.series.create" } as unknown as typeof request)).rejects.toThrow();
  });
  it("commit precisa confirmar o resultado exato; resposta truncada/malformada fica incerta", async () => {
    const h = await preparedCommit(), rpc = vi.fn<FinanceSeriesRpc>(async () => ({ status: "committed", result: h.result })), gateway = createFinanceSeriesGateway(SERIES_OWNER, SERIES_SESSION, h.request.command, rpc);
    expect(await gateway.commit(h.commit)).toEqual({ status: "committed", result: h.result });
    expect(rpc.mock.calls[0]![0]).toBe("finance_series_commit"); expect(rpc.mock.calls[0]![1].p_operation).toBe(h.request.command);
    for (const value of [{ status: "committed", result: {} }, { status: "committed", result: { ...h.result, affected: { ...h.result.affected, created: 1 } } }, { status: "stale", result: h.result }, { status: "unexpected" }]) { rpc.mockResolvedValueOnce(value); await expect(gateway.commit(h.commit)).rejects.toBeInstanceOf(CommitOutcomeUnknown); }
    const original = { ...h.result, series: { ...h.result.series, id: seriesId(15000) } }; rpc.mockResolvedValueOnce({ status: "replayed", result: original }); expect(await gateway.commit(h.commit)).toEqual({ status: "replayed", result: original });
    rpc.mockRejectedValueOnce(new Error("synthetic-transport")); await expect(gateway.commit(h.commit)).rejects.toBeInstanceOf(CommitOutcomeUnknown);
  });
  it("recusa CAS duplicado divergente e contexto injetado antes da rede", async () => {
    const h = await preparedCommit(), rpc = vi.fn<FinanceSeriesRpc>(), gateway = createFinanceSeriesGateway(SERIES_OWNER, SERIES_SESSION, h.request.command, rpc);
    await expect(gateway.commit({ ...h.commit, expected_finance_revision: "1" })).rejects.toThrow();
    await expect(gateway.commit({ ...h.commit, context: { user_id: seriesId(9999), canal: "web" } })).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
  });
  it("transporte usa origem fixa, sem redirect/cache/session local; só o corpo fechado chega ao PostgREST", async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json(emptySeriesSnapshot())), rpc = financeSeriesRpcForRequest(config, actor, transport), request = channelCreate();
    await rpc("finance_series_snapshot", { p_user: SERIES_OWNER, p_session: SERIES_SESSION, p_request: request }, false);
    const [url, init] = transport.mock.calls[0]!; expect(String(url)).toBe("https://project.example.test/rest/v1/rpc/finance_series_snapshot"); expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
    expect(new Headers(init?.headers).get("User-Agent")).toBe("SegundoCerebro-FinanceSeries/2"); expect(JSON.parse(String(init?.body))).toEqual({ p_user: SERIES_OWNER, p_session: SERIES_SESSION, p_request: request }); expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("destino ou proprietário diferente é recusado sem chamada ao transporte", async () => {
    const transport = vi.fn<typeof fetch>(); flags.trusted = false; expect(() => financeSeriesRpcForRequest(config, actor, transport)).toThrow(); flags.trusted = true; flags.allowed = false; expect(() => financeSeriesRpcForRequest(config, actor, transport)).toThrow();
    flags.allowed = true; const rpc = financeSeriesRpcForRequest(config, actor, transport); await expect(rpc("finance_series_page", { p_user: seriesId(9999), p_session: SERIES_SESSION }, false)).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
  });
  it.each(["throw", "invalid_json", "overflow", "server_error"] as const)("%s permanece indisponível na leitura e incerto na escrita, sem detalhe bruto", async scenario => {
    const response = () => scenario === "invalid_json" ? new Response("private-synthetic-not-json") : scenario === "overflow" ? new Response('"' + "x".repeat(4 * 1024 * 1024) + '"') : Response.json({ message: "synthetic-private-diagnostic" }, { status: 503 });
    const transport = vi.fn<typeof fetch>(async () => { if (scenario === "throw") throw new Error("synthetic-private-transport"); return response(); }), rpc = financeSeriesRpcForRequest(config, actor, transport), args = { p_user: SERIES_OWNER, p_session: SERIES_SESSION };
    await expect(rpc("finance_series_page", { ...args, p_cursor: null, p_limit: 20 }, false)).rejects.toMatchObject({ code: "unavailable" });
    await expect(rpc("finance_series_commit", { ...args, p_request: {} }, true)).rejects.toBeInstanceOf(CommitOutcomeUnknown); expect(transport).toHaveBeenCalledTimes(2);
  });
  it.each([["42501", "forbidden"], ["40001", "CONFLICT"], ["23514", "VALIDATION"], ["PT429", undefined]] as const)("classifica somente o código SQL conhecido %s", async (sql, code) => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({ code: sql, message: "synthetic-private-sql" }, { status: 400 })), rpc = financeSeriesRpcForRequest(config, actor, transport), promise = rpc("finance_series_commit", { p_user: SERIES_OWNER, p_session: SERIES_SESSION, p_request: {} }, true);
    if (code) await expect(promise).rejects.toMatchObject({ code }); else await expect(promise).rejects.toThrow("Aguarde");
  });
});
