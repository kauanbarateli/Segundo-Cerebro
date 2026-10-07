import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { CaptureView } from "@/components/features/capturar/capture-view";

export const metadata: Metadata = { title: "Capturar · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("capturar");
  return <WorkspacePage feature="capturar"><Suspense fallback={<p role="status">Carregando notas…</p>}><CaptureView /></Suspense></WorkspacePage>;
}
