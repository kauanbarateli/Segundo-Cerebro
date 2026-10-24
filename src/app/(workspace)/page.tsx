import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { HomeView } from "@/components/features/inicio/home-view";
import { redirect } from "next/navigation";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/guards";
import { onboardingForRequest } from "@/adapters/db/onboarding-runtime";

export const metadata: Metadata = { title: "Início · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("inicio");
  const config = readAuthConfiguration();
  if (config.mode === "supabase") {
    // Only the home entry offers setup. A deep link, recovery or mandatory
    // password change keeps its existing destination and Auth precedence.
    const identity = await requireUser();
    let offerPending = false;
    try {
      const snapshot = await onboardingForRequest(config, identity).load();
      offerPending = snapshot.eligibility.kind === "new_explicit"
        && snapshot.eligibility.offerPending && snapshot.eligibility.canStart;
    } catch {
      // An unavailable optional setup must not interrupt an existing account.
      // The manual entry in Settings remains available; no private error leaks.
    }
    if (offerPending) redirect("/onboarding");
  }
  return <WorkspacePage feature="inicio"><HomeView /></WorkspacePage>;
}
