"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import type { SignupOrigin } from "@/core/acquisition/signup-origin";
import { signupOriginFromSearch } from "@/core/acquisition/signup-origin-transport";

export function SignupPassword() {
  const [revealed, setRevealed] = useState(false);
  return <div className="auth-password">
    <Field name="password" label="Senha" type={revealed ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={72}
      hint="Use pelo menos 12 caracteres e até 72 bytes; acentos e emojis ocupam mais espaço." autoCapitalize="none" spellCheck={false} />
    <Button className="auth-reveal" variant="ghost" aria-label={revealed ? "Ocultar senha" : "Mostrar senha"} aria-pressed={revealed} onClick={() => setRevealed(value => !value)}>{revealed ? <Icons.EyeOff /> : <Icons.Eye />}</Button>
  </div>;
}

export function SignupLegal({ termsVersion, privacyVersion }: { termsVersion: string; privacyVersion: string }) {
  const id = useId();
  return <div className="auth-legal">
    {/* Field não representa controles ocultos de versão. */}
    {/* eslint-disable-next-line no-restricted-syntax */}
    <input type="hidden" name="termsVersion" value={termsVersion} />
    {/* eslint-disable-next-line no-restricted-syntax */}
    <input type="hidden" name="privacyVersion" value={privacyVersion} />
    <label className="auth-legal-check" htmlFor={id}>
      <span className="auth-legal-control">
        {/* Field não implementa checkbox; mantém o padrão acessível do formulário de entrada. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <input id={id} name="acceptedLegal" type="checkbox" value="yes" required /><span className="auth-legal-mark" aria-hidden="true"><Icons.Check /></span>
      </span>
      <span>Li e concordo com os termos e a política de privacidade.</span>
    </label>
    <div className="auth-policy-links"><Link href="/termos-de-servico" aria-label="Ler os termos de serviço (abre em nova aba)" target="_blank" rel="noopener noreferrer">Termos de serviço</Link><Link href="/privacidade" aria-label="Ler a política de privacidade (abre em nova aba)" target="_blank" rel="noopener noreferrer">Privacidade</Link></div>
  </div>;
}

/** URL values are not read, stored or submitted before the optional choice. */
export function SignupOriginChoice() {
  const id = useId(), [checked, setChecked] = useState(false), [origin, setOrigin] = useState<SignupOrigin | null>(null);
  function choose(value: boolean) {
    setChecked(value);
    if (!value) { setOrigin(null); return; }
    setOrigin(signupOriginFromSearch(new URLSearchParams(window.location.search)));
  }
  return <div className="auth-legal">
    <label className="auth-legal-check" htmlFor={id}><span className="auth-legal-control">
      {/* eslint-disable-next-line no-restricted-syntax -- Campo opcional do tipo checkbox, não suportado por Field. */}
      <input id={id} name="consentedOrigin" type="checkbox" value="yes" checked={checked} onChange={event => choose(event.currentTarget.checked)} /><span className="auth-legal-mark" aria-hidden="true"><Icons.Check /></span>
    </span><span>Permitir o uso da origem deste link em métricas de cadastro, por até 12 meses. Opcional.</span></label>
    {checked && !origin && <p className="auth-feedback" role="status">Este link não contém uma origem de campanha válida.</p>}
    {origin && Object.entries(origin).map(([field, value]) => (
      /* eslint-disable-next-line no-restricted-syntax -- Só campos permitidos e consentidos são enviados. */
      <input key={field} type="hidden" name={field} value={value} />
    ))}
  </div>;
}

export function SignupOriginConfirmation() {
  const id = useId();
  return <div className="auth-legal"><label className="auth-legal-check" htmlFor={id}><span className="auth-legal-control">
    {/* eslint-disable-next-line no-restricted-syntax -- Confirmação opcional separada dos termos. */}
    <input id={id} name="acceptedOrigin" type="checkbox" value="yes" /><span className="auth-legal-mark" aria-hidden="true"><Icons.Check /></span>
  </span><span>Permitir o uso da origem informada no cadastro em métricas, por até 12 meses. Opcional.</span></label></div>;
}
