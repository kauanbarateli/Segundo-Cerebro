"use client";

import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/ui/brand";
import { Icons } from "@/components/ui/icons";

const secoes = [
  { href: "#recursos", rotulo: "Recursos" },
  { href: "#principios", rotulo: "Princípios" },
] as const;

/**
 * Cabeçalho fixo da apresentação; abaixo de 768px as seções viram um painel.
 * Abaixo de 420px o nome da marca fica e o pedido de acesso passa para o painel.
 */
export function LandingHeader() {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [aberto]);

  return (
    <header className="conheca-cabecalho glass-frame">
      <div className="conheca-faixa conheca-cabecalho__barra">
        <a className="conheca-marca" href="#topo" aria-label="Segundo Cérebro, início da página"><Brand variant="compact" size={48} /></a>
        <button
          ref={botao}
          type="button"
          className="conheca-menu"
          aria-expanded={aberto}
          aria-controls="conheca-secoes"
          aria-label={aberto ? "Fechar seções" : "Abrir seções"}
          onClick={() => setAberto((valor) => !valor)}
        >
          {aberto ? <Icons.X /> : <Icons.List />}
        </button>
        <nav id="conheca-secoes" className="conheca-secoes" aria-label="Seções" data-aberto={aberto || undefined}>
          <ul>
            {secoes.map((secao) => (
              <li key={secao.href}><a href={secao.href} onClick={() => setAberto(false)}>{secao.rotulo}</a></li>
            ))}
            <li className="conheca-secoes__acesso"><a href="#acesso" onClick={() => setAberto(false)}>Quero acesso</a></li>
          </ul>
        </nav>
        <a className="conheca-botao conheca-botao--compacto conheca-cabecalho__acesso" href="#acesso" onClick={() => setAberto(false)}>Quero acesso</a>
      </div>
    </header>
  );
}
