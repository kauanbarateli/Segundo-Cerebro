import type { EventoDominio, HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario, Leitor, Repositorio } from "../contracts/modules";
import type { TransacaoDeComando, UnitOfWork } from "../contracts/unit-of-work";

export interface HabitRead {
  habitos: Leitor<HabitoDoUsuario>; marcacoes: Leitor<MarcacaoHabito>; pausas: Leitor<PausaDoUsuario>;
  eventos: { list(): Promise<EventoDominio[]> };
}
export interface HabitTransaction extends HabitRead, TransacaoDeComando {
  habitos: Repositorio<HabitoDoUsuario>; marcacoes: Repositorio<MarcacaoHabito>; pausas: Repositorio<PausaDoUsuario>;
  eventos: { list(): Promise<EventoDominio[]>; append(event: EventoDominio): Promise<void> };
}
export type HabitUnitOfWork = UnitOfWork<HabitRead, HabitTransaction>;
