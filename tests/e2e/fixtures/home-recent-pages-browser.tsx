import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { HomeView } from "../../../src/components/features/inicio/home-view";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider, useDemoAccess } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import { IDLE_COMMAND } from "../../../src/lib/demo/connected-application";
import { resolveAccess, type AccessPolicy } from "../../../src/core/access/resolve-access";
import { FixtureNavigation } from "./home-preferences-navigation";

function Surface() {
  const app = useDemoApplication(), [refreshes, setRefreshes] = useState(0);
  const { policy } = useDemoAccess(), knowledge = resolveAccess("conhecimento", policy);
  const feedback = useSyncExternalStore(app.subscribeCommands, app.getCommandSnapshot, () => IDLE_COMMAND);
  return <main data-application-mode={app.mode}>
    <h1>Início</h1>
    <button onClick={() => { void app.refreshActive().then(() => setRefreshes(value => value + 1)); }}>Atualizar leitores reais</button>
    <output aria-label="Atualizações concluídas">{refreshes}</output>
    <output aria-label="Estado do cliente real">{feedback.status}</output>
    <output aria-label="Mensagem do cliente real">{"message" in feedback ? feedback.message : ""}</output>
    <output aria-label="Acesso ao Conhecimento">{JSON.stringify({ allowed: knowledge.allowed, visible: knowledge.visible })}</output>
    <HomeView />
  </main>;
}

Object.assign(globalThis, { __startHomeRecentPages: (userId: string, visible: boolean) => {
  const root = document.getElementById("home-recent-pages");
  if (!root) throw new Error("Recent pages fixture root is missing.");
  const policy: AccessPolicy = { entitlements: {}, isAdmin: false, preferences: {
    tarefas: { visible: false, order: 10 }, calendario: { visible: false, order: 20 }, financeiro: { visible: false, order: 30 },
    habitos: { visible: false, order: 40 }, projetos: { visible: false, order: 50 }, conhecimento: { visible, order: 60 },
    drive: { visible: false, order: 70 }, cofre: { visible: false, order: 80 }, integracoes: { visible: false, order: 90 },
  } };
  // Real application, readers, ownership checks and Home projection. Only
  // routing, HTTP/Auth and the auxiliary null image are explicit test seams.
  createRoot(root).render(<FixtureNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden><Surface /></DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></FixtureNavigation>);
} });
