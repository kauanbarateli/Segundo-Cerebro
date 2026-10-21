import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectEditor } from "../../../src/components/features/projetos/project-editor";
import { EntityImageEditor } from "../../../src/components/layout/entity-image-editor";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider } from "../../../src/lib/demo/demo-provider";
import { LOCAL_STORAGE_ORIGIN } from "../../../src/lib/files/storage-origin";
import type { Projeto } from "../../../src/core/contracts";

// Test-only navigation port. Original editors/provider/journal remain in use.
export function usePathname() { return "/projetos"; }
type Editor = "entity" | "project" | "project-edit";
const existingProject: Projeto = { id: "A0000000-0000-4000-8000-000000000003", user_id: "10000000-0000-4000-8000-000000000001", name: "Projeto de prova", description: null, color_key: "work", position: 0, deleted_at: null, created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z" };
function Surface({ editor }: { editor: Editor }) {
  const trigger = useRef<HTMLButtonElement>(null), [open, setOpen] = useState(false), [saved, setSaved] = useState("");
  const close = () => setOpen(false);
  return <main><h1>Prova sintética de retry de imagem</h1><button ref={trigger} onClick={() => setOpen(true)}>Abrir editor</button><output aria-label="Resultado">{saved}</output>
    {open && (editor !== "entity" ? <ProjectEditor target={{ kind: "project", ...(editor === "project-edit" ? { row: existingProject } : {}) }} containers={[]} returnFocusRef={trigger} onClose={close} onSaved={id => setSaved(id ?? "")} />
      : <EntityImageEditor purpose="home_focus_image" entityId="10000000-0000-4000-8000-000000000001" currentFileId={null} title="Imagem privada" returnFocusRef={trigger} onClose={close} onSaved={id => setSaved(id ?? "removida")} />)}
  </main>;
}
Object.assign(globalThis, { __startSpec08ImageRetry: (editor: Editor) => {
  if (editor !== "entity" && editor !== "project" && editor !== "project-edit") throw new Error("Unknown fixture editor.");
  const root = document.getElementById("spec08-image-retry"); if (!root) throw new Error("Fixture root missing.");
  createRoot(root).render(<DemoAccessProvider serverPolicy={{ isAdmin: false, entitlements: {}, preferences: {} }}><DemoApplicationProvider serverUserId="10000000-0000-4000-8000-000000000001" storageOrigin={LOCAL_STORAGE_ORIGIN} accountValuesHidden><Surface editor={editor} /></DemoApplicationProvider></DemoAccessProvider>);
} });
