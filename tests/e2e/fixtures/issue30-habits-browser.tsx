import { createRoot } from "react-dom/client";
import { HabitsWorkspace } from "../../../src/components/features/habitos/habits-workspace";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";

const policy: AccessPolicy = { entitlements: { conhecimento: false, projetos: false }, isAdmin: false, preferences: {} };
Object.assign(globalThis, { __startIssue30HabitsFixture: (userId: string) => {
  const element = document.getElementById("issue30-habits-fixture");
  if (!element) throw new Error("Habits fixture root is missing.");
  createRoot(element).render(<ThemeProvider><InstallProvider><ToastProvider>
    <DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId} accountValuesHidden>
      <main className="foundation-page"><h1>Hábitos</h1><HabitsWorkspace /></main>
    </DemoApplicationProvider></DemoAccessProvider>
  </ToastProvider></InstallProvider></ThemeProvider>);
} });
