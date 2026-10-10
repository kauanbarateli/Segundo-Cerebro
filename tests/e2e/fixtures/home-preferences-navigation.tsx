import { createContext, useCallback, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

// Only the Next routing boundary is replaced. Product providers/hooks stay real.
type Navigation = { path: string; navigate(href: string, replace?: boolean): void };
const Context = createContext<Navigation | null>(null);
function useNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("Home preferences navigation is missing.");
  return value;
}
export function FixtureNavigation({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  const navigate = useCallback((href: string, replace = false) => {
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
    setPath(window.location.pathname);
  }, []);
  useEffect(() => {
    const back = () => setPath(window.location.pathname);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  return <Context.Provider value={{ path, navigate }}>{children}</Context.Provider>;
}
export function usePathname() { return useNavigation().path; }
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
