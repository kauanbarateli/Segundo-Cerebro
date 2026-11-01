import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SignupLegal, SignupPassword } from "@/components/features/auth/signup-fields";
import { signupAvailable } from "@/lib/auth/signup-availability";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar conta · Segundo Cérebro", robots: { index: false, follow: false } };
const messages: Record<string, string> = {
  sent: "Se for possível criar uma conta com esse endereço, você receberá um e-mail com as próximas etapas.",
  invalid: "Confira o e-mail, a senha e a confirmação dos termos.",
  "invalid-link": "Não foi possível confirmar o link.",
  repeat: "Para continuar com segurança, solicite uma nova confirmação.",
  wait: "Aguarde um pouco antes de tentar novamente.",
  unavailable: "Não foi possível iniciar o cadastro. Tente novamente mais tarde.",
};
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const available = signupAvailable(), status = (await searchParams).status;
  const message = typeof status === "string" ? messages[status] : undefined;
  return <>
    <header className="auth-heading"><h1 id="auth-title">Criar conta</h1><p>Um espaço para organizar o que importa. Acesso gratuito durante o beta.</p></header>
    {!available ? <div className="auth-unavailable" role="status"><div><strong>Cadastro indisponível no momento.</strong><p>Tente novamente mais tarde.</p></div></div> : <>
      {message && <div className="auth-feedback" role={status === "sent" ? "status" : "alert"}><p>{message}</p></div>}
      <form className="auth-form" action="/auth/iniciar-cadastro" method="post">
        <Field name="email" label="E-mail" type="email" autoComplete="email" required maxLength={254} />
        <SignupPassword />
        <SignupLegal termsVersion={LEGAL_DOCUMENTS.termos.version} privacyVersion={LEGAL_DOCUMENTS.privacidade.version} />
        <Button type="submit" variant="primary">Criar conta</Button>
      </form>
      <p className="auth-registration">Já solicitou sua conta? <Link href="/cadastro/reenviar">Reenviar confirmação</Link></p>
    </>}
    <p className="auth-registration">Já tem uma conta? <Link href="/entrar">Entrar</Link></p>
  </>;
}
