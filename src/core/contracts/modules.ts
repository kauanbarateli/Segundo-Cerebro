import type { Captura } from "../capturas/types";
import type { Tarefa } from "../tarefas/types";
import type { Habito, PausaHabito } from "../habitos/habits";
import type { ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "../financeiro/fused";
import type { EntidadeDoUsuario, Canal } from "./base";

export interface Categoria extends EntidadeDoUsuario {
  name: string; normalized_name: string; color_key: string; is_system: boolean; created_at: string; updated_at: string;
}
export interface Projeto extends EntidadeDoUsuario {
  name: string; description: string | null; color_key: string; deleted_at: string | null; position: number; created_at: string; updated_at: string;
}
export interface HabitoDoUsuario extends Habito { user_id: string; color_key: string; icon_key: string | null; position: number; created_at: string; updated_at: string }
export interface MarcacaoHabito extends EntidadeDoUsuario { habit_id: string; done_on: string; note: string | null; created_at: string }
export interface PausaDoUsuario extends PausaHabito, EntidadeDoUsuario { reason: string | null; created_at: string }

/** Closed allowlist. Vault content can never enter this event contract. */
export interface Entidades {
  capture: Captura; task: Tarefa; category: Categoria; project: Projeto;
  habit: HabitoDoUsuario; habit_entry: MarcacaoHabito; habit_pause: PausaDoUsuario;
  finance_account: ContaFinanceira; finance_category: CategoriaFinanceira; finance_transaction: LancamentoFinanceiro; finance_budget: OrcamentoFinanceiro;
}
export type TipoEntidade = keyof Entidades;
export type AcaoEvento = "created" | "updated" | "deleted" | "restored" | "status_changed";
export type EventoDominio = { [K in TipoEntidade]: {
  id: string; user_id: string; entity_type: K; entity_id: string; action: AcaoEvento;
  canal: Canal; occurred_at: string; before: Entidades[K] | null; after: Entidades[K] | null;
} }[TipoEntidade];

export interface ConsultaLista { includeDeleted?: boolean; includeArchived?: boolean }
export interface Leitor<T extends EntidadeDoUsuario> {
  /** Includes trash/archive so explicit restore flows can locate a record. */
  get(id: string): Promise<T | null>;
  /** Excludes trash/archive by default; deterministic created_at/id order. */
  list(query?: ConsultaLista): Promise<T[]>;
}
export interface Repositorio<T extends EntidadeDoUsuario> extends Leitor<T> {
  insert(value: T): Promise<void>;
  replace(value: T): Promise<void>;
  /** Sparse habit marks use physical removal; captures/tasks use deleted_at. */
  remove(id: string): Promise<void>;
}
export interface CapturasPort { capturas: Leitor<Captura> }
export interface TarefasPort { tarefas: Leitor<Tarefa>; categorias: Leitor<Categoria>; projetos: Leitor<Projeto> }
export interface HabitosPort { habitos: Leitor<HabitoDoUsuario>; marcacoes: Leitor<MarcacaoHabito>; pausas: Leitor<PausaDoUsuario> }
export interface FinanceiroPort { contas: Leitor<ContaFinanceira>; categorias: Leitor<CategoriaFinanceira>; lancamentos: Leitor<LancamentoFinanceiro>; orcamentos: Leitor<OrcamentoFinanceiro> }
export interface LeituraDosModulos extends CapturasPort, TarefasPort, HabitosPort {
  financeiro: FinanceiroPort;
  eventos: { list(): Promise<EventoDominio[]> };
}
export interface EscritaFinanceiraPort { contas: Repositorio<ContaFinanceira>; categorias: Repositorio<CategoriaFinanceira>; lancamentos: Repositorio<LancamentoFinanceiro>; orcamentos: Repositorio<OrcamentoFinanceiro> }
