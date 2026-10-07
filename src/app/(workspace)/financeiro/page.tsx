import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { FinanceWorkspace } from "@/components/features/financeiro/finance-workspace";

export const metadata: Metadata = { title: "Financeiro · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("financeiro");
  return <WorkspacePage feature="financeiro"><Suspense fallback={<p role="status">Abrindo financeiro…</p>}><FinanceWorkspace /></Suspense></WorkspacePage>;
}
