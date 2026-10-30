import { exigir } from "./base";

/** Shared persisted TipTap JSON contract. No UI, SDK or reference resolution. */
export interface BlocoDocumento { type: string; text?: string; attrs?: Record<string, string | number | boolean | null>; marks?: { type: string; attrs?: Record<string, string | number | boolean | null> }[]; content?: BlocoDocumento[] }
export interface DocumentoPagina extends BlocoDocumento { type: "doc"; content: BlocoDocumento[] }

export const MAX_DOCUMENT_BYTES = 512 * 1024;
export const documentoVazio = (): DocumentoPagina => ({ type: "doc", content: [{ type: "paragraph" }] });
const tipos = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule", "wikiLink", "captureLink"]);
const marcas = new Set(["bold", "italic", "strike", "code", "underline", "link"]);
const objeto = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function validarDocumento(value: unknown): asserts value is DocumentoPagina {
  exigir(objeto(value) && value.type === "doc" && Array.isArray(value.content), "O documento precisa ter blocos válidos.");
  exigir(new TextEncoder().encode(JSON.stringify(value)).length <= MAX_DOCUMENT_BYTES, "O documento excede 512 KiB.");
  let count = 0;
  function visit(node: unknown, depth: number) {
    exigir(objeto(node) && depth <= 32 && ++count <= 10000 && tipos.has(String(node.type)), "Documento inválido ou complexo demais.");
    exigir(Object.keys(node).every(key => ["type", "text", "attrs", "marks", "content"].includes(key)), "O bloco contém dados não permitidos.");
    if (node.type === "text") exigir(typeof node.text === "string" && node.text.length > 0 && node.content === undefined, "Texto inválido.");
    else exigir(node.text === undefined, "Texto fora de um bloco de texto.");
    if (node.attrs !== undefined) {
      exigir(objeto(node.attrs), "Atributos inválidos.");
      const allowed = ["wikiLink", "captureLink"].includes(String(node.type)) ? ["target_id", "alias"] : node.type === "heading" ? ["level", "textAlign"] : node.type === "paragraph" ? ["textAlign"] : node.type === "taskItem" ? ["checked"] : node.type === "orderedList" ? ["start", "type"] : node.type === "codeBlock" ? ["language"] : [];
      exigir(Object.keys(node.attrs).every(key => allowed.includes(key)), "Atributos não permitidos.");
      if (node.type === "heading") exigir(Number.isInteger(node.attrs.level) && Number(node.attrs.level) >= 1 && Number(node.attrs.level) <= 3, "Nível do título inválido.");
      if (node.type === "orderedList" && node.attrs.start !== undefined) exigir(Number.isSafeInteger(node.attrs.start) && Number(node.attrs.start) > 0, "Início da lista inválido.");
      if (node.type === "wikiLink") exigir((node.attrs.target_id === null || typeof node.attrs.target_id === "string" && /^[0-9a-f-]{36}$/i.test(node.attrs.target_id)) && typeof node.attrs.alias === "string" && node.attrs.alias.trim().length >= 1 && node.attrs.alias.length <= 200, "Referência inválida.");
      if (node.type === "captureLink") exigir((node.attrs.target_id === null || typeof node.attrs.target_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node.attrs.target_id)) && typeof node.attrs.alias === "string" && node.attrs.alias.trim().length >= 1 && node.attrs.alias.length <= 200, "Vínculo de Captura inválido.");
      if (["paragraph", "heading"].includes(String(node.type)) && node.attrs.textAlign !== undefined) exigir(node.attrs.textAlign === null || ["left", "center", "right", "justify"].includes(String(node.attrs.textAlign)), "Alinhamento inválido.");
      if (node.type === "taskItem") exigir(typeof node.attrs.checked === "boolean", "Marcação de checklist inválida.");
      if (node.type === "codeBlock") exigir(node.attrs.language === null || node.attrs.language === undefined || typeof node.attrs.language === "string" && node.attrs.language.length <= 40, "Linguagem inválida.");
    }
    if (["wikiLink", "captureLink"].includes(String(node.type))) exigir(node.attrs !== undefined && node.content === undefined, "Referência sem destino.");
    if (node.type === "taskItem") exigir(node.attrs !== undefined && Array.isArray(node.content) && node.content.length > 0 && objeto(node.content[0]) && node.content[0].type === "paragraph", "Item de checklist inválido.");
    if (node.type === "taskList") exigir(Array.isArray(node.content) && node.content.length > 0 && node.content.every(child => objeto(child) && child.type === "taskItem"), "Checklist inválido.");
    if (node.marks !== undefined) {
      exigir(["text", "wikiLink", "captureLink"].includes(String(node.type)) && Array.isArray(node.marks) && node.marks.length <= 6, "Formatação inválida.");
      for (const mark of node.marks) {
        exigir(objeto(mark) && marcas.has(String(mark.type)) && Object.keys(mark).every(key => ["type", "attrs"].includes(key)), "Marca inválida.");
        exigir(node.type === "text" || mark.type !== "link", "Referências não aceitam outro link.");
        if (mark.attrs !== undefined) {
          exigir(mark.type === "link" && objeto(mark.attrs) && Object.keys(mark.attrs).every(key => ["href", "target", "rel", "class"].includes(key)) && typeof mark.attrs.href === "string" && mark.attrs.href.length <= 2048, "Link inválido.");
          let url: URL; try { url = new URL(mark.attrs.href); } catch { exigir(false, "Use um link HTTP ou HTTPS válido."); }
          exigir(["https:", "http:"].includes(url.protocol) && !url.username && !url.password, "Use um link HTTP ou HTTPS sem credenciais.");
        }
      }
    }
    if (node.content !== undefined) {
      exigir(Array.isArray(node.content), "Blocos inválidos.");
      exigir(!["text", "wikiLink", "captureLink", "horizontalRule", "hardBreak"].includes(String(node.type)), "Bloco não pode conter outros blocos.");
      for (const child of node.content) visit(child, depth + 1);
    }
    if (depth > 0) exigir(node.type !== "doc", "Documento aninhado inválido.");
  }
  visit(value, 0);
}
export function textoDoDocumento(document: DocumentoPagina): string {
  const visit = (node: BlocoDocumento): string => node.type === "text" ? node.text ?? "" : ["wikiLink", "captureLink"].includes(node.type) ? String(node.attrs?.alias ?? "") : node.type === "hardBreak" ? "\n" : (node.content ?? []).map(visit).join(["doc", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "blockquote"].includes(node.type) ? "\n" : "");
  return visit(document);
}
export function documentoDeTexto(text: string): DocumentoPagina {
  return { type: "doc", content: text.split("\n").map(line => ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })) };
}
