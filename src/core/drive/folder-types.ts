import type { EntidadeDoUsuario } from "../contracts/base";

/** Shared persistent folder shape, introduced by Projects T023 and reused by Drive. */
export interface DriveFolder extends EntidadeDoUsuario {
  name: string; parent_id: string | null; project_id: string | null; position: number;
  deleted_at: string | null; deletion_batch_id: string | null; created_at: string; updated_at: string;
}
