import { describe, expect, it } from "vitest";
import { decidePublicAdmission, type AdmissionEvidence } from "../../src/core/admission/public-admission";

const valid = (): AdmissionEvidence => ({
  now: 100, signupEnabled: true,
  identity: { userId: "user-a", sessionId: "session-a", emailVerified: true, sessionValid: true, moderation: "allowed" },
  admission: { userId: "user-a", origin: "public", state: "pending" },
  intent: { id: "intent-a", userId: "user-a", state: "pending", expiresAt: 101 },
  legal: { accepted: true, termsVersion: "v1", privacyVersion: "v2" }, currentLegal: { termsVersion: "v1", privacyVersion: "v2" },
  passwordProof: { userId: "user-a", sessionId: "session-a", method: "reset-after-confirmation", valid: true },
});

describe("decisão de admissão pública baseada em evidência confiável", () => {
  it("planeja admissão somente com sessão, intenção, versões legais e prova vinculadas", () => {
    expect(decidePublicAdmission(valid())).toEqual({ kind: "admit", userId: "user-a", intentId: "intent-a", termsVersion: "v1", privacyVersion: "v2" });
  });
  it("recusa sessão inválida, e-mail não confirmado e moderação bloqueada", () => {
    const input = valid(), identity = input.identity!;
    for (const changed of [{ ...identity, sessionValid: false }, { ...identity, emailVerified: false }]) expect(decidePublicAdmission({ ...input, identity: changed }).kind).toBe("deny");
    expect(decidePublicAdmission({ ...input, identity: { ...identity, moderation: "blocked" } })).toEqual({ kind: "deny", reason: "moderation" });
  });
  it("preserva contas existentes e não reabre pessoa bloqueada ou altera seu estado", () => {
    const input = valid();
    expect(decidePublicAdmission({ ...input, signupEnabled: false, admission: { userId: "user-a", origin: "legacy", state: "admitted" } })).toEqual({ kind: "unchanged" });
    expect(decidePublicAdmission({ ...input, signupEnabled: false, admission: { userId: "user-a", origin: "admin", state: "pending" } })).toEqual({ kind: "unchanged" });
    expect(decidePublicAdmission({ ...input, identity: { ...input.identity!, moderation: "blocked" }, admission: { userId: "user-a", origin: "legacy", state: "admitted" } })).toEqual({ kind: "deny", reason: "moderation" });
  });
  it("recusa inscrição direta, intenção de outra pessoa, vencida ou já consumida", () => {
    const input = valid(), intent = input.intent!;
    for (const changed of [null, { ...intent, userId: "user-b" }, { ...intent, expiresAt: 100 }, { ...intent, state: "consumed" as const }]) expect(decidePublicAdmission({ ...input, intent: changed })).toEqual({ kind: "deny", reason: "intent" });
    expect(decidePublicAdmission({ ...input, signupEnabled: false })).toEqual({ kind: "deny", reason: "disabled" });
  });
  it("não admite sem ciência legal atual e prova de senha da mesma sessão", () => {
    const input = valid();
    expect(decidePublicAdmission({ ...input, legal: { ...input.legal!, termsVersion: "antiga" } })).toEqual({ kind: "deny", reason: "legal" });
    for (const proof of [null, { ...input.passwordProof!, sessionId: "session-b" }, { ...input.passwordProof!, userId: "user-b" }, { ...input.passwordProof!, valid: false }]) expect(decidePublicAdmission({ ...input, passwordProof: proof })).toEqual({ kind: "deny", reason: "password-proof" });
  });
});
