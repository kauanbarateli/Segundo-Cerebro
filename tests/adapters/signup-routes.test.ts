import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fake = vi.hoisted(() => ({ enabled: vi.fn(), request: vi.fn(), verify: vi.fn(), complete: vi.fn(), cookieSet: vi.fn(), cookieGetAll: vi.fn(), signOut: vi.fn() }));
const config = { mode: "supabase" as const, appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_test", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => config }));
vi.mock("@/lib/auth/signup-http", () => ({ signupEnabled: fake.enabled }));
vi.mock("@/lib/auth/signup-runtime", () => ({ createSignupRequestPorts: () => ({}) }));
vi.mock("@/lib/auth/signup-service", () => ({ requestPublicSignup: fake.request }));
vi.mock("@/lib/auth/signup-confirmation-runtime", () => ({ createSignupConfirmationPorts: () => ({}), SIGNUP_CHECKPOINT_COOKIE: "sc-flow-signup-confirmation" }));
vi.mock("@/lib/auth/signup-confirmation-service", () => ({ verifySignupConfirmation: fake.verify }));
vi.mock("@/lib/auth/signup-completion-runtime", () => ({ createSignupCompletionPorts: () => ({}) }));
vi.mock("@/lib/auth/signup-completion-service", () => ({ completePublicSignup: fake.complete }));
vi.mock("@/lib/auth/clients", () => ({ createRequestClient: () => ({ auth: { signOut: fake.signOut } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: fake.cookieGetAll, set: fake.cookieSet }) }));
import { POST as start } from "../../src/app/auth/iniciar-cadastro/route";
import { GET as openLink, POST as confirm } from "../../src/app/auth/confirmar-cadastro/route";
import { GET as openContinuation, POST as confirmContinuation } from "../../src/app/auth/continuar-cadastro/route";
import { POST as clearLocal } from "../../src/app/auth/limpar-cadastro/route";
import { POST as complete } from "../../src/app/auth/finalizar-cadastro/route";

const hash = "a".repeat(64);
const post = (url: string, body = "", origin = config.appOrigin) => new NextRequest(url, { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body });
describe("canais de cadastro ainda fechados por configuração", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fake.enabled.mockReturnValue(true); fake.request.mockResolvedValue({ status: "accepted" });
    fake.verify.mockResolvedValue({ status: "ready" }); fake.complete.mockResolvedValue({ status: "completed" });
    fake.signOut.mockResolvedValue({ error: null });
    fake.cookieGetAll.mockReturnValue([{ name: "sc-signup-otp", value: hash }]);
  });
  it("não consome OTP no GET e remove o segredo da URL de destino", async () => {
    const response = await openLink(new NextRequest(`https://app.example.invalid/auth/confirmar-cadastro?token_hash=${hash}`));
    expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("https://app.example.invalid/cadastro/confirmar?flow=signup");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.cookies.get("sc-signup-otp")).toMatchObject({ value: hash, httpOnly: true, secure: true, sameSite: "lax" });
    expect(fake.verify).not.toHaveBeenCalled();
    const duplicate = await openLink(new NextRequest(`https://app.example.invalid/auth/confirmar-cadastro?token_hash=${hash}&token_hash=${hash}`));
    expect(duplicate.headers.get("location")).toContain("invalid-link"); expect(duplicate.cookies.get("sc-signup-otp")).toBeUndefined();
  });
  it("rejeita POST de outra origem antes de consumir OTP", async () => {
    const response = await confirm(post("https://app.example.invalid/auth/confirmar-cadastro", "", "https://evil.example.invalid"));
    expect(response.status).toBe(403); expect(fake.verify).not.toHaveBeenCalled();
  });
  it("confirma apenas por POST explícito e remove cookie transitório", async () => {
    const response = await confirm(post("https://app.example.invalid/auth/confirmar-cadastro"));
    expect(fake.verify).toHaveBeenCalledWith(expect.anything(), hash, expect.anything());
    expect(response.headers.get("location")).toBe("https://app.example.invalid/cadastro/definir-senha");
    expect(fake.cookieSet).toHaveBeenCalledWith("sc-signup-otp", "", expect.objectContaining({ maxAge: 0, httpOnly: true }));
  });
  it("mantém recuperação de cadastro separada, sem consumir token em GET", async () => {
    const response = await openContinuation(new NextRequest(`https://app.example.invalid/auth/continuar-cadastro?token_hash=${hash}`));
    expect(response.headers.get("location")).toBe("https://app.example.invalid/cadastro/confirmar?flow=continuation");
    expect(response.cookies.get("sc-signup-continuation-otp")?.value).toBe(hash); expect(fake.verify).not.toHaveBeenCalled();
    fake.cookieGetAll.mockReturnValue([{ name: "sc-signup-continuation-otp", value: hash }]);
    expect((await confirmContinuation(post("https://app.example.invalid/auth/continuar-cadastro"))).headers.get("location")).toContain("/cadastro/definir-senha");
    expect(fake.cookieSet).toHaveBeenCalledWith("sc-signup-continuation-otp", "", expect.objectContaining({ maxAge: 0 }));
  });
  it("não substitui sessão existente e só sai localmente por ação explícita", async () => {
    fake.cookieGetAll.mockReturnValue([{ name: "sc-signup-otp", value: hash }, { name: "sc-auth.0", value: "session" }]);
    const blocked = await confirm(post("https://app.example.invalid/auth/confirmar-cadastro"));
    expect(blocked.headers.get("location")).toContain("status=session"); expect(fake.verify).not.toHaveBeenCalled(); expect(fake.cookieSet).not.toHaveBeenCalled();
    const cleared = await clearLocal(post("https://app.example.invalid/auth/limpar-cadastro", "flow=signup"));
    expect(cleared.headers.get("location")).toContain("flow=signup"); expect(fake.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(fake.cookieSet).toHaveBeenCalledWith("sc-auth.0", "", expect.objectContaining({ maxAge: 0 }));
    expect(fake.cookieSet.mock.calls.some(call => call[0] === "sc-signup-otp")).toBe(false);
  });
  it("mantém o cadastro fechado quando a configuração está desligada", async () => {
    fake.enabled.mockReturnValue(false);
    expect((await start(post("https://app.example.invalid/auth/iniciar-cadastro"))).status).toBe(503);
    expect((await openLink(new NextRequest(`https://app.example.invalid/auth/confirmar-cadastro?token_hash=${hash}`))).status).toBe(503);
    expect(fake.request).not.toHaveBeenCalled(); expect(fake.verify).not.toHaveBeenCalled();
  });
  it("recusa formulário duplicado e redireciona conclusão sem expor dados", async () => {
    const invalid = await start(post("https://app.example.invalid/auth/iniciar-cadastro", "email=a&email=b"));
    expect(invalid.headers.get("location")).toContain("status=invalid"); expect(fake.request).not.toHaveBeenCalled();
    const done = await complete(post("https://app.example.invalid/auth/finalizar-cadastro", "password=senha-longa&acceptedLegal=yes&termsVersion=v1&privacyVersion=v2"));
    expect(done.headers.get("location")).toBe("https://app.example.invalid/onboarding"); expect(fake.complete).toHaveBeenCalledOnce();
  });
});
