import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { ConteudoDeAcesso } from "./content";

/**
 * Cabeçalho fixo da apresentação. Tema e acesso ficam sempre na barra, em qualquer largura:
 * a única seção navegável é Recursos, que a abertura já alcança, então não há menu a abrir.
 */
export function LandingHeader({ acesso }: { acesso: ConteudoDeAcesso["cabecalho"] }) {
  return (
    <header className="conheca-cabecalho glass-frame">
      <div className="conheca-faixa conheca-cabecalho__barra">
        <a className="conheca-marca" href="#topo" aria-label="Segundo Cérebro, início da página"><Brand variant="stacked" size={36} /></a>
        <nav className="conheca-secoes" aria-label="Seções">
          <ul>
            <li><a href="#recursos">Recursos</a></li>
          </ul>
        </nav>
        <div className="conheca-cabecalho__acoes">
          <ThemeToggle />
          <Link className="conheca-botao conheca-botao--compacto conheca-botao--contorno" href={acesso.entrar.href} prefetch={false}>{acesso.entrar.rotulo}</Link>
          {acesso.criar && <Link className="conheca-botao conheca-botao--compacto conheca-cabecalho__criar" href={acesso.criar.href} prefetch={false}>{acesso.criar.rotulo}</Link>}
        </div>
      </div>
    </header>
  );
}
