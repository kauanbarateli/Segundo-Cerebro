import type { EntidadeDoUsuario } from "../contracts/base";
export type StatusTarefa = "todo" | "in_progress" | "done" | "archived";
export type PrioridadeTarefa = "low" | "medium" | "high" | "urgent";
export interface CamposTarefa {
  title: string;
  description: string | null;
  category_id: string | null;
  project_id: string | null;
  status: StatusTarefa;
  priority: PrioridadeTarefa;
  due_at: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  all_day: boolean;
  estimated_minutes: number | null;
  board_position: number | null;
}
/** All legacy Task fields. Origin is durable, including after soft deletion. */
export interface Tarefa extends EntidadeDoUsuario, CamposTarefa {
  client_id: string;
  source: "manual";
  origin_capture_id: string | null;
  completed_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
/** Creation requires the full form; editing never defaults omitted status. */
export interface NovaTarefa extends CamposTarefa { client_id: string }
export type EdicaoTarefa = Partial<CamposTarefa>;
