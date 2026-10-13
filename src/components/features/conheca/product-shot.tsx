import type { CSSProperties } from "react";
import { getImageProps, type StaticImageData } from "next/image";
import type { Tela } from "./content";

interface ProductShotProps {
  tela: Tela;
  /** Largura de exibição a partir de 768px, para o srcset do otimizador de imagens. */
  sizes: string;
  priority?: boolean;
  className?: string;
}

type Tema = "sistema" | "claro" | "escuro";

const celular = "(max-width: 767px)";
const larguraDoCelular = "340px";
/** Densidade das capturas em scripts/landing/capturar-telas.mjs: 2 no computador, 3 no celular. */
const densidadeDaCaptura = { computador: 2, celular: 3 } as const;
const escuro = "(prefers-color-scheme: dark)";

function fonte(src: StaticImageData, sizes: string, priority: boolean) {
  return getImageProps({ src, alt: "", sizes, priority }).props;
}

/**
 * Um quadro por tema. "sistema" acompanha a preferência do aparelho; "claro" e
 * "escuro" só aparecem quando a página tem um tema escolhido (html[data-theme]),
 * e carregam sob demanda para não baixar a cena duas vezes.
 */
function Quadro({ tela, sizes, priority, tema }: { tela: Tela; sizes: string; priority: boolean; tema: Tema }) {
  const urgente = priority && tema === "sistema";
  const amplo = fonte(tema === "escuro" ? tela.amplo.escuro : tela.amplo.claro, sizes, urgente);
  const amploEscuro = tema === "sistema" ? fonte(tela.amplo.escuro, sizes, urgente) : null;
  const telefone = tela.celular ? fonte(tema === "escuro" ? tela.celular.escuro : tela.celular.claro, larguraDoCelular, urgente) : null;
  const telefoneEscuro = tela.celular && tema === "sistema" ? fonte(tela.celular.escuro, larguraDoCelular, urgente) : null;

  return (
    <picture className={`conheca-tela__quadro conheca-tela__quadro--${tema}`}>
      {telefoneEscuro && <source media={`${celular} and ${escuro}`} srcSet={telefoneEscuro.srcSet} sizes={telefoneEscuro.sizes} width={telefoneEscuro.width} height={telefoneEscuro.height} />}
      {telefone && <source media={celular} srcSet={telefone.srcSet} sizes={telefone.sizes} width={telefone.width} height={telefone.height} />}
      {amploEscuro && <source media={escuro} srcSet={amploEscuro.srcSet} sizes={amploEscuro.sizes} width={amploEscuro.width} height={amploEscuro.height} />}
      <img
        className="conheca-tela__imagem"
        src={amplo.src}
        srcSet={amplo.srcSet}
        sizes={amplo.sizes}
        width={amplo.width}
        height={amplo.height}
        alt={tela.descricao}
        loading={tema === "sistema" ? amplo.loading : "lazy"}
        decoding={amplo.decoding}
        fetchPriority={amplo.fetchPriority}
      />
    </picture>
  );
}

/** Captura real do app numa moldura única, no tema da página e na largura do aparelho. */
export function ProductShot({ tela, sizes, priority = false, className }: ProductShotProps) {
  const classes = ["conheca-tela", `conheca-tela--${tela.formato}`, tela.celular && "conheca-tela--com-celular", className].filter(Boolean).join(" ");
  // Proporção e largura nativa deixam o CSS limitar a tela à altura da janela, sem
  // ampliar a captura e sem esperar o carregamento.
  const medidas = {
    "--conheca-proporcao": String(tela.amplo.claro.width / tela.amplo.claro.height),
    "--conheca-largura-nativa": `${tela.amplo.claro.width / densidadeDaCaptura[tela.formato === "celular" ? "celular" : "computador"]}px`,
  } as CSSProperties;
  return (
    <figure className={classes} style={medidas}>
      <Quadro tela={tela} sizes={sizes} priority={priority} tema="sistema" />
      <Quadro tela={tela} sizes={sizes} priority={priority} tema="claro" />
      <Quadro tela={tela} sizes={sizes} priority={priority} tema="escuro" />
    </figure>
  );
}
