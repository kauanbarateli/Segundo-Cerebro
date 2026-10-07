import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import tokens from "../../../design-system/tokens/tokens.json";
import { ThemeSelector } from "@/components/theme/theme-selector";
import "./showcase.css";

export const metadata: Metadata = { title: "Fundamentos visuais · Segundo Cérebro" };

const surfaces = [
  { name: "Canvas", token: "canvas", className: "bg-canvas" },
  { name: "Superfície", token: "surface", className: "bg-surface" },
  { name: "Superfície suave", token: "surface-muted", className: "bg-surface-muted" },
  { name: "Superfície ativa", token: "surface-hover", className: "bg-surface-hover" },
];
const semantics = [
  ["success", "Concluído"], ["danger", "Erro"], ["warning", "Atenção"],
  ["info", "Informação"], ["work", "Trabalho"], ["personal", "Pessoal"], ["fin", "Financeiro"],
] as const;
const typeSamples: Record<string, string> = {
  display: "Espaço para pensar.", h2: "O que importa hoje", h3: "Ideias que se conectam",
  "corpo-forte": "Capture agora, organize depois.", corpo: "Uma ideia encontra contexto quando se aproxima de outra.",
  dado: "R$ 1.234,56 · 07/10/2026", legenda: "Atualizado há poucos instantes",
  micro: "Uso auxiliar, nunca conteúdo essencial", campo: "Escreva o título da sua nota", editor: "Um lugar para escrever com calma e voltar às suas ideias.",
};

export default function DesignSystemPage() {
  return (
    <div className="foundation-page showcase-page">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="page-header">
        <Link className="header-link" href="/">Segundo Cérebro</Link>
        <ThemeSelector />
      </header>
      <main id="conteudo" tabIndex={-1}>
        <div className="showcase-intro">
          <h1>Fundamentos visuais</h1>
          <p>DS 2.1: cores, tipografia e formas que dão consistência ao Segundo Cérebro. Alterne o tema para conferir os mesmos elementos em cada ambiente.</p>
        </div>
        <nav className="showcase-index" aria-label="Nesta página">
          <a href="#superficies">Superfícies</a><a href="#semanticas">Cores semânticas</a>
          <a href="#tipografia">Tipografia</a><a href="#raios">Raios</a>
        </nav>

        <section className="showcase-section" aria-labelledby="superficies">
          <h2 id="superficies">Superfícies e tintas</h2>
          <p className="section-description">Quatro fundos sólidos. Três níveis de texto. A superfície inversa destaca uma informação sem depender de cor.</p>
          <div className="surface-specimens">
            {surfaces.map(({ name, token, className }) => (
              <div key={token} className={`surface-specimen ${className} text-ink`}>
                <h3>{name}</h3>
                <p className="text-ink-muted">Texto secundário</p>
                <p className="text-ink-subtle">Texto de apoio</p>
                <code>--{token}</code>
              </div>
            ))}
          </div>
          <div className="inverse-specimen bg-surface-inverse text-ink-inverse">
            <h3>Um contraste com propósito.</h3>
            <p className="text-inverse-muted">Superfície inversa com texto principal e secundário próprios.</p>
          </div>
        </section>

        <section className="showcase-section" aria-labelledby="semanticas">
          <h2 id="semanticas">Cores semânticas</h2>
          <p className="section-description">O rótulo comunica o significado. A cor reforça a leitura. Tons decorativos e tons de texto têm papéis separados.</p>
          <div className="semantic-specimens bg-surface">
            {semantics.map(([name, label]) => (
              <div key={name} className="semantic-specimen" style={{ "--sample-color": `var(--${name})`, "--sample-ink": `var(--${name}-ink)` } as CSSProperties}>
                <span className="semantic-label"><span aria-hidden="true" />{label}</span>
                <code>--{name}-ink</code>
              </div>
            ))}
          </div>
        </section>

        <section className="showcase-section" aria-labelledby="tipografia">
          <h2 id="tipografia">Tipografia</h2>
          <p className="section-description">Geist servida localmente. Campos a partir de 16 px e números tabulares para comparar datas e valores.</p>
          <dl className="type-specimens">
            {Object.entries(tokens.typography.scale).map(([name, value]) => (
              <div key={name} className="type-specimen">
                <dt><strong>{name}</strong><span>{value.fontSize} · {value.lineHeight}</span></dt>
                <dd className={name === "dado" ? "tabular-nums" : undefined} style={{ fontSize: `var(--type-${name})`, lineHeight: `var(--leading-${name})`, fontWeight: `var(--weight-${name})`, letterSpacing: `var(--tracking-${name})` }}>{typeSamples[name]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="showcase-section" aria-labelledby="raios">
          <h2 id="raios">Raios</h2>
          <p className="section-description">Formas compactas para controles e contornos amplos para painéis.</p>
          <ul className="radius-specimens">
            {Object.entries(tokens.radius).map(([name, value]) => (
              <li key={name}><span className="radius-shape" style={{ borderRadius: `var(--radius-${name})` }} aria-hidden="true" /><strong>{name}</strong><span>{value}</span></li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="page-footer"><p>Página de verificação da interface. Os exemplos não representam dados pessoais.</p><Link href="/" className="header-link">Voltar ao início</Link></footer>
    </div>
  );
}
