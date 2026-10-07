import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import "@/components/pwa/pwa.css";

export const metadata: Metadata = { title: "Compartilhar · Segundo Cérebro" };

export default function SharePlaceholder() {
  return <main className="pwa-status-page">
    <Brand />
    <h1>Compartilhar para cá está em preparação</h1>
    <p>O texto, link ou imagem compartilhado ainda não foi salvo. Guarde o original no aplicativo de onde você veio.</p>
    <p>Esta porta de entrada será conectada à captura em uma próxima etapa, junto com sua conta.</p>
    <div className="pwa-status-actions"><Link href="/capturar">Conhecer o espaço de captura</Link><Link href="/">Voltar ao Início</Link></div>
  </main>;
}
