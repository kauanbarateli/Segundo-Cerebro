import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { SettingsWorkspace } from "@/components/features/configuracoes/settings-workspace";

export const metadata: Metadata = { title: "Configurações · Segundo Cérebro" };

export default function SettingsPage() {
  return <WorkspacePage feature="configuracoes"><SettingsWorkspace /></WorkspacePage>;
}
