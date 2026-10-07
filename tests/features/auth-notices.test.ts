import { describe, expect, it } from "vitest";
import { authNotice, authParameter } from "../../src/components/features/auth/auth-notices";

describe("mensagens públicas de autenticação", () => {
  it("não reflete texto da URL", () => {
    for (const value of [undefined, "<script>alert(1)</script>", "senha=secreta", "unknown"]) expect(authNotice(value, "sign-in")).toBeNull();
  });
  it("restringe avisos ao fluxo correspondente", () => {
    expect(authNotice("password-updated", "sign-in")).toEqual({ message: "Senha atualizada. Entre novamente com sua nova senha.", error: false });
    expect(authNotice("password-updated", "recovery")).toBeNull();
    expect(authNotice("password-recheck", "sign-in")?.message).toBe("A senha foi alterada. Entre novamente com a nova senha para confirmar sua sessão.");
    expect(authNotice("password-updated-logout-incomplete", "sign-in")).toEqual({ message: "Senha atualizada e saída local concluída. Não foi possível confirmar a revogação da sessão. Entre novamente e tente sair outra vez.", error: true });
    expect(authNotice("password-updated-logout-incomplete", "recovery")).toBeNull();
    expect(authNotice("recovery-invalid", "sign-in")).toBeNull();
    expect(authNotice("recovery-invalid", "recovery")?.error).toBe(true);
  });
  it("mantém avisos de sessão e saída sem dados da conta", () => {
    expect(authNotice("session-required", "sign-in")?.message).toBe("Entre na sua conta para continuar.");
    expect(authNotice("signed-out", "sign-in")?.error).toBe(false);
    expect(authNotice("logout-incomplete", "sign-in")).toEqual({ message: "Você saiu deste navegador. Não foi possível confirmar a saída da conta. Entre novamente e tente sair outra vez.", error: true });
  });
  it("descarta parâmetros repetidos e excessivos antes de encaminhar à action", () => {
    expect(authParameter(["/tarefas", "https://example.invalid"])).toBeUndefined();
    expect(authParameter("x".repeat(2049))).toBeUndefined();
    expect(authParameter(undefined)).toBeUndefined();
    expect(authParameter("/tarefas?view=hoje")).toBe("/tarefas?view=hoje");
  });
});
