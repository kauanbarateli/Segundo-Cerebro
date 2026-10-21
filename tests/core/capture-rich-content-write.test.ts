import { describe, expect, it } from "vitest";
import { lerEstadoDocumentalDaCaptura, planejarAtualizacaoDocumentalDaCaptura, validarAtualizacaoDocumentalDaCaptura } from "../../src/core/capturas/rich-content-write";
import type { DocumentoPagina } from "../../src/core/contracts/rich-document";

const document: DocumentoPagina = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "  Formatação", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "preservada  " }] }] };
const legacy = { kind: "legacy", content: "  original\n " };
const plan = (current: unknown, expected: unknown, next: unknown = document) => planejarAtualizacaoDocumentalDaCaptura({ current, expected, document: next });

describe("alocação documental da Captura dentro da transação", () => {
  it("compara legado literalmente, deriva cache e aloca revisão1 sem mutar entradas", () => {
    const before = structuredClone({ current: legacy, document });
    const result = plan(legacy, legacy);
    expect(result).toEqual({ kind: "rich", document, document_version: 1, content: "Formatação\npreservada" });
    expect(result.document).not.toBe(document); expect({ current: legacy, document }).toEqual(before);
    result.document.content.length = 0; expect(document.content).toHaveLength(1);
  });
  it.each([[null, ""], ["", null], [" ", ""], ["x\n", "x"], ["  original\n ", "original"]])("não iguala bases legadas distintas %j / %j", (current, expected) => {
    expect(() => plan({ kind: "legacy", content: current }, { kind: "legacy", content: expected })).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it("avança n→n+1 mesmo para documento igual; replay é responsabilidade do recibo", () => {
    expect(plan({ kind: "rich", document, document_version: 8 }, { kind: "rich", document_version: 8 })).toMatchObject({ document_version: 9 });
  });
  it.each([
    [{ kind: "rich", document, document_version: 2 }, { kind: "rich", document_version: 1 }],
    [legacy, { kind: "rich", document_version: 1 }],
    [{ kind: "rich", document, document_version: 1 }, legacy],
    [{ kind: "rich", document, document_version: Number.MAX_SAFE_INTEGER }, { kind: "rich", document_version: Number.MAX_SAFE_INTEGER }],
  ])("recusa conflito/overflow sem inventar nova base", (current, expected) => {
    expect(() => plan(current, expected)).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it.each([0, -1, 1.5, "1", undefined, null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("recusa revisão pública inválida %j", revision => {
    expect(() => plan(legacy, { kind: "rich", document_version: revision })).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });
  it("fecha os envelopes e não executa getters nem propaga erros de reflexão", () => {
    let read = 0;
    const getter = Object.defineProperty({}, "kind", { enumerable: true, get() { read++; return "legacy"; } });
    const trap = new Proxy({}, { ownKeys() { throw new Error("private-canary"); } });
    for (const expected of [getter, trap, { ...legacy, extra: undefined }, { ...legacy, document_version: 0 }]) {
      expect(() => plan(legacy, expected)).toThrow(expect.objectContaining({ code: "VALIDATION" }));
      try { plan(legacy, expected); } catch (error) { expect(String(error)).not.toContain("private-canary"); }
    }
    expect(read).toBe(0);
    expect(() => planejarAtualizacaoDocumentalDaCaptura({ current: legacy, expected: legacy, document, extra: undefined })).toThrow();
  });
  it("documento vazio é representável; namespaces/HTML/alinhamento não são introduzidos", () => {
    expect(plan(legacy, legacy, { type: "doc", content: [{ type: "paragraph" }] })).toMatchObject({ content: null });
    for (const next of ["<script>bad</script>", { type: "doc", content: [{ type: "wikiLink", attrs: { alias: "Página", target_id: null } }] }, { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "center" } }] }]) expect(() => plan(legacy, legacy, next)).toThrow();
    expect(() => plan(legacy, legacy, { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "sem destino", marks: [{ type: "link" }] }] }] })).toThrow();
  });
});

describe("estado persistido e intenção documental fechados", () => {
  const intent = { id: "capture", client_id: "write", expected_content: legacy, patch: { document } };
  it("conserva ausência legada e confere o cache de toda leitura rica", () => {
    expect(lerEstadoDocumentalDaCaptura({ content: " \n" })).toMatchObject({ kind: "legacy", content: " \n", document_version: 0 });
    expect(lerEstadoDocumentalDaCaptura({ content: "Formatação\npreservada", document, document_version: 1 })).toMatchObject({ kind: "rich" });
  });
  it.each([
    { content: null, document }, { content: null, document_version: 1 }, { content: null, document: null, document_version: 0 },
    { content: "forged", document, document_version: 1 }, { content: null, document, document_version: 1 },
    { content: "legacy", bodyHtml: "<b>legacy</b>" }, { content: "Formatação\npreservada", document, document_version: 1, content_html: "<b>rich</b>" },
  ])("não faz fallback de estado parcial/cache divergente", value => { expect(() => lerEstadoDocumentalDaCaptura(value)).toThrow(); });
  it("não aceita título/cache/revisão/dono no patch e clona documento validado", () => {
    expect(validarAtualizacaoDocumentalDaCaptura(intent)).toEqual(intent);
    for (const patch of [{ document, title: "trocar" }, { document, content: "cache" }, { document, document_version: 4 }, { document, owner: "other" }]) expect(() => validarAtualizacaoDocumentalDaCaptura({ ...intent, patch })).toThrow();
    expect(() => validarAtualizacaoDocumentalDaCaptura({ ...intent, expected_content: undefined })).toThrow();
  });
});
