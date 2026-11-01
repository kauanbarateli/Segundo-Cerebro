import { describe, expect, it, vi } from "vitest";
import { completePublicSignup, type SignupCompletionPorts } from "../../src/lib/auth/signup-completion-service";

const userId = "10000000-0000-4000-8000-000000000001", sessionId = "20000000-0000-4000-8000-000000000001", intentId = "30000000-0000-4000-8000-000000000001";
const identity = { userId, sessionId, email: "pessoa@example.com" }, checkpoint = { userId, sessionId, intentId, issuedAt: 1000, expiresAt: 601000, passwordConfirmed: false };
const input = { password: "uma senha longa", acceptedLegal: true, termsVersion: "v1", privacyVersion: "v2" }, legal = { terms: "v1", privacy: "v2" };
function ports(): SignupCompletionPorts {
  return { now: () => 2000, readCheckpoint: () => checkpoint, readVerifiedIdentity: vi.fn(async () => identity), subjectHash: () => "a".repeat(64), limit: vi.fn(async () => ({ allowed: true })), findBoundIntent: vi.fn(async () => ({ intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound" as const })), updatePassword: vi.fn(async () => "updated" as const), putCheckpoint: vi.fn(async () => {}), attestPasswordReset: vi.fn(async () => {}), complete: vi.fn(async () => "admitted" as const), clearCheckpoint: vi.fn(async () => {}) };
}
describe("conclusão de cadastro com prova de senha", () => {
  it("só atesta após definir senha e guardar checkpoint da sessão verificada", async () => {
    const p = ports(); expect(await completePublicSignup(p, input, legal)).toEqual({ status: "completed" });
    expect(p.putCheckpoint).toHaveBeenCalledWith({ ...checkpoint, passwordConfirmed: true });
    expect(vi.mocked(p.putCheckpoint).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(p.attestPasswordReset).mock.invocationCallOrder[0]!);
    expect(p.complete).toHaveBeenCalledWith(userId, sessionId, intentId, "a".repeat(64), "v1", "v2");
    expect(p.clearCheckpoint).toHaveBeenCalledOnce();
  });
  it("não admite sem checkpoint, sessão correspondente ou ciência legal", async () => {
    const p = ports(); p.readCheckpoint = () => null;
    expect(await completePublicSignup(p, input, legal)).toEqual({ status: "needs-verification" });
    p.readCheckpoint = () => checkpoint; vi.mocked(p.readVerifiedIdentity).mockResolvedValue({ ...identity, sessionId: "outra" });
    expect(await completePublicSignup(p, input, legal)).toEqual({ status: "needs-verification" });
    vi.mocked(p.readVerifiedIdentity).mockResolvedValue(identity);
    expect(await completePublicSignup(p, { ...input, acceptedLegal: false }, legal)).toEqual({ status: "invalid" });
    expect(p.updatePassword).not.toHaveBeenCalled(); expect(p.attestPasswordReset).not.toHaveBeenCalled();
  });
  it("não transforma rejeição ou resultado incerto da senha em atestado", async () => {
    const p = ports(); vi.mocked(p.updatePassword).mockResolvedValueOnce("rejected").mockResolvedValueOnce("unknown");
    expect(await completePublicSignup(p, input, legal)).toEqual({ status: "password-invalid" });
    expect(await completePublicSignup(p, input, legal)).toEqual({ status: "needs-verification" });
    expect(p.attestPasswordReset).not.toHaveBeenCalled(); expect(p.complete).not.toHaveBeenCalled();
  });
  it("retoma depois de falha no banco sem alterar a senha outra vez", async () => {
    const p = ports(); vi.mocked(p.attestPasswordReset).mockRejectedValueOnce(new Error("privado"));
    expect(await completePublicSignup(p, input, legal)).toEqual({ status: "unavailable" });
    p.readCheckpoint = () => ({ ...checkpoint, passwordConfirmed: true });
    expect(await completePublicSignup(p, input, legal)).toEqual({ status: "completed" });
    expect(p.updatePassword).toHaveBeenCalledOnce();
  });
  it("confirma commit já consumido sem refazer senha ou evento", async () => {
    const p = ports(); vi.mocked(p.findBoundIntent).mockResolvedValue({ intentId, termsVersion: "v1", privacyVersion: "v2", state: "consumed" });
    vi.mocked(p.complete).mockResolvedValue("already_admitted");
    expect(await completePublicSignup(p, input, legal)).toEqual({ status: "completed" });
    expect(p.updatePassword).not.toHaveBeenCalled(); expect(p.attestPasswordReset).not.toHaveBeenCalled();
  });
});
