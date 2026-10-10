import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { documentoDeTexto, executarConhecimento, conhecimentoDTO, leituraPagina, type ConhecimentoStore, type EventoConhecimento, type Pagina, type SnapshotConhecimento } from "../../src/core/conhecimento";
import { beginPrivacyRender, flushPrivacyEffects, privacyHookMocks, resetPrivacyHooks, type PrivacyHooks } from "../helpers/privacy-hooks";
const seams = vi.hoisted(() => ({ hooks: null as unknown as PrivacyHooks, params: new URLSearchParams(), replace: vi.fn(), app: { userId: "", executeDomainCommand: vi.fn<(command: string, input: unknown) => Promise<unknown>>() } }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useState"]>) => privacyHookMocks(seams.hooks).useState(...args),
  useRef: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useRef"]>) => privacyHookMocks(seams.hooks).useRef(...args),
  useMemo: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useMemo"]>) => privacyHookMocks(seams.hooks).useMemo(...args),
  useCallback: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useCallback"]>) => privacyHookMocks(seams.hooks).useCallback(...args),
  useEffect: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useEffect"]>) => privacyHookMocks(seams.hooks).useEffect(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: seams.replace }), useSearchParams: () => seams.params }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/dynamic", () => ({ default: () => "knowledge-editor" }));
vi.mock("../../src/lib/demo/demo-provider", () => ({ DEMO_LOGOUT_EVENT: "segundo-cerebro:demo-logout", useDemoApplication: () => seams.app, useDemoPrivacy: () => ({ valuesHidden: false }) }));
vi.mock("../../src/components/ui/button", () => ({ Button: "button" }));
vi.mock("../../src/components/ui/card", () => ({ Card: "article" }));
vi.mock("../../src/components/ui/field", () => ({ Field: "input" }));
vi.mock("../../src/components/ui/dialog", () => ({ Dialog: "dialog", ConfirmDialog: "confirm-dialog" }));
import { ConnectedKnowledgeWorkspace } from "../../src/components/features/conhecimento/knowledge-connected-workspace";

const owner = "10000000-0000-4000-8000-000000000001", book = "10000000-0000-4000-8000-000000000002", otherBook = "10000000-0000-4000-8000-000000000003";
const pageA = "10000000-0000-4000-8000-000000000004", pageB = "10000000-0000-4000-8000-000000000005", now = "2026-10-09T13:00:00Z";
function hooks(): PrivacyHooks { return { states: [], refs: [], memos: [], effects: [], pending: [], stateIndex: 0, refIndex: 0, memoIndex: 0, effectIndex: 0 }; }
function find(node: ReactNode, predicate: (node: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) { if (!isValidElement<Record<string, unknown>>(child)) continue; if (predicate(child)) return child; const nested = find(child.props.children as ReactNode, predicate); if (nested) return nested; }
}
const label = (tree: ReactNode, value: string) => find(tree, node => node.props.label === value)!;
const button = (tree: ReactNode, value: string) => find(tree, node => node.type === "button" && node.props.children === value)!;
const click = (node: ReactElement<Record<string, unknown>>) => (node.props.onClick as (event: unknown) => void)({ currentTarget: {} });
const change = (node: ReactElement<Record<string, unknown>>, value: string) => (node.props.onChange as (event: unknown) => void)({ target: { value } });
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
async function settleWrites() { await Promise.allSettled(seams.app.executeDomainCommand.mock.results.filter(result => result.type === "return").map(result => result.value)); await settle(); }
function fixture(withPages = true) {
  const notebook = (id: string, name: string) => ({ id, user_id: owner, name, project_id: null, position: 0, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now });
  const page = (id: string, title: string): Pagina => ({ id, user_id: owner, notebook_id: book, parent_id: null, origin_capture_id: null, title, normalized_title: title.toLowerCase(), document: documentoDeTexto("Texto " + title), content_text: "Texto " + title, version: 1, position: 0, archived_at: null, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now });
  let state: SnapshotConhecimento = { revision: "0", notebooks: withPages ? [notebook(book, "Caderno"), notebook(otherBook, "Outro caderno")] : [], pages: withPages ? [page(pageA, "Origem"), page(pageB, "Destino")] : [], refs: [], links: [], targets: [], captures: [], receipts: [] };
  const store: ConhecimentoStore = { snapshot: async () => structuredClone(state), transaction: async (_context, work) => { const tx = { state: structuredClone(state), events: [] as EventoConhecimento[] }; const result = await work(tx); state = tx.state; return result; } };
  let sequence = 10;
  seams.app = { userId: owner, executeDomainCommand: vi.fn(async (command, input) => executarConhecimento(store, { clock: { now: () => now }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } }, { user_id: owner, canal: "web" }, { command, input } as Parameters<typeof executarConhecimento>[3])) };
  const fetcher = vi.fn(async (url: string) => Response.json(url.includes("?page=") ? leituraPagina(state, new URL(url, "https://example.test").searchParams.get("page")!) : conhecimentoDTO(state)));
  vi.stubGlobal("fetch", fetcher);
  let parent = hooks(), editor = hooks();
  function render() { seams.hooks = parent; beginPrivacyRender(parent); const tree = ConnectedKnowledgeWorkspace(); flushPrivacyEffects(parent); return tree; }
  function renderEditor() { const node = find(render(), node => node.props.page !== undefined && typeof node.type === "function")!; seams.hooks = editor; beginPrivacyRender(editor); const tree = (node.type as (props: unknown) => ReactNode)(node.props); flushPrivacyEffects(editor); return tree; }
  function unmountEditor() { for (const effect of editor.effects) effect.cleanup?.(); resetPrivacyHooks(editor); }
  function unmount() { unmountEditor(); for (const effect of parent.effects) effect.cleanup?.(); parent = hooks(); editor = hooks(); }
  async function mount(id = pageA) { seams.params = new URLSearchParams("note=" + id); render(); await settle(); render(); }
  function navigate(id: string) { unmountEditor(); seams.params = new URLSearchParams("note=" + id); return renderEditor(); }
  return { render, renderEditor, unmount, navigate, mount, fetcher, state: () => state, notebook, replaceState(next: SnapshotConhecimento) { state = next; } };
}
beforeEach(() => { vi.clearAllMocks(); seams.params = new URLSearchParams(); vi.stubGlobal("window", new EventTarget()); });
afterEach(() => { window.dispatchEvent(new CustomEvent("segundo-cerebro:demo-logout", { detail: { userId: seams.app.userId } })); vi.unstubAllGlobals(); });

describe("Conhecimento conectado: primeiro uso", () => {
  it.each([false, true])("cria caderno pelo estado vazio, inclusive se os anteriores estão excluídos (%s)", async onlyDeleted => {
    const f = fixture(false);
    if (onlyDeleted) f.state().notebooks.push({ ...f.notebook(book, "Caderno excluído"), deleted_at: now, deletion_batch_id: pageA });
    f.render(); await settle(); const first = button(f.render(), "Criar primeiro caderno"); expect(first.props.disabled).toBe(false); click(first);
    let tree = f.render(); change(label(tree, "Nome do caderno"), "Meu caderno"); tree = f.render();
    const dialog = find(tree, node => node.type === "dialog" && node.props.title === "Novo caderno")!; expect(dialog.props.open).toBe(true);
    const form = find(dialog, node => node.type === "form")!; (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); await settleWrites();
    expect(seams.app.executeDomainCommand).toHaveBeenCalledWith("knowledge.notebook.create", expect.objectContaining({ name: "Meu caderno" }));
    expect(f.state().notebooks.some(row => row.name === "Meu caderno" && !row.deleted_at)).toBe(true); f.unmount();
  });
});
describe("Conhecimento conectado: rascunhos somente na sessão", () => {
  it("o mesmo documento retornado em ordem JSONB não cria rascunho; mudanças de texto continuam pendentes", async () => {
    const f = fixture(), document = documentoDeTexto("Texto Origem");
    // JSONB and TipTap serialize the same nested object keys in different orders.
    // This hook fixture calls the actual PageEditor callback; the Linux conflict
    // journey separately exercises the real TipTap and canonical SQL transport.
    const fromJsonb = { content: [{ content: [{ text: "Texto Origem", type: "text" }], type: "paragraph" }], type: "doc" } as typeof document;
    expect(fromJsonb).toEqual(document); expect(JSON.stringify(fromJsonb)).not.toBe(JSON.stringify(document));
    f.state().pages[0] = { ...f.state().pages[0]!, document: fromJsonb };
    await f.mount(); let tree = f.renderEditor();
    (find(tree, node => node.type === "knowledge-editor")!.props.onChange as (value: unknown) => void)(document);
    tree = f.renderEditor(); expect(button(tree, "Salvar página").props.disabled).toBe(true);
    expect(seams.app.executeDomainCommand).not.toHaveBeenCalled(); f.unmount(); await f.mount();
    tree = f.renderEditor(); expect(button(tree, "Salvar página").props.disabled).toBe(true);
    (find(tree, node => node.type === "knowledge-editor")!.props.onChange as (value: unknown) => void)(documentoDeTexto("Texto alterado"));
    tree = f.renderEditor(); expect(button(tree, "Salvar página").props.disabled).toBe(false);
    click(button(tree, "Salvar página")); await settleWrites();
    expect(f.state().pages[0]).toMatchObject({ version: 2, content_text: "Texto alterado" }); f.unmount();
  });
  it("alterações de ordem, formatação e atributos continuam sendo rascunhos reais", async () => {
    const f = fixture(), document: Pagina["document"] = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
      { type: "paragraph", content: [{ type: "text", text: "Texto", marks: [{ type: "bold" }] }] },
    ] };
    f.state().pages[0] = { ...f.state().pages[0]!, document };
    await f.mount(); f.renderEditor();
    const reordered = structuredClone(document); reordered.content.reverse();
    const format = structuredClone(document); format.content[1]!.content![0]!.marks = [{ type: "italic" }];
    const level = structuredClone(document); level.content[0]!.attrs = { level: 3 };
    for (const changed of [reordered, format, level]) {
      let tree = f.renderEditor(); (find(tree, node => node.type === "knowledge-editor")!.props.onChange as (value: unknown) => void)(changed);
      tree = f.renderEditor(); expect(button(tree, "Salvar página").props.disabled).toBe(false);
      (find(tree, node => node.type === "knowledge-editor")!.props.onChange as (value: unknown) => void)(document);
      expect(button(f.renderEditor(), "Salvar página").props.disabled).toBe(true);
    }
    expect(seams.app.executeDomainCommand).not.toHaveBeenCalled(); f.unmount();
  });
  it("adotar a versão salva não volta à prop antiga e a próxima edição envia a versão adotada", async () => {
    const f = fixture(); await f.mount(); change(label(f.renderEditor(), "Título da página"), "Rascunho A"); f.renderEditor();
    f.state().pages[0] = { ...f.state().pages[0]!, title: "Salva B", normalized_title: "salva b", version: 2 };
    click(button(f.renderEditor(), "Salvar página")); await settleWrites();
    let tree = f.renderEditor(); expect(button(tree, "Usar a versão salva")).toBeDefined(); click(button(tree, "Usar a versão salva"));
    f.renderEditor(); tree = f.renderEditor();
    expect(label(tree, "Título da página").props.value).toBe("Salva B"); expect(button(tree, "Salvar página").props.disabled).toBe(true);
    expect(seams.app.executeDomainCommand).toHaveBeenCalledTimes(1);
    change(label(tree, "Título da página"), "Continuação A"); tree = f.renderEditor(); click(button(tree, "Salvar página")); await settleWrites();
    expect(seams.app.executeDomainCommand).toHaveBeenLastCalledWith("knowledge.page.update", expect.objectContaining({ expected_version: 2, title: "Continuação A" }));
    expect(f.state().pages[0]).toMatchObject({ title: "Continuação A", version: 3 }); f.unmount();
  });
  it("descartar depois de adotar um conflito preserva a versão salva mais recente", async () => {
    const f = fixture(); await f.mount(); change(label(f.renderEditor(), "Título da página"), "Rascunho A"); f.renderEditor();
    f.state().pages[0] = { ...f.state().pages[0]!, title: "Salva B", normalized_title: "salva b", document: documentoDeTexto("Conteúdo B"), content_text: "Conteúdo B", notebook_id: otherBook, version: 2 };
    click(button(f.renderEditor(), "Salvar página")); await settleWrites();
    click(button(f.renderEditor(), "Usar a versão salva")); f.renderEditor();
    change(label(f.renderEditor(), "Título da página"), "Descartar C"); f.renderEditor();
    click(button(f.renderEditor(), "Descartar rascunho"));
    const confirmation = find(f.renderEditor(), node => node.type === "confirm-dialog")!;
    (confirmation.props.onConfirm as () => void)(); f.renderEditor(); const tree = f.renderEditor();
    expect(label(tree, "Título da página").props.value).toBe("Salva B");
    expect(label(tree, "Caderno da página").props.value).toBe(otherBook);
    expect(find(tree, node => node.type === "knowledge-editor")!.props.document).toEqual(documentoDeTexto("Conteúdo B"));
    expect(button(tree, "Salvar página").props.disabled).toBe(true); expect(seams.app.executeDomainCommand).toHaveBeenCalledTimes(1);
    change(label(tree, "Título da página"), "Continuação D"); click(button(f.renderEditor(), "Salvar página")); await settleWrites();
    expect(seams.app.executeDomainCommand).toHaveBeenLastCalledWith("knowledge.page.update", expect.objectContaining({ expected_version: 2, title: "Continuação D", notebook_id: otherBook }));
    expect(f.state().pages[0]).toMatchObject({ title: "Continuação D", version: 3, content_text: "Conteúdo B" }); f.unmount();
  });
  it("preserva título, documento e organização entre páginas, saída pelo shell e Voltar sem autosave", async () => {
    const f = fixture(); await f.mount(); let tree = f.renderEditor(); change(label(tree, "Título da página"), "Rascunho da origem");
    tree = f.renderEditor(); const editor = find(tree, node => node.type === "knowledge-editor")!; (editor.props.onChange as (value: unknown) => void)(documentoDeTexto("Conteúdo ainda não salvo"));
    tree = f.renderEditor(); change(label(tree, "Caderno da página"), otherBook);
    tree = f.navigate(pageB); expect(label(tree, "Título da página").props.value).toBe("Destino"); tree = f.navigate(pageA);
    expect(label(tree, "Título da página").props.value).toBe("Rascunho da origem"); expect(label(tree, "Caderno da página").props.value).toBe(otherBook);
    f.unmount(); await f.mount(); tree = f.renderEditor(); expect(label(tree, "Título da página").props.value).toBe("Rascunho da origem"); expect(find(tree, node => node.type === "knowledge-editor")!.props.document).toEqual(documentoDeTexto("Conteúdo ainda não salvo"));
    expect(seams.app.executeDomainCommand).not.toHaveBeenCalled(); f.unmount();
  });
  it("cancelar descarte conserva o rascunho; confirmar limpa também após remontagem", async () => {
    const f = fixture(); await f.mount(); let tree = f.renderEditor(); change(label(tree, "Título da página"), "Descartar depois"); tree = f.renderEditor(); click(button(tree, "Descartar rascunho")); tree = f.renderEditor();
    let confirmation = find(tree, node => node.type === "confirm-dialog")!; expect(confirmation.props.open).toBe(true); (confirmation.props.onClose as () => void)();
    tree = f.renderEditor(); expect(label(tree, "Título da página").props.value).toBe("Descartar depois"); click(button(tree, "Descartar rascunho")); tree = f.renderEditor(); confirmation = find(tree, node => node.type === "confirm-dialog")!; (confirmation.props.onConfirm as () => void)();
    tree = f.renderEditor(); expect(label(tree, "Título da página").props.value).toBe("Origem"); f.unmount(); await f.mount(); expect(label(f.renderEditor(), "Título da página").props.value).toBe("Origem"); f.unmount();
  });
  it("guarda a versão original, detecta conflito da API e só substitui ao confirmar a escolha", async () => {
    const f = fixture(); await f.mount(); change(label(f.renderEditor(), "Título da página"), "Minha alteração"); f.renderEditor(); f.unmount();
    f.state().pages[0] = { ...f.state().pages[0]!, title: "Outra sessão", normalized_title: "outra sessao", version: 2 };
    await f.mount(); let tree = f.renderEditor(); expect(label(tree, "Título da página").props.value).toBe("Minha alteração"); click(button(tree, "Salvar página")); await settleWrites(); tree = f.renderEditor();
    expect(seams.app.executeDomainCommand).toHaveBeenCalledWith("knowledge.page.update", expect.objectContaining({ expected_version: 1, title: "Minha alteração" }));
    expect(label(tree, "Título da página").props.value).toBe("Minha alteração"); expect(button(tree, "Usar a versão salva")).toBeDefined(); click(button(tree, "Salvar meu rascunho sobre a atual")); await settleWrites();
    expect(f.state().pages[0]?.title).toBe("Minha alteração"); expect(f.state().pages[0]?.version).toBe(3); f.unmount(); await f.mount(); expect(button(f.renderEditor(), "Salvar página").props.disabled).toBe(true); f.unmount();
  });
  it("logout limpa mesmo com a rota fechada, e uma sessão nova não reidrata o conteúdo", async () => {
    const f = fixture(); await f.mount(); change(label(f.renderEditor(), "Título da página"), "PRIVATE_DRAFT_CANARY"); f.renderEditor(); f.unmount();
    window.dispatchEvent(new CustomEvent("segundo-cerebro:demo-logout", { detail: { userId: owner } }));
    seams.app = { ...seams.app, executeDomainCommand: vi.fn(async () => null) }; await f.mount(); expect(label(f.renderEditor(), "Título da página").props.value).toBe("Origem"); f.unmount();
  });
  it("troca de sessão do mesmo dono elimina o rascunho anterior", async () => {
    const f = fixture(); await f.mount(); change(label(f.renderEditor(), "Título da página"), "OLD_SESSION_PRIVATE"); f.renderEditor(); f.unmount();
    seams.app = { ...seams.app, executeDomainCommand: vi.fn(async () => null) }; await f.mount(); expect(label(f.renderEditor(), "Título da página").props.value).toBe("Origem"); f.unmount();
  });
  it("outra conta com o mesmo id de página não recebe o rascunho anterior", async () => {
    const f = fixture(); await f.mount(); change(label(f.renderEditor(), "Título da página"), "OTHER_ACTOR_PRIVATE"); f.renderEditor(); f.unmount();
    const nextOwner = "20000000-0000-4000-8000-000000000001";
    for (const row of [...f.state().notebooks, ...f.state().pages]) row.user_id = nextOwner;
    seams.app = { userId: nextOwner, executeDomainCommand: vi.fn(async () => null) }; await f.mount(); expect(label(f.renderEditor(), "Título da página").props.value).toBe("Origem"); f.unmount();
  });
  it("um callback antigo não recria rascunhos após logout", async () => {
    const f = fixture(); await f.mount(); const oldChange = label(f.renderEditor(), "Título da página").props.onChange as (event: unknown) => void;
    window.dispatchEvent(new CustomEvent("segundo-cerebro:demo-logout", { detail: { userId: owner } })); oldChange({ target: { value: "LATE_PRIVATE_DRAFT" } }); f.unmount();
    await f.mount(); expect(find(f.render(), node => node.props.page !== undefined)).toBeUndefined(); expect(button(f.render(), "Recarregar página")).toBeDefined(); f.unmount();
  });
  it("um save encerrado depois da navegação não apaga alterações mais novas", async () => {
    const f = fixture(), original = seams.app.executeDomainCommand;
    let finish!: () => void; const blocked = new Promise<void>(resolve => { finish = resolve; });
    seams.app = { ...seams.app, executeDomainCommand: vi.fn(async (command, input) => { await blocked; return original(command, input); }) };
    await f.mount(); change(label(f.renderEditor(), "Título da página"), "Primeiro envio"); click(button(f.renderEditor(), "Salvar página")); f.unmount();
    await f.mount(); change(label(f.renderEditor(), "Título da página"), "Rascunho mais novo"); f.renderEditor(); finish(); await settleWrites(); f.unmount();
    await f.mount(); expect(label(f.renderEditor(), "Título da página").props.value).toBe("Rascunho mais novo"); expect(f.state().pages[0]?.title).toBe("Primeiro envio"); f.unmount();
  });
  it.each(["SESSION_CHANGED", "UNAUTHENTICATED"])("uma escrita recusada por %s elimina conteúdo e revoga o rascunho", async code => {
    const f = fixture(); seams.app = { ...seams.app, executeDomainCommand: vi.fn(async () => { throw { code, message: "A sessão terminou." }; }) };
    await f.mount(); change(label(f.renderEditor(), "Título da página"), "REVOKED_PRIVATE_DRAFT"); click(button(f.renderEditor(), "Salvar página")); await settleWrites();
    expect(find(f.render(), node => node.props.page !== undefined)).toBeUndefined(); f.unmount();
    await f.mount(); expect(find(f.render(), node => node.props.page !== undefined)).toBeUndefined(); expect(button(f.render(), "Recarregar página")).toBeDefined(); f.unmount();
  });
});
