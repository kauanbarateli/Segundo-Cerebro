import type { Captura } from "../capturas/types";
import type { Tarefa } from "../tarefas/types";
import type { ContextoDeEscrita } from "./base";
import type { Categoria, Projeto, HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario, Repositorio, LeituraDosModulos, EscritaFinanceiraPort, EventoDominio } from "./modules";

/** User + command + client_id identify a request; payload mismatch is a conflict. */
export interface ReciboIdempotente { user_id: string; command: string; client_id: string; fingerprint: string; result: unknown }
export interface Transacao extends Omit<LeituraDosModulos, "financeiro" | "eventos"> {
  capturas: Repositorio<Captura>; tarefas: Repositorio<Tarefa>; categorias: Repositorio<Categoria>; projetos: Repositorio<Projeto>;
  habitos: Repositorio<HabitoDoUsuario>; marcacoes: Repositorio<MarcacaoHabito>; pausas: Repositorio<PausaDoUsuario>;
  financeiro: EscritaFinanceiraPort;
  eventos: { list(): Promise<EventoDominio[]>; append(event: EventoDominio): Promise<void> };
  recibos: { get(command: string, clientId: string): Promise<ReciboIdempotente | null>; insert(receipt: ReciboIdempotente): Promise<void> };
}
/**
 * Commit mutations, events and receipts together, or roll them all back.
 * Ports are scoped to one authenticated user and expire after callback completion.
 * Serializable behavior is required for competing conversion/replay requests.
 */
export interface UnitOfWork {
  read(userId: string): LeituraDosModulos;
  transaction<T>(context: ContextoDeEscrita, work: (tx: Transacao) => Promise<T>): Promise<T>;
}
