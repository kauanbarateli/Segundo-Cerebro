import { authorizeWorkspaceFeature } from "@/lib/auth/workspace-guard";
import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { CalendarIntegrations } from "@/components/features/calendario/calendar-integrations";

export const metadata: Metadata = { title: "Integrações · Segundo Cérebro" };

export default async function Page() {
  await authorizeWorkspaceFeature("integracoes");
  return <WorkspacePage feature="integracoes"><CalendarIntegrations /></WorkspacePage>;
}
