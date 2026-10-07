import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { KnowledgeWorkspace, KnowledgeSkeleton } from "@/components/features/conhecimento/knowledge-workspace";

export const metadata: Metadata = { title: "Conhecimento · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("conhecimento");
  return <WorkspacePage feature="conhecimento"><Suspense fallback={<KnowledgeSkeleton />}><KnowledgeWorkspace /></Suspense></WorkspacePage>;
}
