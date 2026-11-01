import { describe, expect, it, vi } from "vitest";
import { verifySignupConfirmation, type SignupConfirmationPorts } from "../../src/lib/auth/signup-confirmation-service";

const identity = { userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001", email: "Pessoa@Example.com" };
const intent = { intentId: "30000000-0000-4000-8000-000000000001", termsVersion: "v1", privacyVersion: "v2", state: "bound" as const, originPending: false };
const legal = { terms: "v1", privacy: "v2" }, token = "a".repeat(64);
function ports(): SignupConfirmationPorts {
  return { now: () => 1000, canBegin: () => true, limitToken: vi.fn(async () => ({ allowed: true })), verifyEmailProof: vi.fn(async () => identity), subjectHash: vi.fn(() => "b".repeat(64)), findBoundIntent: vi.fn(async () => intent), recoverVerifiedIntent: vi.fn(async () => intent), putCheckpoint: vi.fn(async () => {}), clearProvisionalSession: vi.fn(async () => {}) };
}

describe("confirmação explícita de cadastro", () => {
  it("prepara checkpoint somente para identidade e intenção verificadas", async () => {
    const p = ports(); expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "ready" });
    expect(p.subjectHash).toHaveBeenCalledWith("pessoa@example.com");
    expect(p.findBoundIntent).toHaveBeenCalledWith(identity.userId, identity.sessionId, "b".repeat(64));
    expect(p.putCheckpoint).toHaveBeenCalledWith({ userId: identity.userId, sessionId: identity.sessionId, intentId: intent.intentId, issuedAt: 1000, expiresAt: 601000, passwordConfirmed: false, originPending: false });
    expect(p.clearProvisionalSession).not.toHaveBeenCalled();
  });
  it("não inicia verificação com token inválido ou tentativa limitada", async () => {
    const p = ports(); expect(await verifySignupConfirmation(p, "inválido", legal)).toEqual({ status: "invalid" });
    vi.mocked(p.limitToken).mockResolvedValue({ allowed: false });
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "rate-limited" });
    expect(p.verifyEmailProof).not.toHaveBeenCalled(); expect(p.clearProvisionalSession).not.toHaveBeenCalled();
  });
  it("não substitui nem limpa uma sessão pré-existente", async () => {
    const p = ports(); p.canBegin = () => false;
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "unavailable" });
    expect(p.verifyEmailProof).not.toHaveBeenCalled(); expect(p.clearProvisionalSession).not.toHaveBeenCalled();
  });
  it("recupera intenção ausente somente após verificar o OTP, sem admitir a conta", async () => {
    const p = ports(); vi.mocked(p.findBoundIntent).mockResolvedValue(null);
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "ready" });
    expect(p.recoverVerifiedIntent).toHaveBeenCalledWith(identity.userId, identity.sessionId, "b".repeat(64), "v1", "v2");
    expect(vi.mocked(p.verifyEmailProof).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(p.recoverVerifiedIntent).mock.invocationCallOrder[0]!);
  });
  it("recusa versão legal alterada e não divulga erros do provedor", async () => {
    const p = ports(); expect(await verifySignupConfirmation(p, token, { ...legal, terms: "outra" })).toEqual({ status: "invalid" });
    expect(p.clearProvisionalSession).toHaveBeenCalledOnce();
    vi.mocked(p.verifyEmailProof).mockRejectedValue(new Error("informação privada"));
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "unavailable" });
    expect(p.clearProvisionalSession).toHaveBeenCalledTimes(2);
  });
  it("não informa confirmação quando a limpeza da sessão provisória falha", async () => {
    const p = ports(); vi.mocked(p.findBoundIntent).mockResolvedValue(null); vi.mocked(p.recoverVerifiedIntent).mockRejectedValue(new Error("privado")); vi.mocked(p.clearProvisionalSession).mockRejectedValue(new Error("privado"));
    expect(await verifySignupConfirmation(p, token, legal)).toEqual({ status: "unavailable" });
  });
});
