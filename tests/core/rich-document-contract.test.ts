import { describe, expect, it } from "vitest";
import * as shared from "../../src/core/contracts/rich-document";
import * as knowledge from "../../src/core/conhecimento";

const pageId = "10000000-0000-4000-8000-000000000001";
const text = (value: string) => ({ type: "text", text: value });
const paragraph = (content: unknown[] = []) => ({ type: "paragraph", content });
const document = (content: unknown[]) => ({ type: "doc", content });
function checked(api: typeof shared, value: unknown): shared.DocumentoPagina { api.validarDocumento(value); return value; }
const rejection = (api: typeof shared, value: unknown) => {
  try { api.validarDocumento(value); return null; }
  catch (error) { return error instanceof Error ? { name: error.name, message: error.message, code: "code" in error ? error.code : undefined } : error; }
};

describe("SPEC-08: contrato neutro do documento existente", () => {
  it.each(["", "<script>conteúdo literal</script>", "Primeiro\n\nSegundo\n", "Ação e café 🧠\n[[Uma página]]"])("converte legado literalmente pelas duas APIs: %s", legacy => {
    const expected = { type: "doc", content: legacy.split("\n").map(line => ({ type: "paragraph", ...(line ? { content: [text(line)] } : {}) })) };
    for (const api of [shared, knowledge]) {
      const value = api.documentoDeTexto(legacy);
      expect(value).toEqual(expected); expect(() => checked(api, value)).not.toThrow();
      expect(api.textoDoDocumento(value)).toBe(legacy);
      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    }
  });
  it("preserva os nós, marcas, atributos e projeção textual existentes", () => {
    const value = document([
      { type: "heading", attrs: { level: 2 }, content: [text("Título")] },
      paragraph([{ ...text("Formatado"), marks: ["bold", "italic", "strike", "code", "underline"].map(type => ({ type })) },
        { type: "hardBreak" }, { ...text("site"), marks: [{ type: "link", attrs: { href: "https://example.invalid/path", target: "_blank", rel: "noopener noreferrer", class: null } }] }]),
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph([text("Item")])] }] },
      { type: "orderedList", attrs: { start: 2, type: "1" }, content: [{ type: "listItem", content: [paragraph([text("Segundo")])] }] },
      { type: "blockquote", content: [paragraph([text("Citação")])] },
      { type: "codeBlock", attrs: { language: "text" }, content: [text("código")] },
      { type: "horizontalRule" }, paragraph([{ type: "wikiLink", attrs: { target_id: pageId, alias: "Destino" } }]),
    ]);
    for (const api of [shared, knowledge]) {
      expect(() => checked(api, value)).not.toThrow();
      expect(api.textoDoDocumento(checked(api, value))).toBe("Título\nFormatado\nsite\nItem\nSegundo\nCitação\ncódigo\n\nDestino");
    }
    expect(knowledge.extrairReferencias(value as shared.DocumentoPagina)).toEqual([{ alias: "Destino", normalized_alias: "destino", target_id: pageId }]);
  });
  it.each([
    null, [], { type: "doc" }, document([{ type: "iframe" }]),
    document([paragraph([{ type: "text", text: "" }])]),
    document([{ type: "paragraph", attrs: { onclick: "canary" } }]),
    document([{ type: "heading", attrs: { level: 4 } }]),
    document([{ type: "orderedList", attrs: { start: 0 } }]),
    document([{ type: "wikiLink", attrs: { target_id: pageId, alias: " " } }]),
    document([{ type: "wikiLink", attrs: { target_id: pageId, alias: "Destino" }, content: [] }]),
    document([{ type: "hardBreak", content: [] }]), document([{ type: "doc", content: [] }]),
    document([paragraph([{ ...text("A"), marks: [{ type: "unknown" }] }])]),
    document([paragraph([{ ...text("A"), marks: [{ type: "bold", attrs: { style: "canary" } }] }])]),
    // Reserved future additions must remain rejected during this pure extraction.
    document([{ type: "captureLink", attrs: { capture_id: pageId, alias: "Captura" } }]),
    document([{ type: "paragraph", attrs: { textAlign: "unsafe" } }]),
  ])("mantém a mesma recusa pelos caminhos antigo e neutro %#", value => {
    const oldResult = rejection(knowledge, value), neutralResult = rejection(shared, value);
    expect(neutralResult).not.toBeNull(); expect(neutralResult).toEqual(oldResult);
  });
  it.each(["javascript:alert(1)", "data:text/plain,canary", "file:///canary", "https://synthetic:canary@example.invalid/", "/relative"])("recusa protocolo/credencial/link fora do contrato: %s", href => {
    const value = document([paragraph([{ ...text("Link"), marks: [{ type: "link", attrs: { href } }] }])]);
    expect(rejection(shared, value)).not.toBeNull(); expect(rejection(shared, value)).toEqual(rejection(knowledge, value));
  });
  it("mantém limites UTF-8, profundidade e quantidade sem ampliar o contrato", () => {
    expect(shared.MAX_DOCUMENT_BYTES).toBe(512 * 1024);
    const overBytes = document([paragraph([text("á".repeat(shared.MAX_DOCUMENT_BYTES / 2))])]);
    let overDepth: unknown = paragraph([text("Fundo")]);
    for (let index = 0; index < 33; index++) overDepth = { type: "blockquote", content: [overDepth] };
    const overNodes = document(Array.from({ length: 10000 }, () => paragraph()));
    for (const value of [overBytes, document([overDepth]), overNodes]) {
      expect(rejection(shared, value)).not.toBeNull(); expect(rejection(shared, value)).toEqual(rejection(knowledge, value));
    }
    const allowed = document([paragraph([text("á".repeat(100000))])]);
    expect(() => shared.validarDocumento(allowed)).not.toThrow();
  });
  it("não interpreta conteúdo, resolve destinos ou muda o namespace de referência", () => {
    const literal = shared.documentoDeTexto("<img src=x onerror=canary> [[Destino]]");
    const original = JSON.stringify(literal);
    shared.validarDocumento(literal); expect(shared.textoDoDocumento(literal)).toBe("<img src=x onerror=canary> [[Destino]]");
    expect(JSON.stringify(literal)).toBe(original);
    expect(knowledge.extrairReferencias(literal)).toEqual([{ alias: "Destino", normalized_alias: "destino", target_id: null }]);
    expect(shared.documentoVazio()).toEqual(knowledge.documentoVazio());
  });
});
