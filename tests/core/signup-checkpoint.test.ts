import { describe, expect, it } from "vitest";
import { signSignupCheckpoint, verifySignupCheckpoint } from "../../src/lib/auth/signup-checkpoint";

const secret = "s".repeat(32), time = 1000;
const state = { userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001", intentId: "30000000-0000-4000-8000-000000000001", issuedAt: time, expiresAt: time + 600_000 };

describe("checkpoint de confirmação de cadastro", () => {
  it("vincula identidade, sessão e intenção sem conter senha ou token OTP", () => {
    const token = signSignupCheckpoint(state, secret, time);
    expect(verifySignupCheckpoint(token, secret, time + 1)).toEqual(state);
    expect(JSON.parse(Buffer.from(token.split(".")[0]!, "base64url").toString())).toEqual(state);
  });
  it("recusa adulteração, segredo incorreto, expiração e tempo fora da janela", () => {
    const token = signSignupCheckpoint(state, secret, time);
    expect(verifySignupCheckpoint(`${token.slice(0, -1)}!`, secret, time)).toBeNull();
    expect(verifySignupCheckpoint(token, "x".repeat(32), time)).toBeNull();
    expect(verifySignupCheckpoint(token, secret, state.expiresAt)).toBeNull();
    expect(verifySignupCheckpoint(token, secret, time - 1)).toBeNull();
    expect(() => signSignupCheckpoint({ ...state, expiresAt: state.expiresAt + 1 }, secret, time)).toThrow();
    expect(() => signSignupCheckpoint(state, "curto", time)).toThrow();
  });
  it("não confunde com um fluxo de recuperação de senha", async () => {
    const { signFlow } = await import("../../src/lib/auth/flow-state");
    const recovery = signFlow({ kind: "recovery-session", userId: state.userId, sessionId: state.sessionId, expiresAt: time + 1000 }, secret);
    expect(verifySignupCheckpoint(recovery, secret, time)).toBeNull();
  });
});
