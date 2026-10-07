import type { ReactNode } from "react";
import { DemoAccessProvider } from "@/lib/navigation/demo-access-provider";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { DemoApplicationProvider } from "@/lib/demo/demo-provider";
import { getAppMode } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/guards";
import type { AccessPolicy } from "@/core/access/resolve-access";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  let serverPolicy: AccessPolicy | undefined;
  let serverUserId: string | undefined;
  if (getAppMode() === "supabase") {
    const identity = await requireUser();
    serverUserId = identity.userId;
    // Presentation permissions and verified user ID cross; Auth tokens stay on server.
    serverPolicy = { entitlements: identity.entitlements ?? {}, preferences: {}, isAdmin: identity.role === "master" };
  }
  return <DemoAccessProvider serverPolicy={serverPolicy}><DemoApplicationProvider serverUserId={serverUserId}><WorkspaceShell>{children}</WorkspaceShell></DemoApplicationProvider></DemoAccessProvider>;
}
