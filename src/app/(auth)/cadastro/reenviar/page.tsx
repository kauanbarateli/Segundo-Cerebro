import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { signupAvailable } from "@/lib/auth/signup-availability";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reenviar confirmação · Segundo Cérebro", robots: { index: false, follow: false } };
const messages: Record<string, string> = { sent: "Se houver uma confirmação pendente para esse endereço, você receberá uma mensagem.", invalid: "Confira o e-mail e tente novamente.", wait: "Aguarde um pouco antes de tentar novamente.", unavailable: "Não foi possível enviar agora. Tente novamente mais tarde." };
export default async function SignupResendPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const available = signupAvailable(), status = (await searchParams).status;
  const message = typeof status === "string" ? messages[status] : undefined;
  return <>
    <header className="auth-heading"><h1 id="auth-title">Reenviar confirmação</h1><p>Informe o e-mail usado no cadastro.</p></header>
    {!available ? <p className="auth-feedback" role="status">O cadastro está indisponível no momento.</p> : <>
      {message && <p className="auth-feedback" role={status === "sent" ? "status" : "alert"}>{message}</p>}
      <form className="auth-form" action="/auth/reenviar-cadastro" method="post">
        <Field name="email" label="E-mail" type="email" autoComplete="email" required maxLength={254} />
        <Button type="submit" name="purpose" value="signup" variant="primary">Reenviar confirmação</Button>
        <Button type="submit" name="purpose" value="continuation">Já confirmei, quero continuar</Button>
      </form>
    </>}
    <p className="auth-registration"><Link href="/cadastro">Voltar ao cadastro</Link></p>
  </>;
}
