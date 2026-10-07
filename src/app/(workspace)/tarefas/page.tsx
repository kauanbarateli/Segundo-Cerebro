import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { TasksWorkspace } from "@/components/features/tarefas/tasks-workspace";

export const metadata: Metadata = { title: "Tarefas · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="tarefas"><Suspense fallback={<p role="status">Abrindo tarefas…</p>}><TasksWorkspace /></Suspense></WorkspacePage>;
}
