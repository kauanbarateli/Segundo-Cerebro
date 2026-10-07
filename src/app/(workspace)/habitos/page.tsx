import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { HabitsWorkspace, HabitsSkeleton } from "@/components/features/habitos/habits-workspace";

export const metadata: Metadata = { title: "Hábitos · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="habitos"><Suspense fallback={<HabitsSkeleton />}><HabitsWorkspace /></Suspense></WorkspacePage>;
}
