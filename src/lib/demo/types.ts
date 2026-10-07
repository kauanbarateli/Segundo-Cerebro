import type { Captura } from "../../core/capturas";
import type { Tarefa } from "../../core/tarefas";
import type { Categoria, Projeto, HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario } from "../../core/contracts";
import type { ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "../../core/financeiro";

export interface AgendaEvent {
  id: string; title: string; starts_at: string; ends_at: string; location: string | null;
  linked_capture_id: string | null; habit_id: string | null;
  calendar_id?: string; all_day?: boolean;
}
export interface DemoCalendar { id: string; name: string; color_key: string }
export interface DemoNotebook { id: string; name: string; parent_id: string | null; project_id: string | null; position: number }
export interface DemoNotebookMembership { notebook_id: string; capture_id: string; position: number }
export interface DemoFolder { id: string; name: string; parent_id: string | null; project_id: string | null; deleted_at: string | null }
export interface DemoDriveFile { id: string; folder_id: string | null; name: string; mime: string; bytes: number; starred: boolean; modified_at: string; deleted_at: string | null }
export interface DemoProfile { display_name: string; email_label: string }
export interface DemoQueries {
  tasks: { items: Tarefa[]; categories: Categoria[]; projects: Projeto[] };
  captures: { items: Captura[]; categories: Categoria[]; projects: Projeto[] };
  habits: { items: HabitoDoUsuario[]; entries: MarcacaoHabito[]; pauses: PausaDoUsuario[] };
  finance: { accounts: ContaFinanceira[]; categories: CategoriaFinanceira[]; transactions: LancamentoFinanceiro[]; budgets: OrcamentoFinanceiro[] };
  agenda: { items: AgendaEvent[]; calendars?: DemoCalendar[] };
  knowledge: { notebooks: DemoNotebook[]; memberships: DemoNotebookMembership[]; items: Captura[] };
  projects: { items: Projeto[] };
  drive: { folders: DemoFolder[]; files: DemoDriveFile[]; capacity_bytes: number };
  vault: { configured: boolean; items: { id: string; title: string; kind: "login" | "note" }[] };
  settings: { profile: DemoProfile | null };
}
export type DemoReadOnlyData = { notebooks: DemoNotebook[]; memberships: DemoNotebookMembership[]; calendars: DemoCalendar[] } & Pick<DemoQueries, "drive" | "vault" | "settings">;
export type DemoQueryKey = keyof DemoQueries;
export interface QueryState<T> {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
}
