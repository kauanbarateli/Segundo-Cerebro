"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";

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
