import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Drive · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("drive");
  return <section className="shell-empty" data-access="allowed" aria-labelledby="files-unavailable-title">
    <h1 id="files-unavailable-title">Arquivos</h1>
    <p>Esta área está sendo preparada e não está disponível nesta versão. Seus arquivos existentes permanecem preservados.</p>
    <div className="shell-empty-actions"><Link className="shell-inline-link" href="/">Voltar ao Início</Link><Link className="shell-inline-link" href="/conhecimento">Abrir Conhecimento</Link></div>
  </section>;
}
