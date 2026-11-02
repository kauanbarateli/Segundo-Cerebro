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
  const [hydrated, setHydrated] = useState(false);
  const [showInitial, setShowInitial] = useState(true);
  const inFlight = useRef(false), terminalOrUncertain = useRef(initialSent), feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (reply) feedback.current?.focus(); }, [reply]);
  useEffect(() => { setHydrated(true); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || terminalOrUncertain.current) return;
    const body = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string") { setReply("invalid"); return; }
      body.append(name, value);
    }
    inFlight.current = true; setBusy(true); setReply(null); setShowInitial(false);
    let submitted = false;
    try {
      // Rotate the HttpOnly attempt secret before a new password POST. Older
      // links continue via OTP plus the password-reset fence.
      const preparation = await fetch("/auth/preparar-cadastro", { method:"POST", cache:"no-store", redirect:"error", referrerPolicy:"no-referrer", signal:AbortSignal.timeout(10_000) });
      if (!preparation.ok) { setReply("unavailable"); return; }
      const prepared:unknown=await preparation.json();
      if(!prepared || typeof prepared!=="object" || Array.isArray(prepared) || Object.keys(prepared).sort().join(",")!=="attempt,ok" || (prepared as {ok?:unknown}).ok!==true || typeof (prepared as {attempt?:unknown}).attempt!=="string" || !/^[a-f0-9]{64}$/.test((prepared as {attempt:string}).attempt)) {setReply("unavailable");return;}
      submitted = true;
      const response = await fetch("/auth/iniciar-cadastro", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json","X-Signup-Attempt":(prepared as {attempt:string}).attempt}, body, cache:"no-store", redirect:"error", referrerPolicy:"no-referrer", signal:AbortSignal.timeout(30_000) });
      let payload: unknown = null;
      try { payload = await response.json(); } catch { /* malformed response stays uncertain */ }
      const result = classifySignupReply(response.ok, payload);
      if (result === "sent" || result === "uncertain") terminalOrUncertain.current = true;
      setReply(result);
    } catch { if (submitted) terminalOrUncertain.current = true; setReply(submitted ? "uncertain" : "unavailable"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <>
    <noscript><p className="auth-feedback">Ative o JavaScript para iniciar o cadastro com segurança. Se já recebeu um link de confirmação, você pode abri-lo diretamente.</p></noscript>
    {showInitial && initialMessage && <div className="auth-feedback" role={initialSent ? "status" : "alert"}><p>{initialMessage}</p></div>}
    {reply && <div className="auth-feedback" role={reply === "sent" ? "status" : "alert"} tabIndex={-1} ref={feedback}><p>{
      reply === "sent" ? "Se for possível criar uma conta com esse endereço, você receberá um e-mail com as próximas etapas." :
      reply === "invalid" ? "Confira o e-mail, a senha e a confirmação dos termos." :
      reply === "wait" ? "Aguarde um pouco antes de tentar novamente." :
      reply === "unavailable" ? "Não foi possível preparar o cadastro. Confira se há uma sessão aberta e tente novamente." :
      "Não foi possível confirmar o envio. Verifique seu e-mail ou solicite outra confirmação."
    }</p>{reply === "uncertain" && <p><Link href="/cadastro/reenviar">Reenviar confirmação</Link></p>}</div>}
    {!initialSent && reply !== "sent" && <form className="auth-form" action="/auth/iniciar-cadastro" method="post" onSubmit={submit}>
      <fieldset className="auth-form__fields" disabled={!hydrated || busy || reply === "uncertain"}>
        <Field name="email" label="E-mail" type="email" autoComplete="email" required maxLength={254} />
        <SignupPassword />
        <SignupLegal termsVersion={termsVersion} privacyVersion={privacyVersion} />
        <SignupOriginChoice />
        <Button type="submit" variant="primary" loading={busy}>Criar conta</Button>
      </fieldset>
    </form>}
  </>;
}
