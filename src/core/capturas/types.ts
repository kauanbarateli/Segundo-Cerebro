import type { EntidadeDoUsuario } from "../contracts/base";
export type TipoCaptura = "idea" | "task" | "note" | "reminder";
export type StatusCaptura = "draft" | "inbox" | "organized" | "archived";
/** T-009 mock attachment metadata. Image bytes belong to the storage adapter. */
export interface AnexoCaptura { id: string; name: string; mime: "image/png" | "image/jpeg"; width: number; height: number; bytes: number }
/** Every legacy Capture field, plus idempotency and standardized lifecycle metadata. */
export interface Captura extends EntidadeDoUsuario {
  client_id: string;
  project_id: string | null;
  type: TipoCaptura;
  title: string | null;
  content: string | null;
  status: StatusCaptura;
  category_id: string | null;
  converted_task_id: string | null;
  captured_at: string;
  organized_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  linked_capture_ids?: string[];
  attachments?: AnexoCaptura[];
}
export interface CamposCaptura {
  type: TipoCaptura;
  title: string | null;
  content: string | null;
  category_id: string | null;
  project_id: string | null;
  linked_capture_ids?: string[];
  attachments?: AnexoCaptura[];
}
export interface NovaCaptura extends CamposCaptura { client_id: string; status?: "draft" | "inbox" }
export type EdicaoCaptura = Partial<CamposCaptura>;
