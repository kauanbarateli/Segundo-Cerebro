import { describe, expect, it, vi } from "vitest";
import { resendSignupConfirmation, type SignupResendPorts } from "../../src/lib/auth/signup-resend-service";

function ports(): SignupResendPorts { return { subjectHash: () => "a".repeat(64), limit: vi.fn(async () => ({ allowed: true })), resend: vi.fn(async () => {}) }; }
describe("reenvio de confirmação", () => {
  it("mantém a resposta neutra se o provedor recusar ou falhar", async () => {
    const p = ports(); vi.mocked(p.resend).mockRejectedValueOnce(new Error("privado"));
    expect(await resendSignupConfirmation(p, "  Pessoa@EXAMPLE.com ", "signup")).toEqual({ status: "accepted" });
    expect(p.resend).toHaveBeenCalledWith("pessoa@example.com", "signup");
    expect(await resendSignupConfirmation(p, "pessoa@example.com", "continuation")).toEqual({ status: "accepted" });
  });
  it("recusa limite excedido e entrada inválida sem chamar o provedor", async () => {
    const p = ports(); expect(await resendSignupConfirmation(p, "a\u0000@example.com", "signup")).toEqual({ status: "invalid" });
    vi.mocked(p.limit).mockResolvedValue({ allowed: false });
    expect(await resendSignupConfirmation(p, "a@example.com", "signup")).toEqual({ status: "rate-limited" });
    expect(await resendSignupConfirmation(p, "a@example.com", "outro")).toEqual({ status: "invalid" });
    expect(p.resend).not.toHaveBeenCalled();
  });
});
