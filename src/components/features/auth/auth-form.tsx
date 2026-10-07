"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { signInAction, recoverPasswordAction, updatePasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { authNotice, type AuthFormKind } from "./auth-notices";

const initialState: AuthActionState = { status: "idle" };
const copy = {
  "sign-in": { title: "Entrar", description: "Use o e-mail e a senha da sua conta.", submit: "Entrar", pending: "Entrando…" },
  recovery: { title: "Recuperar senha", description: "Informe seu e-mail para solicitar um link de recuperação.", submit: "Enviar link de recuperação", pending: "Enviando…" },
  reset: { title: "Definir nova senha", description: "Escolha uma nova senha para voltar à sua conta.", submit: "Salvar nova senha", pending: "Salvando…" },
  change: { title: "Trocar senha", description: "Defina uma nova senha. Depois, entre novamente nos seus aparelhos.", submit: "Salvar nova senha", pending: "Salvando…" },
} as const;

function PasswordField({ name, label, autoComplete, disabled, error }: {
  name: "password" | "confirmPassword" | "currentPassword";
  label: string; autoComplete: "current-password" | "new-password";
  disabled: boolean; error?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return <div className="auth-password">
    <Field name={name} label={label} type={revealed ? "text" : "password"} autoComplete={autoComplete}
      required disabled={disabled} minLength={autoComplete === "new-password" ? 12 : undefined} maxLength={autoComplete === "new-password" ? 72 : 1024}
      hint={name === "password" && autoComplete === "new-password" ? "Use pelo menos 12 caracteres, até o limite de 72 bytes. Acentos e emojis ocupam mais espaço." : undefined}
      error={error} autoCapitalize="none" spellCheck={false} />
    <Button className="auth-reveal" variant="ghost" disabled={disabled} aria-label={(revealed ? "Ocultar " : "Mostrar ") + label.toLocaleLowerCase("pt-BR")}
      aria-pressed={revealed} onClick={() => setRevealed((value) => !value)}>{revealed ? <Icons.EyeOff /> : <Icons.Eye />}</Button>
  </div>;
}

export function AuthForm({ kind, available, requiresCurrentPassword = false, completionPending = false, notice, returnTo }: {
  kind: AuthFormKind; available: boolean; requiresCurrentPassword?: boolean; completionPending?: boolean; notice?: string; returnTo?: string;
}) {
  const action = kind === "sign-in" ? signInAction : kind === "recovery" ? recoverPasswordAction : updatePasswordAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [email, setEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null), feedbackRef = useRef<HTMLDivElement>(null);
  const words = copy[kind], fixedNotice = authNotice(notice, kind);
  const passwordChange = kind === "change" || kind === "reset";
  const finishing = passwordChange && (state.completionPending ?? completionPending);
  const disabled = !available || pending;
  const recoverySent = kind === "recovery" && state.status === "success";

  useEffect(() => {
    if (state.status === "idle") return;
    const firstField = Object.keys(state.fieldErrors ?? {}).find((key) => state.fieldErrors?.[key as keyof NonNullable<AuthActionState["fieldErrors"]>]);
    const input = firstField ? formRef.current?.elements.namedItem(firstField) : null;
    if (input instanceof HTMLInputElement) input.focus();
    else feedbackRef.current?.focus();
  }, [state]);

  return <>
    <header className="auth-heading"><h1 id="auth-title">{finishing ? "Concluir troca de senha" : words.title}</h1><p>{finishing ? "Sua senha já foi alterada. Conclua a atualização da conta e a saída dos aparelhos antes de entrar novamente." : words.description}</p></header>
    {!available && <div className="auth-unavailable" role="alert"><Icons.Alert /><div><strong>Autenticação indisponível neste ambiente</strong><p>A entrada e a recuperação de senha ainda não foram configuradas. Não informe sua senha aqui.</p></div></div>}
    {available && fixedNotice && state.status === "idle" && <div className="auth-feedback" data-error={fixedNotice.error || undefined} role={fixedNotice.error ? "alert" : "status"}>{fixedNotice.message}</div>}
    {state.status !== "idle" && <div ref={feedbackRef} tabIndex={-1} className="auth-feedback" data-error={state.status === "error" || undefined} role={state.status === "error" ? "alert" : "status"}>
      <p>{state.message ?? (state.status === "error" ? "Não foi possível concluir. Tente novamente." : "Solicitação concluída.")}</p>
      {state.retryAfterSeconds !== undefined && state.retryAfterSeconds > 0 && <p>Aguarde {Math.ceil(state.retryAfterSeconds)} segundos antes de tentar novamente.</p>}
    </div>}
    {!recoverySent && <form ref={formRef} action={formAction} className="auth-form" aria-busy={pending || undefined}>
      {/* eslint-disable-next-line no-restricted-syntax -- Hidden transport value has no visual field, label or focus target. The server validates this destination. */}
      {returnTo && kind === "sign-in" && <input type="hidden" name="returnTo" value={returnTo} />}
      {!passwordChange && <Field name="email" label="E-mail" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false}
        required disabled={disabled} maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} error={state.fieldErrors?.email} />}
      {!finishing && kind === "change" && requiresCurrentPassword && <PasswordField name="currentPassword" label="Senha atual" autoComplete="current-password" disabled={disabled} error={state.fieldErrors?.currentPassword} />}
      {!finishing && kind !== "recovery" && <PasswordField name="password" label={passwordChange ? "Nova senha" : "Senha"} autoComplete={passwordChange ? "new-password" : "current-password"} disabled={disabled} error={state.fieldErrors?.password} />}
      {!finishing && passwordChange && <PasswordField name="confirmPassword" label="Confirmar nova senha" autoComplete="new-password" disabled={disabled} error={state.fieldErrors?.confirmPassword} />}
      <Button type="submit" variant="primary" loading={pending} disabled={!available}>{finishing ? pending ? "Concluindo…" : "Concluir proteção da conta" : pending ? words.pending : words.submit}</Button>
    </form>}
    <nav className="auth-links" aria-label="Opções de acesso">
      {kind === "sign-in" ? <Link href="/recuperar-senha">Esqueci a senha</Link> : <Link href="/entrar">Voltar para entrar</Link>}
      {kind === "reset" && <Link href="/recuperar-senha">Solicitar outro link</Link>}
    </nav>
    {kind === "sign-in" && <p className="auth-registration">O cadastro é fechado. Para solicitar acesso, fale com quem administra o Segundo Cérebro.</p>}
  </>;
}
