import { describe, expect, it } from "vitest";
import { documentoDeTexto, executarConhecimento, extrairReferencias, leituraPagina, normalizarTituloPagina, validarDocumento, type ComandoConhecimento, type ConhecimentoStore, type EventoConhecimento, type SnapshotConhecimento } from "../../src/core/conhecimento";

const actor = "10000000-0000-4000-8000-000000000001";
const notebookId = "10000000-0000-4000-8000-000000000002";
const now = "2026-10-09T13:00:00Z";
function fixture() {
  let state: SnapshotConhecimento = { revision: "0", notebooks: [{ id: notebookId, user_id: actor, name: "Caderno", project_id: null, position: 0, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now }], pages: [], refs: [], links: [], targets: [], captures: [], receipts: [] };
  const events: EventoConhecimento[] = []; let sequence = 10;
  const store: ConhecimentoStore = { snapshot: async () => structuredClone(state), transaction: async (_context, work) => { const tx = { state: structuredClone(state), events: [] as EventoConhecimento[] }; const result = await work(tx); state = tx.state; events.push(...tx.events); return result; } };
  const deps = { clock: { now: () => now }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } };
  const command = (request: ComandoConhecimento) => executarConhecimento(store, deps, { user_id: actor, canal: "web" }, request);
  const create = async (title: string, text = "", parent_id?: string) => { const result = await command({ command: "knowledge.page.create", input: { client_id: title, notebook_id: notebookId, title, document: documentoDeTexto(text), parent_id } }); return result as SnapshotConhecimento["pages"][number]; };
  return { command, create, events, state: () => state };
}
describe("Conhecimento: documento e identidade", () => {
  it("normaliza acentos sem transformar conteúdo em HTML", () => { expect(normalizarTituloPagina("  AÇÃO   diária ")).toBe("acao diaria"); const document = documentoDeTexto("<script>texto</script>\n\n[[Alvo]]"); expect(() => validarDocumento(document)).not.toThrow(); expect(extrairReferencias(document)).toEqual([{ alias: "Alvo", normalized_alias: "alvo", target_id: null }]); });
  it.each([ { type: "doc", content: [{ type: "iframe" }] }, { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" } }] }, { type: "doc", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] } ])("recusa documento não permitido %#", document => { expect(() => validarDocumento(document)).toThrow(); });
  it("salva referência pendente, cria por confirmação e mantém backlink após renomear", async () => {
    const f = fixture(), source = await f.create("Origem", "Olá [[Destino novo]]");
    expect(f.state().refs[0]?.target_id).toBeNull();
    const result = await f.command({ command: "knowledge.page.resolve-ref", input: { id: source.id, alias: "Destino novo", client_id: "resolve" } }) as { target: SnapshotConhecimento["pages"][number] };
    expect(leituraPagina(f.state(), result.target.id).backlinks).toEqual([{ id: source.id, title: "Origem", notebook_id: notebookId }]);
    await f.command({ command: "knowledge.page.update", input: { id: result.target.id, expected_version: 1, title: "Nome atualizado", document: result.target.document, client_id: "rename" } });
    expect(f.state().refs[0]?.target_id).toBe(result.target.id); expect(leituraPagina(f.state(), result.target.id).backlinks).toHaveLength(1);
    expect(f.state().pages.find(page => page.id === source.id)?.document.content[0]?.content?.some(node => node.type === "wikiLink" && node.attrs?.target_id === result.target.id)).toBe(true);
  });
  it("recusa título equivalente e detecta conflito sem sobrescrever", async () => {
    const f = fixture(), page = await f.create("Ação"); await expect(f.create("acao")).rejects.toThrow("Já existe");
    await f.command({ command: "knowledge.page.update", input: { id: page.id, expected_version: 1, title: "Novo", document: documentoDeTexto("guardado"), client_id: "update" } });
    await expect(f.command({ command: "knowledge.page.update", input: { id: page.id, expected_version: 1, title: "antigo", document: documentoDeTexto("perdido"), client_id: "stale" } })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.state().pages[0]?.content_text).toBe("guardado");
  });
  it("excluir/restaurar uma árvore não restaura filho já excluído antes", async () => {
    const f = fixture(), parent = await f.create("Pai"), child = await f.create("Filho", "", parent.id), earlier = await f.create("Excluída antes", "", parent.id);
    await f.command({ command: "knowledge.page.delete", input: { id: earlier.id, client_id: "earlier-delete" } });
    await f.command({ command: "knowledge.page.delete", input: { id: parent.id, client_id: "delete-tree" } });
    await f.command({ command: "knowledge.page.restore", input: { id: parent.id, client_id: "restore-tree" } });
    expect(f.state().pages.find(page => page.id === child.id)?.deleted_at).toBeNull(); expect(f.state().pages.find(page => page.id === earlier.id)?.deleted_at).toBe(now);
  });
  it("lixeira do caderno preserva referências e restaura somente seu lote", async () => {
    const f = fixture(), target = await f.create("Destino"), source = await f.create("Origem", "[[Destino]]");
    await f.command({ command: "knowledge.page.delete", input: { id: target.id, client_id: "predeleted" } });
    await f.command({ command: "knowledge.notebook.delete", input: { id: notebookId, client_id: "notebook-delete" } });
    await f.command({ command: "knowledge.notebook.restore", input: { id: notebookId, client_id: "notebook-restore" } });
    expect(f.state().refs).toHaveLength(1); expect(f.state().pages.find(page => page.id === source.id)?.deleted_at).toBeNull(); expect(f.state().pages.find(page => page.id === target.id)?.deleted_at).toBe(now);
  });
  it("não permite ciclo de árvore ou pai de outro caderno", async () => {
    const f = fixture(), parent = await f.create("Pai"), child = await f.create("Filho", "", parent.id);
    await expect(f.command({ command: "knowledge.page.update", input: { id: parent.id, title: "Pai", document: parent.document, expected_version: 1, parent_id: child.id, client_id: "cycle" } })).rejects.toThrow("ancestral");
  });
  it("replay mantém identidade e evento; payload diferente é conflito", async () => {
    const f = fixture(), request: ComandoConhecimento = { command: "knowledge.page.create", input: { title: "Uma", notebook_id: notebookId, client_id: "same" } };
    const first = await f.command(request); expect(await f.command(request)).toEqual(first); expect(f.events).toHaveLength(1);
    await expect(f.command({ ...request, input: { ...request.input, title: "Outra" } })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("arquivar preserva arestas, mas tira a origem dos backlinks ativos", async () => {
    const f = fixture(), target = await f.create("Destino"), source = await f.create("Origem", "[[Destino]]");
    await f.command({ command: "knowledge.page.archive", input: { id: source.id, client_id: "archive" } });
    expect(f.state().refs[0]?.target_id).toBe(target.id); expect(leituraPagina(f.state(), target.id).backlinks).toHaveLength(0);
  });
  it("promover cria um único destino e congela a captura histórica com evento", async () => {
    const f = fixture(), captureId = "10000000-0000-4000-8000-000000000009";
    f.state().captures.push({ id: captureId, user_id: actor, client_id: "original", type: "note", title: "Captura", content: "Texto original", status: "inbox", category_id: null, project_id: null, converted_task_id: null, captured_at: now, organized_at: null, archived_at: null, deleted_at: null, created_at: now, updated_at: now });
    const request: ComandoConhecimento = { command: "knowledge.page.promote-capture", input: { capture_id: captureId, notebook_id: notebookId, client_id: "promote" } };
    const result = await f.command(request) as { page: SnapshotConhecimento["pages"][number] };
    await f.command({ ...request, input: { ...request.input, client_id: "repeat-promotion" } });
    expect(f.state().pages).toHaveLength(1); expect(f.state().pages[0]?.origin_capture_id).toBe(captureId); expect(f.state().captures[0]).toMatchObject({ content: "Texto original", status: "archived", archived_at: now });
    expect(f.events.map(event => event.entity_type)).toEqual(["knowledge_page", "capture"]);
    expect(result.page.content_text).toBe("Texto original");
  });
});
