import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookie-policy";
import { SIGNUP_OTP_COOKIE, SIGNUP_CONTINUATION_COOKIE } from "@/lib/auth/signup-channel";
import { signupAvailable } from "@/lib/auth/signup-availability";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar e-mail · Segundo Cérebro", robots: { index: false, follow: false } };
export default async function SignupConfirmPage({ searchParams }: { searchParams: Promise<{ flow?: string | string[] }> }) {
  const flow = (await searchParams).flow === "continuation" ? "continuation" : "signup", all = (await cookies()).getAll();
  const tokens = all.filter(cookie => cookie.name === (flow === "signup" ? SIGNUP_OTP_COOKIE : SIGNUP_CONTINUATION_COOKIE));
  const ready = signupAvailable() && tokens.length === 1 && /^[A-Za-z0-9_-]{32,256}$/.test(tokens[0]?.value ?? "");
  const hasSession = all.some(cookie => (cookie.name === AUTH_COOKIE_NAME || cookie.name.startsWith(`${AUTH_COOKIE_NAME}.`) || cookie.name.startsWith(`${AUTH_COOKIE_NAME}-`)) && cookie.value !== "");
  return <>
    <header className="auth-heading"><h1 id="auth-title">Confirme seu e-mail</h1><p>Continue para proteger sua conta e preparar seu espaço.</p></header>
    {!ready ? <p className="auth-feedback" role="status">O link não está disponível ou expirou. <Link href="/cadastro/reenviar">Solicite uma nova mensagem</Link>.</p> : hasSession ? <>
      <p className="auth-feedback">Há uma sessão aberta neste navegador. Para continuar, saia apenas deste navegador.</p>
      <form className="auth-form" action="/auth/limpar-cadastro" method="post">
        {/* eslint-disable-next-line no-restricted-syntax -- Campo técnico, sem controle visível. */}
        <input type="hidden" name="flow" value={flow} />
        <Button type="submit">Sair deste navegador</Button>
      </form>
    </> : <form className="auth-form" action={flow === "signup" ? "/auth/confirmar-cadastro" : "/auth/continuar-cadastro"} method="post"><Button type="submit" variant="primary">Confirmar e continuar</Button></form>}
    <p className="auth-registration"><Link href="/entrar">Voltar para entrar</Link></p>
  </>;
}
