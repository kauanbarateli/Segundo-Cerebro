import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-series-runtime", () => ({ financeSeriesGatewayForRequest: seams.gateway }));
vi.mock("../../src/adapters/db/finance-series-availability", () => ({ requireFinanceSeriesAvailable: () => undefined }));
import { GET, POST } from "../../src/app/api/finance/series/route";
import { AuthGuardError } from "../../src/lib/auth/types";
import { SeriesGatewayFixture, channelCreate, SERIES_SESSION } from "../fixtures/finance-series-channel";
import { seriesId, SERIES_NOW, SERIES_OWNER } from "../fixtures/finance-series";
const origin = "https://app.example.test";
const actor = { userId: SERIES_OWNER, sessionId: SERIES_SESSION, mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const write = (value: unknown, requestOrigin = origin, owner = SERIES_OWNER) => new Request(origin + "/api/finance/series", { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", "X-Expected-User-ID": owner }, body: JSON.stringify(value) });
const read = (query = "", owner = SERIES_OWNER) => new Request(origin + "/api/finance/series" + query, { headers: { "X-Expected-User-ID": owner } });
let gateway: SeriesGatewayFixture;
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(SERIES_NOW));
  gateway = new SeriesGatewayFixture(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } }); seams.gateway.mockReturnValue(gateway);
});
afterEach(() => vi.useRealTimers());
describe("T053-B3: rota fina conserva limites e autenticação do servidor", () => {
  it("cria com contexto derivado da sessão e resultado v2; replay mantém mesmo recibo", async () => {
    const request = channelCreate(), first = await POST(write(request)); expect(first.status).toBe(200); const result = await first.json();
    expect(result).toMatchObject({ ok: true, result: { version: 2, series: { user_id: SERIES_OWNER }, affected: { created: 2 } } });
    expect(gateway.lastCommit?.context).toEqual({ user_id: SERIES_OWNER, canal: "web" }); expect(gateway.lastCommit?.receipt.client_id).toBe(request.input.client_id);
    const second = await POST(write(request)); expect(await second.json()).toEqual(result); expect(gateway.calls.commit).toBe(1);
    expect(first.headers.get("cache-control")).toContain("no-store"); expect(first.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it.each(["anonymous", "password", "veto"] as const)("%s não alcança o gateway privilegiado", async state => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => state === "anonymous" ? null : state === "password" ? { ...actor, mustChangePassword: true } : { ...actor, entitlements: { financeiro: false } } } });
    expect((await GET(read())).status).toBe(state === "anonymous" ? 401 : 403); expect((await POST(write(channelCreate()))).status).toBe(state === "anonymous" ? 401 : 403); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("dono esperado divergiu: nega leitura e escrita sem misturar a conta", async () => {
    expect((await GET(read("", seriesId(9999)))).status).toBe(409); expect((await POST(write(channelCreate(), origin, seriesId(9999)))).status).toBe(409); expect(seams.gateway).not.toHaveBeenCalled();
    expect((await GET(read("", ""))).status).toBe(400);
  });
  it("CSRF, Content-Type incorreto e dono/contexto injetados não alcançam o adapter", async () => {
    expect((await POST(write(channelCreate(), "https://foreign.example.test"))).status).toBe(403); expect(seams.services).not.toHaveBeenCalled();
    const raw = new Request(origin + "/api/finance/series", { method: "POST", headers: { Origin: origin, "Content-Type": "text/plain", "X-Expected-User-ID": SERIES_OWNER }, body: JSON.stringify(channelCreate()) }); expect((await POST(raw)).status).toBe(400);
    const request = channelCreate(); expect((await POST(write({ ...request, input: { ...request.input, user_id: seriesId(9999) } }))).status).toBe(400); expect((await POST(write({ ...request, context: { user_id: SERIES_OWNER, canal: "cron" } }))).status).toBe(400); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it.each(["?unexpected=1", "?limit=0", "?limit=51", "?limit=01", "?cursor=bad", "?limit=1&limit=2", "?series_id=bad", `?series_id=${seriesId(4)}&limit=1`])("query inválida %s não inicializa gateway", async query => {
    expect((await GET(read(query))).status).toBe(400); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("page é somente metadata própria, detalhe não gerido retorna404 e erroAuth não vira legado", async () => {
    const page = await GET(read("?limit=1")); expect(page.status).toBe(200); expect(await page.json()).toEqual({ ok: true, result: { version: 2, finance_revision: "0", items: [], next_cursor: null } });
    expect((await GET(read(`?series_id=${seriesId(4)}`))).status).toBe(404);
    vi.spyOn(gateway, "detail").mockRejectedValue(new AuthGuardError("forbidden")); const denied = await GET(read(`?series_id=${seriesId(4)}`)); expect(denied.status).toBe(403); expect(await denied.json()).toMatchObject({ code: "FORBIDDEN" });
  });
  it("timeout de escrita mantém COMMIT_UNKNOWN e nunca reenvia automaticamente", async () => {
    gateway.mode = "unknown_before"; const response = await POST(write(channelCreate())); expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ ok: false, code: "COMMIT_UNKNOWN" }); expect(gateway.calls).toEqual({ snapshot: 2, commit: 1 });
  });
  it("público limitado64KiB recusa excesso e JSON inválido antes da persistência", async () => {
    const raw = (body: string) => new Request(origin + "/api/finance/series", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": SERIES_OWNER }, body });
    expect((await POST(raw(" ".repeat(64 * 1024 + 1)))).status).toBe(400); expect((await POST(raw("invalid-synthetic-json"))).status).toBe(400); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("diagnóstico bruto inesperado permanece503 genérico", async () => {
    vi.spyOn(gateway, "page").mockRejectedValue(new Error("synthetic-private-provider-payload")); const response = await GET(read()); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("synthetic-private");
  });
});
