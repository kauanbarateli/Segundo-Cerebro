"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SignupLegal, SignupOriginChoice, SignupPassword } from "./signup-fields";
import { classifySignupReply, type SignupReply } from "./signup-response";

/** No UTM/credential persistence: the mounted form retains values in memory. */
export function SignupForm({ termsVersion, privacyVersion, initialMessage, initialSent = false }: { termsVersion: string; privacyVersion: string; initialMessage?: string; initialSent?: boolean }) {
  const [reply, setReply] = useState<SignupReply | null>(null), [busy, setBusy] = useState(false);
  const [showInitial, setShowInitial] = useState(true);
  const inFlight = useRef(false), terminalOrUncertain = useRef(initialSent), feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (reply) feedback.current?.focus(); }, [reply]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || terminalOrUncertain.current) return;
    const body = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string") { setReply("invalid"); return; }
      body.append(name, value);
    }
    inFlight.current = true; setBusy(true); setReply(null); setShowInitial(false);
    try {
      const response = await fetch("/auth/iniciar-cadastro", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"}, body, cache:"no-store", redirect:"error", referrerPolicy:"no-referrer", signal:AbortSignal.timeout(30_000) });
      let payload: unknown = null;
      try { payload = await response.json(); } catch { /* malformed response stays uncertain */ }
      const result = classifySignupReply(response.ok, payload);
      if (result === "sent" || result === "uncertain") terminalOrUncertain.current = true;
      setReply(result);
    } catch { terminalOrUncertain.current = true; setReply("uncertain"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <>
    {showInitial && initialMessage && <div className="auth-feedback" role={initialSent ? "status" : "alert"}><p>{initialMessage}</p></div>}
    {reply && <div className="auth-feedback" role={reply === "sent" ? "status" : "alert"} tabIndex={-1} ref={feedback}><p>{
      reply === "sent" ? "Se for possível criar uma conta com esse endereço, você receberá um e-mail com as próximas etapas." :
      reply === "invalid" ? "Confira o e-mail, a senha e a confirmação dos termos." :
      reply === "wait" ? "Aguarde um pouco antes de tentar novamente." :
      "Não foi possível confirmar o envio. Verifique seu e-mail ou solicite outra confirmação."
    }</p>{reply === "uncertain" && <p><Link href="/cadastro/reenviar">Reenviar confirmação</Link></p>}</div>}
    {!initialSent && reply !== "sent" && <form className="auth-form" action="/auth/iniciar-cadastro" method="post" onSubmit={submit}>
      <fieldset className="auth-form__fields" disabled={busy || reply === "uncertain"}>
        <Field name="email" label="E-mail" type="email" autoComplete="email" required maxLength={254} />
        <SignupPassword />
        <SignupLegal termsVersion={termsVersion} privacyVersion={privacyVersion} />
        <SignupOriginChoice />
        <Button type="submit" variant="primary" loading={busy}>Criar conta</Button>
      </fieldset>
    </form>}
  </>;
}
