import Link from "next/link";

export default function WorkspaceNotFound() {
  return <section className="shell-empty"><h1>Página indisponível</h1><p>O endereço não existe ou seu acesso a este módulo não está disponível.</p><Link className="shell-inline-link" href="/">Voltar ao Início</Link></section>;
}
