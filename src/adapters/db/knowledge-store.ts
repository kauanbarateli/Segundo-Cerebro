import "server-only";
import { assinatura, ErroDeDominio, exigir, type ContextoDeEscrita } from "../../core/contracts/base";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import { validarDocumento, normalizarTituloPagina, textoDoDocumento } from "../../core/conhecimento/document";
import type { ConhecimentoStore, EventoConhecimento, MudancaConhecimento, SnapshotConhecimento } from "../../core/conhecimento/types";

export interface KnowledgeCommit { expected_revision: string; context: ContextoDeEscrita; changes: MudancaConhecimento[]; refs: SnapshotConhecimento["refs"]; events: EventoConhecimento[]; receipt: ReciboIdempotente }
export interface KnowledgeGateway { readonly actorId: string; snapshot(): Promise<SnapshotConhecimento>; commit(request: KnowledgeCommit): Promise<{ status: "stale" | "committed" | "replayed"; result?: unknown }>; receipt(command: string, clientId: string): Promise<ReciboIdempotente | null> }
export class KnowledgeCommitUnknown extends Error { constructor() { super("O resultado do envio ainda não foi confirmado. Tente novamente com o mesmo envio."); this.name = "KnowledgeCommitUnknown"; } }
const same = (a: unknown, b: unknown) => assinatura(a) === assinatura(b);
const groups = { notebooks: "knowledge_notebook", pages: "knowledge_page", links: "knowledge_link", captures: "capture" } as const;
export function validateKnowledgeSnapshot(state: SnapshotConhecimento, actor: string) {
  exigir(/^(0|[1-9][0-9]*)$/.test(state.revision), "Revisão inválida.");
  const ids = new Set<string>();
  for (const rows of [state.notebooks, state.pages, state.refs, state.links, state.captures]) {
    exigir(Array.isArray(rows), "Snapshot inválido.");
    for (const item of rows) { exigir(item.user_id === actor && typeof item.id === "string" && !ids.has(item.id), "Registro fora do usuário autenticado."); ids.add(item.id); }
  }
  exigir(Array.isArray(state.targets) && Array.isArray(state.receipts), "Snapshot inválido.");
  for (const item of state.pages) {
    validarDocumento(item.document);
    exigir(item.normalized_title === normalizarTituloPagina(item.title) && item.content_text === textoDoDocumento(item.document) && Number.isSafeInteger(item.version) && item.version > 0, "Página inconsistente.");
    exigir(state.notebooks.some(notebook => notebook.id === item.notebook_id), "Caderno inexistente.");
    const visited = new Set([item.id]); let parentId = item.parent_id;
    while (parentId) { exigir(!visited.has(parentId), "Árvore cíclica."); visited.add(parentId); const parent = state.pages.find(page => page.id === parentId); exigir(parent && parent.notebook_id === item.notebook_id, "Ancestral fora do caderno."); parentId = parent.parent_id; }
  }
  for (const ref of state.refs) exigir(state.pages.some(page => page.id === ref.page_id) && (ref.target_id === null || state.pages.some(page => page.id === ref.target_id && page.id !== ref.page_id)), "Referência fora do usuário.");
  const receipts = new Set<string>();
  for (const receipt of state.receipts) { const key = `${receipt.command}:${receipt.client_id}`; exigir(receipt.user_id === actor && receipt.command.startsWith("knowledge.") && !receipts.has(key), "Recibo inválido."); receipts.add(key); }
}
/** Staging do Núcleo com CAS; retries nunca repetem efeito externo. */
export function createKnowledgeStore(gateway: KnowledgeGateway): ConhecimentoStore {
  const read = async () => { const state = structuredClone(await gateway.snapshot()); validateKnowledgeSnapshot(state, gateway.actorId); return state; };
  return { snapshot: read,
    async transaction(context, work) {
      exigir(context.user_id === gateway.actorId && ["web", "api", "cron"].includes(context.canal), "Escrita fora do usuário.");
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = await read(), tx = { state: structuredClone(before), events: [] as EventoConhecimento[] };
        const result = await work(tx); validateKnowledgeSnapshot(tx.state, gateway.actorId);
        const fresh = tx.state.receipts.filter(receipt => !before.receipts.some(old => old.command === receipt.command && old.client_id === receipt.client_id));
        if (!fresh.length) return structuredClone(result);
        exigir(fresh.length === 1 && same(fresh[0]?.result, result), "Comando exige um único recibo.");
        const changes: MudancaConhecimento[] = [];
        for (const [collection, type] of Object.entries(groups)) {
          const key = collection as keyof typeof groups;
          const old = new Map(before[key].map(item => [item.id, item]));
          for (const item of tx.state[key]) { const existing = old.get(item.id) ?? null; if (!same(existing, item)) changes.push({ type, before: structuredClone(existing), after: structuredClone(item) }); old.delete(item.id); }
          exigir(old.size === 0, "Exclusão física de conteúdo não permitida.");
        }
        const remaining = [...tx.events];
        for (const change of changes) { const index = remaining.findIndex(event => event.entity_type === change.type && same(event.before, change.before) && same(event.after, change.after)); if (index < 0) throw new ErroDeDominio("EVENT_REQUIRED", "Escrita sem evento de domínio."); remaining.splice(index, 1); }
        exigir(!remaining.length, "Evento sem alteração correspondente.");
        const receipt = fresh[0]!;
        const commit: KnowledgeCommit = { expected_revision: before.revision, context: structuredClone(context), changes, refs: structuredClone(tx.state.refs), events: tx.events, receipt };
        try {
          const response = await gateway.commit(commit); if (response.status === "stale") continue;
          if (!Object.hasOwn(response, "result") || response.status === "committed" && !same(response.result, result)) throw new KnowledgeCommitUnknown();
          return structuredClone(response.result) as typeof result;
        } catch (error) {
          if (!(error instanceof KnowledgeCommitUnknown)) throw error;
          const saved = await gateway.receipt(receipt.command, receipt.client_id);
          if (!saved) throw error;
          exigir(saved.user_id === gateway.actorId && saved.command === receipt.command && saved.client_id === receipt.client_id && saved.fingerprint === receipt.fingerprint, "Recibo de reconciliação inválido.");
          return structuredClone(saved.result) as typeof result;
        }
      }
      throw new ErroDeDominio("CONFLICT", "Os dados mudaram durante o envio. Tente novamente com o mesmo envio.");
    },
  };
}
