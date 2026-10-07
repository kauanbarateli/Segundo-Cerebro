import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Ajuda · Segundo Cérebro" };

export default function HelpPage() {
  return (
    <>
      <div className="shell-page-heading"><h1>Ajuda</h1><p>Conheça o que já pode experimentar.</p></div>
      <div className="shell-help">
        <section><h2>Uma demonstração de navegação</h2><p>Explore as áreas do Segundo Cérebro pelo menu lateral ou pela barra inferior no celular. Cada módulo tem um endereço próprio, mas suas operações ainda estão em construção. Não há conta conectada nem dados pessoais nesta versão.</p></section>
        <section><h2>Encontre um módulo</h2><p>Use Buscar no cabeçalho ou pressione Ctrl+K (Cmd+K no Mac). Digite o nome do módulo e navegue pelos resultados com Tab. Escape fecha a busca e devolve o foco ao acionador.</p></section>
        <section><h2>Preferência e acesso</h2><p>Em Configurações, ocultar um módulo remove os atalhos e preserva seu acesso pelo endereço. Um veto simulado impede abrir a página. O privilégio Admin também é uma simulação explícita; nenhuma permissão de uma conta real é alterada.</p><Link className="shell-inline-link" href="/configuracoes">Experimentar em Configurações</Link></section>
        <section><h2>Encerrar a demonstração</h2><p>Sair da demonstração restaura a navegação e desativa o privilégio Admin simulado. O tema é preservado. Esta ação não representa logout de uma conta, pois a autenticação será implementada em outra etapa.</p></section>
        <Link className="shell-inline-link" href="/design-system">Fundamentos visuais</Link>
      </div>
    </>
  );
}
