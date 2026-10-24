import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { FinanceWorkspace } from "@/components/features/financeiro/finance-workspace";
import { financeGoalsImagesAvailable } from "@/adapters/db/finance-goals-images-availability";
import { GoalImagesHostProvider } from "@/components/features/financeiro/goals/goal-image-host-binding";

export const metadata: Metadata = { title: "Financeiro · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("financeiro");
  return <WorkspacePage feature="financeiro"><GoalImagesHostProvider enabled={financeGoalsImagesAvailable()}><Suspense fallback={<p role="status">Abrindo financeiro…</p>}><FinanceWorkspace /></Suspense></GoalImagesHostProvider></WorkspacePage>;
}
