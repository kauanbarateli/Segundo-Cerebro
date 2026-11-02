import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { OriginWithdrawal } from "@/components/legal/origin-withdrawal";
import { requireUser } from "@/lib/auth/guards";
import { AuthGuardError } from "@/lib/auth/types";
import "@/components/legal/legal-document.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Origem de cadastro · Segundo Cérebro", robots: { index: false } };

export default async function OriginPrivacyPage() {
  let identity;
  try { identity = await requireUser(); }
  catch (error) { if (error instanceof AuthGuardError && error.code === "demo") notFound(); throw error; }
  return <div className="legal-page">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="legal-header"><Link className="legal-brand" href="/conheca" prefetch={false} aria-label="Segundo Cérebro · conhecer o aplicativo"><Brand variant="horizontal" size={44} /></Link><ThemeSelector /></header>
    <main id="conteudo" className="legal-main" tabIndex={-1}>
      <div className="legal-intro"><Link className="legal-back" href="/privacidade#cookies" prefetch={false}>Voltar à política de privacidade</Link>
        <h1>Origem de cadastro</h1><p className="legal-summary">Gerencie o consentimento para usar a origem informada no cadastro.</p>
        <OriginWithdrawal key={identity.userId} userId={identity.userId} />
      </div>
    </main>
  </div>;
}
