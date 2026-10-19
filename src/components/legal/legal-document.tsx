import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { LegalLinks } from "@/components/ui/legal-links";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { LEGAL_SUPPORT_EMAIL, type LegalDocument as Document } from "@/lib/legal/documents";
import "./legal-document.css";

/** Server-rendered reading surface; the shared theme control is its only client island. */
export function LegalDocument({ document }: { document: Document }) {
  return <div className="legal-page" id="topo">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="legal-header">
      <Link className="legal-brand" href="/conheca" prefetch={false} aria-label="Segundo Cérebro · conhecer o aplicativo"><Brand variant="horizontal" size={44} /></Link>
      <ThemeSelector />
    </header>
    <main id="conteudo" className="legal-main" tabIndex={-1}>
      <header className="legal-intro">
        <Link className="legal-back" href="/conheca" prefetch={false}>Voltar à apresentação</Link>
        <h1>{document.title}</h1>
        <p className="legal-summary">{document.summary}</p>
        <p className="legal-version">Versão {document.version} · Atualizado em <time dateTime={document.updatedAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${document.updatedAt}T12:00:00Z`))}</time></p>
        {document.notice && <p className="legal-notice">{document.notice}</p>}
      </header>
      <div className="legal-reading-layout">
        <nav className="legal-index" aria-labelledby="legal-index-title">
          <h2 id="legal-index-title">Nesta página</h2>
          <ul>{document.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul>
        </nav>
        <article className="legal-article" aria-label={document.title}>
          {document.sections.map(section => <section key={section.id} id={section.id} className="legal-section" aria-labelledby={`${section.id}-titulo`}>
            <h2 id={`${section.id}-titulo`}>{section.title}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
            {section.links && <ul className="legal-source-links">{section.links.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>}
          </section>)}
          <a className="legal-back" href="#topo">Voltar ao início</a>
        </article>
      </div>
    </main>
    <footer className="legal-footer">
      <nav aria-label="Privacidade e termos"><LegalLinks /></nav>
      <a className="legal-contact" href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>{LEGAL_SUPPORT_EMAIL}</a>
      <Link className="legal-back" href="/configuracoes" prefetch={false}>Configurações do aplicativo</Link>
    </footer>
  </div>;
}
