import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { ThemeSelector } from "@/components/theme/theme-selector";
import "./auth.css";

/** OBSERVADO: single centered 400px panel from the approved DS 2.1 login. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="auth-page">
    <a className="skip-link" href="#auth-main">Pular para o formulário</a>
    <div className="auth-surface">
      <main id="auth-main" className="auth-panel" aria-labelledby="auth-title" tabIndex={-1}>
        <Brand size={44} />
        {children}
      </main>
      <footer className="auth-footer"><ThemeSelector /></footer>
    </div>
  </div>;
}
