import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignupLegal, SignupOriginConfirmation, SignupPassword } from "@/components/features/auth/signup-fields";
import { readAuthConfiguration } from "@/lib/auth/config";
import { SIGNUP_CHECKPOINT_COOKIE } from "@/lib/auth/signup-confirmation-runtime";
import { verifySignupCheckpoint } from "@/lib/auth/signup-checkpoint";
import { signupEnabled } from "@/lib/auth/signup-http";
import { LEGAL_DOCUMENTS, LEGAL_SUPPORT_EMAIL } from "@/lib/legal/documents";
import { originWithdrawalV2Enabled } from "@/lib/auth/origin-withdrawal-v2-gate";
import { SignupVersionedCompletionForm } from "@/components/features/auth/signup-versioned-completion-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proteger conta · Segundo Cérebro", robots: { index: false, follow: false } };
const errors: Record<string, string> = { invalid: "Confirme os termos atuais para continuar.", "password-invalid": "Confira a senha e tente novamente.", "rate-limited": "Aguarde um pouco antes de tentar novamente.", "origin-changed": "Sua escolha sobre a origem mudou. Confira a opção abaixo antes de continuar.", unavailable: "Não foi possível concluir. Tente novamente." };
export default async function SignupPasswordPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  let checkpoint = null, available = false, revisionMode = false;
  try {
    const config = readAuthConfiguration();
    if (config.mode === "supabase" && signupEnabled(config)) {
      available = true;
      const store=await cookies(),matches = store.getAll().filter(cookie => cookie.name === SIGNUP_CHECKPOINT_COOKIE);
      if (matches.length === 1) checkpoint = verifySignupCheckpoint(matches[0]?.value, config.stateSecret, Date.now());
      revisionMode=originWithdrawalV2Enabled();
    }
  } catch { /* Fail closed. */ }
  const status = (await searchParams).status, error = typeof status === "string" ? errors[status] : undefined;
  return <>
    <header className="auth-heading"><h1 id="auth-title">{available ? "Proteja sua conta" : "Confirmação indisponível"}</h1><p>{available ? checkpoint?.passwordConfirmed ? "Sua senha já foi definida. Falta apenas concluir o cadastro." : "Defina sua senha para concluir a confirmação deste e-mail." : "A confirmação de cadastro está temporariamente indisponível. Tente novamente mais tarde."}</p></header>
    {status === "origin-review-required" && <p className="auth-feedback" role="alert">Seu cadastro já foi concluído em outra etapa. Para conferir ou retirar a permissão de uso da origem, <Link href="/entrar?returnTo=%2Fprivacidade%2Forigem-cadastro">entre na conta e revise sua escolha</Link>.</p>}
    {status === "pending-reconciliation" && <p className="auth-feedback" role="alert">Não foi possível confirmar a conclusão. <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>Fale com o suporte</a> antes de tentar novamente. Você também pode solicitar a retirada do consentimento para uso da origem.</p>}
    {status === "origin-review-required" ? null : available && !checkpoint && status !== "pending-reconciliation" ? <p className="auth-feedback" role="status">A confirmação não está disponível ou expirou. <Link href="/cadastro/revisar">Revise a confirmação para continuar</Link>.</p> : checkpoint ? <>
      {error && <p className="auth-feedback" role="alert">{error}</p>}
      {revisionMode ? <SignupVersionedCompletionForm userId={checkpoint.userId} passwordConfirmed={checkpoint.passwordConfirmed} termsVersion={LEGAL_DOCUMENTS.termos.version} privacyVersion={LEGAL_DOCUMENTS.privacidade.version} /> : <form className="auth-form" action="/auth/finalizar-cadastro" method="post">
        {!checkpoint.passwordConfirmed && <SignupPassword />}
        <SignupLegal termsVersion={LEGAL_DOCUMENTS.termos.version} privacyVersion={LEGAL_DOCUMENTS.privacidade.version} />
        {checkpoint.originPending && <SignupOriginConfirmation />}
        <Button type="submit" variant="primary">Concluir cadastro</Button>
      </form>}
    </> : null}
  </>;
}
