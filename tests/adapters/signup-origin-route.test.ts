import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ identity: vi.fn(), rpc: vi.fn() }));
const userId = "10000000-0000-4000-8000-000000000001", sessionId = "20000000-0000-4000-8000-000000000001";
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => ({ mode: "supabase", appOrigin: "https://app.example.invalid" }) }));
vi.mock("@/lib/auth/runtime", () => ({ requestAuthServices: async () => ({ gateway: { readIdentity: fake.identity } }) }));
vi.mock("@/lib/auth/signup-http", () => ({ signupOriginRpc: fake.rpc }));
import { GET, POST } from "../../src/app/api/signup-origin/route";

const get = (id = userId) => new Request("https://app.example.invalid/api/signup-origin", { headers: { "x-expected-user-id": id } });
const post = (body = "{}", origin = "https://app.example.invalid", id = userId) => new Request("https://app.example.invalid/api/signup-origin", { method: "POST", headers: { "x-expected-user-id": id, origin, "content-type": "application/json" }, body });
describe("origem de cadastro privada", () => {
  beforeEach(() => { vi.clearAllMocks(); fake.identity.mockResolvedValue({ userId, sessionId, mustChangePassword: false }); fake.rpc.mockResolvedValue({ status: "active", expiresAt: "2027-10-31T00:00:00Z" }); });
  it("usa a identidade da sessão e devolve apenas estado e expiração", async () => {
    const response = await GET(get()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ ok: true, result: { status: "active", expiresAt: "2027-10-31T00:00:00Z" } });
    expect(fake.rpc).toHaveBeenCalledWith(expect.anything(), "signup_origin_status", { p_user: userId, p_session: sessionId });
  });
  it("recusa anônimo, conta trocada, origem externa e payload com campos", async () => {
    fake.identity.mockResolvedValueOnce(null); expect((await GET(get())).status).toBe(401);
    expect((await GET(get("outro"))).status).toBe(409);
    expect((await POST(post("{}", "https://evil.example.invalid"))).status).toBe(403);
    expect((await POST(post('{"userId":"outro"}'))).status).toBe(403);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("retira idempotentemente e não devolve valores de campanha", async () => {
    fake.rpc.mockResolvedValue({ status: "withdrawn" });
    expect(await (await POST(post())).json()).toEqual({ ok: true, result: { status: "withdrawn" } });
    fake.rpc.mockResolvedValue({ status: "absent", expiresAt: null, utm_source: "não deve sair" });
    expect((await GET(get())).status).toBe(503);
  });
});
