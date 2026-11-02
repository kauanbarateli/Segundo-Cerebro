import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ enabled: vi.fn(), identity: vi.fn(), rpc: vi.fn() }));
const userId = "10000000-0000-4000-8000-000000000001", sessionId = "20000000-0000-4000-8000-000000000001", revision = "30000000-0000-4000-8000-000000000001";
vi.mock("@/lib/auth/origin-withdrawal-v2-gate", () => ({ originWithdrawalV2Enabled: fake.enabled }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => ({ mode: "supabase", appOrigin: "https://app.example.invalid" }) }));
vi.mock("@/lib/auth/runtime", () => ({ requestAuthServices: async () => ({ gateway: { readIdentity: fake.identity } }) }));
vi.mock("@/lib/auth/signup-http", () => ({ signupOriginV2Rpc: fake.rpc }));
import { GET, POST } from "../../src/app/api/signup-origin-v2/route";
const get = (id = userId) => new Request("https://app.example.invalid/api/signup-origin-v2", { headers: { "x-expected-user-id": id } });
const post = (body = JSON.stringify({ revision }), id = userId) => new Request("https://app.example.invalid/api/signup-origin-v2", { method: "POST", headers: { "x-expected-user-id": id, origin: "https://app.example.invalid", "content-type": "application/json" }, body });
describe("retirada de origem v2", () => {
  beforeEach(() => { vi.clearAllMocks(); fake.enabled.mockReturnValue(true); fake.identity.mockResolvedValue({ userId, sessionId, mustChangePassword: false }); fake.rpc.mockResolvedValue({ status: "active", revision }); });
  it("fica indisponível por padrão quando gate não está habilitado", async () => {
    fake.enabled.mockReturnValue(false); expect((await GET(get())).status).toBe(404); expect((await POST(post())).status).toBe(404); expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("retorna somente revisão opaca e usa a sessão autenticada", async () => {
    const response = await GET(get()); expect(await response.json()).toEqual({ ok: true, result: { status: "active", revision } });
    expect(fake.rpc).toHaveBeenCalledWith(expect.anything(), "signup_origin_status_v2", { p_user: userId, p_session: sessionId });
    fake.rpc.mockResolvedValueOnce({ status: "active", revision, utm_source: "não deve sair" }); expect((await GET(get())).status).toBe(503);
  });
  it("envia a revisão e trata stale sem consultar a RPC legada", async () => {
    fake.rpc.mockResolvedValue({ status: "stale" }); expect(await (await POST(post())).json()).toEqual({ ok: true, result: { status: "stale" } });
    expect(fake.rpc).toHaveBeenCalledWith(expect.anything(), "signup_origin_withdraw_v2", { p_user: userId, p_session: sessionId, p_revision: revision });
  });
  it("recusa ator trocado e corpo inesperado sem tocar o banco", async () => {
    expect((await POST(post(JSON.stringify({ revision }), "outro"))).status).toBe(409);
    expect((await POST(post('{}'))).status).toBe(400);
    expect((await POST(post(JSON.stringify({ revision, utm_source: "não aceitar" })))).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("não converte erro de RPC ou resposta inválida em ausência", async () => {
    fake.rpc.mockRejectedValueOnce(new Error("unavailable")); expect((await GET(get())).status).toBe(503);
    fake.rpc.mockResolvedValueOnce({ status: "absent", revision: revision }); expect((await GET(get())).status).toBe(503);
    fake.rpc.mockResolvedValueOnce(null); expect((await POST(post())).status).toBe(503);
  });
});
