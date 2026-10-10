import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ConnectedKnowledgeWorkspace } from "../../../src/components/features/conhecimento/knowledge-connected-workspace";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";

// Only the Next navigation boundary is replaced; search changes are real state.
type Navigation = { path: string; navigate(href: string, replace?: boolean): void };
const NavigationContext = createContext<Navigation | null>(null);
function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("Knowledge SQL navigation is missing.");
  return value;
}
function FixtureNavigation({ children }: { children: ReactNode }) {
  const current = () => window.location.pathname + window.location.search;
  const [path, setPath] = useState(current);
  const navigate = useCallback((href: string, replace = false) => {
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
    setPath(window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    const back = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  return <NavigationContext.Provider value={{ path, navigate }}>{children}</NavigationContext.Provider>;
}
export function usePathname() { return useNavigation().path.split("?")[0]; }
export function useSearchParams() {
  const { path } = useNavigation();
  return useMemo(() => new URLSearchParams(path.split("?")[1] ?? ""), [path]);
}
export function useRouter() {
  const { navigate } = useNavigation();
  return useMemo(() => ({ push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true) }), [navigate]);
}
export function NavigationLink({ href = "#", onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useNavigation();
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault(); navigate(href);
    }
  }}>{children}</a>;
}
const policy: AccessPolicy = { entitlements: {}, isAdmin: false, preferences: {
  projetos: { visible: false, order: 10 }, calendario: { visible: false, order: 20 },
  financeiro: { visible: false, order: 30 }, habitos: { visible: false, order: 40 },
} };
function Surface() {
  const app = useDemoApplication();
  return <main data-application-mode={app.mode}><h1>Conhecimento SQL</h1><ConnectedKnowledgeWorkspace /></main>;
}
Object.assign(globalThis, { __startIssue28KnowledgeSql: (userId: string) => {
  const element = document.getElementById("issue28-knowledge-sql");
  if (!element) throw new Error("Knowledge SQL fixture root is missing.");
  // Real providers, connected adapter/journal, reader and TipTap. No seeded hook
  // state or synthetic in-browser backend survives a full document reload.
  createRoot(element).render(<FixtureNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden>
      <Surface />
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></FixtureNavigation>);
} });
