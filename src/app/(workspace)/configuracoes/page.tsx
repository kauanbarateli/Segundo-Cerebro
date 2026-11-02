import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { SettingsWorkspace } from "@/components/features/configuracoes/settings-workspace";

export const metadata: Metadata = { title: "Configurações · Segundo Cérebro" };

export default async function SettingsPage() {
  await authorizeWorkspaceFeature("configuracoes");
  return <WorkspacePage feature="configuracoes"><SettingsWorkspace /></WorkspacePage>;
}
