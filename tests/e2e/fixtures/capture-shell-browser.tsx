/** Current product only. Auth/policy/Next routing remain explicit test seams.
 * The real shell, editor, providers, command journal and SQL-backed client stay
 * mounted together. No product CSS, controller or data factory is replaced.
 */
import { createRoot } from "react-dom/client";
import { WorkspaceShell } from "../../../src/components/layout/workspace-shell";
import { WorkspacePage } from "../../../src/components/layout/workspace-page";
import { CaptureView } from "../../../src/components/features/capturar/capture-view";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";
import { FixtureNavigation } from "./issue22-capture-navigation";

// These are actual presentation vetoes, not fabricated successful empty queries.
// Calendar reminders, M3 enrichment and promotion are outside this finite test.
// Capturar, the shell, menus, the other visible routes and their real geometry
// are preserved. Following an unsupported route fails the navigation seam.
const policy: AccessPolicy = { entitlements: { conhecimento: false, projetos: false, calendario: false }, isAdmin: false, preferences: {} };
Object.assign(globalThis, { __startCaptureShellFixture: (userId: string) => {
  const element = document.getElementById("capture-shell-fixture");
  if (!element) throw new Error("Capture shell root is missing.");
  createRoot(element).render(<FixtureNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden>
      <WorkspaceShell displayName="Pessoa de teste"><WorkspacePage feature="capturar"><CaptureView /></WorkspacePage></WorkspaceShell>
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></FixtureNavigation>);
} });
