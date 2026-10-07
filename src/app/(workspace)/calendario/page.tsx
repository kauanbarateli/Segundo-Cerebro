import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { CalendarWorkspace, CalendarSkeleton } from "@/components/features/calendario/calendar-workspace";

export const metadata: Metadata = { title: "Calendário · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("calendario");
  return <WorkspacePage feature="calendario"><Suspense fallback={<CalendarSkeleton />}><CalendarWorkspace /></Suspense></WorkspacePage>;
}
