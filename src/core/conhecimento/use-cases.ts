import { assinatura, ErroDeDominio, exigir, instanteValido, naoEncontrado, type ContextoDeEscrita } from "../contracts/base";
import { documentoDeTexto, documentoVazio, extrairReferencias, normalizarTituloPagina, resolverReferenciaNoDocumento, textoDoDocumento, validarDocumento } from "./document";
import type { AlvoRelacionado, Caderno, ComandoConhecimento, ConhecimentoDTO, ConhecimentoStore, DependenciasConhecimento, EntidadeConhecimento, EventoConhecimento, LeituraPaginaDTO, Pagina, RelacionadosDTO, SnapshotConhecimento, TipoVinculo, TransacaoConhecimento, Vinculo } from "./types";

export const TIPOS_VINCULO: readonly TipoVinculo[] = ["page", "notebook", "task", "capture", "event", "file", "project", "transaction", "habit"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clone = <T>(value: T): T => structuredClone(value);
function nome(value: unknown, limit = 200): string { exigir(typeof value === "string" && value.trim().length > 0 && value.trim().length <= limit, `Informe um nome com até ${limit} caracteres.`); return value.trim(); }
function id(value: unknown): asserts value is string { exigir(typeof value === "string" && UUID.test(value), "Identificador inválido."); }
const pagina = (state: SnapshotConhecimento, value: string) => { id(value); const result = state.pages.find(item => item.id === value); if (!result) naoEncontrado(); return result; };
const caderno = (state: SnapshotConhecimento, value: string) => { id(value); const result = state.notebooks.find(item => item.id === value); if (!result) naoEncontrado(); return result; };
function ativo(state: SnapshotConhecimento, page: Pagina) { exigir(!page.deleted_at && !caderno(state, page.notebook_id).deleted_at, "Restaure a página e seu caderno antes de editar."); }
function tituloLivre(state: SnapshotConhecimento, title: string, exclude?: string) { exigir(!state.pages.some(page => page.id !== exclude && !page.deleted_at && page.normalized_title === normalizarTituloPagina(title)), "Já existe uma página com este título."); }
function verificarPai(state: SnapshotConhecimento, notebookId: string, parentId: string | null, ownId?: string) {
  const notebook = caderno(state, notebookId); exigir(!notebook.deleted_at, "Restaure o caderno antes de incluir páginas.");
  const visited = new Set<string>(ownId ? [ownId] : []); let next = parentId;
  while (next) { exigir(!visited.has(next), "Uma página não pode ser sua própria ancestral."); visited.add(next); const parent = pagina(state, next); ativo(state, parent); exigir(parent.notebook_id === notebookId, "A página mãe precisa estar no mesmo caderno."); next = parent.parent_id; }
}
export function descendentesPagina(state: SnapshotConhecimento, pageId: string): Pagina[] {
  const ids = new Set([pageId]); let changed = true;
  while (changed) { changed = false; for (const page of state.pages) if (page.parent_id && ids.has(page.parent_id) && !ids.has(page.id)) { ids.add(page.id); changed = true; } }
  return state.pages.filter(page => ids.has(page.id));
}
function evento(tx: TransacaoConhecimento, deps: DependenciasConhecimento, context: ContextoDeEscrita, type: EventoConhecimento["entity_type"], before: EntidadeConhecimento | null, after: EntidadeConhecimento | null, action: EventoConhecimento["action"]) {
  const entity = after ?? before; exigir(entity, "Evento sem registro.");
  tx.events.push({ id: deps.ids.next(), user_id: context.user_id, entity_type: type, entity_id: entity.id, action, canal: context.canal, occurred_at: deps.clock.now(), before: clone(before), after: clone(after) });
}
function salvarRefs(tx: TransacaoConhecimento, deps: DependenciasConhecimento, page: Pagina) {
  const previous = tx.state.refs.filter(ref => ref.page_id === page.id);
  const refs = extrairReferencias(page.document, previous).map(ref => {
    const target = ref.target_id ? tx.state.pages.find(item => item.id === ref.target_id) : tx.state.pages.find(item => !item.deleted_at && item.normalized_title === ref.normalized_alias);
    if (ref.target_id) exigir(target, "Uma referência aponta para uma página indisponível.");
    return { ...ref, target_id: target?.id ?? null };
  }).filter(ref => ref.target_id !== page.id);
  const deduped = new Map(refs.map(ref => [ref.target_id ?? ref.normalized_alias, ref]));
  tx.state.refs = tx.state.refs.filter(ref => ref.page_id !== page.id);
  for (const ref of deduped.values()) {
    const old = previous.find(item => item.target_id === ref.target_id && item.normalized_alias === ref.normalized_alias);
    tx.state.refs.push({ ...ref, id: old?.id ?? deps.ids.next(), user_id: page.user_id, page_id: page.id, created_at: old?.created_at ?? deps.clock.now() });
  }
}
function criarPagina(tx: TransacaoConhecimento, deps: DependenciasConhecimento, context: ContextoDeEscrita, input: { notebook_id: string; title: string; parent_id?: string | null; document?: Pagina["document"]; origin_capture_id?: string | null }) {
  const title = nome(input.title); tituloLivre(tx.state, title); verificarPai(tx.state, input.notebook_id, input.parent_id ?? null);
  const document = clone(input.document ?? documentoVazio()); validarDocumento(document); const now = deps.clock.now();
  const page: Pagina = { id: deps.ids.next(), user_id: context.user_id, notebook_id: input.notebook_id, parent_id: input.parent_id ?? null, origin_capture_id: input.origin_capture_id ?? null, title, normalized_title: normalizarTituloPagina(title), document, content_text: textoDoDocumento(document), version: 1, position: tx.state.pages.filter(item => item.notebook_id === input.notebook_id).length, archived_at: null, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now };
  tx.state.pages.push(page); salvarRefs(tx, deps, page); evento(tx, deps, context, "knowledge_page", null, page, "created");
  // Uma referência pendente resolve quando o destino é criado, conservando IDs.
  for (const ref of tx.state.refs) if (!ref.target_id && ref.normalized_alias === page.normalized_title && ref.page_id !== page.id) ref.target_id = page.id;
  return page;
}
export function conhecimentoDTO(state: SnapshotConhecimento): ConhecimentoDTO { const { revision, notebooks, pages, refs, links, targets } = state; return clone({ revision, notebooks, pages, refs, links, targets }); }
export function alvoRelacionado(state: SnapshotConhecimento, type: TipoVinculo, targetId: string): AlvoRelacionado | null {
  if (type === "page") { const page = state.pages.find(item => item.id === targetId && !item.deleted_at); return page ? { type, id: targetId, title: page.title, href: `/conhecimento?note=${encodeURIComponent(targetId)}` } : null; }
  if (type === "notebook") { const notebook = state.notebooks.find(item => item.id === targetId && !item.deleted_at); return notebook ? { type, id: targetId, title: notebook.name, href: `/conhecimento?notebook=${encodeURIComponent(targetId)}` } : null; }
  return state.targets.find(item => item.type === type && item.id === targetId) ?? null;
}
/** Uma passagem pelas referências e vínculos; nenhum lookup assíncrono por item. */
export function leituraPagina(state: SnapshotConhecimento, pageId: string): LeituraPaginaDTO {
  const page = pagina(state, pageId); const byId = new Map(state.pages.map(item => [item.id, item]));
  const backlinks = [...new Set(state.refs.filter(ref => ref.target_id === pageId).map(ref => ref.page_id))].map(source => byId.get(source)).filter((item): item is Pagina => !!item && !item.deleted_at && !item.archived_at).map(item => ({ id: item.id, title: item.title, notebook_id: item.notebook_id }));
  const related = state.links.filter(link => !link.deleted_at && (link.from_type === "page" && link.from_id === pageId || link.to_type === "page" && link.to_id === pageId)).map(link => link.from_type === "page" && link.from_id === pageId ? alvoRelacionado(state, link.to_type, link.to_id) : alvoRelacionado(state, link.from_type, link.from_id)).filter((item): item is AlvoRelacionado => item !== null);
  return clone({ page, backlinks, related });
}
export function leituraRelacionados(state: SnapshotConhecimento, type: TipoVinculo, sourceId: string): RelacionadosDTO {
  id(sourceId); exigir(TIPOS_VINCULO.includes(type), "Tipo de registro inválido.");
  const source = alvoRelacionado(state, type, sourceId); if (!source) naoEncontrado();
  const items = state.links.filter(link => !link.deleted_at && (link.from_type === type && link.from_id === sourceId || link.to_type === type && link.to_id === sourceId)).flatMap(link => {
    const outgoing = link.from_type === type && link.from_id === sourceId;
    const target = alvoRelacionado(state, outgoing ? link.to_type : link.from_type, outgoing ? link.to_id : link.from_id);
    return target ? [{ ...target, link_id: link.id }] : [];
  });
  return clone({ source, items });
}
export async function executarConhecimento(store: ConhecimentoStore, deps: DependenciasConhecimento, context: ContextoDeEscrita, request: ComandoConhecimento): Promise<unknown> {
  request = clone(request); context = clone(context); id(context.user_id); exigir(instanteValido(deps.clock.now()), "Relógio inválido.");
  exigir(typeof request.input.client_id === "string" && request.input.client_id.trim().length > 0 && request.input.client_id.length <= 200, "Informe client_id.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(assinatura(request.input)));
  const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return store.transaction(context, async tx => {
    exigir([tx.state.notebooks, tx.state.pages, tx.state.refs, tx.state.links, tx.state.captures].every(rows => rows.every(row => row.user_id === context.user_id)), "Registros fora do usuário autenticado.");
    const receipt = tx.state.receipts.find(item => item.command === request.command && item.client_id === request.input.client_id);
    if (receipt) { if (receipt.fingerprint !== fingerprint) throw new ErroDeDominio("CONFLICT", "client_id já utilizado com outro conteúdo."); return clone(receipt.result); }
    const now = deps.clock.now(); let result: unknown;
    switch (request.command) {
      case "knowledge.notebook.create": {
        const { input } = request; const name = nome(input.name, 120); if (input.project_id) { id(input.project_id); exigir(alvoRelacionado(tx.state, "project", input.project_id), "Projeto indisponível."); }
        const notebook: Caderno = { id: deps.ids.next(), user_id: context.user_id, name, project_id: input.project_id ?? null, position: tx.state.notebooks.length, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now };
        tx.state.notebooks.push(notebook); evento(tx, deps, context, "knowledge_notebook", null, notebook, "created"); result = notebook; break;
      }
      case "knowledge.notebook.update": {
        const { input } = request; const item = caderno(tx.state, input.id), before = clone(item); exigir(!item.deleted_at, "Restaure o caderno antes de editar.");
        if (input.project_id) { id(input.project_id); exigir(alvoRelacionado(tx.state, "project", input.project_id), "Projeto indisponível."); }
        item.name = nome(input.name, 120); if (input.project_id !== undefined) item.project_id = input.project_id; item.updated_at = now;
        evento(tx, deps, context, "knowledge_notebook", before, item, "updated"); result = item; break;
      }
      case "knowledge.notebook.delete": case "knowledge.notebook.restore": {
        const item = caderno(tx.state, request.input.id), before = clone(item); const deleting = request.command.endsWith("delete");
        if (!!item.deleted_at !== deleting) {
          const batch = deleting ? deps.ids.next() : item.deletion_batch_id;
          for (const page of tx.state.pages.filter(page => page.notebook_id === item.id && (deleting ? !page.deleted_at : page.deletion_batch_id === batch))) {
            if (!deleting) tituloLivre(tx.state, page.title, page.id); const old = clone(page); page.deleted_at = deleting ? now : null; page.deletion_batch_id = deleting ? batch : null; page.version++; page.updated_at = now;
            evento(tx, deps, context, "knowledge_page", old, page, deleting ? "deleted" : "restored");
          }
          item.deleted_at = deleting ? now : null; item.deletion_batch_id = deleting ? batch : null; item.updated_at = now;
          evento(tx, deps, context, "knowledge_notebook", before, item, deleting ? "deleted" : "restored");
        }
        result = item; break;
      }
      case "knowledge.page.create": result = criarPagina(tx, deps, context, request.input); break;
      case "knowledge.page.update": {
        const { input } = request; const item = pagina(tx.state, input.id); ativo(tx.state, item);
        if (!Number.isSafeInteger(input.expected_version) || input.expected_version !== item.version) throw new ErroDeDominio("CONFLICT", "Esta página foi alterada em outro lugar. Escolha qual versão conservar.");
        const title = nome(input.title); tituloLivre(tx.state, title, item.id); validarDocumento(input.document);
        const notebookId = input.notebook_id ?? item.notebook_id, parentId = input.parent_id === undefined ? item.parent_id : input.parent_id;
        verificarPai(tx.state, notebookId, parentId, item.id); const old = clone(item);
        item.title = title; item.normalized_title = normalizarTituloPagina(title); item.document = clone(input.document); item.content_text = textoDoDocumento(item.document); item.parent_id = parentId; item.notebook_id = notebookId; item.version++; item.updated_at = now;
        salvarRefs(tx, deps, item); evento(tx, deps, context, "knowledge_page", old, item, "updated");
        if (old.notebook_id !== notebookId) for (const child of descendentesPagina(tx.state, item.id).filter(child => child.id !== item.id)) { const before = clone(child); child.notebook_id = notebookId; child.version++; child.updated_at = now; evento(tx, deps, context, "knowledge_page", before, child, "updated"); }
        result = item; break;
      }
      case "knowledge.page.delete": case "knowledge.page.restore": {
        const item = pagina(tx.state, request.input.id), deleting = request.command.endsWith("delete");
        if (!!item.deleted_at !== deleting) {
          if (!deleting) { exigir(!caderno(tx.state, item.notebook_id).deleted_at, "Restaure primeiro o caderno."); if (item.parent_id) exigir(!pagina(tx.state, item.parent_id).deleted_at, "Restaure primeiro a página mãe."); }
          const batch = deleting ? deps.ids.next() : item.deletion_batch_id;
          for (const page of descendentesPagina(tx.state, item.id).filter(page => deleting ? !page.deleted_at : page.deletion_batch_id === batch)) {
            if (!deleting) tituloLivre(tx.state, page.title, page.id); const before = clone(page); page.deleted_at = deleting ? now : null; page.deletion_batch_id = deleting ? batch : null; page.version++; page.updated_at = now;
            evento(tx, deps, context, "knowledge_page", before, page, deleting ? "deleted" : "restored");
          }
        }
        result = item; break;
      }
      case "knowledge.page.archive": case "knowledge.page.unarchive": {
        const item = pagina(tx.state, request.input.id); ativo(tx.state, item); const before = clone(item); item.archived_at = request.command.endsWith("unarchive") ? null : now; item.version++; item.updated_at = now;
        evento(tx, deps, context, "knowledge_page", before, item, "status_changed"); result = item; break;
      }
      case "knowledge.page.resolve-ref": {
        const item = pagina(tx.state, request.input.id); ativo(tx.state, item); const alias = nome(request.input.alias);
        exigir(tx.state.refs.some(ref => ref.page_id === item.id && ref.normalized_alias === normalizarTituloPagina(alias)), "A referência não pertence a esta página.");
        const existingRef = tx.state.refs.find(ref => ref.page_id === item.id && ref.normalized_alias === normalizarTituloPagina(alias));
        let target = existingRef?.target_id ? pagina(tx.state, existingRef.target_id) : tx.state.pages.find(page => !page.deleted_at && page.normalized_title === normalizarTituloPagina(alias));
        target ??= criarPagina(tx, deps, context, { notebook_id: request.input.notebook_id ?? item.notebook_id, title: alias });
        ativo(tx.state, target); exigir(target.id !== item.id, "Uma página não referencia a si mesma."); const before = clone(item);
        item.document = resolverReferenciaNoDocumento(item.document, alias, target.id); item.content_text = textoDoDocumento(item.document); item.version++; item.updated_at = now;
        salvarRefs(tx, deps, item); evento(tx, deps, context, "knowledge_page", before, item, "updated"); result = { page: item, target }; break;
      }
      case "knowledge.page.promote-capture": {
        const { input } = request; id(input.capture_id); const existing = tx.state.pages.find(page => page.origin_capture_id === input.capture_id);
        if (existing) { result = { page: existing, capture_id: input.capture_id }; break; }
        const capture = tx.state.captures.find(item => item.id === input.capture_id); if (!capture || capture.deleted_at) naoEncontrado();
        const page = criarPagina(tx, deps, context, { notebook_id: input.notebook_id, parent_id: input.parent_id, title: capture.title?.trim() || "Captura sem título", document: documentoDeTexto(capture.content ?? ""), origin_capture_id: capture.id });
        const before = clone(capture); capture.status = "archived"; capture.archived_at = now; capture.organized_at ??= now; capture.updated_at = now;
        evento(tx, deps, context, "capture", before, capture, "status_changed"); result = { page, capture_id: capture.id }; break;
      }
      case "knowledge.link.create": {
        const { input } = request; id(input.from_id); id(input.to_id); exigir(TIPOS_VINCULO.includes(input.from_type) && TIPOS_VINCULO.includes(input.to_type), "Tipo de vínculo inválido.");
        exigir(input.from_type !== input.to_type || input.from_id !== input.to_id, "Um registro não pode ser vinculado a si mesmo.");
        exigir(alvoRelacionado(tx.state, input.from_type, input.from_id) && alvoRelacionado(tx.state, input.to_type, input.to_id), "Registro relacionado indisponível.");
        const previous = tx.state.links.find(link => link.from_type === input.from_type && link.from_id === input.from_id && link.to_type === input.to_type && link.to_id === input.to_id);
        if (previous && !previous.deleted_at) { result = previous; break; }
        const link: Vinculo = previous ? { ...previous, deleted_at: null, updated_at: now } : { id: deps.ids.next(), user_id: context.user_id, from_type: input.from_type, from_id: input.from_id, to_type: input.to_type, to_id: input.to_id, deleted_at: null, created_at: now, updated_at: now };
        if (previous) tx.state.links[tx.state.links.indexOf(previous)] = link; else tx.state.links.push(link);
        evento(tx, deps, context, "knowledge_link", previous ?? null, link, previous ? "restored" : "created"); result = link; break;
      }
      case "knowledge.link.delete": {
        id(request.input.id); const link = tx.state.links.find(item => item.id === request.input.id); if (!link) naoEncontrado(); const before = clone(link);
        if (before.deleted_at) { result = before; break; }
        link.deleted_at = now; link.updated_at = now;
        evento(tx, deps, context, "knowledge_link", before, link, "deleted"); result = link; break;
      }
    }
    tx.state.receipts.push({ user_id: context.user_id, command: request.command, client_id: request.input.client_id, fingerprint, result: clone(result) }); return clone(result);
  });
}
