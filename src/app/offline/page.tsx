import type { Metadata } from "next";
import { Brand } from "@/components/ui/brand";
import { RetryConnection } from "@/components/pwa/retry-connection";
import "@/components/pwa/pwa.css";

export const metadata: Metadata = { title: "Sem conexão · Segundo Cérebro" };

export default function OfflinePage() {
  return <main className="pwa-status-page">
    <Brand />
    <h1>Vamos retomar quando houver conexão</h1>
    <p>O Segundo Cérebro não conseguiu carregar esta página. Confira sua conexão e tente novamente.</p>
    <p>Esta versão ainda precisa de internet para abrir os módulos. Nenhuma informação foi enviada ou salva por esta página.</p>
    <div className="pwa-status-actions"><RetryConnection /></div>
  </main>;
}
