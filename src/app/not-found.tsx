import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import "@/components/pwa/pwa.css";

export const metadata: Metadata = { title: "Página não encontrada · Segundo Cérebro" };

/** Unmatched addresses outside the workspace group; same status-page frame as /offline. */
export default function NotFound() {
  return <main className="pwa-status-page">
    <Brand />
    <h1>Esta página não existe</h1>
    <p>O endereço pode ter mudado ou ter sido digitado de outro jeito. Nenhuma informação sua foi alterada.</p>
    <div className="pwa-status-actions"><Link href="/">Voltar ao Início</Link></div>
  </main>;
}
