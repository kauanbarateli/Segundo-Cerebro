import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";

const doubles = vi.hoisted(() => ({ rpc: vi.fn(), signup: vi.fn(), provider: vi.fn(), trusted: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/clients", () => ({ createPrivilegedClient: () => ({ rpc: doubles.rpc }) }));
vi.mock("@/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: doubles.trusted }));
vi.mock("@supabase/supabase-js", () => ({ createClient: doubles.provider }));
// This test-only fixture changes the release flag, so positive cases test the
// original wire under a simulated authorization; production remains disabled.
vi.mock("@/lib/auth/signup-http", async () => import("../fixtures/signup-http-enabled"));
import { createSignupRequestPorts } from "../../src/lib/auth/signup-runtime";
import { requestPublicSignup } from "../../src/lib/auth/signup-service";
import { signupSameBrowserEnabled, signupRpc as simulatedSignupRpc } from "../fixtures/signup-http-enabled";

const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_private", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
const input = { email: "a@example.invalid", password: "senha longa de teste", acceptedLegal: true, termsVersion: "v1", privacyVersion: "v2" };
const legal = { terms: "v1", privacy: "v2" };

describe("adaptador servidor para solicitação de cadastro", () => {
  it("vincula o fixture ao código real com única mudança de autorização e caminho do import", () => {
    const actual = readFileSync(new URL("../../src/lib/auth/signup-http.ts", import.meta.url), "utf8");
    const fixture = readFileSync(new URL("../fixtures/signup-http-enabled.ts", import.meta.url), "utf8");
    expect(actual).toContain("const TRANSACTIONAL_SIGNUP_RELEASED: boolean = false;");
    expect(fixture).toBe(actual.replace("const TRANSACTIONAL_SIGNUP_RELEASED: boolean = false;", "const TRANSACTIONAL_SIGNUP_RELEASED: boolean = true;").replace('from "./database-origin-server"', 'from "@/lib/auth/database-origin-server"').replace('from "./config"', 'from "@/lib/auth/config"').replace('from "./signup-fence-wire"', 'from "@/lib/auth/signup-fence-wire"').replace('from "./origin-withdrawal-v2-gate"', 'from "@/lib/auth/origin-withdrawal-v2-gate"'));
  });
  beforeEach(() => {
    vi.stubEnv("PUBLIC_SIGNUP_ENABLED", "true"); doubles.trusted.mockReturnValue(true);
    doubles.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    doubles.signup.mockResolvedValue({ data: {}, error: null }); doubles.provider.mockReturnValue({ auth: { signUp: doubles.signup } });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json("10000000-0000-4000-8000-000000000001")));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("fecha por padrão e não chama o provedor com destino não confiável", async () => {
    vi.stubEnv("PUBLIC_SIGNUP_ENABLED", "false");
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal)).toEqual({ status: "unavailable" });
    expect(doubles.rpc).not.toHaveBeenCalled(); expect(doubles.signup).not.toHaveBeenCalled();
    vi.stubEnv("PUBLIC_SIGNUP_ENABLED", "true"); doubles.trusted.mockReturnValue(false);
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal)).toEqual({ status: "unavailable" });
    expect(doubles.signup).not.toHaveBeenCalled();
  });
  it("mantém a guarda de duplicatas fechada mesmo se o gate transacional for simulado como aberto",async()=>{
    expect(signupSameBrowserEnabled(config)).toBe(false);
    await expect(simulatedSignupRpc(config,"signup_browser_find",{p_browser:"a".repeat(64)})).rejects.toThrow("Signup unavailable.");expect(fetch).not.toHaveBeenCalled();
  });
  it("cria intenção sem credenciais e usa somente o destino fixo de confirmação", async () => {
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal)).toEqual({ status: "accepted" });
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(String(call[0])).toBe("https://db.example.invalid/rest/v1/rpc/signup_intent_create");
    const options = call[1] as RequestInit, body = String(options.body);
    expect(options.redirect).toBe("error"); expect(options.cache).toBe("no-store");
    expect(body).not.toContain(input.email); expect(body).not.toContain(input.password);
    expect(doubles.signup).toHaveBeenCalledWith(expect.objectContaining({ email: input.email, password: input.password, options: { data: { sc_signup_pointer: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) }, emailRedirectTo: "https://app.example.invalid/auth/confirmar-cadastro" } }));
    expect(doubles.provider).toHaveBeenCalledWith(config.supabaseUrl, config.publishableKey, expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
  });
  it("envia origem nula sem consentimento e apenas UTMs permitidas com consentimento", async () => {
    const candidate = { utm_source: "busca", utm_campaign: "organização", referrer: "privado", email: "private@example.invalid" };
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal, { consented: false, candidate })).toEqual({ status: "accepted" });
    let options = vi.mocked(fetch).mock.calls[0]![1] as RequestInit;
    let body = JSON.parse(String(options.body));
    expect(body).toMatchObject({ p_origin: null, p_origin_version: null });
    expect(String(options.body)).not.toContain("privado");

    vi.mocked(fetch).mockClear();
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal, { consented: true, candidate })).toEqual({ status: "accepted" });
    options = vi.mocked(fetch).mock.calls[0]![1] as RequestInit;
    body = JSON.parse(String(options.body));
    expect(body).toMatchObject({ p_origin: { utm_source: "busca", utm_campaign: "organização" }, p_origin_version: "signup-origin-v1" });
    expect(Object.keys(body.p_origin).sort()).toEqual(["utm_campaign", "utm_source"]);
    expect(String(options.body)).not.toContain("privado");
    expect(String(options.body)).not.toContain("private@example.invalid");
  });
  it("não chama Auth se o banco ou o limite forem indisponíveis", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal)).toEqual({ status: "unavailable" });
    expect(doubles.signup).not.toHaveBeenCalled();
    doubles.rpc.mockResolvedValue({ data: null, error: { message: "privado" } });
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal)).toEqual({ status: "unavailable" });
    expect(doubles.signup).not.toHaveBeenCalled();
  });
  it("recusa respostas de intenção excessivas ou de tipo inesperado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(2048), { headers: { "content-type": "application/json" } })));
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal)).toEqual({ status: "unavailable" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response('"10000000-0000-4000-8000-000000000001"', { headers: { "content-type": "application/json-other" } })));
    expect(await requestPublicSignup(createSignupRequestPorts(config), input, legal)).toEqual({ status: "unavailable" });
    expect(doubles.signup).not.toHaveBeenCalled();
  });
});
