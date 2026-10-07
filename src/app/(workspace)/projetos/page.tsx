import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { ProjectsWorkspace, ProjectsSkeleton } from "@/components/features/projetos/projects-workspace";

export const metadata: Metadata = { title: "Projetos · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="projetos"><Suspense fallback={<ProjectsSkeleton />}><ProjectsWorkspace /></Suspense></WorkspacePage>;
}
