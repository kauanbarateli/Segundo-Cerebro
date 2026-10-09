import { describe, expect, it, vi } from "vitest";
import { normalizeSearch, rankSearch, search, searchRank, searchTerm, validSearchResults, SEARCH_TYPES, type SearchResult } from "../../src/core/busca";
describe("busca global normalizada e estável", () => {
  it("normaliza acentos, maiúsculas e espaços sem perder o termo original enviado ao port", async () => {
    expect(normalizeSearch("  Organização\t PESSOAL  ")).toBe("organizacao pessoal"); const port = { query: vi.fn().mockResolvedValue([]) }; await search(port, "  Organização "); expect(port.query).toHaveBeenCalledWith("Organização");
  });
  it("não consulta vazio e recusa controles ou termo excessivo", async () => {
    const port = { query: vi.fn() }; expect(await search(port, " ")).toEqual([]); expect(port.query).not.toHaveBeenCalled(); for (const value of ["x".repeat(121), "a\u0000b", 3, null]) expect(() => searchTerm(value)).toThrow();
  });
  it("prioriza título exato, prefixo, trecho de título e depois corpo", () => {
    expect(searchRank("Órbita", "", "orbita")).toBe(0); expect(searchRank("Órbita pessoal", "", "orbita")).toBe(1); expect(searchRank("Minha órbita", "", "orbita")).toBe(2); expect(searchRank("Pessoal", "a órbita", "orbita")).toBe(3);
  });
  it("desempata os sete tipos e IDs de forma determinística sem mutar os resultados", () => {
    const items: SearchResult[] = [...SEARCH_TYPES].reverse().map(type => ({ type, id: type, title: "Nome", href: "/", rank: 0 })); const sorted = rankSearch(items); expect(sorted.map(row => row.type)).toEqual(SEARCH_TYPES); expect(items[0]?.type).toBe("habit");
    expect(rankSearch([{ ...items[0]!, id: "b" }, { ...items[0]!, id: "a" }]).map(row => row.id)).toEqual(["a", "b"]);
  });
  it("recusa destinos externos, campos extras e limites quebrados antes de renderizar a paleta", () => {
    const row = { id: "own-item", type: "capture", title: "Minha captura", href: "/capturar?capture=own-item", rank: 0 };
    expect(validSearchResults([row])).toBe(true);
    for (const value of [null, [null], [{ ...row, href: "https://foreign.example.invalid" }], [{ ...row, type: "vault" }], [{ ...row, content: "private" }], [{ ...row, rank: 5 }], [{ ...row, title: "a".repeat(201) }], Array(71).fill(row)]) expect(validSearchResults(value)).toBe(false);
  });
});
