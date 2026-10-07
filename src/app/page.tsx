const repositoryUrl = "https://github.com/kauanbarateli/Segundo-Cerebro";

/** Geometry ported from novo-segundo-cerebro/design-system/brand. */
function BrandSymbol() {
  return (
    <svg
      className="brand-symbol"
      width="44"
      height="44"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path
        d="M18.5 20C18.5 15.858 21.858 12.5 26 12.5H35C41.627 12.5 47 17.873 47 24.5C47 28.253 45.245 31.791 42.255 34.056L21.5 49.5H47"
        stroke="var(--surface)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.5" cy="20" r="3" fill="currentColor" stroke="var(--surface)" strokeWidth="1.5" />
      <circle cx="47" cy="49.5" r="3" fill="currentColor" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="foundation-page">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="page-header">
        <div className="brand">
          <BrandSymbol />
          <span className="brand-name">
            <strong>Segundo</strong>
            <span>Cérebro</span>
          </span>
        </div>
        <div className="header-tools">
          <Link className="header-link" href="/design-system">Fundamentos visuais</Link>
          <ThemeSelector />
        </div>
      </header>

      <main id="conteudo" className="foundation-grid" tabIndex={-1}>
        <section className="welcome-panel" aria-labelledby="page-title">
          <div className="welcome-copy">
            <h1 id="page-title">Seu espaço está ganhando forma.</h1>
            <p>
              O Segundo Cérebro está em construção. Um lugar para reunir suas
              ideias, conectar conhecimento e organizar o dia.
            </p>
          </div>
          <a className="primary-link" href={`${repositoryUrl}/issues`}>
            Acompanhar a construção
            <ArrowRight />
          </a>
        </section>

        <section className="planning-panel" aria-labelledby="planning-title">
          <h2 id="planning-title">O que vem pela frente</h2>
          <dl className="product-path">
            <div>
              <dt>Capturar</dt>
              <dd>Guardar uma ideia e decidir seu próximo passo.</dd>
            </div>
            <div>
              <dt>Conectar</dt>
              <dd>Aproximar notas e reencontrar seu contexto.</dd>
            </div>
            <div>
              <dt>Organizar o dia</dt>
              <dd>Reunir tarefas, agenda, hábitos e finanças.</dd>
            </div>
          </dl>
          <a className="text-link" href={`${repositoryUrl}/tree/main/docs/planejamento`}>
            Conhecer o planejamento
            <ArrowRight />
          </a>
        </section>
      </main>

      <footer className="page-footer">
        <p>Esta é a primeira etapa. Os módulos ainda não estão disponíveis.</p>
        <span>Segundo Cérebro</span>
      </footer>
    </div>
  );
}
import Link from "next/link";
import { ThemeSelector } from "@/components/theme/theme-selector";
