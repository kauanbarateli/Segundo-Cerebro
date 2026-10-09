import type { Metadata } from "next";
import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import { ActivityView } from "@/components/features/atividade/activity-view";

export const metadata: Metadata = { title: "Atividade · Segundo Cérebro" };
export default async function ActivityPage() {
  await authorizeWorkspaceFeature("inicio");
  return <><div className="shell-page-heading"><h1>Atividade</h1><p>Acompanhe as mudanças nas suas Capturas e Tarefas.</p></div><ActivityView /></>;
}
