import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { signSignupCheckpoint } from "../../src/lib/auth/signup-checkpoint";

const fake = vi.hoisted(() => ({ available: vi.fn(), enabled: vi.fn(), getAll: vi.fn() }));
const config = { mode: "supabase" as const, appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_test", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: fake.getAll }) }));
vi.mock("@/lib/auth/signup-availability", () => ({ signupAvailable: fake.available }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => config }));
vi.mock("@/lib/auth/signup-http", () => ({ signupEnabled: fake.enabled }));
import SignupPage from "../../src/app/(auth)/cadastro/page";
import ConfirmPage from "../../src/app/(auth)/cadastro/confirmar/page";
import PasswordPage from "../../src/app/(auth)/cadastro/definir-senha/page";
import ResendPage from "../../src/app/(auth)/cadastro/reenviar/page";

describe("páginas preparadas de cadastro", () => {
  beforeEach(() => { vi.clearAllMocks(); fake.available.mockReturnValue(true); fake.enabled.mockReturnValue(true); fake.getAll.mockReturnValue([]); });
  it("não apresenta formulário quando cadastro está fechado", async () => {
    fake.available.mockReturnValue(false);
    const html = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Cadastro indisponível"); expect(html).not.toContain("/auth/iniciar-cadastro");
  });
  it("pede somente e-mail, senha e ciência legal, com reenvio separado", async () => {
    const html = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('name="email"'); expect(html).toContain('name="password"'); expect(html).toContain('name="acceptedLegal"');
    expect(html).toContain("/cadastro/reenviar"); expect(html).not.toContain('name="telefone"');
    const resend = renderToStaticMarkup(await ResendPage({ searchParams: Promise.resolve({}) }));
    expect(resend).toContain('value="signup"'); expect(resend).toContain('value="continuation"');
  });
  it("apresenta POST explícito sem incluir o token no HTML e protege sessão existente", async () => {
    fake.getAll.mockReturnValue([{ name: "sc-signup-continuation-otp", value: "a".repeat(64) }]);
    const html = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({ flow: "continuation" }) }));
    expect(html).toContain('action="/auth/continuar-cadastro"'); expect(html).not.toContain("a".repeat(64));
    fake.getAll.mockReturnValue([{ name: "sc-signup-continuation-otp", value: "a".repeat(64) }, { name: "sc-auth", value: "sessao" }]);
    const existing = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({ flow: "continuation" }) }));
    expect(existing).toContain('action="/auth/limpar-cadastro"'); expect(existing).not.toContain('action="/auth/continuar-cadastro"');
  });
  it("só permite definir senha com checkpoint válido e oferece retomada após troca", async () => {
    const absent = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({}) }));
    expect(absent).not.toContain('action="/auth/finalizar-cadastro"'); expect(absent).toContain("/cadastro/reenviar");
    const now = Date.now(), token = signSignupCheckpoint({ userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001", intentId: "30000000-0000-4000-8000-000000000001", issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: true, originPending: false }, config.stateSecret, now);
    fake.getAll.mockReturnValue([{ name: "sc-flow-signup-confirmation", value: token }]);
    const resume = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({}) }));
    expect(resume).toContain('action="/auth/finalizar-cadastro"'); expect(resume).not.toContain('name="password"'); expect(resume).not.toContain(token);
    const pendingOrigin = signSignupCheckpoint({ userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001", intentId: "30000000-0000-4000-8000-000000000001", issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: true, originPending: true }, config.stateSecret, now);
    fake.getAll.mockReturnValue([{ name: "sc-flow-signup-confirmation", value: pendingOrigin }]);
    const origin = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({}) }));
    expect(origin).toContain('name="acceptedOrigin"'); expect(origin).not.toContain('name="acceptedOrigin" type="checkbox" value="yes" checked');
  });
  it("mostra indisponibilidade sem oferecer reenvio quando o gate está fechado", async () => {
    fake.enabled.mockReturnValue(false);
    const html = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Confirmação indisponível");
    expect(html).toContain("Tente novamente mais tarde");
    expect(html).not.toContain("/cadastro/reenviar");
    expect(html).not.toContain('action="/auth/finalizar-cadastro"');
    expect(fake.getAll).not.toHaveBeenCalled();
  });
});
