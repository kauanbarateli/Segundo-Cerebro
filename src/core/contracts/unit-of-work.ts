import type { Captura } from "../capturas/types";
import type { Tarefa } from "../tarefas/types";
import type { ContextoDeEscrita } from "./base";
import type { Categoria, Projeto, HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario, Repositorio, LeituraDosModulos, EscritaFinanceiraPort, EventoDominio } from "./modules";

/** User + command + client_id identify a request; payload mismatch is a conflict. */
export interface ReciboIdempotente { user_id: string; command: string; client_id: string; fingerprint: string; result: unknown }

/** Shared command capability; idempotency does not require every module port. */
export interface TransacaoDeComando {
  recibos: { get(command: string, clientId: string): Promise<ReciboIdempotente | null>; insert(receipt: ReciboIdempotente): Promise<void> };
}
export type CaptureTaskRead = Pick<LeituraDosModulos, "capturas" | "tarefas" | "categorias" | "projetos" | "eventos">;

/** Captures/tasks use soft deletion. Organization is read-only in these commands. */
export interface CaptureTaskTransaction extends TransacaoDeComando, CaptureTaskRead {
  capturas: Pick<Repositorio<Captura>, "get" | "list" | "insert" | "replace">;
  tarefas: Pick<Repositorio<Tarefa>, "get" | "list" | "insert" | "replace">;
  eventos: { list(): Promise<EventoDominio[]>; append(event: EventoDominio): Promise<void> };
}

/** Complete in-memory contract; modules may depend on narrower capabilities. */
export interface Transacao extends CaptureTaskTransaction {
  capturas: Repositorio<Captura>; tarefas: Repositorio<Tarefa>; categorias: Repositorio<Categoria>; projetos: Repositorio<Projeto>;
  habitos: Repositorio<HabitoDoUsuario>; marcacoes: Repositorio<MarcacaoHabito>; pausas: Repositorio<PausaDoUsuario>;
  financeiro: EscritaFinanceiraPort;
}
/**
 * Commit mutations, events and receipts together, or roll them all back.
 * Ports are scoped to one authenticated user and expire after callback completion.
 * Serializable behavior is required for competing conversion/replay requests.
 * An adapter may repeat the callback after a serialization conflict; keep external
 * side effects outside it, and discard ports/results from an uncommitted attempt.
 */
export interface UnitOfWork<Read = LeituraDosModulos, Transaction extends TransacaoDeComando = Transacao> {
  read(userId: string): Read;
  transaction<T>(context: ContextoDeEscrita, work: (tx: Transaction) => Promise<T>): Promise<T>;
}

export type CaptureTaskUnitOfWork = UnitOfWork<CaptureTaskRead, CaptureTaskTransaction>;
