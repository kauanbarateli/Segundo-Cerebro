import type { Metadata } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";

export const metadata: Metadata = { title: "Projetos · Segundo Cérebro" };

export default function Page() {
  return <WorkspacePage feature="projetos" />;
}
