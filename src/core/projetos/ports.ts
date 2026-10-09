import type { ProjectContainer } from "./types";
export type { ProjectContainer } from "./types";
import type { EventoDominio, Leitor, Projeto, Repositorio } from "../contracts/modules";
import type { TransacaoDeComando, UnitOfWork } from "../contracts/unit-of-work";

export interface ProjectRead { projetos: Leitor<Projeto>; containers?: Leitor<ProjectContainer>; eventos: { list(): Promise<EventoDominio[]> } }
export interface ProjectTransaction extends ProjectRead, TransacaoDeComando {
  projetos: Repositorio<Projeto>; containers?: Repositorio<ProjectContainer>;
  eventos: { list(): Promise<EventoDominio[]>; append(event: EventoDominio): Promise<void> };
}
export type ProjectUnitOfWork = UnitOfWork<ProjectRead, ProjectTransaction>;
