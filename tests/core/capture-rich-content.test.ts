import { describe, expect, it } from "vitest";
import { lerConteudoDocumentalDaCaptura } from "../../src/core/capturas";
import { ErroDeDominio } from "../../src/core/contracts/base";
import { MAX_DOCUMENT_BYTES, documentoDeTexto, textoDoDocumento, validarDocumento, type BlocoDocumento, type DocumentoPagina } from "../../src/core/contracts/rich-document";

const rich = (document: unknown = documentoDeTexto("Texto"), document_version: unknown = 1) => ({ kind: "rich", document, document_version });
const invalid = (input: unknown) => expect(() => lerConteudoDocumentalDaCaptura(input)).toThrow(expect.objectContaining({ code: "VALIDATION" }));
const paragraph = (text: string, marks?: BlocoDocumento["marks"]): DocumentoPagina => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] }] });

describe("SPEC-08: leitura documental pura de Captura", () => {
  it.each([
    { label: "nulo", content: null }, { label: "vazio", content: "" },
    { label: "HTML e colchetes", content: "  <b>literal</b>\n[[Outra captura]]  " },
    { label: "muitas linhas", content: "a\n".repeat(4999) + "a" },
    { label: "limite ASCII", content: "x".repeat(30_000) }, { label: "limite emoji", content: "😀".repeat(15_000) },
  ])("preserva o legado literal sem converter ou aparar: $label", ({ content }) => {
    expect(lerConteudoDocumentalDaCaptura({ kind: "legacy", content })).toEqual({ kind: "legacy", content, document: null, document_version: 0 });
  });

  it("não promete que todo legado cabe na conversão atual para documento", () => {
    const content = "a\n".repeat(4999) + "a";
    expect(content.length).toBe(9999);
    expect(() => validarDocumento(documentoDeTexto(content))).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(lerConteudoDocumentalDaCaptura({ kind: "legacy", content }).content).toBe(content);
  });

  it("deriva texto normalizado e conserva formatos, espaços e quebras do JSON", () => {
    const document: DocumentoPagina = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "  Título", marks: [{ type: "bold" }, { type: "italic" }, { type: "strike" }, { type: "underline" }] }] },
      { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Citação", marks: [{ type: "link", attrs: { href: "https://example.com/path" } }] }, { type: "hardBreak" }, { type: "text", text: "continua" }] }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Lista" }] }] }] },
      { type: "orderedList", attrs: { start: 2, type: "1" }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Ordenada" }] }] }] },
      { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "<literal>" }] },
      { type: "horizontalRule" }, { type: "paragraph" },
    ] };
    const result = lerConteudoDocumentalDaCaptura(rich(document, Number.MAX_SAFE_INTEGER));
    expect(result).toEqual({ kind: "rich", document, document_version: Number.MAX_SAFE_INTEGER, content: textoDoDocumento(document).trim() });
    expect(result.document).not.toBe(document);
    expect(result.document?.content).not.toBe(document.content);
    expect(textoDoDocumento(document)).toMatch(/^  Título/);
  });

  it.each([{ type: "doc", content: [] }, { type: "doc", content: [{ type: "paragraph" }] }, paragraph(" \n ")])("normaliza a projeção vazia para null, sem alterar o JSON", document => {
    expect(lerConteudoDocumentalDaCaptura(rich(document))).toEqual({ kind: "rich", document, document_version: 1, content: null });
  });

  it.each(["x".repeat(30_000), "😀".repeat(15_000)])("aceita o limite UTF-16 da projeção rica", text => {
    expect(lerConteudoDocumentalDaCaptura(rich(paragraph(text))).content).toBe(text);
  });

  it.each(["x".repeat(30_001), "😀".repeat(15_000) + "x", " ".repeat(30_001)])("recusa excesso antes de trim tanto no legado quanto no rico", text => {
    invalid({ kind: "legacy", content: text }); invalid(rich(paragraph(text)));
  });

  it.each([undefined, null, [], {}, { kind: "other", content: "x" }, { kind: "legacy" }, { kind: "legacy", content: undefined }, { kind: "legacy", content: 1 },
    { kind: "legacy", content: "x", document: undefined }, { kind: "legacy", content: "x", document_version: 0 },
    { kind: "rich", document: documentoDeTexto("x") }, { kind: "rich", document_version: 1 },
    rich(null), { ...rich(), document: undefined }, { ...rich(), content: undefined }, { ...rich(), content: "Texto" }, { ...rich(), extra: true },
  ])("recusa envelope incompleto/cruzado sem fallback: %j", input => { invalid(input); });

  it.each([undefined, null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1", true])("recusa revisão inválida: %j", revision => { invalid({ ...rich(), document_version: revision }); });

  it.each(["javascript:alert(1)", "data:text/html,unsafe", "file:///private", "https://user:password@example.com/path", "//example.com/path"])("recusa URL não permitida: %s", href => {
    invalid(rich(paragraph("link", [{ type: "link", attrs: { href } }])));
  });

  it.each(["http://example.com/path", "https://example.com/path"])("preserva links HTTP(S) permitidos: %s", href => {
    const document = paragraph("link", [{ type: "link", attrs: { href } }]);
    expect(lerConteudoDocumentalDaCaptura(rich(document)).document).toEqual(document);
  });

  it("recusa namespaces e alinhamento ainda não admitidos, em qualquer profundidade", () => {
    for (const node of [
      { type: "wikiLink", attrs: { target_id: "11111111-1111-1111-1111-111111111111", alias: "Página" } },
      { type: "captureLink", attrs: { capture_id: "capture", alias: "Captura" } },
      { type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "Texto" }] },
    ]) invalid(rich({ type: "doc", content: [{ type: "blockquote", content: [node] }] }));
    const document = paragraph("[[literal]] <strong>texto</strong>");
    expect(lerConteudoDocumentalDaCaptura(rich(document)).content).toBe("[[literal]] <strong>texto</strong>");
  });

  it("aplica 512 KiB mesmo com projeção curta e preserva 10.000 blocos e profundidade32", () => {
    const href = "https://example.com/" + "x".repeat(1000);
    invalid(rich({ type: "doc", content: Array.from({ length: 600 }, () => ({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] })) }));
    const full: DocumentoPagina = { type: "doc", content: [{ type: "paragraph", content: Array.from({ length: 9998 }, () => ({ type: "text", text: "x" })) }] };
    expect(lerConteudoDocumentalDaCaptura(rich(full)).content?.length).toBe(9998);
    invalid(rich({ ...full, content: [{ type: "paragraph", content: [...full.content[0]!.content!, { type: "text", text: "x" }] }] }));
    const nested = (count: number) => {
      let node: BlocoDocumento = { type: "text", text: "x" };
      for (let index = 0; index < count; index++) node = { type: "blockquote", content: [node] };
      return { type: "doc", content: [node] };
    };
    expect(lerConteudoDocumentalDaCaptura(rich(nested(31)))).toMatchObject({ kind: "rich", content: "x" });
    invalid(rich(nested(32)));
  });

  it("preserva a fronteira exata de bytes UTF-8 sem ampliar o contrato neutro", () => {
    // rel has no additional length policy in the existing neutral validator.
    const attrs = { href: "https://example.com", rel: "" };
    const document = paragraph("link", [{ type: "link", attrs }]);
    const available = MAX_DOCUMENT_BYTES - new TextEncoder().encode(JSON.stringify(document)).length;
    attrs.rel = "á".repeat(Math.floor(available / 2)) + "x".repeat(available % 2);
    expect(new TextEncoder().encode(JSON.stringify(document)).length).toBe(MAX_DOCUMENT_BYTES);
    expect(lerConteudoDocumentalDaCaptura(rich(document)).content).toBe("link");
    attrs.rel += "x";
    invalid(rich(document));
  });

  it("preserva entradas congeladas e não compartilha documento, attrs, marcas ou listas", () => {
    const attrs = Object.freeze({ href: "https://example.com" });
    const mark = Object.freeze({ type: "link", attrs });
    const marks = Object.freeze([mark]);
    const text = Object.freeze({ type: "text", text: "Texto", marks });
    const content = Object.freeze([Object.freeze({ type: "paragraph", content: Object.freeze([text]) })]);
    const document = Object.freeze({ type: "doc", content });
    const result = lerConteudoDocumentalDaCaptura(Object.freeze(rich(document)));
    if (result.kind !== "rich") throw new Error("Expected rich result");
    const copiedText = result.document.content[0]!.content![0]!;
    expect(copiedText).not.toBe(text); expect(copiedText.marks).not.toBe(marks);
    expect(copiedText.marks![0]).not.toBe(mark); expect(copiedText.marks![0]!.attrs).not.toBe(attrs);
    copiedText.text = "Outro"; copiedText.marks![0]!.attrs!.href = "https://changed.example";
    expect(text.text).toBe("Texto"); expect(attrs.href).toBe("https://example.com");
  });

  it("recusa dados não JSON sem executar getters, inclusive herdados", () => {
    let reads = 0;
    const inherited = Object.assign(Object.create({ get document() { reads++; throw Error("PRIVATE_GET"); } }), { kind: "rich", document_version: 1 });
    const own = { kind: "legacy", get content() { reads++; throw Error("PRIVATE_GET"); } };
    const documentGetter = { type: "doc", get content() { reads++; throw Error("PRIVATE_GET"); } };
    const arrayGetter = Object.defineProperty([], "0", { enumerable: true, get() { reads++; throw Error("PRIVATE_GET"); } });
    for (const input of [inherited, own, rich(documentGetter), rich({ type: "doc", content: arrayGetter }), rich({ type: "doc", content: new Array(1) }),
      rich({ type: "doc", content: [], toJSON() { reads++; throw Error("PRIVATE_TO_JSON"); } }),
      rich({ type: "doc", content: [], unknown: undefined }), rich({ type: "doc", content: [], unknown: Symbol("x") }),
      rich({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://example.com", rel: undefined } }] }] }] }),
      { kind: "legacy", content: "x", [Symbol("x")]: true }, rich({ type: "doc", content: [], [Symbol("x")]: true }),
    ]) invalid(input);
    const cycle: Record<string, unknown> = { type: "doc", content: [] }; cycle.extra = cycle;
    invalid(rich(cycle));
    const extra = Object.assign([], { extra: true }); invalid(rich({ type: "doc", content: extra }));
    expect(reads).toBe(0);
  });

  it("aceita protótipo nulo e cópia por descriptors sem get de Proxy", () => {
    let reads = 0;
    const observe = <T extends object>(value: T): T => new Proxy(value, { get() { reads++; throw Error("PRIVATE_GET"); } });
    const text = Object.assign(Object.create(null), { type: "text", text: "Texto" });
    const paragraph = Object.assign(Object.create(null), { type: "paragraph", content: observe([observe(text)]) });
    const document = observe(Object.assign(Object.create(null), { type: "doc", content: observe([observe(paragraph)]) }));
    expect(lerConteudoDocumentalDaCaptura(observe(Object.assign(Object.create(null), rich(document))))).toMatchObject({ kind: "rich", content: "Texto", document_version: 1 });
    expect(lerConteudoDocumentalDaCaptura(observe(Object.assign(Object.create(null), { kind: "legacy", content: " literal " })))).toMatchObject({ kind: "legacy", content: " literal " });
    expect(reads).toBe(0);
  });

  it("converte falha de reflexão em erro de domínio sem expor mensagem privada", () => {
    const expected = expect.objectContaining({ code: "VALIDATION", message: "Conteúdo documental inválido." });
    for (const thrown of [new Error("PRIVATE_REFLECTION"), ...(["NOT_FOUND", "CONFLICT", "VALIDATION"] as const).map(code => new ErroDeDominio(code, "PRIVATE_REFLECTION")), null, undefined]) {
      const input = new Proxy({}, { ownKeys() { throw thrown; } });
      expect(() => lerConteudoDocumentalDaCaptura(input)).toThrow(expected);
    }
    let errorReads = 0;
    const thrownProxy = new Proxy({}, {
      get() { errorReads++; throw Error("PRIVATE_ERROR_GET"); },
      getPrototypeOf() { errorReads++; throw Error("PRIVATE_ERROR_PROTOTYPE"); },
    });
    expect(() => lerConteudoDocumentalDaCaptura(new Proxy({}, { ownKeys() { throw thrownProxy; } }))).toThrow(expected);
    expect(errorReads).toBe(0);
    const { proxy, revoke } = Proxy.revocable({}, {}); revoke();
    expect(() => lerConteudoDocumentalDaCaptura(proxy)).toThrow(expected);
    expect(() => lerConteudoDocumentalDaCaptura(rich(proxy))).toThrow(expected);
  });
});
