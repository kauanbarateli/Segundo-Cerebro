"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { Icons } from "@/components/ui/icons";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { WORKSPACE_ROUTES } from "@/lib/navigation/routes";

export function WorkspacePage({ feature, children, title, subtitle, actions }: {
  feature: FeatureKey; children: ReactNode;
  /** Layout Codex heading: defaults to the module name and its subtitle. */
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
}) {
  const { policy, ready } = useDemoAccess();
  const route = WORKSPACE_ROUTES.find((item) => item.feature === feature)!;
  const access = resolveAccess(feature, policy);

  return (
    <>
      <div className="shell-page-heading">
        <div><h1>{title ?? route.label}</h1><p>{subtitle ?? route.subtitle}</p></div>
        {actions && <div className="shell-page-actions">{actions}</div>}
      </div>
      {!ready ? <div className="shell-loading" role="status">Preparando a demonstração…</div> : !access.allowed ? (
        <section className="shell-empty" aria-labelledby="access-title" data-access="denied">
          <span className="shell-empty-icon"><Icons.Lock /></span>
          <h2 id="access-title">Acesso indisponível nesta demonstração</h2>
          <p>{access.reason === "admin-required"
            ? "A área Admin exige o privilégio de administração. Você pode experimentar esse estado nas opções de demonstração em Configurações."
            : "Um veto de acesso simulado impede abrir este módulo, inclusive pelo endereço direto. Reveja o cenário em Configurações para permitir o acesso."}</p>
          <Link className="shell-inline-link" href="/configuracoes">Rever opções de demonstração<Icons.ChevronRight /></Link>
        </section>
      ) : children}
    </>
  );
}
