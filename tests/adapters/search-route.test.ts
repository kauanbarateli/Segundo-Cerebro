import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), port: vi.fn(), query: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/search-runtime", () => ({ searchForRequest: seams.port }));
import { GET } from "../../src/app/api/search/route";
const id = "10000000-0000-4000-8000-000000000001", origin = "http://127.0.0.1:3000";
const actor = { userId: id, sessionId: id, mustChangePassword: false, entitlements: {} };
const request = (query = "?q=ação", headers: Record<string, string> = {}) => new Request(origin + "/api/search" + query, { headers: { "X-Expected-User-ID": id, ...headers } });
beforeEach(() => {
  vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin });
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor } });
  seams.query.mockResolvedValue([]); seams.port.mockReturnValue({ query: seams.query });
});
describe("busca autenticada e limitada", () => {
  it("passa identidade verificada e mantém resposta privada", async () => {
    const response = await GET(request()); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(seams.port).toHaveBeenCalledWith(expect.anything(), actor); expect(seams.query).toHaveBeenCalledWith("ação");
  });
  it.each([null, { ...actor, mustChangePassword: true }, { ...actor, entitlements: { inicio: false } }])("fecha leitura antes do RPC para %j", async identity => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => identity } });
    expect([401, 403]).toContain((await GET(request())).status); expect(seams.port).not.toHaveBeenCalled();
  });
  it("recusa troca de conta antes de construir o cliente privilegiado", async () => {
    expect((await GET(request("?q=a", { "X-Expected-User-ID": "other" }))).status).toBe(409); expect(seams.port).not.toHaveBeenCalled();
  });
  it.each(["?q=" + "a".repeat(121), "?q=a&q=b", "?q=a&user_id=other", "?q=%00"])("valida consulta antes do RPC: %s", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(seams.port).not.toHaveBeenCalled();
  });
  it("não consulta banco para um termo vazio", async () => {
    expect(await (await GET(request("?q=%20"))).json()).toEqual({ items: [] }); expect(seams.port).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([{ Origin: "https://foreign.example.invalid" }, { "Sec-Fetch-Site": "cross-site" }])("fecha origem externa", async headers => {
    expect((await GET(request(undefined, headers))).status).toBe(403); expect(seams.services).not.toHaveBeenCalled();
  });
  it("não transforma falhas em lista vazia nem expõe SQL", async () => {
    seams.query.mockRejectedValue(new Error("SQL_CANARY")); const response = await GET(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("SQL_CANARY");
  });
  it("demo não toca Auth ou Supabase", async () => {
    seams.config.mockReturnValue({ mode: "demo" }); expect((await GET(request())).status).toBe(503); expect(seams.services).not.toHaveBeenCalled();
  });
});
