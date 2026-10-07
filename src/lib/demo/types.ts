import type { Captura } from "../../core/capturas";
import type { Tarefa } from "../../core/tarefas";
import type { Categoria, Projeto, HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario } from "../../core/contracts";
import type { ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "../../core/financeiro";

export interface AgendaEvent {
  id: string; title: string; starts_at: string; ends_at: string; location: string | null;
  linked_capture_id: string | null; habit_id: string | null;
}
export interface DemoQueries {
  tasks: { items: Tarefa[]; categories: Categoria[]; projects: Projeto[] };
  captures: { items: Captura[]; categories: Categoria[]; projects: Projeto[] };
  habits: { items: HabitoDoUsuario[]; entries: MarcacaoHabito[]; pauses: PausaDoUsuario[] };
  finance: { accounts: ContaFinanceira[]; categories: CategoriaFinanceira[]; transactions: LancamentoFinanceiro[]; budgets: OrcamentoFinanceiro[] };
  agenda: { items: AgendaEvent[] };
}
export type DemoQueryKey = keyof DemoQueries;
export interface QueryState<T> {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
}
