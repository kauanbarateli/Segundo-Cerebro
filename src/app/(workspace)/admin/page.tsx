import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";

export const metadata: Metadata = { title: "Admin · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("admin");
  return <WorkspacePage feature="admin" />;
}
