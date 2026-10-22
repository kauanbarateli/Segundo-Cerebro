import { ErroDeDominio, exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { conferirOrganizacao, emitirEvento, executarComando } from "../contracts/operations";
import type { CaptureTaskTransaction, CaptureTaskUnitOfWork } from "../contracts/unit-of-work";
import type { Tarefa } from "../tarefas/types";
import type { Captura, CamposCaptura, EdicaoCaptura, NovaCaptura } from "./types";
import { normalizarTituloCaptura, reescreverReferenciaWiki } from "./wiki";
import { lerEstadoDocumentalDaCaptura, planejarAtualizacaoDocumentalDaCaptura, referenciasDocumentaisDaCaptura, validarAtualizacaoDocumentalDaCaptura, validarCriacaoDocumentalDaCaptura, type AtualizacaoDocumentalDaCaptura, type CriacaoDocumentalDaCaptura } from "./rich-content-write";
import { lerConteudoDocumentalDaCaptura } from "./rich-content";

const keys: readonly (keyof CamposCaptura)[] = ["type", "title", "content", "category_id", "project_id", "linked_capture_ids", "attachments"];
function camposCaptura(input: CamposCaptura): CamposCaptura {
  const fields = Object.fromEntries(keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])) as unknown as CamposCaptura;
  exigir(["idea", "task", "note", "reminder"].includes(fields.type), "Tipo de captura inválido.");
  exigir(fields.title === null || typeof fields.title === "string" && fields.title.length <= 200, "Título inválido.");
  exigir(fields.content === null || typeof fields.content === "string" && fields.content.length <= 30_000, "O conteúdo deve ter até 30.000 caracteres.");
  exigir(fields.title?.trim() || fields.content?.trim(), "Escreva algo para capturar.");
  for (const id of [fields.category_id, fields.project_id]) exigir(id === null || typeof id === "string" && id.length > 0, "Referência inválida.");
  if (fields.linked_capture_ids !== undefined) exigir(Array.isArray(fields.linked_capture_ids) && fields.linked_capture_ids.every((id) => typeof id === "string" && id.length > 0) && new Set(fields.linked_capture_ids).size === fields.linked_capture_ids.length, "Vínculos inválidos ou repetidos.");
  if (fields.attachments !== undefined) {
    exigir(Array.isArray(fields.attachments) && fields.attachments.length <= 6 && new Set(fields.attachments.map((attachment) => attachment.id)).size === fields.attachments.length, "Uma captura aceita até seis imagens diferentes.");
    fields.attachments = fields.attachments.map((attachment) => {
      exigir(typeof attachment.id === "string" && attachment.id.length > 0 && typeof attachment.name === "string" && attachment.name.trim().length > 0 && attachment.name.length <= 200, "Identificação da imagem inválida.");
      exigir(["image/png", "image/jpeg"].includes(attachment.mime), "A imagem precisa ser reencodada antes de salvar.");
      exigir(Number.isSafeInteger(attachment.width) && attachment.width > 0 && Number.isSafeInteger(attachment.height) && attachment.height > 0 && Number.isSafeInteger(attachment.bytes) && attachment.bytes > 0 && attachment.bytes <= 8 * 1024 * 1024, "Dimensões ou tamanho da imagem inválidos.");
      const { id, name, mime, width, height, bytes } = attachment;
      return { id, name, mime, width, height, bytes };
    });
  }
  return { ...fields, title: fields.title?.trim() || null, content: fields.content?.trim() || null };
}

async function conferirVinculos(tx: CaptureTaskTransaction, fields: CamposCaptura, id: string) {
  for (const linkedId of fields.linked_capture_ids ?? []) {
    exigir(linkedId !== id, "Uma captura não pode vincular a si mesma.");
    const linked = await tx.capturas.get(linkedId);
    if (!linked || linked.deleted_at) naoEncontrado();
  }
}

export async function criarCaptura(store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: NovaCaptura | CriacaoDocumentalDaCaptura): Promise<Captura> {
  input = Object.hasOwn(input, "document") ? validarCriacaoDocumentalDaCaptura(input) : structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.create", input.client_id, input, async (tx) => {
    exigir(!Object.hasOwn(input, "document_version"), "A revisão é alocada pelo servidor.");
    const rich = "document" in input ? lerConteudoDocumentalDaCaptura({ kind: "rich", document: input.document, document_version: 1 }) : null;
    const fields = camposCaptura({ ...input, content: rich?.content ?? ("content" in input ? input.content : null), ...(rich?.kind === "rich" ? { linked_capture_ids: [...new Set([...(input.linked_capture_ids ?? []), ...referenciasDocumentaisDaCaptura(rich.document)])] } : {}) });
    exigir(input.status === undefined || ["draft", "inbox"].includes(input.status), "Estado inicial inválido.");
    await conferirOrganizacao(tx, fields.category_id, fields.project_id);
    const now = deps.clock.now();
    const capture: Captura = { ...fields, ...(rich?.kind === "rich" ? { document: rich.document, document_version: 1 } : {}), id: deps.ids.next(), user_id: context.user_id, client_id: input.client_id,
      status: input.status ?? "inbox", converted_task_id: null, captured_at: now, organized_at: null,
      archived_at: null, deleted_at: null, created_at: now, updated_at: now };
    await conferirVinculos(tx, fields, capture.id);
    await tx.capturas.insert(capture);
    await emitirEvento(tx, deps, context, "capture", null, capture, "created");
    return capture;
  });
}

export function editarCaptura(store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string; patch: EdicaoCaptura; expected_content?: never } | AtualizacaoDocumentalDaCaptura): Promise<Captura> {
  const documental = Object.hasOwn(input, "expected_content") || Object.hasOwn(input.patch, "document");
  input = documental ? validarAtualizacaoDocumentalDaCaptura(input) : structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.update", input.client_id, input, async (tx) => {
    const before = await tx.capturas.get(input.id);
    if (!before || before.deleted_at) naoEncontrado();
    const current = lerEstadoDocumentalDaCaptura(before);
    if ("expected_content" in input && input.expected_content !== undefined) {
      exigir(!await tx.capturas.isContentReadOnly?.(before.id), "Esta captura foi promovida a uma página. Edite o conteúdo em Conhecimento.");
      const plan = planejarAtualizacaoDocumentalDaCaptura({
        current: current.kind === "legacy" ? { kind: "legacy", content: current.content } : { kind: "rich", document: current.document, document_version: current.document_version },
        expected: input.expected_content, document: input.patch.document,
      });
      const metadata = Object.fromEntries(Object.entries(input.patch).filter(([key]) => key !== "document"));
      const fields = camposCaptura({ ...before, ...metadata, content: plan.content, linked_capture_ids: [...new Set([...(input.patch.linked_capture_ids ?? before.linked_capture_ids ?? []), ...referenciasDocumentaisDaCaptura(plan.document)])] });
      await conferirVinculos(tx, { ...fields, linked_capture_ids: (fields.linked_capture_ids ?? []).filter(id => !(before.linked_capture_ids ?? []).includes(id)) }, before.id);
      await conferirOrganizacao(tx, fields.category_id === before.category_id ? null : fields.category_id, fields.project_id === before.project_id ? null : fields.project_id);
      const after: Captura = { ...before, ...fields, document: plan.document, document_version: plan.document_version, content: plan.content, updated_at: deps.clock.now() };
      await tx.capturas.replace(after);
      await emitirEvento(tx, deps, context, "capture", before, after, "updated");
      return after;
    }
    const patch = input.patch as EdicaoCaptura;
    if (current.kind === "rich" && (Object.hasOwn(patch, "title") || Object.hasOwn(patch, "content"))) throw new ErroDeDominio("CONFLICT", "Esta Captura usa um documento formatado. Preserve sua edição e recarregue o editor.");
    const changes = Object.fromEntries(keys.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]));
    const fields = camposCaptura({ ...before, ...changes });
    exigir(!await tx.capturas.isContentReadOnly?.(before.id) || fields.title === before.title && fields.content === before.content, "Esta captura foi promovida a uma página. Edite o conteúdo em Conhecimento.");
    // Existing references survive archival/trash; only newly supplied links need to be alive.
    await conferirVinculos(tx, { ...fields, linked_capture_ids: (fields.linked_capture_ids ?? []).filter((id) => !(before.linked_capture_ids ?? []).includes(id)) }, before.id);
    await conferirOrganizacao(tx, fields.category_id === before.category_id ? null : fields.category_id, fields.project_id === before.project_id ? null : fields.project_id);
    const after = { ...before, ...fields, updated_at: deps.clock.now() };
    const renamed = before.title && after.title && before.title !== after.title;
    if (renamed && after.content) after.content = reescreverReferenciaWiki(after.content, before.title!, after.title!);
    exigir(!after.content || after.content.length <= 30_000, "Renomear ultrapassaria o limite de 30.000 caracteres desta nota. Encurte o título ou o texto.");
    const rewrites: { before: Captura; after: Captura }[] = [];
    if (renamed) {
      const all = await tx.capturas.list({ includeArchived: true, includeDeleted: true });
      const readOnlyIds = new Set((await Promise.all(all.map(async row => await tx.capturas.isContentReadOnly?.(row.id) ? row.id : null))).filter((id): id is string => id !== null));
      for (const related of all) {
        if (related.id === after.id || !related.content || readOnlyIds.has(related.id) || lerEstadoDocumentalDaCaptura(related).kind === "rich") continue;
        const content = reescreverReferenciaWiki(related.content, before.title!, after.title!);
        if (content === related.content) continue;
        exigir(content.length <= 30_000, "Renomear ultrapassaria o limite de 30.000 caracteres de uma nota vinculada. Encurte o título ou o texto relacionado.");
        rewrites.push({ before: related, after: { ...related, content, updated_at: after.updated_at } });
      }
      if ((rewrites.length || after.content !== fields.content) && all.some((related) => related.id !== after.id && !readOnlyIds.has(related.id) && related.title && [normalizarTituloCaptura(before.title!), normalizarTituloCaptura(after.title!)].includes(normalizarTituloCaptura(related.title)))) {
        throw new ErroDeDominio("CONFLICT", "Há títulos iguais entre as notas referenciadas. Resolva as referências ambíguas antes de renomear.");
      }
    }
    await tx.capturas.replace(after);
    await emitirEvento(tx, deps, context, "capture", before, after, "updated");
    // A title change and incoming text (including trash) share this commit.
    for (const rewritten of rewrites) {
      await tx.capturas.replace(rewritten.after);
      await emitirEvento(tx, deps, context, "capture", rewritten.before, rewritten.after, "updated");
    }
    return after;
  });
}

function cicloCaptura(store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }, mode: "archive" | "delete" | "restore"): Promise<Captura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, `capture.${mode}`, input.client_id, input, async (tx) => {
    const before = await tx.capturas.get(input.id);
    if (!before || mode === "archive" && before.deleted_at) naoEncontrado();
    if (mode === "delete" && before.deleted_at || mode === "restore" && !before.deleted_at || mode === "archive" && before.status === "archived") return before;
    const now = deps.clock.now();
    const after: Captura = { ...before, updated_at: now };
    if (mode === "archive") { after.status = "archived"; after.archived_at = now; }
    else after.deleted_at = mode === "restore" ? null : now;
    await tx.capturas.replace(after);
    await emitirEvento(tx, deps, context, "capture", before, after, mode === "archive" ? "status_changed" : mode === "delete" ? "deleted" : "restored");
    return after;
  });
}
export const arquivarCaptura = (store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => cicloCaptura(store, deps, context, input, "archive");
export const excluirCaptura = (store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => cicloCaptura(store, deps, context, input, "delete");
export const restaurarCaptura = (store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => cicloCaptura(store, deps, context, input, "restore");

export function organizarCaptura(store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string; destination: "inbox" | "knowledge" }): Promise<Captura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.organize", input.client_id, input, async (tx) => {
    exigir(["inbox", "knowledge"].includes(input.destination), "Destino inválido.");
    const before = await tx.capturas.get(input.id);
    if (!before || before.deleted_at || before.status === "archived") naoEncontrado();
    const now = deps.clock.now();
    const after: Captura = { ...before, status: input.destination === "inbox" ? "inbox" : "organized", organized_at: input.destination === "inbox" ? null : before.organized_at ?? now, updated_at: now };
    await tx.capturas.replace(after); await emitirEvento(tx, deps, context, "capture", before, after, "status_changed");
    return after;
  });
}

export function desarquivarCaptura(store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }): Promise<Captura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.unarchive", input.client_id, input, async (tx) => {
    const before = await tx.capturas.get(input.id);
    if (!before || before.deleted_at) naoEncontrado();
    if (before.status !== "archived") return before;
    const after: Captura = { ...before, status: before.organized_at || before.converted_task_id ? "organized" : "inbox", archived_at: null, updated_at: deps.clock.now() };
    await tx.capturas.replace(after); await emitirEvento(tx, deps, context, "capture", before, after, "status_changed");
    return after;
  });

}

export interface ConversaoCaptura { captura: Captura; tarefa: Tarefa }
export function converterCapturaEmTarefa(store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { capture_id: string; client_id: string }): Promise<ConversaoCaptura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.convert", input.client_id, input, async (tx) => {
    const capture = await tx.capturas.get(input.capture_id);
    if (!capture || capture.deleted_at) naoEncontrado();
    if (capture.converted_task_id) {
      const task = await tx.tarefas.get(capture.converted_task_id);
      if (!task) naoEncontrado();
      return { captura: capture, tarefa: task };
    }
    const now = deps.clock.now();
    const project = capture.project_id ? await tx.projetos.get(capture.project_id) : null;
    const task: Tarefa = { id: deps.ids.next(), user_id: context.user_id, client_id: input.client_id,
      title: capture.title || capture.content?.slice(0, 120) || "Nova tarefa",
      description: capture.content && (capture.title || capture.content.length > 120) ? capture.content : null,
      category_id: capture.category_id, project_id: project && !project.deleted_at ? project.id : null,
      source: "manual", origin_capture_id: capture.id, status: "todo", priority: "medium", due_at: null,
      scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null,
      board_position: null, completed_at: null, archived_at: null, deleted_at: null, created_at: now, updated_at: now };
    const organized: Captura = { ...capture, converted_task_id: task.id, status: "organized", organized_at: now, archived_at: null, updated_at: now };
    await tx.tarefas.insert(task);
    await tx.capturas.replace(organized);
    await emitirEvento(tx, deps, context, "task", null, task, "created");
    await emitirEvento(tx, deps, context, "capture", capture, organized, "status_changed");
    return { captura: organized, tarefa: task };
  });
}
