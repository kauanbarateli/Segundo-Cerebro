"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeatureKey } from "@/core/access/resolve-access";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { WORKSPACE_ROUTES } from "@/lib/navigation/routes";

/** Preference and test controls stay distinct; no real rights are user-editable. */
export function DemoSettings() {
  const { policy, setPreference, simulateEntitlement, simulateAdmin, resetDemo } = useDemoAccess();
  const [feature, setFeature] = useState<FeatureKey>("tarefas");
  const [feedback, setFeedback] = useState("");
  // Início and Configurações remain reachable so a demo cannot lock its own recovery UI.
  const configurable = WORKSPACE_ROUTES.filter((route) => route.feature !== "inicio" && route.feature !== "configuracoes");
  const route = WORKSPACE_ROUTES.find((item) => item.feature === feature)!;
  const preference = policy.preferences[feature] ?? { visible: true, order: WORKSPACE_ROUTES.indexOf(route) };

  return (
    <section className="shell-preferences" aria-label="Opções de navegação demonstrativas">
      <p className="shell-preferences-intro">Estas opções testam a navegação, sem conta conectada. As escolhas ficam nesta aba; quando o armazenamento está bloqueado, duram até recarregar. Nenhum dado é enviado a um servidor.</p>
      <Field as="select" label="Funcionalidade de demonstração" value={feature} wrapperClassName="shell-preferences-target"
        onChange={(event) => { setFeature(event.target.value as FeatureKey); setFeedback(""); }}>
        {configurable.map((item) => <option key={item.feature} value={item.feature}>{item.label}</option>)}
      </Field>
      <div className="shell-preferences-grid">
        <section className="shell-preferences-section" aria-labelledby="preference-title">
          <h2 id="preference-title">Sua preferência de navegação</h2>
          <p>Ocultar um módulo remove seus atalhos. O endereço continua acessível se houver direito de acesso.</p>
          <Field as="select" label="Visibilidade na navegação" value={preference.visible ? "visible" : "hidden"} onChange={(event) => {
            const visible = event.target.value === "visible";
            setPreference(feature, { ...preference, visible });
            setFeedback(`${route.label}: ${visible ? "visível" : "oculto"} na navegação. O direito de acesso não mudou.`);
          }}>
            <option value="visible">Mostrar módulo</option><option value="hidden">Ocultar módulo</option>
          </Field>
          <Field as="select" label="Ordem de preferência" value={preference.order} onChange={(event) => {
            setPreference(feature, { ...preference, order: Number(event.target.value) });
            setFeedback(`Ordem de ${route.label} atualizada.`);
          }} hint="Números menores aparecem antes; empates seguem a ordem original.">
            {WORKSPACE_ROUTES.map((item, index) => <option value={index} key={item.feature}>{index + 1}</option>)}
          </Field>
          <Link className="shell-inline-link" href={route.href}>Abrir {route.label} pelo endereço</Link>
        </section>
        <section className="shell-preferences-section" aria-labelledby="simulation-title">
          <h2 id="simulation-title">Cenário de acesso simulado</h2>
          <p>Controle exclusivo desta demonstração. Na aplicação com contas, o usuário não poderá editar seu próprio Entitlement.</p>
          <Field as="select" label="Entitlement simulado" value={policy.entitlements[feature] === false ? "denied" : "allowed"} onChange={(event) => {
            const allowed = event.target.value === "allowed";
            simulateEntitlement(feature, allowed);
            setFeedback(`${route.label}: acesso ${allowed ? "permitido" : "vetado"} no cenário simulado. A preferência foi preservada.`);
          }}>
            <option value="allowed">Permitir acesso</option><option value="denied">Vetar acesso</option>
          </Field>
          <Field as="select" label="Privilégio Admin da demonstração" value={policy.isAdmin ? "enabled" : "disabled"} onChange={(event) => {
            const enabled = event.target.value === "enabled";
            simulateAdmin(enabled);
            setFeedback(`Privilégio Admin de demonstração ${enabled ? "ativado" : "desativado"}.`);
          }}>
            <option value="disabled">Sem privilégio Admin</option><option value="enabled">Simular privilégio Admin</option>
          </Field>
        </section>
      </div>
      <div className="shell-preferences-footer">
        <Button onClick={() => { resetDemo(); setFeedback("Demonstração restaurada: módulos visíveis, Plano Pessoal e sem privilégio Admin."); }}>Restaurar demonstração</Button>
        <p className="shell-preferences-feedback" role="status">{feedback}</p>
      </div>
    </section>
  );
}
