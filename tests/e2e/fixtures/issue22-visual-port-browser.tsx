/** The entry is a declared fixture, never counted as historical product source.
 * Product imports below are resolved exclusively inside B/P/C Git blobs by the
 * visual VFS. Auth/RSC identity, Next navigation/link/image are explicit seams.
 * Providers, queries, Memory factory, connected client and both features are real.
 */
import { createContext, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceShell } from "../../../src/components/layout/workspace-shell";
import { WorkspacePage } from "../../../src/components/layout/workspace-page";
import { CaptureView } from "../../../src/components/features/capturar/capture-view";
import { TasksWorkspace } from "../../../src/components/features/tarefas/tasks-workspace";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import type { EstadoInicialMemoria } from "../../../src/adapters/memory";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";

export interface VisualFixtureData { userId: string; now: string; initial: EstadoInicialMemoria; connected: boolean }
interface Navigation { href: string; go(href: string, replace?: boolean, options?: { scroll?: boolean }): void }
const NavigationContext = createContext<Navigation | null>(null);
function useVisualNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("Visual navigation is outside its fixture.");
  return value;
}
export function usePathname() { return new URL(useVisualNavigation().href).pathname; }
export function useSearchParams() {
  const { href } = useVisualNavigation();
  return useMemo(() => new URLSearchParams(new URL(href).search), [href]);
}
export function useRouter() {
  const { go } = useVisualNavigation();
  return useMemo(() => ({ push: (href: string, options?: { scroll?: boolean }) => go(href, false, options),
    replace: (href: string, options?: { scroll?: boolean }) => go(href, true, options) }), [go]);
}
export function VisualLink({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { go } = useVisualNavigation();
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || href.startsWith("#")) return;
    event.preventDefault(); go(href);
  }}>{children}</a>;
}
// The original asset blob and original alt/classes/dimensions are preserved;
// the Next optimization network service is not part of this fixture.
export function VisualImage({ src, unoptimized: _unoptimized, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | { src: string }; unoptimized?: boolean }) {
  void _unoptimized;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} src={typeof src === "string" ? src : src.src} />;
}
function VisualNavigation({ children }: { children: ReactNode }) {
  const [href, setHref] = useState(window.location.href);
  const value = useMemo<Navigation>(() => ({ href, go(target, replace = false, options) {
    const next = new URL(target, window.location.href);
    if (next.origin !== window.location.origin || !["/capturar", "/tarefas"].includes(next.pathname)
      || [...next.searchParams.keys()].some(key => !["capture", "task", "view", "new"].includes(key))) throw new Error("Visual navigation escaped its two routes.");
    window.history[replace ? "replaceState" : "pushState"](null, "", next.href);
    setHref(next.href); if (options?.scroll !== false) window.scrollTo(0, 0);
  } }), [href]);
  useEffect(() => { const update = () => setHref(window.location.href); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
// One identical real policy across B/P/C. M3 enrichment and agenda reminders
// are vetoed by actual guards, never by fabricated empty HTTP/query responses.
// Activity and the entire real shell remain visible in the current tree: their
// additions are recorded differences, not erased to match the old screenshots.
const policy: AccessPolicy = { entitlements: { conhecimento: false, calendario: false }, isAdmin: false, preferences: {} };
function Surface() {
  const pathname = usePathname(), app = useDemoApplication();
  useEffect(() => {
    Object.assign(globalThis, { __loadIssue22VisualQueries: async () => { await Promise.all([app.load("tasks"), app.load("captures")]); },
      __inspectIssue22Visual: () => ({ userId: app.userId, mode: app.mode ?? "demo", today: app.today(),
        tasks: app.getSnapshot("tasks"), captures: app.getSnapshot("captures") }) });
  }, [app]);
  return <WorkspaceShell><WorkspacePage feature={pathname === "/capturar" ? "capturar" : "tarefas"}>
    {pathname === "/capturar" ? <CaptureView /> : <TasksWorkspace />}
  </WorkspacePage></WorkspaceShell>;
}
Object.assign(globalThis, { __startIssue22Visual: (data: VisualFixtureData) => {
  const root = document.getElementById("issue22-visual-root");
  if (!root || !data.userId || !data.initial || !Number.isFinite(Date.parse(data.now))) throw new Error("Visual fixture configuration is invalid.");
  // Only infrastructure options are intercepted at B's original factory seam.
  // The provider itself and the resulting adapters/hooks/snapshots are untouched.
  Object.assign(globalThis, { __issue22VisualFactoryData: data });
  createRoot(root).render(<VisualNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={data.connected ? data.userId : undefined} accountValuesHidden={false}>
      <Surface />
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></VisualNavigation>);
} });
