import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { DemoSettings } from "@/components/layout/demo-settings";

export const metadata: Metadata = { title: "Configurações · Segundo Cérebro" };

export default function SettingsPage() {
  return <WorkspacePage feature="configuracoes"><DemoSettings /></WorkspacePage>;
}
