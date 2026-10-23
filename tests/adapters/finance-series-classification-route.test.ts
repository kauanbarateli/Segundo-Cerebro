import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), legacy: vi.fn(), managed: vi.fn(), classify: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-runtime", () => ({ financeGatewayForRequest: seams.legacy }));
vi.mock("../../src/adapters/db/finance-series-runtime", () => ({ financeSeriesGatewayForRequest: seams.managed }));
vi.mock("../../src/adapters/db/finance-series-classification", () => ({ classifyFinanceSeriesGroup: seams.classify }));
import { GET } from "../../src/app/api/finance/series/classification/route";
import { AuthGuardError } from "../../src/lib/auth/types";
import { ErroDeDominio } from "../../src/core/contracts/base";
import { seriesId, SERIES_OWNER } from "../fixtures/finance-series";
const group = seriesId(4), origin = "https://app.example.test", actor = { userId: SERIES_OWNER, sessionId: seriesId(10), mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const read = (query = "group_id=" + group, owner = SERIES_OWNER) => new Request(origin + "/api/finance/series/classification?" + query, { headers: { "X-Expected-User-ID": owner } });
beforeEach(() => { vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor } }); seams.classify.mockResolvedValue({ version: 2, group_id: group, kind: "legacy" }); });
describe("#78 — rota autenticada de classificação sem conteúdo financeiro", () => {
  it("retorna somente classificação mínima com headers privados", async () => {
    const response = await GET(read()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, result: { version: 2, group_id: group, kind: "legacy" } }); expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff"); expect(seams.classify).toHaveBeenCalledWith(SERIES_OWNER, group, expect.objectContaining({ legacy: expect.any(Function), managed: expect.any(Function) }));
  });
  it("Auth, dono e Entitlement precedem inclusive a classificação legado", async () => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => null } }); expect((await GET(read())).status).toBe(401);
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...actor, entitlements: { financeiro: false } }) } }); expect((await GET(read())).status).toBe(403);
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor } }); expect((await GET(read("group_id=" + group, seriesId(9999)))).status).toBe(409); expect(seams.classify).not.toHaveBeenCalled(); expect(seams.legacy).not.toHaveBeenCalled(); expect(seams.managed).not.toHaveBeenCalled();
  });
  it.each(["", "group_id=invalid", "group_id=" + group + "&group_id=" + group, "group_id=" + group + "&owner=" + SERIES_OWNER])("recusa query %j antes de qualquer classificação", async query => { expect((await GET(read(query))).status).toBe(400); expect(seams.classify).not.toHaveBeenCalled(); });
  it.each([[new AuthGuardError("forbidden"), 403], [new AuthGuardError("unavailable"), 503], [new ErroDeDominio("NOT_FOUND", "synthetic-private"), 404], [new Error("synthetic-private"), 503]] as const)("erro mantém estado fechado %s", async (error, status) => { seams.classify.mockRejectedValue(error); const response = await GET(read()); expect(response.status).toBe(status); const body = await response.json(); expect(body.ok).toBe(false); expect(JSON.stringify(body)).not.toContain("synthetic-private"); expect(body).not.toHaveProperty("result"); });
});
