import { useState } from "react";
import { createRoot } from "react-dom/client";
import { HomeView } from "../../../src/components/features/inicio/home-view";
import { SettingsConnectedWorkspace } from "../../../src/components/features/configuracoes/settings-connected-workspace";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider, useDemoAccess } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import { settingsPreferences, validAccountSettings } from "../../../src/core/configuracoes";
import { resolveAccess } from "../../../src/core/access/resolve-access";
import { FixtureNavigation, NavigationLink, usePathname } from "./home-preferences-navigation";

function Surface() {
  const path = usePathname(), app = useDemoApplication(), { policy } = useDemoAccess();
  const [refreshes, setRefreshes] = useState(0);
  const access = resolveAccess("tarefas", policy);
  return <main>
    <nav aria-label="Rotas do teste"><NavigationLink href="/">Início</NavigationLink><NavigationLink href="/configuracoes">Configurações</NavigationLink></nav>
    <output aria-label="Política de Tarefas">{JSON.stringify({ allowed: access.allowed, visible: access.visible })}</output>
    <button onClick={() => { void app.refreshActive().then(() => setRefreshes(value => value + 1)); }}>Atualizar leituras observadas</button>
    <output aria-label="Atualizações concluídas">{refreshes}</output>
    <h1>{path === "/configuracoes" ? "Configurações" : "Início"}</h1>
    {path === "/configuracoes" ? <SettingsConnectedWorkspace /> : <HomeView />}
  </main>;
}

Object.assign(globalThis, { __startHomePreferencesFixture: async (userId: string) => {
  const reply = await fetch("/api/settings", { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": userId } });
  const settings: unknown = await reply.json();
  if (!reply.ok || !validAccountSettings(settings, userId)) throw new Error("Home account settings fixture is invalid.");
  const element = document.getElementById("home-preferences-fixture");
  if (!element) throw new Error("Home preferences fixture root is missing.");
  // Same AccountSettings→presentation policy and connected providers as layout.
  const serverPolicy = { entitlements: {}, preferences: settingsPreferences(settings), isAdmin: false };
  createRoot(element).render(<FixtureNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={serverPolicy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden={settings.preferences.values_hidden}>
      <Surface />
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></FixtureNavigation>);
} });
