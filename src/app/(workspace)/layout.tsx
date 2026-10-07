import type { ReactNode } from "react";
import { DemoAccessProvider } from "@/lib/navigation/demo-access-provider";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { DemoApplicationProvider } from "@/lib/demo/demo-provider";
import { getAppMode } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/guards";
import type { AccessPolicy } from "@/core/access/resolve-access";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  let serverPolicy: AccessPolicy | undefined;
  if (getAppMode() === "supabase") {
    const identity = await requireUser();
    // Only presentation permissions cross the RSC boundary, never session data.
    serverPolicy = { entitlements: identity.entitlements ?? {}, preferences: {}, isAdmin: identity.role === "master" };
  }
  return <DemoAccessProvider serverPolicy={serverPolicy}><DemoApplicationProvider><WorkspaceShell>{children}</WorkspaceShell></DemoApplicationProvider></DemoAccessProvider>;
}
