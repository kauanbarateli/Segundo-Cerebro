import { requireMaster } from "@/lib/auth/guards";
import { AuthGuardError } from "@/lib/auth/types";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { AdminWorkspace } from "@/components/features/admin/admin-workspace";

export const metadata: Metadata = { title: "Admin · Segundo Cérebro" };

export default async function Page() {
  try { await requireMaster(); }
  catch (error) {
    if (error instanceof AuthGuardError && error.code === "forbidden") notFound();
    if (!(error instanceof AuthGuardError && error.code === "demo")) throw error;
  }
  return <WorkspacePage feature="admin"><AdminWorkspace /></WorkspacePage>;
}
