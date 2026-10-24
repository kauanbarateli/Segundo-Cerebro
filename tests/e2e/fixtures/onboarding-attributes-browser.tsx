import { StrictMode, type AnchorHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SettingsFocusSection } from "../../../src/components/features/configuracoes/settings-focus-section";
import { ProjectContextSection } from "../../../src/components/features/projetos/project-context-section";

export function FixtureLink({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  void prefetch; return <a {...props} />;
}
let root: Root | null = null;
Object.assign(globalThis, { __startAttributes: (userId: string, projectId: string) => {
  const host = document.getElementById("attributes-root"); if (!host) throw new Error("FIXTURE_HOST_MISSING");
  root ??= createRoot(host);
  root.render(<StrictMode><main><h1>Preferências opcionais</h1><section aria-label="Perfil"><SettingsFocusSection key={userId} userId={userId} /></section><section aria-label="Projeto"><ProjectContextSection key={userId + projectId} userId={userId} projectId={projectId} /></section></main></StrictMode>);
} });
