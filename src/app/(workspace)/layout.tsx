import type { ReactNode } from "react";
import { DemoAccessProvider } from "@/lib/navigation/demo-access-provider";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <DemoAccessProvider><WorkspaceShell>{children}</WorkspaceShell></DemoAccessProvider>;
}
