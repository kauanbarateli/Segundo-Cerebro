"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { Icons } from "@/components/ui/icons";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { WORKSPACE_ROUTES } from "@/lib/navigation/routes";
import { NavigationIcon } from "./navigation-icon";

export function WorkspacePage({ feature, children }: { feature: FeatureKey; children?: ReactNode }) {
  const { policy, ready } = useDemoAccess();
  const route = WORKSPACE_ROUTES.find((item) => item.feature === feature)!;
  const access = resolveAccess(feature, policy);

  return (
    <>
      <div className="shell-page-heading"><h1>{route.label}</h1><p>{route.description}</p></div>
      {!ready ? <div className="shell-loading" role="status">Preparando a demonstração…</div> : !access.allowed ? (
        <section className="shell-empty" aria-labelledby="access-title" data-access="denied">
          <span className="shell-empty-icon"><Icons.Lock /></span>
          <h2 id="access-title">Acesso indisponível nesta demonstração</h2>
          <p>{access.reason === "admin-required"
            ? "A área Admin exige o privilégio de administração. Você pode experimentar esse estado nas opções de demonstração em Configurações."
            : "Um veto de acesso simulado impede abrir este módulo, inclusive pelo endereço direto. Reveja o cenário em Configurações para permitir o acesso."}</p>
          <Link className="shell-inline-link" href="/configuracoes">Rever opções de demonstração<Icons.ChevronRight /></Link>
        </section>
      ) : children ?? (
        <section className="shell-empty" aria-labelledby="empty-title" data-access="allowed">
          <span className="shell-empty-icon"><NavigationIcon feature={feature} /></span>
          <h2 id="empty-title">{route.emptyTitle}</h2><p>{route.emptyDescription}</p>
          <div className="shell-empty-actions">
            {feature === "inicio" ? <>
              <Link className="shell-inline-link" href="/capturar">Explorar Capturar<Icons.ChevronRight /></Link>
              <Link className="shell-inline-link" href="/design-system">Fundamentos visuais<Icons.ChevronRight /></Link>
            </> : <Link className="shell-inline-link" href="/">Voltar ao Início<Icons.ChevronRight /></Link>}
          </div>
        </section>
      )}
    </>
  );
}
