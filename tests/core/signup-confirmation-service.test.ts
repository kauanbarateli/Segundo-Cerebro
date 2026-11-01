import { describe, expect, it, vi } from "vitest";
import { verifySignupConfirmation, type SignupConfirmationPorts } from "../../src/lib/auth/signup-confirmation-service";

const identity = { userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001", email: "Pessoa@Example.com" };
const intent = { intentId: "30000000-0000-4000-8000-000000000001", termsVersion: "v1", privacyVersion: "v2" };
const legal = { terms: "v1", privacy: "v2" }, token = "a".repeat(64);
function ports(): SignupConfirmationPorts {
  return { now: () => 1000, limitToken: vi.fn(async () => ({ allowed: true })), verifySignupToken: vi.fn(async () => identity), subjectHash: vi.fn(() => "b".repeat(64)), findBoundIntent: vi.fn(async () => intent), putCheckpoint: vi.fn(async () => {}), clearProvisionalSession: vi.fn(async () => {}) };
}

describe("confirmação explícita de cadastro", () => {
  it("prepara checkpoint somente para identidade e intenção verificadas", async () => {
    const p = ports(); expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "ready" });
    expect(p.subjectHash).toHaveBeenCalledWith("pessoa@example.com");
    expect(p.findBoundIntent).toHaveBeenCalledWith(identity.userId, identity.sessionId, "b".repeat(64));
    expect(p.putCheckpoint).toHaveBeenCalledWith({ userId: identity.userId, sessionId: identity.sessionId, intentId: intent.intentId, issuedAt: 1000, expiresAt: 601000 });
    expect(p.clearProvisionalSession).not.toHaveBeenCalled();
  });
  it("não inicia verificação com token inválido ou tentativa limitada", async () => {
    const p = ports(); expect(await verifySignupConfirmation(p, "inválido", legal)).toEqual({ status: "invalid" });
    vi.mocked(p.limitToken).mockResolvedValue({ allowed: false });
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "rate-limited" });
    expect(p.verifySignupToken).not.toHaveBeenCalled(); expect(p.clearProvisionalSession).not.toHaveBeenCalled();
  });
  it("não admite conta existente sem vínculo e limpa a sessão provisória", async () => {
    const p = ports(); vi.mocked(p.findBoundIntent).mockResolvedValue(null);
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "invalid" });
    expect(p.putCheckpoint).not.toHaveBeenCalled(); expect(p.clearProvisionalSession).toHaveBeenCalledOnce();
  });
  it("recusa versão legal alterada e não divulga erros do provedor", async () => {
    const p = ports(); expect(await verifySignupConfirmation(p, token, { ...legal, terms: "outra" })).toEqual({ status: "invalid" });
    expect(p.clearProvisionalSession).toHaveBeenCalledOnce();
    vi.mocked(p.verifySignupToken).mockRejectedValue(new Error("informação privada"));
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "unavailable" });
    expect(p.clearProvisionalSession).toHaveBeenCalledTimes(2);
  });
  it("não informa confirmação quando a limpeza da sessão provisória falha", async () => {
    const p = ports(); vi.mocked(p.findBoundIntent).mockResolvedValue(null); vi.mocked(p.clearProvisionalSession).mockRejectedValue(new Error("privado"));
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "unavailable" });
  });
});
