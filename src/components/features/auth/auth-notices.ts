export type AuthFormKind = "sign-in" | "recovery" | "reset" | "change";

/** Only fixed public notices are rendered; query-string text is never reflected. */
export function authNotice(value: string | undefined, kind: AuthFormKind): { message: string; error: boolean } | null {
  if (kind === "sign-in") {
    if (value === "password-updated") return { message: "Senha atualizada. Entre novamente com sua nova senha.", error: false };
    if (value === "password-recheck") return { message: "A senha foi alterada. Entre novamente com a nova senha para confirmar sua sessão.", error: false };
    if (value === "password-updated-logout-incomplete") return { message: "Senha atualizada e saída local concluída. Não foi possível confirmar a revogação da sessão. Entre novamente e tente sair outra vez.", error: true };
    if (value === "session-required") return { message: "Entre na sua conta para continuar.", error: false };
    if (value === "signed-out") return { message: "Você saiu da sua conta.", error: false };
    if (value === "logout-incomplete") return { message: "Você saiu deste navegador. Não foi possível confirmar a saída da conta. Entre novamente e tente sair outra vez.", error: true };
  }
  if (kind === "recovery" && value === "recovery-invalid") return { message: "Este link de recuperação não é válido ou expirou. Solicite um novo link abaixo.", error: true };
  return null;
}

export function authParameter(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length <= 2048 ? value : undefined;
}
