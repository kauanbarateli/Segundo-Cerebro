import type { ReactNode } from "react";
import { DemoAccessProvider } from "@/lib/navigation/demo-access-provider";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { DemoApplicationProvider } from "@/lib/demo/demo-provider";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <DemoAccessProvider><DemoApplicationProvider><WorkspaceShell>{children}</WorkspaceShell></DemoApplicationProvider></DemoAccessProvider>;
}
