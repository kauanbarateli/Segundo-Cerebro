import { createRoot } from "react-dom/client";
import { ConnectedKnowledgeWorkspace } from "../../../src/components/features/conhecimento/knowledge-connected-workspace";
import { KnowledgeFixtureProvider, NavigationLink, useFixturePath, type KnowledgeFixtureOptions } from "./knowledge-workspace-context";
function Surface() {
  const path = useFixturePath();
  return <main><nav aria-label="Módulos sintéticos"><NavigationLink href="/conhecimento">Conhecimento</NavigationLink><NavigationLink href="/outro">Outro módulo</NavigationLink></nav>
    <h1>{path.startsWith("/conhecimento") ? "Conhecimento" : "Outro módulo"}</h1>{path.startsWith("/conhecimento") ? <ConnectedKnowledgeWorkspace /> : <p>Outra superfície sintética. Use Voltar para retomar a página.</p>}
  </main>;
}
Object.assign(globalThis, { __startKnowledgeFixture: (options: KnowledgeFixtureOptions) => {
  const root = document.getElementById("knowledge-fixture"); if (!root) throw new Error("Knowledge fixture root missing.");
  createRoot(root).render(<KnowledgeFixtureProvider options={options}><Surface /></KnowledgeFixtureProvider>);
} });
