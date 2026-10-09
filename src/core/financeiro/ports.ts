import type { ContextoDeEscrita } from "../contracts/base";
import type { EventoDominio, Leitor, Repositorio } from "../contracts/modules";
import type { ReciboIdempotente } from "../contracts/unit-of-work";
import type { ContaFinanceira, CategoriaFinanceira, EtiquetaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "./fused";

/** Finance needs only its own repositories, events and command receipts. */
export interface FinanceRead {
  financeiro: {
    contas: Leitor<ContaFinanceira>; categorias: Leitor<CategoriaFinanceira>;
    lancamentos: Leitor<LancamentoFinanceiro>; orcamentos: Leitor<OrcamentoFinanceiro>;
    etiquetas?: Leitor<EtiquetaFinanceira>;
  };
  eventos: { list(): Promise<EventoDominio[]> };
}
export interface FinanceTransaction extends FinanceRead {
  financeiro: {
    contas: Repositorio<ContaFinanceira>; categorias: Repositorio<CategoriaFinanceira>;
    lancamentos: Repositorio<LancamentoFinanceiro>; orcamentos: Repositorio<OrcamentoFinanceiro>;
    etiquetas?: Repositorio<EtiquetaFinanceira>;
  };
  eventos: { list(): Promise<EventoDominio[]>; append(event: EventoDominio): Promise<void> };
  recibos: { get(command: string, clientId: string): Promise<ReciboIdempotente | null>; insert(receipt: ReciboIdempotente): Promise<void> };
}
export interface FinanceUnitOfWork {
  read(userId: string): FinanceRead;
  transaction<T>(context: ContextoDeEscrita, work: (tx: FinanceTransaction) => Promise<T>): Promise<T>;
}
