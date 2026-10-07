import type { Metadata } from "next";
import Link from "next/link";
import { Icons } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Demonstração encerrada · Segundo Cérebro" };

export default function DemoExitPage() {
  return (
    <>
      <div className="shell-page-heading"><h1>Demonstração encerrada</h1><p>Você pode voltar para explorar quando quiser.</p></div>
      <section className="shell-empty" aria-labelledby="exit-title">
        <span className="shell-empty-icon"><Icons.Logout /></span>
        <h2 id="exit-title">Até a próxima ideia</h2>
        <p>Não havia uma conta conectada. Os dados desta visita e os rascunhos de captura foram descartados. As opções de navegação voltaram ao estado inicial; sua escolha de tema permanece no navegador.</p>
        <Link className="shell-inline-link" href="/">Voltar à demonstração<Icons.ChevronRight /></Link>
      </section>
    </>
  );
}
