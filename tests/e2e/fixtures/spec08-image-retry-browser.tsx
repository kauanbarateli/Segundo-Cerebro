import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectEditor } from "../../../src/components/features/projetos/project-editor";
import { EntityImageEditor } from "../../../src/components/layout/entity-image-editor";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider } from "../../../src/lib/demo/demo-provider";
import { LOCAL_STORAGE_ORIGIN } from "../../../src/lib/files/storage-origin";

// Test-only navigation port. Original editors/provider/journal remain in use.
export function usePathname() { return "/projetos"; }
function Surface({ editor }: { editor: "entity" | "project" }) {
  const trigger = useRef<HTMLButtonElement>(null), [open, setOpen] = useState(false), [saved, setSaved] = useState("");
  const close = () => setOpen(false);
  return <main><h1>Prova sintética de retry de imagem</h1><button ref={trigger} onClick={() => setOpen(true)}>Abrir editor</button><output aria-label="Resultado">{saved}</output>
    {open && (editor === "project" ? <ProjectEditor target={{ kind: "project" }} containers={[]} returnFocusRef={trigger} onClose={close} onSaved={id => setSaved(id ?? "")} />
      : <EntityImageEditor purpose="home_focus_image" entityId="10000000-0000-4000-8000-000000000001" currentFileId={null} title="Imagem privada" returnFocusRef={trigger} onClose={close} onSaved={id => setSaved(id ?? "removida")} />)}
  </main>;
}
Object.assign(globalThis, { __startSpec08ImageRetry: (editor: "entity" | "project") => {
  if (editor !== "entity" && editor !== "project") throw new Error("Unknown fixture editor.");
  const root = document.getElementById("spec08-image-retry"); if (!root) throw new Error("Fixture root missing.");
  createRoot(root).render(<DemoAccessProvider serverPolicy={{ isAdmin: false, entitlements: {}, preferences: {} }}><DemoApplicationProvider serverUserId="10000000-0000-4000-8000-000000000001" storageOrigin={LOCAL_STORAGE_ORIGIN} accountValuesHidden><Surface editor={editor} /></DemoApplicationProvider></DemoAccessProvider>);
} });
