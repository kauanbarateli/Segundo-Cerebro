import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { FinanceWorkspace } from "../../../src/components/features/financeiro/finance-workspace";
import { HomeView } from "../../../src/components/features/inicio/home-view";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";

// Only Next navigation is replaced. FinanceWorkspace uses native History for
// query-only transitions, so this seam observes actual push/replace/popstate.
const keys = new Set(["tab", "month", "q", "kind", "account", "category", "status", "page", "sort", "dir"]);
function boundHref(value: string | URL) {
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || !["/", "/financeiro"].includes(url.pathname) || url.hash ||
    url.pathname === "/" && url.search || [...url.searchParams.keys()].some(key => !keys.has(key))) throw new Error("Finance navigation is outside this fixture.");
  return url.pathname + url.search;
}
type Navigation = { href: string; navigate(href: string, replace?: boolean): void };
const Context = createContext<Navigation | null>(null);
function useNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("Finance SQL navigation is missing.");
  return value;
}
function FixtureNavigation({ children }: { children: ReactNode }) {
  const [href, setHref] = useState(() => boundHref(window.location.href));
  useEffect(() => {
    const push = window.history.pushState, replace = window.history.replaceState;
    const notify = () => setHref(boundHref(window.location.href));
    const pushObserved: History["pushState"] = function (this: History, data, unused, url) { if (url !== undefined && url !== null) boundHref(url); push.call(this, data, unused, url); notify(); };
    const replaceObserved: History["replaceState"] = function (this: History, data, unused, url) { if (url !== undefined && url !== null) boundHref(url); replace.call(this, data, unused, url); notify(); };
    window.history.pushState = pushObserved; window.history.replaceState = replaceObserved;
    window.addEventListener("popstate", notify);
    return () => {
      window.removeEventListener("popstate", notify);
      if (window.history.pushState === pushObserved) window.history.pushState = push;
      if (window.history.replaceState === replaceObserved) window.history.replaceState = replace;
    };
  }, []);
  const navigate = useCallback((value: string, replace = false) => {
    const target = boundHref(value);
    if (replace) window.history.replaceState(null, "", target); else window.history.pushState(null, "", target);
    setHref(boundHref(window.location.href));
  }, []);
  return <Context.Provider value={{ href, navigate }}>{children}</Context.Provider>;
}
export function usePathname() { return useNavigation().href.split("?")[0]!; }
export function useSearchParams() { const { href } = useNavigation(); return useMemo(() => new URLSearchParams(href.split("?")[1] ?? ""), [href]); }
export function useRouter() {
  const { navigate } = useNavigation();
  return useMemo(() => ({ push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh() { throw new Error("Next refresh is outside this fixture."); } }), [navigate]);
}
export function NavigationLink({ href = "#", onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useNavigation();
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); navigate(href); }
  }}>{children}</a>;
}
const policy: AccessPolicy = { entitlements: { conhecimento: false }, isAdmin: false, preferences: {
  capturar: { visible: false, order: 10 }, tarefas: { visible: false, order: 20 },
  habitos: { visible: false, order: 30 }, calendario: { visible: false, order: 40 }, projetos: { visible: false, order: 50 },
} };
function Surface() {
  const path = usePathname(), app = useDemoApplication();
  return <main className="foundation-page" data-application-mode={app.mode}>
    <nav aria-label="Rotas da prova financeira"><NavigationLink href="/">Início</NavigationLink><NavigationLink href="/financeiro">Financeiro</NavigationLink></nav>
    <h1>{path === "/" ? "Início" : "Financeiro"}</h1>
    {path === "/" ? <HomeView /> : <FinanceWorkspace />}
  </main>;
}
Object.assign(globalThis, { __startIssue26FinanceSql: (userId: string) => {
  const element = document.getElementById("issue26-finance-sql");
  if (!element) throw new Error("Finance SQL fixture root is missing.");
  createRoot(element).render(<FixtureNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden>
      <Surface />
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></FixtureNavigation>);
} });
