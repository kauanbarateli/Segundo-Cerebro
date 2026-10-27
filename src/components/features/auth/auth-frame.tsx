import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { Icons } from "@/components/ui/icons";
import { AuthThemeSwitcher } from "./auth-theme-switcher";
import "./auth.css";

/** RECOMENDADO: requested auth refinement in the existing monochrome DS 2.1. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="auth-page">
    <a className="skip-link" href="#auth-main">Pular para o formulário</a>
    <div className="auth-surface">
      <header className="auth-topbar">
        <Link className="auth-brand-link" href="/conheca" aria-label="Segundo Cérebro — conhecer o aplicativo"><Brand variant="stacked" size={36} /></Link>
        <AuthThemeSwitcher />
      </header>
      <div className="auth-body">
        <section className="auth-intro" aria-labelledby="auth-intro-title">
          <h2 id="auth-intro-title">Capture, conecte,<br />reencontre.</h2>
          <p>Ideias, compromissos e planos no seu espaço pessoal.</p>
          <Link href="/conheca">Conheça o Segundo Cérebro <Icons.ArrowUpRight /></Link>
        </section>
        <main id="auth-main" className="auth-panel" aria-labelledby="auth-title" tabIndex={-1}>
          {children}
        </main>
      </div>
      <footer className="auth-footer">
        <p>Um lugar para pensar com clareza.</p>
        <nav aria-label="Informações e suporte">
          <Link href="/termos-de-servico" target="_blank" rel="noopener noreferrer">Termos de serviço</Link>
          <Link href="/privacidade" target="_blank" rel="noopener noreferrer">Privacidade</Link>
          <a href="mailto:suporte@segundocerebroapp.com.br">Precisa de ajuda?</a>
        </nav>
      </footer>
    </div>
  </div>;
}
