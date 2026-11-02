import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SIGNUP_OTP_COOKIE, SIGNUP_CONTINUATION_COOKIE } from "@/lib/auth/signup-channel";
import { signupAvailable } from "@/lib/auth/signup-availability";
import { readAuthConfiguration } from "@/lib/auth/config";
import { readSignupEmailLink } from "@/lib/auth/signup-email-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar e-mail · Segundo Cérebro", robots: { index: false, follow: false } };
export default async function SignupConfirmPage({ searchParams }: { searchParams: Promise<{ flow?: string | string[]; nonce?: string | string[] }> }) {
  const params = await searchParams, flow = params.flow === "continuation" ? "continuation" : "signup", all = (await cookies()).getAll();
  const tokens = all.filter(cookie => cookie.name === (flow === "signup" ? SIGNUP_OTP_COOKIE : SIGNUP_CONTINUATION_COOKIE));
  const available = signupAvailable();
  let nonce: string | null = null;
  try {
    const config = readAuthConfiguration();
    if (available && config.mode === "supabase" && typeof params.nonce === "string" && tokens.length === 1) {
      const proof = readSignupEmailLink(tokens[0]?.value, flow, config.stateSecret, Date.now());
      if (proof && proof.nonce === params.nonce) nonce = proof.nonce;
    }
  } catch { /* Fail closed. */ }
  return <>
    <header className="auth-heading"><h1 id="auth-title">Confirme seu e-mail</h1><p>Continue para proteger sua conta e preparar seu espaço.</p></header>
    {!available ? <p className="auth-feedback" role="status">A confirmação de cadastro está temporariamente indisponível. Tente novamente mais tarde.</p> : !nonce ? <p className="auth-feedback" role="status">O link não está disponível ou expirou. <Link href="/cadastro/reenviar">Solicite uma nova mensagem</Link>.</p> : <form className="auth-form" action={flow === "signup" ? "/auth/confirmar-cadastro" : "/auth/continuar-cadastro"} method="post">
      {/* eslint-disable-next-line no-restricted-syntax -- Vincula esta abertura à ação. */}
      <input type="hidden" name="nonce" value={nonce} />
      <Button type="submit" variant="primary">Confirmar e continuar</Button>
    </form>}
    <p className="auth-registration"><Link href="/entrar">Voltar para entrar</Link></p>
  </>;
}
