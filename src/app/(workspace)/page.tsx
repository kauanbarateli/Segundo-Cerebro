import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { HomeView } from "@/components/features/inicio/home-view";

export const metadata: Metadata = { title: "Início · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="inicio"><HomeView /></WorkspacePage>;
}
