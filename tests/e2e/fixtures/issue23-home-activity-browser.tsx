import { useState } from "react";
import { createRoot } from "react-dom/client";
import { HomeView } from "../../../src/components/features/inicio/home-view";
import { ActivityView } from "../../../src/components/features/atividade/activity-view";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";
import { FixtureNavigation, NavigationLink, usePathname } from "./home-preferences-navigation";

const policy: AccessPolicy = { entitlements: {}, isAdmin: false, preferences: {
  calendario: { visible: false, order: 10 }, financeiro: { visible: false, order: 20 },
  habitos: { visible: false, order: 30 }, projetos: { visible: false, order: 40 },
} };
function Surface() {
  const path = usePathname(), app = useDemoApplication();
  const [reads, setReads] = useState(0);
  return <main>
    <nav aria-label="Rotas da prova SQL"><NavigationLink href="/">Início</NavigationLink><NavigationLink href="/atividade">Atividade</NavigationLink></nav>
    <button onClick={() => { void app.refreshActive().then(() => setReads(value => value + 1)); }}>Atualizar consultas da prova</button>
    <output aria-label="Consultas atualizadas">{reads}</output>
    <h1>{path === "/atividade" ? "Atividade" : "Início"}</h1>
    {path === "/atividade" ? <ActivityView /> : <HomeView />}
  </main>;
}

Object.assign(globalThis, { __startIssue23SqlFixture: (userId: string) => {
  const element = document.getElementById("issue23-sql-fixture");
  if (!element) throw new Error("Issue23 SQL fixture root is missing.");
  // Real connected application/reader/hooks/components. Only routing/Link and
  // CSS are substituted by the fixture loader; there is no seeded hook state.
  createRoot(element).render(<FixtureNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden>
      <Surface />
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></FixtureNavigation>);
} });
