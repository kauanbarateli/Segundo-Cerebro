import type { Metadata } from "next";
import { INDEXACAO_PUBLICA } from "@/components/features/conheca/content";
import { LandingPage } from "@/components/features/conheca/landing-page";

const titulo = "Segundo Cérebro · Capture agora, encontre depois";
const descricao = "Notas, tarefas, agenda, hábitos, finanças e senhas num só lugar, ligados entre si. Conheça o Segundo Cérebro.";

/** Origem pública para URLs absolutas de compartilhamento; ausente na demonstração sem APP_URL. */
function origemPublica(): URL | undefined {
  const valor = process.env.APP_URL;
  if (!valor) return undefined;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" ? new URL(url.origin) : undefined;
  } catch {
    return undefined;
  }
}

export function generateMetadata(): Metadata {
  return {
    metadataBase: origemPublica(),
    title: titulo,
    description: descricao,
    alternates: { canonical: "/conheca" },
    robots: { index: INDEXACAO_PUBLICA, follow: INDEXACAO_PUBLICA },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "Segundo Cérebro",
      url: "/conheca",
      title: titulo,
      description: descricao,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descricao },
  };
}

export default function ConhecaPage() {
  return <LandingPage />;
}
