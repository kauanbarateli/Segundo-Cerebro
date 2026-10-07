import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { TasksWorkspace } from "@/components/features/tarefas/tasks-workspace";

export const metadata: Metadata = { title: "Tarefas · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("tarefas");
  return <WorkspacePage feature="tarefas"><Suspense fallback={<p role="status">Abrindo tarefas…</p>}><TasksWorkspace /></Suspense></WorkspacePage>;
}
