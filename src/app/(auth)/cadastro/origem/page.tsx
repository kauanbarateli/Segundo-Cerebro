import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { OriginWithdrawalV2 } from "@/components/legal/origin-withdrawal-v2";
import { readAuthConfiguration } from "@/lib/auth/config";
import { originWithdrawalV2Enabled } from "@/lib/auth/origin-withdrawal-v2-gate";
import { signupFenceDeployed } from "@/lib/auth/signup-http";
import { readSignupContext } from "@/lib/auth/signup-provisional";
import { LEGAL_SUPPORT_EMAIL } from "@/lib/legal/documents";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Origem do cadastro · Segundo Cérebro", robots: { index: false, follow: false } };

/** The signed context only selects the provisional session; the API re-verifies it with Auth. */
export default async function SignupOriginPage() {
  let userId: string | null = null;
  try {
    const config = readAuthConfiguration();
    if (config.mode === "supabase" && originWithdrawalV2Enabled() && signupFenceDeployed(config)) {
      userId = readSignupContext(await cookies(), config.stateSecret)?.userId ?? null;
    }
  } catch { /* Fail closed without exposing the reason. */ }
  return <>
    <header className="auth-heading"><h1 id="auth-title">Origem do cadastro</h1><p>Revise sua escolha sobre o uso da origem informada neste cadastro.</p></header>
    {userId ? <OriginWithdrawalV2 key={userId} userId={userId} context="signup" /> : <p className="auth-feedback" role="status">Não foi possível confirmar a sessão provisória. Se já concluiu o cadastro, <Link href="/entrar?returnTo=%2Fprivacidade%2Forigem-cadastro">entre para revisar sua escolha</Link>. Caso contrário, <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>fale com o suporte</a>.</p>}
    <p className="auth-registration"><Link href="/cadastro/definir-senha">Voltar à confirmação</Link></p>
  </>;
}
