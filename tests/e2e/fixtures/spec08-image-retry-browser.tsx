import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectEditor } from "../../../src/components/features/projetos/project-editor";
import { HabitEditor } from "../../../src/components/features/habitos/habit-editor";
import "../../../src/components/features/habitos/habits.css";
import { EntityImageEditor } from "../../../src/components/layout/entity-image-editor";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import { LOCAL_STORAGE_ORIGIN } from "../../../src/lib/files/storage-origin";
import type { HabitoDoUsuario, Projeto } from "../../../src/core/contracts";

// Test-only navigation port. Original editors/provider/journal remain in use.
export function usePathname() { return "/projetos"; }
type Editor = "entity" | "project" | "project-edit" | "project-demo-edit" | "habit" | "habit-edit";
const existingProject: Projeto = { id: "A0000000-0000-4000-8000-000000000003", user_id: "10000000-0000-4000-8000-000000000001", name: "Projeto de prova", description: null, color_key: "work", position: 0, deleted_at: null, created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z" };
const existingHabit: HabitoDoUsuario = { id: existingProject.id, user_id: existingProject.user_id, name: "Hábito de prova", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-10-19", archived_at: null, color_key: "personal", icon_key: null, position: 0, created_at: existingProject.created_at, updated_at: existingProject.updated_at };
function Surface({ editor }: { editor: Editor }) {
  const app = useDemoApplication();
  const row = editor === "project-demo-edit" ? { ...existingProject, id: "project-sc-v2", user_id: app.userId } : existingProject;
  const trigger = useRef<HTMLButtonElement>(null), [open, setOpen] = useState(false), [saved, setSaved] = useState("");
  const close = () => setOpen(false);
  return <main><h1>Prova sintética de retry de imagem</h1><button ref={trigger} onClick={() => setOpen(true)}>Abrir editor</button><output aria-label="Resultado">{saved}</output>
    {open && (editor === "habit" || editor === "habit-edit" ? <HabitEditor row={editor === "habit-edit" ? existingHabit : undefined} returnFocusRef={trigger} onClose={close} onSaved={() => setSaved("habit-saved")} /> : editor !== "entity" ? <ProjectEditor target={{ kind: "project", ...(editor === "project-edit" || editor === "project-demo-edit" ? { row } : {}) }} containers={[]} returnFocusRef={trigger} onClose={close} onSaved={id => setSaved(id ?? "")} />
      : <EntityImageEditor purpose="home_focus_image" entityId="10000000-0000-4000-8000-000000000001" currentFileId={null} title="Imagem privada" returnFocusRef={trigger} onClose={close} onSaved={id => setSaved(id ?? "removida")} />)}
  </main>;
}
Object.assign(globalThis, { __startSpec08ImageRetry: (editor: Editor) => {
  if (!["entity", "project", "project-edit", "project-demo-edit", "habit", "habit-edit"].includes(editor)) throw new Error("Unknown fixture editor.");
  const root = document.getElementById("spec08-image-retry"); if (!root) throw new Error("Fixture root missing.");
  createRoot(root).render(<DemoAccessProvider serverPolicy={{ isAdmin: false, entitlements: {}, preferences: {} }}><DemoApplicationProvider serverUserId={editor === "project-demo-edit" ? undefined : "10000000-0000-4000-8000-000000000001"} storageOrigin={LOCAL_STORAGE_ORIGIN} accountValuesHidden><Surface editor={editor} /></DemoApplicationProvider></DemoAccessProvider>);
} });
