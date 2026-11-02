import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { OriginWithdrawal } from "@/components/legal/origin-withdrawal";
import { OriginWithdrawalV2 } from "@/components/legal/origin-withdrawal-v2";
import { originWithdrawalV2Enabled } from "@/lib/auth/origin-withdrawal-v2-gate";
import { readAuthState } from "@/lib/auth/guards";
import "@/components/legal/legal-document.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Origem de cadastro · Segundo Cérebro", robots: { index: false } };

export default async function OriginPrivacyPage() {
  const auth = await readAuthState();
  if (auth.mode === "demo") notFound();
  const identity = auth.identity;
  if (!identity) redirect("/entrar?notice=session-required&returnTo=%2Fprivacidade%2Forigem-cadastro");
  if (identity.mustChangePassword) redirect("/trocar-senha");
  return <div className="legal-page">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="legal-header"><Link className="legal-brand" href="/conheca" prefetch={false} aria-label="Segundo Cérebro · conhecer o aplicativo"><Brand variant="horizontal" size={44} /></Link><ThemeSelector /></header>
    <main id="conteudo" className="legal-main" tabIndex={-1}>
      <div className="legal-intro"><Link className="legal-back" href="/privacidade#cookies" prefetch={false}>Voltar à política de privacidade</Link>
        <h1>Origem de cadastro</h1><p className="legal-summary">Gerencie o consentimento para usar a origem informada no cadastro.</p>
        {originWithdrawalV2Enabled() ? <OriginWithdrawalV2 key={identity.userId} userId={identity.userId} /> : <OriginWithdrawal key={identity.userId} userId={identity.userId} />}
      </div>
    </main>
  </div>;
}
