import type { EntidadeDoUsuario } from "../contracts/base";

/** Project mutations expose only container organization metadata. */
export interface ProjectContainer extends EntidadeDoUsuario {
  kind: "capture" | "notebook" | "folder"; name: string; project_id: string | null; parent_id: string | null;
  deleted_at: string | null; created_at: string; updated_at: string;
}
