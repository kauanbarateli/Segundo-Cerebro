import { describe, expect, it, vi } from "vitest";
import { requestPublicSignup, type SignupRequestPorts } from "../../src/lib/auth/signup-service";

const payload = { email: " Pessoa@Example.com ", password: "uma senha longa", acceptedLegal: true, termsVersion: "t1", privacyVersion: "p1" };
const legal = { terms: "t1", privacy: "p1" };
function ports(): SignupRequestPorts {
  return { now: () => 1000, randomPointer: () => "a".repeat(43), bindingHash: () => "b".repeat(64), subjectHash: () => "c".repeat(64), limit: vi.fn(async () => ({ allowed: true })), createIntent: vi.fn(async () => {}), signup: vi.fn(async () => {}) };
}
describe("solicitação de cadastro", () => {
  it("emite intenção antes do provedor sem armazenar e-mail ou senha na intenção", async () => {
    const services = ports();
    expect(await requestPublicSignup(services, payload, legal)).toEqual({ status: "accepted" });
    expect(services.createIntent).toHaveBeenCalledWith({ bindingHash: "b".repeat(64), subjectHash: "c".repeat(64), termsVersion: "t1", privacyVersion: "p1", expiresAt: 1_801_000, origin: null, originVersion: null });
    expect(services.signup).toHaveBeenCalledWith({ email: "pessoa@example.com", password: payload.password, pointer: "a".repeat(43) });
    expect(vi.mocked(services.createIntent).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(services.signup).mock.invocationCallOrder[0]!);
  });
  it("mantém resposta neutra para falha do provedor e nunca usa a resposta como vínculo", async () => {
    const services = ports(); vi.mocked(services.signup).mockRejectedValue(new Error("conteúdo privado"));
    expect(await requestPublicSignup(services, payload, legal)).toEqual({ status: "accepted" });
  });
  it("falha fechado com limite, gerador inválido ou indisponibilidade da intenção", async () => {
    const limited = ports(); vi.mocked(limited.limit).mockResolvedValue({ allowed: false });
    expect(await requestPublicSignup(limited, payload, legal)).toEqual({ status: "rate-limited" });
    expect(limited.createIntent).not.toHaveBeenCalled(); expect(limited.signup).not.toHaveBeenCalled();
    const invalid = ports(); invalid.randomPointer = () => "previsível";
    expect(await requestPublicSignup(invalid, payload, legal)).toEqual({ status: "unavailable" }); expect(invalid.signup).not.toHaveBeenCalled();
    const failed = ports(); vi.mocked(failed.createIntent).mockRejectedValue(new Error("privado"));
    expect(await requestPublicSignup(failed, payload, legal)).toEqual({ status: "unavailable" }); expect(failed.signup).not.toHaveBeenCalled();
  });
  it("não chama serviços se o pedido básico for inválido", async () => {
    const services = ports();
    expect(await requestPublicSignup(services, { ...payload, role: "master" }, legal)).toEqual({ status: "invalid", field: "input" });
    expect(services.limit).not.toHaveBeenCalled(); expect(services.signup).not.toHaveBeenCalled();
  });
  it("somente inclui UTMs permitidas após consentimento explícito", async () => {
    const p = ports(), candidate = { utm_source: "busca", utm_campaign: "organização", referrer: "privado" };
    expect(await requestPublicSignup(p, payload, legal, { consented: false, candidate })).toEqual({ status: "accepted" });
    expect(p.createIntent).toHaveBeenLastCalledWith(expect.objectContaining({ origin: null, originVersion: null }));
    expect(await requestPublicSignup(p, payload, legal, { consented: true, candidate })).toEqual({ status: "accepted" });
    expect(p.createIntent).toHaveBeenLastCalledWith(expect.objectContaining({ origin: { utm_source: "busca", utm_campaign: "organização" }, originVersion: "signup-origin-v1" }));
  });
});
