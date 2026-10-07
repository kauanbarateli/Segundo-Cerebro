import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { KnowledgeWorkspace, KnowledgeSkeleton } from "@/components/features/conhecimento/knowledge-workspace";

export const metadata: Metadata = { title: "Conhecimento · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="conhecimento"><Suspense fallback={<KnowledgeSkeleton />}><KnowledgeWorkspace /></Suspense></WorkspacePage>;
}
