import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {signSignupContext,SIGNUP_CONTEXT_COOKIE} from "../../src/lib/auth/signup-provisional";
import { signSignupCheckpoint } from "../../src/lib/auth/signup-checkpoint";
import { signSignupReconsent } from "../../src/lib/auth/signup-reconsent-checkpoint";
import { createSignupEmailLink } from "../../src/lib/auth/signup-email-link";
import { LEGAL_DOCUMENTS } from "../../src/lib/legal/documents";

const fake = vi.hoisted(() => ({ available: vi.fn(), enabled: vi.fn(), fence: vi.fn(), v2: vi.fn(), getAll: vi.fn() }));
const config = { mode: "supabase" as const, appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_test", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: fake.getAll }) }));
vi.mock("@/lib/auth/signup-availability", () => ({ signupAvailable: fake.available }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => config }));
vi.mock("@/lib/auth/signup-http", () => ({ signupEnabled: fake.enabled, signupSameBrowserEnabled:fake.enabled, signupFenceDeployed:fake.fence }));
vi.mock("@/lib/auth/origin-withdrawal-v2-gate", () => ({ originWithdrawalV2Enabled: fake.v2 }));
import SignupPage from "../../src/app/(auth)/cadastro/page";
import ConfirmPage from "../../src/app/(auth)/cadastro/confirmar/page";
import PasswordPage from "../../src/app/(auth)/cadastro/definir-senha/page";
import ResendPage from "../../src/app/(auth)/cadastro/reenviar/page";
import ReviewPage from "../../src/app/(auth)/cadastro/revisar/page";
import SignupOriginPage from "../../src/app/(auth)/cadastro/origem/page";

describe("páginas preparadas de cadastro", () => {
  beforeEach(() => { vi.clearAllMocks(); fake.available.mockReturnValue(true); fake.enabled.mockReturnValue(true); fake.fence.mockReturnValue(true); fake.v2.mockReturnValue(false); fake.getAll.mockReturnValue([]); });
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
    const proof = createSignupEmailLink("continuation", "a".repeat(64), config.stateSecret, Date.now());
    fake.getAll.mockReturnValue([{ name: "sc-signup-continuation-otp", value: proof.cookie }]);
    const html = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({ flow: "continuation", nonce: proof.nonce }) }));
    expect(html).toContain('action="/auth/continuar-cadastro"'); expect(html).not.toContain("a".repeat(64));
    expect(html).not.toContain(proof.cookie); expect(html).toContain(`value="${proof.nonce}"`);
    fake.getAll.mockReturnValue([{ name: "sc-signup-continuation-otp", value: proof.cookie }, { name: "sc-auth", value: "sessao" }]);
    const existing = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({ flow: "continuation", nonce: proof.nonce }) }));
    expect(existing).not.toContain('action="/auth/limpar-cadastro"'); expect(existing).toContain('action="/auth/continuar-cadastro"');
    const other = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({ flow: "continuation", nonce: "z".repeat(43) }) }));
    expect(other).not.toContain('action="/auth/limpar-cadastro"'); expect(other).not.toContain('action="/auth/continuar-cadastro"');
  });
  it("não oferece reenvio quando confirmação permanece indisponível", async () => {
    fake.available.mockReturnValue(false);
    const html = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("temporariamente indisponível"); expect(html).not.toContain("/cadastro/reenviar");
  });
  it("revisão só aparece após OTP e informa o descarte opcional de origem",async()=>{
    const absent=renderToStaticMarkup(await ReviewPage({searchParams:Promise.resolve({})}));expect(absent).not.toContain('action="/auth/revisar-cadastro"');
    const now=Date.now(),checkpoint={userId:"10000000-0000-4000-8000-000000000001",sessionId:"20000000-0000-4000-8000-000000000001",intentId:"30000000-0000-4000-8000-000000000001",issuedAt:now,expiresAt:now+600000,passwordConfirmed:false,originPending:true};
    fake.getAll.mockReturnValue([{name:"sc-flow-signup-confirmation",value:signSignupCheckpoint(checkpoint,config.stateSecret,now)}]);
    expect(renderToStaticMarkup(await ReviewPage({searchParams:Promise.resolve({})}))).not.toContain('action="/auth/revisar-cadastro"');
    const token=signSignupReconsent({checkpoint,terms:LEGAL_DOCUMENTS.termos.version,privacy:LEGAL_DOCUMENTS.privacidade.version},config.stateSecret,now);
    const context=signSignupContext({scope:"q".repeat(43),userId:checkpoint.userId,sessionId:checkpoint.sessionId},config.stateSecret);
    fake.getAll.mockReturnValue([{name:"sc-flow-signup-reconsent",value:token},{name:SIGNUP_CONTEXT_COOKIE,value:context}]);
    const present=renderToStaticMarkup(await ReviewPage({searchParams:Promise.resolve({})}));expect(present).toContain('action="/auth/revisar-cadastro"');expect(present).toContain('name="acceptedLegal"');expect(present).toContain('name="acceptedOrigin"');expect(present).toContain("será descartada");expect(present).not.toContain(token);
    const uncertain=renderToStaticMarkup(await ReviewPage({searchParams:Promise.resolve({status:"unknown"})}));expect(uncertain).not.toContain('action="/auth/revisar-cadastro"');expect(uncertain).toContain('action="/auth/limpar-revisao"');expect(uncertain).toContain("Encerrar sessão provisória e pedir novo link");expect(uncertain).toContain('href="/cadastro/reenviar"');expect(uncertain).toContain("Se não for possível confirmar a saída");
    fake.getAll.mockReturnValue([{name:SIGNUP_CONTEXT_COOKIE,value:context}]);
    const expired=renderToStaticMarkup(await ReviewPage({searchParams:Promise.resolve({})}));expect(expired).toContain('action="/auth/limpar-revisao"');expect(expired).toContain('href="/cadastro/reenviar"');expect(expired).not.toContain('action="/auth/revisar-cadastro"');
  });
  it("só oferece senha com checkpoint válido e não promete retomada por cookie antigo", async () => {
    const absent = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({}) }));
    expect(absent).not.toContain('action="/auth/finalizar-cadastro"'); expect(absent).toContain("/cadastro/revisar");
    const pendingWithoutCheckpoint = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({ status: "pending-reconciliation" }) }));
    expect(pendingWithoutCheckpoint).toContain('href="mailto:suporte@segundocerebroapp.com.br"');
    expect(pendingWithoutCheckpoint).not.toContain("/cadastro/reenviar");
    const now = Date.now(), token = signSignupCheckpoint({ userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001", intentId: "30000000-0000-4000-8000-000000000001", issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: true, originPending: false }, config.stateSecret, now);
    fake.getAll.mockReturnValue([{ name: "sc-flow-signup-confirmation", value: token }]);
    const resume = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({}) }));
    expect(resume).not.toContain('action="/auth/finalizar-cadastro"'); expect(resume).not.toContain('name="password"'); expect(resume).not.toContain(token); expect(resume).toContain("verificação adicional"); expect(resume).toContain("Fale com o suporte");
    const pendingOrigin = signSignupCheckpoint({ userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001", intentId: "30000000-0000-4000-8000-000000000001", issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: true, originPending: true }, config.stateSecret, now);
    fake.getAll.mockReturnValue([{ name: "sc-flow-signup-confirmation", value: pendingOrigin }]);
    const origin = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({}) }));
    expect(origin).not.toContain('name="acceptedOrigin"'); expect(origin).not.toContain('action="/auth/finalizar-cadastro"');
    const pendingOriginPage = renderToStaticMarkup(await PasswordPage({ searchParams: Promise.resolve({ status: "pending-reconciliation" }) }));
    expect(pendingOriginPage).toContain('href="mailto:suporte@segundocerebroapp.com.br"');
    expect(pendingOriginPage).toContain("solicitar a retirada do consentimento"); expect(pendingOriginPage).not.toContain('name="acceptedOrigin"');
  });
  it("permite acesso à retirada com contexto válido mesmo sem checkpoint e cadastro fechado",async()=>{
    fake.v2.mockReturnValue(true);fake.fence.mockReturnValue(true);fake.enabled.mockReturnValue(false);
    const now=Date.now(),context=signSignupContext({scope:"q".repeat(43),userId:"10000000-0000-4000-8000-000000000001",sessionId:"20000000-0000-4000-8000-000000000001"},config.stateSecret,now);
    fake.getAll.mockReturnValue([{name:SIGNUP_CONTEXT_COOKIE,value:context},{name:"sc-flow-signup-confirmation",value:"expired"}]);
    const html=renderToStaticMarkup(await SignupOriginPage());expect(html).toContain("Verificando sua escolha");expect(html).not.toContain(context);expect(html).not.toContain("expired");
    const password=renderToStaticMarkup(await PasswordPage({searchParams:Promise.resolve({})}));expect(password).toContain('href="/cadastro/origem"');expect(password).not.toContain('action="/auth/finalizar-cadastro"');
  });
  it("não expõe controles quando contexto ou gate da retirada estão ausentes",async()=>{
    fake.v2.mockReturnValue(true);const now=Date.now(),context=signSignupContext({scope:"q".repeat(43),userId:"10000000-0000-4000-8000-000000000001",sessionId:"20000000-0000-4000-8000-000000000001"},config.stateSecret,now-25*60*60*1000);
    fake.getAll.mockReturnValue([{name:SIGNUP_CONTEXT_COOKIE,value:context}]);const expired=renderToStaticMarkup(await SignupOriginPage());expect(expired).toContain("Não foi possível confirmar a sessão provisória");expect(expired).not.toContain("Verificando sua escolha");
    const valid=signSignupContext({scope:"q".repeat(43),userId:"10000000-0000-4000-8000-000000000001",sessionId:"20000000-0000-4000-8000-000000000001"},config.stateSecret,now);fake.getAll.mockReturnValue([{name:SIGNUP_CONTEXT_COOKIE,value:valid},{name:SIGNUP_CONTEXT_COOKIE,value:valid}]);const duplicate=renderToStaticMarkup(await SignupOriginPage());expect(duplicate).not.toContain("Verificando sua escolha");expect(duplicate).not.toContain(valid);
    fake.getAll.mockClear();fake.fence.mockReturnValue(false);const closed=renderToStaticMarkup(await SignupOriginPage());expect(closed).toContain("Não foi possível confirmar a sessão provisória");expect(fake.getAll).not.toHaveBeenCalled();
  });
  it("checkpoint passwordConfirmed não exibe retomada também no modo versionado",async()=>{
    fake.v2.mockReturnValue(true);const now=Date.now(),token=signSignupCheckpoint({userId:"10000000-0000-4000-8000-000000000001",sessionId:"20000000-0000-4000-8000-000000000001",intentId:"30000000-0000-4000-8000-000000000001",issuedAt:now,expiresAt:now+600000,passwordConfirmed:true,originPending:true},config.stateSecret,now);fake.getAll.mockReturnValue([{name:"sc-flow-signup-confirmation",value:token}]);
    const html=renderToStaticMarkup(await PasswordPage({searchParams:Promise.resolve({})}));expect(html).toContain("verificação adicional");expect(html).toContain('href="/cadastro/origem"');expect(html).not.toContain('action="/auth/finalizar-cadastro"');expect(html).not.toContain("Falta apenas concluir");
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
