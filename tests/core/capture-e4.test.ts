import { describe, expect, it, vi } from "vitest";
import { criarAdapterMemoria } from "../../src/adapters/memory";
import { criarCaptura, editarCaptura, converterCapturaEmTarefa, type Captura } from "../../src/core/capturas";
import { documentoDeTexto, textoDoDocumento, validarDocumento, type DocumentoPagina } from "../../src/core/contracts/rich-document";
import { executarConhecimento, type ComandoConhecimento, type ConhecimentoStore, type EventoConhecimento, type Pagina, type SnapshotConhecimento } from "../../src/core/conhecimento";
import { documentoDaCapturaPromovida } from "../../src/core/conhecimento/capture-promotion";
import { createKnowledgeStore, type KnowledgeCommit, type KnowledgeGateway } from "../../src/adapters/db/knowledge-store";
vi.mock("server-only", () => ({}));

const actor = "10000000-0000-4000-8000-000000000001", foreign = "20000000-0000-4000-8000-000000000001", notebook = "10000000-0000-4000-8000-000000000002", now = "2026-10-22T12:00:00Z";
const a = "10000000-0000-4000-8000-000000000003", b = "10000000-0000-4000-8000-000000000004", image = "10000000-0000-4000-8000-000000000005";
const document: DocumentoPagina = { type: "doc", content: [
  { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [{ type: "text", text: "Conteúdo", marks: [{ type: "underline" }, { type: "bold" }] }] },
  { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Concluído" }] }] }] },
  { type: "paragraph", content: [{ type: "text", text: "Fonte", marks: [{ type: "link", attrs: { href: "https://example.com/rota", target: "_blank", rel: "noopener noreferrer" } }] }] },
] };
function capture(id: string, title: string, doc = document): Captura { return { id, user_id: actor, client_id: id, title, type: "note", content: textoDoDocumento(doc).trim(), document: structuredClone(doc), document_version: 7, project_id: null, category_id: null, status: "inbox", converted_task_id: null, captured_at: now, organized_at: null, archived_at: null, deleted_at: null, created_at: now, updated_at: now, linked_capture_ids: [] }; }
function knowledge(captures: Captura[]) {
  let state: SnapshotConhecimento = { revision: "0", notebooks: [{ id: notebook, user_id: actor, name: "Caderno", project_id: null, position: 0, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now }], pages: [], refs: [], links: [], targets: [], captures, receipts: [] };
  let sequence = 10; const events: EventoConhecimento[] = [];
  const deps = { clock: { now: () => now }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } };
  let eventFailure = false;
  const store: ConhecimentoStore = { snapshot: async () => structuredClone(state), transaction: async (_context, work) => { const tx = { state: structuredClone(state), events: [] as EventoConhecimento[] }; const result = await work(tx); if (eventFailure) throw new Error("event failed"); state = tx.state; events.push(...tx.events); return result; } };
  const command = (request: ComandoConhecimento) => executarConhecimento(store, deps, { user_id: actor, canal: "web" }, request);
  const promote = (id: string, client_id = `promote:${id}`) => command({ command: "knowledge.page.promote-capture", input: { capture_id: id, notebook_id: notebook, client_id } }) as Promise<{ page: Pagina; capture_id: string }>;
  return { command, promote, events, state: () => state, failEvent: () => { eventFailure = true; } };
}
describe("E4: criação e edição documental atômicas", () => {
  it("cria documento/revisão/cache juntos, replay não duplica e tarefa usa somente o texto derivado", async () => {
    let sequence = 20; const deps = { clock: { now: () => now }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } }, store = criarAdapterMemoria(deps), context = { user_id: actor, canal: "web" as const };
    const input = { client_id: "rich-create", type: "note" as const, title: "\tDocumento\u00a0", category_id: null, project_id: null, document };
    const created = await criarCaptura(store, deps, context, input);
    expect(created).toMatchObject({ title: "Documento", document, document_version: 1, content: textoDoDocumento(document).trim() });
    expect(await criarCaptura(store, deps, context, input)).toEqual(created); expect(await store.read(actor).eventos.list()).toHaveLength(1);
    const edit = { id: created.id, client_id: "edit", expected_content: { kind: "rich" as const, document_version: 1 }, patch: { document, title: "Novo título" } };
    const saved = await editarCaptura(store, deps, context, edit); expect(saved).toMatchObject({ title: "Novo título", document, document_version: 2 });
    expect(await editarCaptura(store, deps, context, edit)).toEqual(saved);
    await expect(editarCaptura(store, deps, context, { ...edit, client_id: "stale" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(editarCaptura(store, deps, context, { id: created.id, client_id: "old", patch: { title: "Cliente antigo", content: "perda" } })).rejects.toMatchObject({ code: "CONFLICT" });
    const result = await converterCapturaEmTarefa(store, deps, context, { capture_id: saved.id, client_id: "task" });
    expect(result.tarefa.description).toBe(saved.content); expect(result.tarefa).not.toHaveProperty("document");
  });
  it("falha de evento reverte criação rica, dado e recibo; vínculo alheio nunca entra no documento", async () => {
    let sequence = 20, fail = true; const deps = { clock: { now: () => now }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } }, context = { user_id: actor, canal: "web" as const };
    const store = criarAdapterMemoria({ ...deps, beforeOperation(point) { if (point === "event" && fail) throw new Error("event failed"); } });
    const input = { client_id: "same", type: "note" as const, title: "Rica", category_id: null, project_id: null, document };
    await expect(criarCaptura(store, deps, context, input)).rejects.toThrow("event failed"); expect(await store.read(actor).capturas.list()).toEqual([]);
    fail = false; expect((await criarCaptura(store, deps, context, input)).document_version).toBe(1);
    const linked: DocumentoPagina = { type: "doc", content: [{ type: "paragraph", content: [{ type: "captureLink", attrs: { target_id: b, alias: "Alheia" } }] }] };
    await expect(criarCaptura(store, deps, context, { ...input, client_id: "foreign", document: linked })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
describe("E4: promoção integral e namespaces", () => {
  it.each([[a, b], [b, a]])("A→B mantém o destino por ID nas duas ordens: %s depois %s", async (first, second) => {
    const source = capture(a, "A", { type: "doc", content: [...structuredClone(document.content), { type: "paragraph", content: [{ type: "captureLink", attrs: { target_id: b, alias: "B original" } }] }] });
    source.linked_capture_ids = [b]; source.attachments = [{ id: image, name: "Privada.png", mime: "image/png", width: 2, height: 2, bytes: 50 }];
    const f = knowledge([source, capture(b, "B")]), original = structuredClone(source);
    await f.promote(first); await f.promote(second);
    const pageA = f.state().pages.find(page => page.origin_capture_id === a)!, pageB = f.state().pages.find(page => page.origin_capture_id === b)!;
    expect(pageA.document.content.slice(0, 3)).toEqual(document.content);
    expect(pageA.document.content.at(-1)?.content?.[0]).toMatchObject({ type: "wikiLink", attrs: { target_id: pageB.id, alias: "B original" } });
    expect(f.state().refs.some(ref => ref.page_id === pageA.id && ref.target_id === pageB.id)).toBe(true);
    expect(f.state().refs.some(ref => ref.target_id === b)).toBe(false);
    expect(f.state().links.filter(link => !link.deleted_at && link.from_id === pageA.id && link.to_type === "page" && link.to_id === pageB.id)).toHaveLength(1);
    expect(f.state().links.filter(link => !link.deleted_at && link.from_id === pageA.id && link.to_type === "file" && link.to_id === image)).toHaveLength(1);
    expect(f.state().captures.find(item => item.id === a)).toMatchObject({ document: original.document, document_version: 7, attachments: original.attachments, status: "archived" });
    const count = f.events.length, replay = await f.promote(a); expect(replay.page.id).toBe(pageA.id); expect(f.events).toHaveLength(count);
    await f.command({ command: "knowledge.page.update", input: { id: pageB.id, expected_version: pageB.version, title: "B renomeada", document: pageB.document, client_id: "rename" } });
    expect(f.state().refs.some(ref => ref.page_id === pageA.id && ref.target_id === pageB.id)).toBe(true);
  });
  it("não resolve Captura pendente por página homônima e conserva HTML como texto", () => {
    const source = capture(a, "A", documentoDeTexto("<img onerror=alert(1)> [[B]]")); source.linked_capture_ids = [b];
    const homonym = { id: image, user_id: actor, origin_capture_id: null, title: "B" } as Pagina;
    const result = documentoDaCapturaPromovida(source, [source, capture(b, "B")], [homonym]);
    expect(result.content[0]?.content?.[0]?.text).toBe("<img onerror=alert(1)> ");
    expect(result.content[0]?.content?.[1]).toMatchObject({ type: "captureLink", attrs: { target_id: b } });
  });
  it.each(["source", "target"])("a lixeira %s exige restauração sem perder a promoção ou aresta pendente", async endpoint => {
    const source = capture(a, "A", { type: "doc", content: [{ type: "paragraph", content: [{ type: "captureLink", attrs: { target_id: b, alias: "B" } }] }] }); source.linked_capture_ids = [b];
    const f = knowledge([source, capture(b, "B")]), first = await f.promote(endpoint === "source" ? a : b);
    await f.command({ command: "knowledge.page.delete", input: { id: first.page.id, client_id: "trash" } });
    const before = structuredClone(f.state()), events = structuredClone(f.events);
    await expect(f.promote(endpoint === "source" ? b : a)).rejects.toThrow("Restaure");
    expect(f.state()).toEqual(before); expect(f.events).toEqual(events);
    await f.command({ command: "knowledge.page.restore", input: { id: first.page.id, client_id: "restore" } });
    await f.promote(endpoint === "source" ? b : a);
    expect(f.state().pages).toHaveLength(2);
    const pageA = f.state().pages.find(page => page.origin_capture_id === a)!, pageB = f.state().pages.find(page => page.origin_capture_id === b)!;
    expect(f.state().links.filter(link => !link.deleted_at && link.from_id === pageA.id && link.to_id === pageB.id)).toHaveLength(1);
  });
  it("Página apenas arquivada continua reconciliada com seu lifecycle preservado", async () => {
    const source = capture(a, "A", { type: "doc", content: [{ type: "paragraph", content: [{ type: "captureLink", attrs: { target_id: b, alias: "B" } }] }] }); source.linked_capture_ids = [b];
    const f = knowledge([source, capture(b, "B")]), first = await f.promote(a);
    await f.command({ command: "knowledge.page.archive", input: { id: first.page.id, client_id: "archive" } });
    await f.promote(b);
    expect(f.state().pages.find(page => page.id === first.page.id)).toMatchObject({ archived_at: now, deleted_at: null, version: 3 });
  });
  it("limita aliases a200unidadesUTF16 sem consumir o candidato longo nem referência posterior/interna", () => {
    for (const text of [`[[${"🧠".repeat(101)}]]`, `[[${"🧠".repeat(101)}]] [[B]]`, `[[${"🧠".repeat(101)}[[B]]`]) {
      const source = capture(a, "A", documentoDeTexto(text)); source.linked_capture_ids = [b];
      const result = documentoDaCapturaPromovida(source, [source, capture(b, "B")], []);
      expect(textoDoDocumento(result)).toBe(text.includes("[[B]]") ? text.slice(0, -5) + "B" : text);
      expect(result.content[0]!.content![0]!.text).toBe(text.includes("[[B]]") ? text.slice(0, -5) : text);
    }
    const alias = "🧠".repeat(100), source = capture(a, "A", documentoDeTexto(`[[${alias}]]`));
    expect(documentoDaCapturaPromovida(source, [source], []).content[0]!.content).toEqual([{ type: "captureLink", attrs: { alias, target_id: null } }]);
  });
  it("origem alheia, cache forjado e evento que falha não deixam promoção parcial", async () => {
    for (const row of [{ ...capture(a, "A"), user_id: foreign }, { ...capture(a, "A"), content: "forjado" }]) {
      const f = knowledge([row]), before = structuredClone(f.state());
      await expect(f.promote(a)).rejects.toHaveProperty("code"); expect(f.state()).toEqual(before); expect(f.events).toEqual([]);
    }
    const f = knowledge([capture(a, "A")]), before = structuredClone(f.state()); f.failEvent();
    await expect(f.promote(a)).rejects.toThrow("event failed"); expect(f.state()).toEqual(before); expect(f.events).toEqual([]);
  });
  it("refaz projeção no CAS atual e conserva edição de outra aba em vez de sobrescrever seu documento", async () => {
    const source = capture(a, "A", { type: "doc", content: [{ type: "paragraph", content: [{ type: "captureLink", attrs: { target_id: b, alias: "B" } }] }] }); source.linked_capture_ids = [b];
    const f = knowledge([source, capture(b, "B")]); await f.promote(a);
    const state = structuredClone(f.state()), commits: KnowledgeCommit[] = [];
    const gateway: KnowledgeGateway = { actorId: actor, snapshot: async () => structuredClone(state), receipt: async () => null, commit: async request => {
      commits.push(structuredClone(request));
      if (commits.length === 1) {
        const row = state.pages[0]!; row.document.content.push({ type: "paragraph", content: [{ type: "text", text: "Edição concorrente", marks: [{ type: "italic" }] }] }); row.content_text = textoDoDocumento(row.document); row.version++; state.revision = "1";
        return { status: "stale" };
      }
      return { status: "committed", result: request.receipt.result };
    } };
    let sequence = 80; await executarConhecimento(createKnowledgeStore(gateway), { clock: { now: () => now }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } }, { user_id: actor, canal: "web" }, { command: "knowledge.page.promote-capture", input: { capture_id: b, notebook_id: notebook, client_id: "same-after-stale" } });
    expect(commits).toHaveLength(2); expect(commits[0]!.expected_revision).toBe("0"); expect(commits[1]!.expected_revision).toBe("1");
    const update = commits[1]!.changes.find(change => change.type === "knowledge_page" && change.before?.id === state.pages[0]!.id)!;
    expect(update.before).toMatchObject({ version: 2, content_text: "B\nEdição concorrente" });
    expect(update.after).toMatchObject({ version: 3, content_text: "B\nEdição concorrente" });
    expect((update.after as Pagina).document.content.at(-1)).toEqual(state.pages[0]!.document.content.at(-1));
    expect(commits[1]!.receipt.client_id).toBe("same-after-stale");
  });
  it("checklist/alinhamento são fechados e não criam imagens, HTML ou links executáveis", () => {
    expect(() => validarDocumento(document)).not.toThrow();
    for (const node of [{ type: "taskItem", attrs: { checked: "true" }, content: [{ type: "paragraph" }] }, { type: "paragraph", attrs: { textAlign: "expression(alert(1))" } }, { type: "taskList", content: [{ type: "paragraph" }] }, { type: "captureLink", attrs: { target_id: "javascript:alert(1)", alias: "X" } }]) expect(() => validarDocumento({ type: "doc", content: [node] })).toThrow();
  });
});
