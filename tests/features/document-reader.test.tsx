import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import type { DocumentoPagina } from "../../src/core/contracts/rich-document";
vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
import DocumentReader from "../../src/components/editor/document-reader";

describe("Documento em leitura", () => {
  it("preserva formatação, ordem, checklist e referências sem editor ou controles de escrita", () => {
    const id = "10000000-0000-4000-8000-000000000021";
    const document: DocumentoPagina = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
      { type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "<script>literal</script>", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://example.com/fonte" } }] }, { type: "wikiLink", attrs: { target_id: id, alias: "Página relacionada" } }] },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Item feito" }] }] }] },
    ] };
    const before = structuredClone(document), html = renderToStaticMarkup(<DocumentReader document={document} />);
    expect(html).toContain("<h3>Título</h3>"); expect(html).toContain("text-align:center");
    expect(html).toContain("&lt;script&gt;literal&lt;/script&gt;"); expect(html).toContain('href="https://example.com/fonte"');
    expect(html).toContain(`href="/conhecimento?note=${id}"`); expect(html).toContain('aria-label="Concluído"');
    expect(html).not.toMatch(/<script|<button|<input|<textarea|contenteditable|javascript:/i);
    expect(document).toEqual(before);
  });
  it("referência não resolvida é texto e documentos fora do contrato não entram no DOM", () => {
    const unresolved: DocumentoPagina = { type: "doc", content: [{ type: "paragraph", content: [{ type: "captureLink", attrs: { target_id: null, alias: "Ainda não conectada" } }] }] };
    const html = renderToStaticMarkup(<DocumentReader document={unresolved} />);
    expect(html).toContain("Ainda não conectada"); expect(html).not.toContain("href="); expect(html).not.toContain("<button");
    const unsafe: DocumentoPagina = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Payload privado", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] };
    const rejected = renderToStaticMarkup(<DocumentReader document={unsafe} />);
    expect(rejected).toContain('role="alert"'); expect(rejected).not.toContain("Payload privado"); expect(rejected).not.toContain("javascript:");
  });
});
