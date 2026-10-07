import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthActionState } from "../../src/lib/auth/types";

const actionResult = vi.hoisted(() => ({ state: { status: "idle" } as AuthActionState, pending: false }));

vi.mock("../../src/lib/auth/actions", () => ({
  signInAction: vi.fn(), recoverPasswordAction: vi.fn(), updatePasswordAction: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: () => [actionResult.state, () => {}, actionResult.pending],
}));

import { AuthForm } from "../../src/components/features/auth/auth-form";

function render(props: Parameters<typeof AuthForm>[0]) {
  return renderToStaticMarkup(createElement(AuthForm, props));
}
function namedInputs(html: string) {
  return [...html.matchAll(/<input\b[^>]*\bname="([^"]+)"[^>]*>/g)].map((match) => match[1]);
}

describe("estados renderizados dos formulários de autenticação", () => {
  beforeEach(() => { actionResult.state = { status: "idle" }; actionResult.pending = false; });

  it.each(["change", "reset"] as const)("retoma %s pelo contexto do servidor sem pedir outra senha", (kind) => {
    const html = render({ kind, available: true, completionPending: true, requiresCurrentPassword: true });
    expect(html).toContain("Concluir proteção da conta");
    expect(html).toContain("Sua senha já foi alterada.");
    expect(namedInputs(html)).toEqual([]);
    expect(html).not.toContain("completionPending");
    expect(html).not.toMatch(/\brequired(?:=|\s|>)/);
  });

  it("permite finalizar após a action alterar a senha e falhar em uma etapa posterior", () => {
    actionResult.state = { status: "error", message: "Conclua a proteção da conta.", completionPending: true };
    const html = render({ kind: "change", available: true, requiresCurrentPassword: true });
    expect(namedInputs(html)).toEqual([]);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Concluir proteção da conta");
    expect(html).not.toMatch(/<button\b[^>]*\bdisabled/);
  });

  it("respeita uma resposta explícita que invalida o contexto de retomada", () => {
    actionResult.state = { status: "error", message: "Confirme os dados novamente.", completionPending: false };
    expect(namedInputs(render({ kind: "change", available: true, completionPending: true, requiresCurrentPassword: true })))
      .toEqual(["currentPassword", "password", "confirmPassword"]);
  });

  it("mantém o estado de conclusão em uma resposta de limitação confirmada pelo servidor", () => {
    actionResult.state = { status: "error", message: "Muitas tentativas.", retryAfterSeconds: 30, completionPending: true };
    const html = render({ kind: "change", available: true, requiresCurrentPassword: true });
    expect(namedInputs(html)).toEqual([]);
    expect(html).toContain("Aguarde 30 segundos");
    expect(html).toContain("Concluir proteção da conta");
  });

  it("exige a senha atual apenas quando a guarda determina", () => {
    expect(namedInputs(render({ kind: "change", available: true, requiresCurrentPassword: true })))
      .toEqual(["currentPassword", "password", "confirmPassword"]);
    expect(namedInputs(render({ kind: "reset", available: true }))).toEqual(["password", "confirmPassword"]);
  });

  it("bloqueia a finalização duplicada durante o envio", () => {
    actionResult.pending = true;
    const html = render({ kind: "change", available: true, completionPending: true });
    expect(html).toMatch(/<form\b[^>]*aria-busy="true"/);
    expect(html).toMatch(/<button\b[^>]*\bdisabled/);
    expect(html).toContain("Concluindo…");
  });

  it("não aceita credenciais nem apresenta sucesso de URL quando indisponível", () => {
    const html = render({ kind: "sign-in", available: false, notice: "password-updated" });
    expect(html).toContain("Não informe sua senha aqui.");
    expect(html).not.toContain("Senha atualizada.");
    const inputs = html.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    expect(inputs.every((input) => /\bdisabled/.test(input))).toBe(true);
    expect(html).toMatch(/<button\b[^>]*type="submit"[^>]*\bdisabled/);
  });

  it("substitui o formulário pelo retorno genérico da recuperação", () => {
    actionResult.state = { status: "success", message: "Se houver uma conta, você receberá um e-mail." };
    const html = render({ kind: "recovery", available: true });
    expect(html).toContain('role="status"');
    expect(html).toContain("Se houver uma conta, você receberá um e-mail.");
    expect(html).not.toContain("<form");
    expect(html).toContain("Voltar para entrar");
  });
});
