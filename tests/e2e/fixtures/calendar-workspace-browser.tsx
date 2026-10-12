import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { WorkspacePage } from "../../../src/components/layout/workspace-page";
import { CalendarSkeleton, CalendarWorkspace } from "../../../src/components/features/calendario/calendar-workspace";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";

// Only the Next routing boundary is replaced. The composition mirrors
// src/app/(workspace)/calendario/page.tsx; access/application providers, the
// connected client, its command journal and CalendarWorkspace effects are the
// product modules. HTTP answers come from the spec's synthetic ports.
const replaced: string[] = [];
function bounded(value: string | URL) {
  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin || url.pathname !== "/calendario" || url.hash) throw new Error("Calendar navigation is outside the declared fixture.");
  return url.pathname + url.search;
}
type Navigation = { href: string; navigate(href: string, replace: boolean): void };
const Context = createContext<Navigation | null>(null);
function useNavigation() { const value = useContext(Context); if (!value) throw new Error("Calendar fixture navigation missing."); return value; }
function NavigationProvider({ children }: { children: ReactNode }) {
  const [href, setHref] = useState(() => bounded(window.location.href));
  useEffect(() => {
    const back = () => setHref(bounded(window.location.href));
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const navigate = useCallback((target: string, replace: boolean) => {
    const next = bounded(target);
    if (replace) { replaced.push(next); window.history.replaceState(null, "", next); } else window.history.pushState(null, "", next);
    setHref(next);
  }, []);
  const value = useMemo(() => ({ href, navigate }), [href, navigate]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePathname() { return useNavigation().href.split("?")[0]!; }
export function useSearchParams() { const { href } = useNavigation(); return useMemo(() => new URL(href, window.location.origin).searchParams, [href]); }
export function useRouter() {
  const { navigate } = useNavigation();
  return useMemo(() => ({ push: (href: string) => navigate(href, false), replace: (href: string) => navigate(href, true), refresh() { throw new Error("Router refresh is outside the Calendar fixture."); } }), [navigate]);
}
export function NavigationLink({ href = "#", onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useNavigation();
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(href, false); }
  }}>{children}</a>;
}

Object.assign(globalThis, { __calendarWorkspaceFixture: {
  start(userId: string, policy: AccessPolicy) {
    const element = document.getElementById("calendar-workspace");
    if (!element || policy.isAdmin || policy.entitlements.calendario === false) throw new Error("Ordinary calendar fixture required.");
    createRoot(element).render(<NavigationProvider><DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId}>
      <main className="calendar-fixture"><WorkspacePage feature="calendario"><Suspense fallback={<CalendarSkeleton />}><CalendarWorkspace /></Suspense></WorkspacePage></main>
    </DemoApplicationProvider></DemoAccessProvider></NavigationProvider>);
  },
  replaced: () => [...replaced],
} });
