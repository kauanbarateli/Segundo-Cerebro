import { createContext, useCallback, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

// Explicit Next navigation seam. Query-only transitions must rerender the real
// CaptureEditor; product providers/hooks/components and browser history stay real.
type Navigation = { href: string; navigate(href: string, replace?: boolean): void };
const Context = createContext<Navigation | null>(null);
function useNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("Issue22 navigation is missing.");
  return value;
}
export function FixtureNavigation({ children }: { children: ReactNode }) {
  const [href, setHref] = useState(window.location.pathname + window.location.search);
  const navigate = useCallback((value: string, replace = false) => {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/capturar" || [...url.searchParams.keys()].some(key => key !== "capture")) throw new Error("Navigation is outside this fixture.");
    if (replace) window.history.replaceState(null, "", url.pathname + url.search);
    else window.history.pushState(null, "", url.pathname + url.search);
    setHref(window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    const back = () => setHref(window.location.pathname + window.location.search);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  return <Context.Provider value={{ href, navigate }}>{children}</Context.Provider>;
}
export function usePathname() { return useNavigation().href.split("?")[0]!; }
export function useSearchParams() { const { href } = useNavigation(); return new URLSearchParams(href.includes("?") ? href.slice(href.indexOf("?") + 1) : ""); }
export function useRouter() {
  const { navigate } = useNavigation();
  return { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh() { throw new Error("Router refresh is outside this fixture."); } };
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
