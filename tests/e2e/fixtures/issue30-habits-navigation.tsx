import type { AnchorHTMLAttributes } from "react";

// Closed Next navigation seam. These journeys stay on Hábitos; no product
// component/provider, query, command, hook state or acknowledgement is replaced.
export function usePathname() { return window.location.pathname; }
export function useSearchParams() { return new URLSearchParams(window.location.search); }
export function useRouter() {
  const refused = () => { throw new Error("Navigation is outside the Habits fixture."); };
  return { push: refused, replace: refused, refresh: refused };
}
export function NavigationLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} />;
}
