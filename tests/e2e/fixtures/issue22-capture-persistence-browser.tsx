import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { CaptureView } from "../../../src/components/features/capturar/capture-view";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import { IDLE_COMMAND } from "../../../src/lib/demo/connected-application";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";
import { FixtureNavigation } from "./issue22-capture-navigation";

// Ancillary modules are excluded from this fixture, never the reason for its
// RLS failure. Capturar/Tarefas remain allowed in both SQL and presentation.
const policy: AccessPolicy = { entitlements: { conhecimento: false, projetos: false }, isAdmin: false, preferences: {} };
function Surface() {
  const app = useDemoApplication();
  const feedback = useSyncExternalStore(app.subscribeCommands, app.getCommandSnapshot, () => IDLE_COMMAND);
  return <main className="foundation-page">
    <h1>Capturar</h1>
    <output aria-label="Proteção do envio">{feedback.status}</output>
    <CaptureView />
  </main>;
}
Object.assign(globalThis, { __startIssue22CaptureFixture: (userId: string) => {
  const element = document.getElementById("issue22-capture-fixture");
  if (!element) throw new Error("Issue22 capture root is missing.");
  // Real connected application, CaptureRequests, drafts and browser Web Locks /
  // localStorage journal. Auth/policy, public HTTP and routing are explicit seams.
  createRoot(element).render(<FixtureNavigation><ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden>
      <Surface />
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider></FixtureNavigation>);
} });
