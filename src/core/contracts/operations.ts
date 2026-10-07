import { assinatura, ErroDeDominio, exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "./base";
import type { AcaoEvento, Entidades, EventoDominio, TipoEntidade } from "./modules";
import type { CaptureTaskRead, CaptureTaskTransaction, TransacaoDeComando, UnitOfWork } from "./unit-of-work";

export function executarComando<T, Transaction extends TransacaoDeComando>(store: Pick<UnitOfWork<unknown, Transaction>, "transaction">, context: ContextoDeEscrita, command: string, clientId: string, input: unknown, work: (tx: Transaction) => Promise<T>): Promise<T> {
  exigir(typeof clientId === "string" && clientId.trim().length > 0 && clientId.length <= 200, "Informe client_id para a operação.");
  const fingerprint = assinatura(input);
  return store.transaction(context, async (tx) => {
    const receipt = await tx.recibos.get(command, clientId);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new ErroDeDominio("CONFLICT", "client_id já usado com outro conteúdo.");
      return receipt.result as T;
    }
    const result = await work(tx);
    await tx.recibos.insert({ user_id: context.user_id, command, client_id: clientId, fingerprint, result });
    return result;
  });
}

export async function emitirEvento<K extends TipoEntidade>(tx: Pick<CaptureTaskTransaction, "eventos">, deps: DependenciasDeDominio, context: ContextoDeEscrita, entityType: K, before: Entidades[K] | null, after: Entidades[K] | null, action: AcaoEvento) {
  const entity = after ?? before;
  exigir(entity, "Evento exige uma entidade.");
  await tx.eventos.append({ id: deps.ids.next(), user_id: context.user_id, entity_type: entityType, entity_id: entity.id, action, canal: context.canal, occurred_at: deps.clock.now(), before, after } as EventoDominio);
}

export async function conferirOrganizacao(tx: Pick<CaptureTaskRead, "categorias" | "projetos">, categoryId: string | null, projectId: string | null) {
  if (categoryId !== null && !await tx.categorias.get(categoryId)) naoEncontrado();
  if (projectId !== null) {
    const project = await tx.projetos.get(projectId);
    if (!project || project.deleted_at !== null) naoEncontrado();
  }
}
