import { beforeEach, expect, it, vi } from "vitest";
import { SIGNUP_CONTEXT_COOKIE, signSignupContext, signupProvisionalCookie } from "../../src/lib/auth/signup-provisional";
vi.mock("server-only", () => ({}));
const fake = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn(), client: vi.fn(), rpc: vi.fn(), enabled: vi.fn(), gate: vi.fn() }));
const userId = "10000000-0000-4000-8000-000000000001", sessionId = "20000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002", revision = "30000000-0000-4000-8000-000000000001", scope = "q".repeat(43);
const config = { mode: "supabase", appOrigin: "https://app.example.invalid", stateSecret: "s".repeat(32), secureCookies: true };
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: fake.getAll, set: fake.set }) }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => config }));
vi.mock("@/lib/auth/clients", () => ({ createRequestClient: fake.client }));
vi.mock("@/lib/auth/signup-http", () => ({ signupFenceDeployed: fake.enabled, signupOriginV2Rpc: fake.rpc }));
vi.mock("@/lib/auth/origin-withdrawal-v2-gate", () => ({ originWithdrawalV2Enabled: fake.gate }));
import { GET, POST } from "../../src/app/api/signup-origin-pending-v2/route";
const get = (id = userId) => new Request("https://app.example.invalid/api/signup-origin-pending-v2", { headers: { "x-expected-user-id": id } });
const post = (body = JSON.stringify({ revision }), id = userId) => new Request("https://app.example.invalid/api/signup-origin-pending-v2", { method: "POST", headers: { origin: config.appOrigin, "content-type": "application/json", "x-expected-user-id": id }, body });
beforeEach(() => {
  vi.clearAllMocks(); fake.enabled.mockReturnValue(true); fake.gate.mockReturnValue(true); fake.rpc.mockResolvedValue({ status: "active", revision });
  fake.client.mockReturnValue({ auth: { getUser: async () => ({ data: { user: { id: userId, email_confirmed_at: "2026-01-01", is_anonymous: false } }, error: null }), getClaims: async () => ({ data: { claims: { sub: userId, session_id: sessionId } }, error: null }) } });
  fake.getAll.mockReturnValue([{ name: "sc-auth.0", value: "main" }, { name: SIGNUP_CONTEXT_COOKIE, value: signSignupContext({ scope, userId, sessionId }, config.stateSecret) }]);
});
it("permanece fechado antes de ler cookies quando qualquer gate está fechado", async () => {
  fake.enabled.mockReturnValueOnce(false); expect((await GET(get())).status).toBe(503);
  fake.gate.mockReturnValueOnce(false); expect((await POST(post())).status).toBe(503);
  expect(fake.getAll).not.toHaveBeenCalled(); expect(fake.client).not.toHaveBeenCalled(); expect(fake.rpc).not.toHaveBeenCalled();
});
it("usa somente a sessão provisória verificada para consultar e retirar a revisão", async () => {
  const response = await GET(get()); expect(await response.json()).toEqual({ ok: true, result: { status: "active", revision } });
  expect(fake.client).toHaveBeenCalledWith(config, expect.anything(), true, expect.anything(), signupProvisionalCookie(scope));
  fake.rpc.mockResolvedValueOnce({ status: "stale" }); expect(await (await POST(post())).json()).toEqual({ ok: true, result: { status: "stale" } });
  expect(fake.rpc).toHaveBeenLastCalledWith(config, "signup_origin_withdraw_v2", { p_user: userId, p_session: sessionId, p_revision: revision }); expect(fake.set).not.toHaveBeenCalled();
});
it("permite retirada com checkpoint expirado e contexto provisório ainda válido", async () => {
  fake.getAll.mockReturnValue([{ name: SIGNUP_CONTEXT_COOKIE, value: signSignupContext({ scope, userId, sessionId }, config.stateSecret) }, { name: "sc-flow-signup-confirmation", value: "expired-or-invalid" }]);
  fake.rpc.mockResolvedValueOnce({ status: "withdrawn" });const response=await POST(post());
  expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,result:{status:"withdrawn"}});expect(fake.rpc).toHaveBeenCalledWith(config,"signup_origin_withdraw_v2",{p_user:userId,p_session:sessionId,p_revision:revision});
});
it("recusa contexto provisório expirado sem consultar ou retirar origem", async () => {
  fake.getAll.mockReturnValue([{name:SIGNUP_CONTEXT_COOKIE,value:signSignupContext({scope,userId,sessionId},config.stateSecret,Date.now()-25*60*60*1000)}]);
  expect((await POST(post())).status).toBe(401);expect(fake.client).not.toHaveBeenCalled();expect(fake.rpc).not.toHaveBeenCalled();
});
it("recusa conta trocada ou sessão provisória divergente sem chamar RPC", async () => {
  expect((await POST(post(JSON.stringify({ revision }), other))).status).toBe(409); expect(fake.rpc).not.toHaveBeenCalled();
  fake.client.mockReturnValueOnce({ auth: { getUser: async () => ({ data: { user: { id: userId, email_confirmed_at: "2026-01-01", is_anonymous: false } }, error: null }), getClaims: async () => ({ data: { claims: { sub: userId, session_id: other } }, error: null }) } });
  expect((await GET(get())).status).toBe(401); expect(fake.rpc).not.toHaveBeenCalled();
});
it("não aceita UTM, revisão ausente ou resultado ambíguo", async () => {
  expect((await POST(post('{}'))).status).toBe(400); expect((await POST(post(JSON.stringify({ revision, utm_source: "privado" })))).status).toBe(400); expect(fake.rpc).not.toHaveBeenCalled();
  fake.rpc.mockResolvedValueOnce({ status: "active", revision, utm_source: "privado" }); const response = await GET(get()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("privado");
  fake.rpc.mockRejectedValueOnce(new Error("secret")); const uncertain = await POST(post()); expect(uncertain.status).toBe(503); expect(await uncertain.text()).not.toContain("secret");
});
