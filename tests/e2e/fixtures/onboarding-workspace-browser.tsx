import { StrictMode, type AnchorHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { OnboardingWorkspace } from "../../../src/components/features/onboarding/onboarding-workspace";
import { parseOnboardingOAuthNotice } from "../../../src/components/features/onboarding/oauth-notice";

export function FixtureLink({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  void prefetch; return <a {...props} />;
}
const navigations: string[] = [];
const router = { push(path: string) { navigations.push(path); } };
export function useFixtureRouter() { return router; }
export function useFixturePathname() { return "/onboarding"; }
let root: Root | null = null;
Object.assign(globalThis, {
  __onboardingNavigations: navigations,
  __startOnboarding(ownerId: string) {
    const host = document.getElementById("onboarding-root"); if (!host) throw new Error("FIXTURE_HOST_MISSING");
    root ??= createRoot(host);
    // Deliberately no owner key: the real lifetime fence must ignore old replies.
    const notices = new URL(window.location.href).searchParams.getAll("notice");
    const notice = parseOnboardingOAuthNotice(notices.length === 1 ? notices[0] : notices);
    root.render(<StrictMode><ThemeProvider><OnboardingWorkspace ownerId={ownerId} notice={notice} /></ThemeProvider></StrictMode>);
  },
});
