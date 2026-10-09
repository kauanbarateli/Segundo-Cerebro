import type { ReactNode } from "react";
import { DemoAccessProvider } from "@/lib/navigation/demo-access-provider";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { DemoApplicationProvider } from "@/lib/demo/demo-provider";
import { getAppMode } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/guards";
import type { AccessPolicy } from "@/core/access/resolve-access";
import { settingsPreferences } from "@/core/configuracoes";
import { accountPresentation } from "@/adapters/db/account-presentation";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  let serverPolicy: AccessPolicy | undefined;
  let serverUserId: string | undefined;
  let valuesHidden: boolean | undefined;
  let avatarId: string | null = null;
  if (getAppMode() === "supabase") {
    const identity = await requireUser();
    serverUserId = identity.userId;
    // Presentation permissions and verified user ID cross; Auth tokens stay on server.
    const account = await accountPresentation();
    serverPolicy = { entitlements: identity.entitlements ?? {}, preferences: account?.user_id === identity.userId ? settingsPreferences(account) : {}, isAdmin: identity.role === "master" };
    valuesHidden = account?.user_id === identity.userId ? account.preferences.values_hidden : true;
    avatarId = account?.user_id === identity.userId ? account.profile.avatar_file_id : null;
  }
  return <DemoAccessProvider serverPolicy={serverPolicy}><DemoApplicationProvider serverUserId={serverUserId} accountValuesHidden={valuesHidden}><WorkspaceShell avatarId={avatarId}>{children}</WorkspaceShell></DemoApplicationProvider></DemoAccessProvider>;
}
