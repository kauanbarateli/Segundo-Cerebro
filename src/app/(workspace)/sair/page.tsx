import type { Metadata } from "next";
import Link from "next/link";
import { Icons } from "@/components/ui/icons";
import { getAppMode } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sair · Segundo Cérebro" };

export default async function DemoExitPage() {
  if (getAppMode() === "supabase") {
    await requireUser();
    return <section className="shell-empty"><h1>Sair da conta</h1><p>Ao sair, suas sessões serão encerradas. Você poderá entrar novamente com sua senha.</p><form method="post" action="/auth/logout"><Button type="submit">Sair da conta</Button></form><Link className="shell-inline-link" href="/">Voltar ao Início</Link></section>;
  }
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
