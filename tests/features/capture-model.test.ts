import { describe, expect, it } from "vitest";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { draftFrom, filterCaptures, incoming, references, rewriteWiki, validateDraft } from "../../src/components/features/capturar/model";
import { clearDrafts, draftStorageKey, findDraft, readDrafts, writeDrafts, type DraftStorage } from "../../src/components/features/capturar/drafts";
const notes = () => structuredClone(createDemoFixture().initial.capture!);
describe("projeções de Capturar", () => {
  it("preserva categoria nula existente e aplica Pessoal somente à nova nota", () => {
    expect(draftFrom({ ...notes()[0]!, category_id: null }, "personal").category_id).toBeNull();
    expect(draftFrom(undefined, "personal").category_id).toBe("personal");
  });
  it("ordena por captura mais recente e desempata pelo ID sem mudar a entrada", () => {
    const items = [...notes()].reverse(); const snapshot = structuredClone(items);
    expect(filterCaptures(items, "all", "").map((item) => item.id)).toEqual(["architecture", "vision", "journal", "finance", "watch", "accountant", "book"]);
    const sameTime = items.slice(0, 2).map((item) => ({ ...item, captured_at: items[0]!.captured_at }));
    expect(filterCaptures(sameTime, "all", "").map((item) => item.id)).toEqual(["accountant", "book"]);
    expect(items).toEqual(snapshot);
  });
  it("preserva sete exemplos e os três itens da caixa de entrada", () => {
    expect(notes().map((note) => note.id)).toEqual(["architecture", "vision", "journal", "finance", "watch", "accountant", "book"]);
    expect(filterCaptures(notes(), "inbox", "").map((note) => note.id)).toEqual(["watch", "accountant", "book"]);
    expect(filterCaptures(notes(), "all", "nucleo").map((note) => note.id)).toEqual(["architecture"]);
  });
  it("deduplica wiki e ID, ignora autorreferência e conserva pendências", () => {
    const draft = { ...draftFrom(notes()[0]), linked_capture_ids: ["vision", "architecture"], content: "[[VISÃO DO PRODUTO]] [[visao do produto]] [[Decisões de arquitetura]] [[Ainda não existe]]" };
    expect(references(draft, notes())).toEqual({ ids: ["vision"], missing: ["Ainda não existe"] });
    expect(incoming("architecture", notes()).map((note) => note.id)).toEqual(["vision", "journal", "finance", "book"]);
  });
  it("renomear e desvincular mantêm o restante do texto, sem interpretar HTML", () => {
    const source = "Antes <script>literal</script> [[visao do produto]] e [[Outra nota]].";
    expect(rewriteWiki(source, "Visão do produto", "Nova visão")).toBe("Antes <script>literal</script> [[Nova visão]] e [[Outra nota]].");
    expect(rewriteWiki(source, "Visão do produto", "Visão do produto", true)).toBe("Antes <script>literal</script> Visão do produto e [[Outra nota]].");
  });
  it("valida título obrigatório e único também entre arquivadas, sem mudar coleção", () => {
    const items = notes(); items[0]!.status = "archived";
    const blank = draftFrom(); expect(validateDraft(blank, items)).toMatch(/título/);
    expect(validateDraft({ ...blank, title: "  DECISOES DE ARQUITETURA " }, items)).toMatch(/Já existe/);
    expect(validateDraft({ ...blank, title: "Novo", content: "x".repeat(30_000) }, items)).toBeNull();
    expect(filterCaptures(items, "archived", "decisoes")).toHaveLength(1);
    expect(items[0]!.status).toBe("archived");
  });
});
describe("rascunhos por usuário", () => {
  function storage() { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } } satisfies DraftStorage; }
  it("recupera texto após nova leitura e limpa somente o usuário indicado", () => {
    const store = storage(); const draft = { ...draftFrom(), title: "Rascunho", content: "Texto ainda não salvo" };
    expect(writeDrafts(store, "a", { new: draft })).toBe(true); writeDrafts(store, "b", { new: { ...draft, title: "Outro usuário" } });
    expect(readDrafts(store, "a").drafts.new).toEqual(draft); clearDrafts(store, "a");
    expect(readDrafts(store, "a").drafts).toEqual({}); expect(readDrafts(store, "b").drafts.new?.title).toBe("Outro usuário");
  });
  it("ignora estruturas inválidas e não permite ID do mapa divergente", () => {
    const store = storage(); store.setItem(draftStorageKey("a"), JSON.stringify({ wrong: draftFrom(), new: { title: "Parcial" } }));
    expect(readDrafts(store, "a")).toEqual({ drafts: {}, available: true });
    store.setItem(draftStorageKey("a"), "{broken"); expect(readDrafts(store, "a").available).toBe(false);
  });
  it("storage indisponível não impede memória da sessão nem lança no logout", () => {
    const blocked = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); } };
    expect(readDrafts(blocked, "a")).toEqual({ drafts: {}, available: false });
    expect(writeDrafts(blocked, "a", {})).toBe(false); expect(() => clearDrafts(blocked, "a")).not.toThrow();
  });
  it("trata chaves herdadas como ausentes e aceita os mesmos nomes como dados próprios", () => {
    const store = storage();
    for (const id of ["__proto__", "constructor", "toString"]) {
      expect(findDraft({}, id)).toBeUndefined();
      const draft = { ...draftFrom(), id, title: "Texto recuperável" };
      const map = { [id]: draft };
      expect(writeDrafts(store, "a", map)).toBe(true);
      const restored = readDrafts(store, "a").drafts;
      expect(Object.hasOwn(restored, id)).toBe(true);
      expect(findDraft(restored, id)).toEqual(draft);
      expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
    }
  });
});
