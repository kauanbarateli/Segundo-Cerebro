import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Ajuda · Segundo Cérebro" };

export default async function HelpPage() {
  const connected = getAppMode() === "supabase";
  if (connected) await requireUser();
  return (
    <>
      <div className="shell-page-heading"><h1>Ajuda</h1><p>Conheça o que já pode experimentar.</p></div>
      <div className="shell-help">
        <section><h2>Uma demonstração de navegação</h2><p>Explore as áreas do Segundo Cérebro pelo menu lateral ou pela barra inferior no celular. Cada módulo tem um endereço próprio, mas suas operações ainda estão em construção. {connected ? "Sua conta está conectada; os dados dos módulos são exemplos temporários e não são salvos nela." : "Não há conta conectada nem dados pessoais nesta versão."}</p></section>
        <section><h2>Encontre um módulo</h2><p>Use Buscar no cabeçalho ou pressione Ctrl+K (Cmd+K no Mac). Digite o nome do módulo e navegue pelos resultados com Tab. Escape fecha a busca e devolve o foco ao acionador.</p></section>
        <section><h2>Preferência e acesso</h2><p>{connected ? "A navegação mostra os módulos liberados para sua conta. Cada acesso é verificado no servidor, inclusive quando você abre o endereço diretamente." : "Em Configurações, ocultar um módulo remove os atalhos e preserva seu acesso pelo endereço. Um veto simulado impede abrir a página. O privilégio Admin também é uma simulação explícita; nenhuma permissão de uma conta real é alterada."}</p><Link className="shell-inline-link" href="/configuracoes">Abrir Configurações</Link></section>
        <section><h2>{connected ? "Sair da conta" : "Encerrar a demonstração"}</h2><p>{connected ? "Use Sair da conta no menu para encerrar suas sessões. Para trocar sua senha, abra as opções da conta ou Configurações." : "Sair da demonstração restaura a navegação e desativa o privilégio Admin simulado. O tema é preservado. Nenhuma conta está conectada neste modo."}</p></section>
        <Link className="shell-inline-link" href="/design-system">Fundamentos visuais</Link>
      </div>
    </>
  );
}
