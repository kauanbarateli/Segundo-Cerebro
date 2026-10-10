import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { CaptureView } from "../../../src/components/features/capturar/capture-view";
import { KnowledgeWorkspace } from "../../../src/components/features/conhecimento/knowledge-workspace";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";

const paths: Record<string, readonly string[]> = { "/capturar": ["capture"], "/conhecimento": ["notebook", "note", "view", "q", "origin"] };
function bounded(value: string | URL) {
  const url = new URL(value, window.location.origin), keys = paths[url.pathname];
  if (url.origin !== window.location.origin || !keys || url.hash || [...url.searchParams.keys()].some(key => !keys.includes(key))) throw new Error("Knowledge tree navigation is outside the fixture.");
  return url.pathname + url.search;
}
type Navigation = { href: string; navigate(href: string, replace?: boolean): void };
const Context = createContext<Navigation | null>(null);
function useNavigation() { const value = useContext(Context); if (!value) throw new Error("Knowledge tree navigation is missing."); return value; }
function NavigationProvider({ children }: { children: ReactNode }) {
  const [href, setHref] = useState(() => bounded(window.location.href));
  useEffect(() => {
    // Observe original Capture History writes. No synthetic selected item or
    // backend/hook state is retained after a full document reload.
    const push = window.history.pushState, replace = window.history.replaceState, notify = () => setHref(bounded(window.location.href));
    const observedPush: History["pushState"] = function (this: History, data, unused, url) { if (url !== undefined && url !== null) bounded(url); push.call(this, data, unused, url); notify(); };
    const observedReplace: History["replaceState"] = function (this: History, data, unused, url) { if (url !== undefined && url !== null) bounded(url); replace.call(this, data, unused, url); notify(); };
    window.history.pushState = observedPush; window.history.replaceState = observedReplace; window.addEventListener("popstate", notify);
    return () => { window.removeEventListener("popstate", notify); if (window.history.pushState === observedPush) window.history.pushState = push; if (window.history.replaceState === observedReplace) window.history.replaceState = replace; };
  }, []);
  const navigate = useCallback((target: string, replace = false) => { const next = bounded(target); if (replace) window.history.replaceState(null, "", next); else window.history.pushState(null, "", next); setHref(bounded(window.location.href)); }, []);
  return <Context.Provider value={{ href, navigate }}>{children}</Context.Provider>;
}
export function usePathname() { return useNavigation().href.split("?")[0]!; }
export function useSearchParams() { const { href } = useNavigation(); return useMemo(() => new URLSearchParams(href.split("?")[1] ?? ""), [href]); }
export function useRouter() { const { navigate } = useNavigation(); return useMemo(() => ({ push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh() { throw new Error("Next refresh is outside this fixture."); } }), [navigate]); }
export function NavigationLink({ href = "#", onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useNavigation();
  return <a {...props} href={href} onClick={event => { onClick?.(event); if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(href); } }}>{children}</a>;
}
const policy: AccessPolicy = { isAdmin: false, entitlements: { calendario: false, financeiro: false, habitos: false, cofre: false }, preferences: {} };
function Surface() {
  const path = usePathname(), app = useDemoApplication();
  return <main className="foundation-page" data-application-mode={app.mode}><h1>{path === "/capturar" ? "Capturar" : "Conhecimento"}</h1>{path === "/capturar" ? <CaptureView /> : <KnowledgeWorkspace />}</main>;
}
Object.assign(globalThis, { __startIssue28KnowledgeTreeSql: (userId: string) => {
  const element = document.getElementById("issue28-knowledge-tree-sql"); if (!element) throw new Error("Knowledge tree fixture root missing.");
  createRoot(element).render(<NavigationProvider><ThemeProvider><InstallProvider><ToastProvider><DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden><Surface /></DemoApplicationProvider></DemoAccessProvider></ToastProvider></InstallProvider></ThemeProvider></NavigationProvider>);
} });
