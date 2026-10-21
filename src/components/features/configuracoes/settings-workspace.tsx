"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import type { DemoQueryKey } from "@/lib/demo/types";
import { resolveAccess } from "@/core/access/resolve-access";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { WORKSPACE_ROUTES } from "@/lib/navigation/routes";
import { DemoSettings } from "@/components/layout/demo-settings";
import { ThemeModels } from "@/components/theme/theme-models";
import { InstallHelp } from "@/components/pwa/install-help";
import { PageNavigation } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import "./settings.css";
import { SettingsConnectedWorkspace } from "./settings-connected-workspace";
import { SettingsLegalSection } from "./settings-legal-section";

const sections = [{ href: "#perfil", label: "Perfil" }, { href: "#aparencia", label: "Aparência" }, { href: "#modulos", label: "Módulos" }, { href: "#demonstracao", label: "Demonstração" }, { href: "#privacidade-e-termos", label: "Privacidade e termos" }, { href: "#instalacao", label: "Instalação" }];
const queryOptions = [
  { key: "tasks", feature: "tarefas" }, { key: "captures", feature: "capturar" },
  { key: "habits", feature: "habitos" }, { key: "finance", feature: "financeiro" },
  { key: "agenda", feature: "calendario" }, { key: "knowledge", feature: "conhecimento" },
  { key: "projects", feature: "projetos" }, { key: "drive", feature: "drive" },
  { key: "vault", feature: "cofre" }, { key: "settings", feature: "configuracoes" },
] as const;

export function SettingsWorkspace() {
  const { connected } = useDemoAccess();
  return connected ? <SettingsConnectedWorkspace /> : <DemoSettingsWorkspace />;
}
function DemoSettingsWorkspace() {
  const query = useDemoQuery("settings"), app = useDemoApplication();
  const { policy, connected } = useDemoAccess();
  const [hash, setHash] = useState("#perfil");
  const [readKey, setReadKey] = useState<DemoQueryKey>("drive");
  const [scenario, setScenario] = useState<"example" | "empty">(app.scenario);
  const [feedback, setFeedback] = useState(() => app.epoch > 0 ? app.scenario === "empty" ? "Cenário sem registros carregado." : "Exemplos carregados para uma nova visita." : "");
  const eligible = queryOptions.filter((option) => resolveAccess(option.feature, policy).allowed);
  const selected = eligible.find((option) => option.key === readKey) ?? eligible.find((option) => option.key === "settings")!;
  const target = WORKSPACE_ROUTES.find((route) => route.feature === selected.feature)!;
  useEffect(() => {
    const update = () => setHash(sections.some((section) => section.href === window.location.hash) ? window.location.hash : "#perfil");
    update(); window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const integrations = resolveAccess("integracoes", policy).allowed;
  return <div className="settings-workspace" data-access="allowed">
    <p className="settings-intro">Ajuste o Segundo Cérebro ao seu jeito de organizar a vida.</p>
    <PageNavigation label="Nesta página" items={sections} currentHref={hash} />
    <section id="perfil" className="settings-panel" aria-labelledby="settings-profile-title">
      <div className="settings-heading"><h2 id="settings-profile-title">Perfil</h2><p>{connected ? "Sua conta está conectada." : "Como você aparece nesta demonstração."}</p></div>
      {connected ? <div><p className="settings-text">Sua conta está conectada. Os dados dos módulos continuam sendo exemplos temporários.</p><Link className="settings-link" href="/trocar-senha">Trocar senha</Link></div>
        : query.status === "error" ? <div className="settings-error"><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></div>
        : !query.data ? <div className="settings-profile-skeleton" role="status" aria-label="Carregando perfil"><i aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /></div>
          : query.data.profile ? <div className="settings-profile"><span className="settings-avatar" aria-hidden="true">{query.data.profile.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{query.data.profile.display_name}</strong><p>{query.data.profile.email_label}</p><p>Perfil ilustrativo · sem conta conectada</p></div></div>
            : <p className="settings-text">Nenhum perfil de exemplo neste cenário. As preferências continuam disponíveis abaixo.</p>}
    </section>
    <section id="aparencia" className="settings-panel" aria-labelledby="settings-appearance-title">
      <div className="settings-heading"><h2 id="settings-appearance-title">Aparência</h2><p>O tema acompanha todas as áreas e fica salvo neste navegador. Sistema acompanha a preferência do aparelho.</p></div>
      <ThemeModels legend="Tema" />
    </section>
    <section id="modulos" className="settings-panel" aria-label="Módulos e cenários de acesso">
      <div className="settings-heading"><h2>Módulos</h2><p>{connected ? "Os módulos liberados para sua conta." : "Visibilidade, ordem e acesso simulado desta demonstração."}</p></div>
      {connected
        ? <p className="settings-text">A navegação mostra os módulos liberados para sua conta. Suas permissões são verificadas no servidor a cada acesso. A personalização será disponibilizada em uma próxima etapa.</p>
        : <DemoSettings />}
    </section>
    {integrations && <section className="settings-panel settings-panel--row" aria-labelledby="settings-calendars-title">
      <div className="settings-heading"><h2 id="settings-calendars-title">Calendários conectados</h2><p>Contas e fontes da agenda ficam reunidas em Integrações.</p></div>
      <Link className="settings-button-link" href="/integracoes">Gerenciar integrações<Icons.ChevronRight /></Link>
    </section>}
    <section id="demonstracao" className="settings-panel" aria-labelledby="settings-demo-title">
      <div className="settings-heading"><h2 id="settings-demo-title">Dados da demonstração</h2><p>Explore os estados de leitura dos módulos permitidos. Estas ferramentas não alteram direitos de acesso nem os dados de uma conta real.</p></div>
      <div className="settings-demo-grid"><div className="settings-demo-block">
        <h3>Falha de leitura</h3>
        <Field as="select" label="Módulo para testar leitura" value={selected.key} onChange={(event) => { setReadKey(event.target.value as DemoQueryKey); setFeedback(""); }}>
          {eligible.map((option) => <option key={option.key} value={option.key}>{WORKSPACE_ROUTES.find((route) => route.feature === option.feature)!.label}</option>)}
        </Field>
        <div className="settings-row"><Button onClick={() => { app.failNextRead(selected.key); setFeedback(`${target.label}: a próxima leitura falhará uma vez. Use Tentar de novo no módulo para recuperar os dados.`); }}>Simular falha na próxima leitura</Button>
          <Link className="settings-link" href={target.href}>Abrir {target.label}</Link></div>
      </div><div className="settings-demo-block">
        <h3>Cenário de dados</h3><Field as="select" label="Cenário de dados" value={scenario} onChange={(event) => setScenario(event.target.value as "example" | "empty")}><option value="example">Com exemplos</option><option value="empty">Sem registros</option></Field>
        <p>{connected ? "Carregar um cenário substitui apenas os exemplos desta visita. As permissões da sua conta permanecem iguais." : "Carregar um cenário substitui os dados e rascunhos desta visita. Suas preferências e os vetos simulados são preservados."}</p>
        <Button onClick={() => { app.setScenario(scenario); setFeedback(scenario === "empty" ? "Cenário sem registros carregado." : "Exemplos carregados para uma nova visita."); }}>Carregar cenário</Button>
      </div></div><p className="settings-feedback" role="status">{feedback}</p>
    </section>
    <SettingsLegalSection />
    <section id="instalacao" className="settings-panel" aria-label="Instalação do aplicativo"><InstallHelp /></section>
  </div>;
}
