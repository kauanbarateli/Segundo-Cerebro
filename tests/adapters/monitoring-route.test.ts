import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), report: vi.fn(), limit: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/observability/sentry", () => ({ reportBoundary: seams.report }));
import { POST } from "../../src/app/api/monitoring/route";
const id = "10000000-0000-4000-8000-000000000001", origin = "http://127.0.0.1:3000";
const actor = { userId: id, sessionId: id, mustChangePassword: false, entitlements: {} };
const request = (body: unknown = { area: "cofre" }, headers: Record<string, string> = {}) => new Request(origin + "/api/monitoring", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.limit.mockResolvedValue({ allowed: true });
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor }, limit: seams.limit });
});
describe("telemetria mínima não impede recuperação", () => {
  it("recebe somente área enumerada após identidade e limite", async () => {
    const response = await POST(request()); expect(response.status).toBe(204); expect(await response.text()).toBe(""); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(seams.limit).toHaveBeenCalledWith("password", id, actor); expect(seams.report).toHaveBeenCalledWith("cofre");
  });
  it.each([{ area: "cofre", error: "SECRET_CANARY" }, { area: "/cofre?password=SECRET_CANARY" }, { area: "cofre", user_id: id }, { area: "cofre", content: "a".repeat(300) }, null])("descarta dados e não os encaminha %j", async value => {
    expect((await POST(request(value))).status).toBe(204); expect(seams.report).not.toHaveBeenCalled(); expect(seams.limit).not.toHaveBeenCalled();
  });
  it.each([null, { ...actor, mustChangePassword: true }])("descarta sessão inválida", async identity => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => identity }, limit: seams.limit }); expect((await POST(request())).status).toBe(204); expect(seams.report).not.toHaveBeenCalled();
  });
  it("não inicializa serviços em demo ou origem externa", async () => {
    await POST(request(undefined, { Origin: "https://foreign.example.invalid" })); seams.config.mockReturnValue({ mode: "demo" }); await POST(request()); expect(seams.services).not.toHaveBeenCalled();
  });
  it("limite e falha no fornecedor são silenciosos", async () => {
    seams.limit.mockResolvedValue({ allowed: false }); expect((await POST(request())).status).toBe(204); expect(seams.report).not.toHaveBeenCalled();
    seams.limit.mockResolvedValue({ allowed: true }); seams.report.mockRejectedValue(new Error("PROVIDER_CANARY")); const response = await POST(request()); expect(response.status).toBe(204); expect(await response.text()).toBe("");
  });
});
