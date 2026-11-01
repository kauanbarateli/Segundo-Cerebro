import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ identity: null as unknown, rpc: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: () => ({ mode: "supabase", appOrigin: "https://app.example.invalid" }) }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: async () => ({ gateway: { readIdentity: async () => state.identity } }) }));
vi.mock("../../src/adapters/db/feedback-gateway", () => ({ feedbackRpc: state.rpc, FeedbackGatewayError: class extends Error { constructor(readonly code: string) { super(code); } } }));
import { GET, POST } from "../../src/app/api/feedback/route";
const owner = "2b000000-0000-4000-8000-000000000001", other = "2b000000-0000-4000-8000-000000000002";
function request(method = "GET", body?: string, origin = "https://app.example.invalid", expected = owner) {
  return new Request("https://app.example.invalid/api/feedback", { method, headers: { "x-expected-user-id": expected, origin, "content-type": "application/json" }, ...(body === undefined ? {} : { body }) });
}
beforeEach(() => { vi.clearAllMocks(); state.identity = { userId: owner, sessionId: other, mustChangePassword: false, role: "user", entitlements: {} }; state.rpc.mockResolvedValue([]); });
describe("feedback HTTP", () => {
  it("nega sessão ausente e não consulta o gateway", async () => { state.identity = null; const response = await GET(request()); expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toContain("no-store"); expect(state.rpc).not.toHaveBeenCalled(); });
  it("nega identidade de outra aba e senha pendente", async () => { expect((await GET(request("GET", undefined, undefined, other))).status).toBe(409); state.identity = { userId: owner, sessionId: other, mustChangePassword: true }; expect((await GET(request())).status).toBe(403); expect(state.rpc).not.toHaveBeenCalled(); });
  it("nega origem externa e identidade injetada antes do gateway", async () => { const body = JSON.stringify({ category: "suggestion", text: "Mensagem válida", clientId: other, userId: other }); expect((await POST(request("POST", body, "https://outside.invalid"))).status).toBe(403); expect((await POST(request("POST", body))).status).toBe(400); expect(state.rpc).not.toHaveBeenCalled(); });
  it("limita o corpo e associa o ator conferido à mensagem", async () => { expect((await POST(request("POST", JSON.stringify({ text: "x".repeat(40000) })))).status).toBe(400); const response = await POST(request("POST", JSON.stringify({ category: "suggestion", text: "Mensagem válida", clientId: other }))); expect(response.status).toBe(200); expect(state.rpc).toHaveBeenCalledOnce(); expect(state.rpc.mock.calls.at(0)?.[1]).toMatchObject({ userId: owner }); });
  it("recusa cursor incompleto ou parâmetros extras", async () => {
    for (const query of ["?before=2026-01-01T00%3A00%3A00Z", "?id=" + other, "?unknown=1", "?before=x&id=" + other]) {
      const input = new Request(`https://app.example.invalid/api/feedback${query}`, { headers: { "x-expected-user-id": owner } });
      expect((await GET(input)).status).toBe(400);
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
