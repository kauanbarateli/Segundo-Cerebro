import { LegalLinks } from "@/components/ui/legal-links";

export function SettingsLegalSection() {
  return <section id="privacidade-e-termos" className="settings-panel" aria-labelledby="settings-legal-title">
    <div className="settings-heading"><h2 id="settings-legal-title">Privacidade e termos</h2><p>Consulte como seus dados são tratados e as condições de uso do aplicativo. As páginas também estão disponíveis sem entrar na conta.</p></div>
    <nav aria-label="Privacidade e termos"><LegalLinks /></nav>
  </section>;
}
