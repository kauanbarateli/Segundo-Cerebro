import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { VaultWorkspace } from "@/components/features/cofre/vault-workspace";

export const metadata: Metadata = { title: "Cofre · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("cofre");
  return <WorkspacePage feature="cofre"><VaultWorkspace /></WorkspacePage>;
}
