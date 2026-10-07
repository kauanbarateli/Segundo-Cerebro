import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { Icons } from "@/components/ui/icons";
import { ThemeSelector } from "@/components/theme/theme-selector";

const repositoryUrl = "https://github.com/kauanbarateli/Segundo-Cerebro";

export default function HomePage() {
  return (
    <div className="foundation-page">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="page-header">
        <Brand variant="compact" size={44} />
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
            <Icons.ChevronRight />
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
            <Icons.ChevronRight />
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
