import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { FinanceWorkspace } from "@/components/features/financeiro/finance-workspace";

export const metadata: Metadata = { title: "Financeiro · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="financeiro"><Suspense fallback={<p role="status">Abrindo financeiro…</p>}><FinanceWorkspace /></Suspense></WorkspacePage>;
}
