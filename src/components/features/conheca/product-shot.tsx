import type { CSSProperties } from "react";
import { getImageProps, type StaticImageData } from "next/image";
import type { Tela } from "./content";
import { HeroImagePriority } from "./hero-image-priority";

interface ProductShotProps {
  tela: Tela;
  /** Largura de exibição a partir de 768px, para o srcset do otimizador de imagens. */
  sizes: string;
  priority?: boolean;
  className?: string;
}

type Tema = "sistema" | "claro" | "escuro";

const celular = "(max-width: 767px)";
// O quadro ocupa a faixa disponível nos celulares estreitos, até o teto de 340px.
const larguraDoCelular = "(max-width: 379px) calc(100vw - 40px), 340px";
/** Densidade das capturas em scripts/landing/capturar-telas.mjs: 2 no computador, 3 no celular. */
const densidadeDaCaptura = { computador: 2, celular: 3 } as const;
const escuro = "(prefers-color-scheme: dark)";

function fonte(src: StaticImageData, sizes: string) {
  return getImageProps({ src, alt: "", sizes, loading: "lazy" }).props;
}

/**
 * Um quadro por tema. "sistema" acompanha a preferência do aparelho; "claro" e
 * "escuro" seguem o tema resolvido em html[data-theme]. Todos saem lazy do
 * servidor; a prioridade do hero só é aplicada ao quadro visível após hidratar.
 */
function Quadro({ tela, sizes, tema }: { tela: Tela; sizes: string; tema: Tema }) {
  const amplo = fonte(tema === "escuro" ? tela.amplo.escuro : tela.amplo.claro, sizes);
  const amploEscuro = tema === "sistema" ? fonte(tela.amplo.escuro, sizes) : null;
  const telefone = tela.celular ? fonte(tema === "escuro" ? tela.celular.escuro : tela.celular.claro, larguraDoCelular) : null;
  const telefoneEscuro = tela.celular && tema === "sistema" ? fonte(tela.celular.escuro, larguraDoCelular) : null;

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
        loading="lazy"
        decoding={amplo.decoding}
        fetchPriority="auto"
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
  const quadros = (
    <>
      <Quadro tela={tela} sizes={sizes} tema="sistema" />
      <Quadro tela={tela} sizes={sizes} tema="claro" />
      <Quadro tela={tela} sizes={sizes} tema="escuro" />
    </>
  );
  return priority
    ? <HeroImagePriority className={classes} style={medidas}>{quadros}</HeroImagePriority>
    : <figure className={classes} style={medidas}>{quadros}</figure>;
}
