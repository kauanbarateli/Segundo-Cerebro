import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { Suspense } from "react";
import { DriveWorkspace, DriveSkeleton } from "@/components/features/drive/drive-workspace";

export const metadata: Metadata = { title: "Drive · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="drive"><Suspense fallback={<DriveSkeleton />}><DriveWorkspace /></Suspense></WorkspacePage>;
}
