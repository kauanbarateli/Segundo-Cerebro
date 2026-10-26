import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { DocumentLink } from "../../src/components/editor/document-link";
import { validarDocumento, type DocumentoPagina } from "../../src/core/contracts/rich-document";
import { draftFrom, withDraftDocument } from "../../src/components/features/capturar/model";

const text = "Texto sintético doc18 para validar captura, leitura e edição.";
const schema = getSchema([StarterKit.configure({ link: false }), DocumentLink.configure({
  openOnClick: false, autolink: false, linkOnPaste: false,
  HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
})]);
function linked(href: string): unknown {
  return schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null,
    schema.text(text, [schema.marks.bold!.create(), schema.marks.link!.create({ href, target: "_blank", rel: "noopener noreferrer" })]))).toJSON();
}
describe("document link: real TipTap schema respects the persisted contract", () => {
  it.each(["https://example.com/qa-doc18", "http://example.com/qa-doc18"])("keeps bold and accepts a short link without unsupported attributes: %s", href => {
    const value = linked(href); validarDocumento(value);
    const mark = value.content[0]!.content![0]!.marks!.find(mark => mark.type === "link")!;
    expect(mark.attrs).toEqual({ href, target: "_blank", rel: "noopener noreferrer", class: null });
    expect(Object.keys(mark.attrs!).sort()).toEqual(["class", "href", "rel", "target"]);
    expect(JSON.stringify(value).length).toBeLessThan(512);
    const before = draftFrom(); before.title = "QA captura rich";
    const updated = withDraftDocument(before, value);
    expect(updated.content).toBe(text);
    expect(updated.document).toEqual(value);
    expect(updated.document!.content[0]!.content![0]!.marks).toContainEqual({ type: "bold" });
    expect(before.document).toBeUndefined(); expect(before.content).toBe("");
  });
  it.each(["javascript:alert(1)", "data:text/html,synthetic", "file:///synthetic", "https://synthetic:secret@example.com/", "/relative"])("does not widen the domain link destination policy: %s", href => {
    const value = linked(href);
    expect(() => validarDocumento(value)).toThrow();
    expect(() => withDraftDocument(draftFrom(), value as DocumentoPagina)).toThrow();
  });
  it("keeps unsupported persisted attributes rejected instead of teaching the domain title/style", () => {
    const extras: Array<Record<string, string | number | boolean | null>> = [{ title: null }, { title: "Synthetic tooltip" }, { style: "color:red" }, { onclick: "synthetic" }];
    for (const extra of extras) {
      const value = linked("https://example.com/qa-doc18") as DocumentoPagina;
      const mark = value.content[0]!.content![0]!.marks!.find(mark => mark.type === "link")!;
      mark.attrs = { ...mark.attrs, ...extra };
      expect(() => validarDocumento(value)).toThrow();
      expect(() => withDraftDocument(draftFrom(), value)).toThrow();
    }
  });
  it("preserves the existing text limit", () => {
    const value = linked("https://example.com/qa-doc18") as DocumentoPagina;
    value.content[0]!.content![0]!.text = "a".repeat(30001);
    expect(() => withDraftDocument(draftFrom(), value)).toThrow();
  });
});
