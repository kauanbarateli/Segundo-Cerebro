import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceShell } from "../../../src/components/layout/workspace-shell";
import { SettingsWorkspace } from "../../../src/components/features/configuracoes/settings-workspace";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";

const anchors = new Set(["", "#perfil", "#aparencia", "#modulos", "#lembretes", "#dados"]);
function bounded(value: string | URL) {
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname !== "/configuracoes" || url.search || !anchors.has(url.hash)) throw new Error("Settings navigation is outside the declared fixture.");
  return url.pathname + url.hash;
}
type Navigation = { href: string; navigate(href: string, replace?: boolean): void };
const Context = createContext<Navigation | null>(null);
function useNavigation() { const value = useContext(Context); if (!value) throw new Error("Settings fixture navigation missing."); return value; }
function NavigationProvider({ children }: { children: ReactNode }) {
  const [href, setHref] = useState(() => bounded(window.location.href));
  useEffect(() => {
    const push = window.history.pushState, replace = window.history.replaceState, notify = () => setHref(bounded(window.location.href));
    const observedPush: History["pushState"] = function (this: History, data, unused, url) { if (url !== undefined && url !== null) bounded(url); push.call(this, data, unused, url); notify(); };
    const observedReplace: History["replaceState"] = function (this: History, data, unused, url) { if (url !== undefined && url !== null) bounded(url); replace.call(this, data, unused, url); notify(); };
    window.history.pushState = observedPush; window.history.replaceState = observedReplace; window.addEventListener("popstate", notify); window.addEventListener("hashchange", notify);
    return () => { window.removeEventListener("popstate", notify); window.removeEventListener("hashchange", notify); if (window.history.pushState === observedPush) window.history.pushState = push; if (window.history.replaceState === observedReplace) window.history.replaceState = replace; };
  }, []);
  const navigate = useCallback((target: string, replace = false) => { const next = bounded(target); if (replace) window.history.replaceState(null, "", next); else window.history.pushState(null, "", next); setHref(bounded(window.location.href)); }, []);
  return <Context.Provider value={{ href, navigate }}>{children}</Context.Provider>;
}
export function usePathname() { return useNavigation().href.split("#")[0]!; }
export function useSearchParams() { useNavigation(); return useMemo(() => new URLSearchParams(), []); }
export function useRouter() { const { navigate } = useNavigation(); return useMemo(() => ({ push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh() { throw new Error("Next refresh/avatar is outside this fixture."); } }), [navigate]); }
export function NavigationLink({ href = "#", onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useNavigation();
  // Product internal anchors are ordinary native <a>, not a replaced control.
  return <a {...props} href={href} onClick={event => { onClick?.(event); if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(href); } }}>{children}</a>;
}
function Surface() {
  const app = useDemoApplication();
  return <WorkspaceShell><div className="foundation-page" data-application-mode={app.mode}><h1>Configurações</h1><SettingsWorkspace /></div></WorkspaceShell>;
}
Object.assign(globalThis, { __startIssue34SettingsSql: (userId: string, policy: AccessPolicy, valuesHidden: boolean) => {
  const element = document.getElementById("issue34-settings-sql"); if (!element || policy.isAdmin || policy.entitlements.calendario !== false) throw new Error("Ordinary settings fixture/disabled calendar policy required.");
  createRoot(element).render(<NavigationProvider><ThemeProvider><InstallProvider><ToastProvider><DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden={valuesHidden}><Surface /></DemoApplicationProvider></DemoAccessProvider></ToastProvider></InstallProvider></ThemeProvider></NavigationProvider>);
} });
