import { Brand } from "@/components/ui/brand";
import Link from "next/link";
import { LegalLinks } from "@/components/ui/legal-links";
import { Icons } from "@/components/ui/icons";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { AccessAction } from "./access-action";
import { acesso, conexoes, dispersao, hero, movimentos, perguntas, principios, rodape, type Pergunta } from "./content";
import { LandingHeader } from "./landing-header";
import { ProductShot } from "./product-shot";
import "./landing.css";

const larguraUtil = "(max-width: 767px) calc(100vw - 40px), (max-width: 1184px) calc(100vw - 64px), 1120px";
function larguraDeCapitulo(item: Pergunta): string {
  if (item.tela.formato === "celular") return "360px";
  if (item.tela.formato === "dialogo") return "560px";
  return "(max-width: 1023px) calc(100vw - 64px), 640px";
}

function Capitulo({ item, ordem }: { item: Pergunta; ordem: "texto-primeiro" | "tela-primeiro" }) {
  return (
    <article
      id={item.id}
      className={`conheca-capitulo conheca-capitulo--${item.tela.formato} conheca-capitulo--${ordem}`}
      aria-labelledby={`${item.id}-pergunta`}
    >
      <div className="conheca-faixa conheca-capitulo__grade">
        {/* As duas colunas reservam o percurso em que a pergunta fica e a tela sobe até ela. */}
        <div className="conheca-capitulo__coluna">
          <div className="conheca-capitulo__texto">
            <h3 id={`${item.id}-pergunta`} className="conheca-pergunta">{item.pergunta}</h3>
            <p className="conheca-resposta">{item.resposta}</p>
            <p className="conheca-paragrafo">{item.texto}</p>
            <ul className="conheca-fatos">
              {item.fatos.map((fato) => <li key={fato}>{fato}</li>)}
            </ul>
          </div>
        </div>
        <div className="conheca-capitulo__palco">
          <ProductShot tela={item.tela} sizes={larguraDeCapitulo(item)} className="conheca-capitulo__tela" />
        </div>
      </div>
    </article>
  );
}

/** Apresentação pública do produto: seis perguntas respondidas por telas reais. */
export function LandingPage() {
  return (
    <div className="conheca" id="topo">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <LandingHeader />
      <main id="conteudo" tabIndex={-1}>
        <section className="conheca-hero" aria-labelledby="conheca-titulo">
          <div className="conheca-faixa conheca-hero__grade">
            <h1 id="conheca-titulo" className="conheca-vitrine conheca-hero__titulo">
              {hero.titulo.map((linha) => <span key={linha}>{linha}</span>)}
            </h1>
            <div className="conheca-hero__apoio">
              <p className="conheca-chamada">{hero.chamada}</p>
              <a className="conheca-botao conheca-botao--primario" href="#perguntas">
                {hero.acao}
                <Icons.ChevronRight />
              </a>
            </div>
            <ProductShot tela={hero.tela} sizes={larguraUtil} priority className="conheca-hero__tela" />
            <nav className="conheca-indice" aria-labelledby="conheca-indice-titulo">
              <p id="conheca-indice-titulo" className="conheca-indice__titulo">{hero.indice}</p>
              <ol>
                {perguntas.itens.map((item) => (
                  <li key={item.id}><a href={`#${item.id}`}>{item.pergunta}</a></li>
                ))}
              </ol>
            </nav>
          </div>
        </section>

        <section id="dispersao" className="conheca-secao" aria-labelledby="dispersao-titulo">
          <div className="conheca-faixa conheca-dispersao">
            <div className="conheca-dispersao__texto">
              <h2 id="dispersao-titulo" className="conheca-titulo">{dispersao.titulo}</h2>
              <p className="conheca-paragrafo">{dispersao.texto}</p>
            </div>
            <dl className="conheca-lugares">
              {dispersao.lugares.map(([pergunta, lugar]) => (
                <div key={pergunta}>
                  <dt>{pergunta}</dt>
                  <dd>{lugar}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="movimentos" className="conheca-secao conheca-secao--inversa" aria-labelledby="movimentos-titulo">
          <div className="conheca-faixa">
            <h2 id="movimentos-titulo" className="conheca-titulo">{movimentos.titulo}</h2>
            <ol className="conheca-movimentos">
              {movimentos.itens.map((item) => (
                <li key={item.nome}>
                  <h3 className="conheca-movimento__nome">{item.nome}</h3>
                  <p className="conheca-paragrafo">{item.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="perguntas" className="conheca-perguntas" aria-labelledby="perguntas-titulo">
          <h2 id="perguntas-titulo" className="conheca-oculto">{perguntas.titulo}</h2>
          {perguntas.itens.map((item, indice) => (
            <Capitulo key={item.id} item={item} ordem={indice % 2 === 0 ? "texto-primeiro" : "tela-primeiro"} />
          ))}
        </section>

        <section id="conexoes" className="conheca-secao conheca-conexoes" aria-labelledby="conexoes-titulo">
          <div className="conheca-faixa">
            <div className="conheca-conexoes__texto">
              <h2 id="conexoes-titulo" className="conheca-titulo">{conexoes.titulo}</h2>
              <p className="conheca-paragrafo">{conexoes.texto}</p>
            </div>
            <ProductShot tela={conexoes.tela} sizes={larguraUtil} className="conheca-conexoes__tela" />
            <ul className="conheca-regras">
              {conexoes.regras.map((regra) => (
                <li key={regra.titulo}>
                  <h3 className="conheca-regra__titulo">{regra.titulo}</h3>
                  <p className="conheca-paragrafo">{regra.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="principios" className="conheca-secao" aria-labelledby="principios-titulo">
          <div className="conheca-faixa conheca-principios">
            <h2 id="principios-titulo" className="conheca-titulo">{principios.titulo}</h2>
            <ul className="conheca-principios__lista">
              {principios.itens.map((item) => (
                <li key={item.titulo}>
                  <h3 className="conheca-regra__titulo">{item.titulo}</h3>
                  <p className="conheca-paragrafo">{item.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="acesso" className="conheca-acesso" aria-labelledby="acesso-titulo">
          <div className="conheca-faixa conheca-acesso__grade">
            <h2 id="acesso-titulo" className="conheca-vitrine">{acesso.titulo}</h2>
            <div className="conheca-acesso__apoio">
              <p className="conheca-chamada">{acesso.texto}</p>
              <AccessAction destino={acesso.destino} />
              <Link className="conheca-acesso__conta" href="/entrar" prefetch={false}>Já tem uma conta? Entrar</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="conheca-rodape">
        <div className="conheca-faixa conheca-rodape__grade">
          <div className="conheca-rodape__marca">
            <Brand variant="horizontal" size={56} />
            <p>{rodape.lema}</p>
          </div>
          <p className="conheca-rodape__aviso">{rodape.aviso}</p>
          <ThemeSelector />
          <nav className="conheca-rodape__links" aria-label="Informações e configurações">
            <LegalLinks />
            <Link className="conheca-rodape__configuracoes" href="/configuracoes" prefetch={false}>Configurações do aplicativo</Link>
          </nav>
          <p className="conheca-rodape__direitos">© 2026 Segundo Cérebro</p>
        </div>
      </footer>
    </div>
  );
}
