import { exigir } from "../contracts/base";
import type { BlocoDocumento, DocumentoPagina, ReferenciaPagina } from "./types";

export const MAX_DOCUMENT_BYTES = 512 * 1024;
export const normalizarTituloPagina = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
export const documentoVazio = (): DocumentoPagina => ({ type: "doc", content: [{ type: "paragraph" }] });
const tipos = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule", "wikiLink"]);
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
      const allowed = node.type === "wikiLink" ? ["target_id", "alias"] : node.type === "heading" ? ["level"] : node.type === "orderedList" ? ["start", "type"] : node.type === "codeBlock" ? ["language"] : [];
      exigir(Object.keys(node.attrs).every(key => allowed.includes(key)), "Atributos não permitidos.");
      if (node.type === "heading") exigir(Number.isInteger(node.attrs.level) && Number(node.attrs.level) >= 1 && Number(node.attrs.level) <= 3, "Nível do título inválido.");
      if (node.type === "orderedList" && node.attrs.start !== undefined) exigir(Number.isSafeInteger(node.attrs.start) && Number(node.attrs.start) > 0, "Início da lista inválido.");
      if (node.type === "wikiLink") exigir((node.attrs.target_id === null || typeof node.attrs.target_id === "string" && /^[0-9a-f-]{36}$/i.test(node.attrs.target_id)) && typeof node.attrs.alias === "string" && node.attrs.alias.trim().length >= 1 && node.attrs.alias.length <= 200, "Referência inválida.");
      if (node.type === "codeBlock") exigir(node.attrs.language === null || node.attrs.language === undefined || typeof node.attrs.language === "string" && node.attrs.language.length <= 40, "Linguagem inválida.");
    }
    if (node.type === "wikiLink") exigir(node.attrs !== undefined && node.content === undefined, "Referência sem destino.");
    if (node.marks !== undefined) {
      exigir(node.type === "text" && Array.isArray(node.marks) && node.marks.length <= 6, "Formatação inválida.");
      for (const mark of node.marks) {
        exigir(objeto(mark) && marcas.has(String(mark.type)) && Object.keys(mark).every(key => ["type", "attrs"].includes(key)), "Marca inválida.");
        if (mark.attrs !== undefined) {
          exigir(mark.type === "link" && objeto(mark.attrs) && Object.keys(mark.attrs).every(key => ["href", "target", "rel", "class"].includes(key)) && typeof mark.attrs.href === "string" && mark.attrs.href.length <= 2048, "Link inválido.");
          let url: URL; try { url = new URL(mark.attrs.href); } catch { exigir(false, "Use um link HTTP ou HTTPS válido."); }
          exigir(["https:", "http:"].includes(url.protocol) && !url.username && !url.password, "Use um link HTTP ou HTTPS sem credenciais.");
        }
      }
    }
    if (node.content !== undefined) {
      exigir(Array.isArray(node.content), "Blocos inválidos.");
      exigir(!["text", "wikiLink", "horizontalRule", "hardBreak"].includes(String(node.type)), "Bloco não pode conter outros blocos.");
      for (const child of node.content) visit(child, depth + 1);
    }
    if (depth > 0) exigir(node.type !== "doc", "Documento aninhado inválido.");
  }
  visit(value, 0);
}
export function textoDoDocumento(document: DocumentoPagina): string {
  const visit = (node: BlocoDocumento): string => node.type === "text" ? node.text ?? "" : node.type === "wikiLink" ? String(node.attrs?.alias ?? "") : node.type === "hardBreak" ? "\n" : (node.content ?? []).map(visit).join(["doc", "bulletList", "orderedList", "listItem", "blockquote"].includes(node.type) ? "\n" : "");
  return visit(document);
}
export function documentoDeTexto(text: string): DocumentoPagina {
  return { type: "doc", content: text.split("\n").map(line => ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })) };
}
export function extrairReferencias(document: DocumentoPagina, previous: ReferenciaPagina[] = []): { alias: string; normalized_alias: string; target_id: string | null }[] {
  const found = new Map<string, { alias: string; normalized_alias: string; target_id: string | null }>();
  const add = (alias: string, target: string | null) => {
    alias = alias.trim(); const normalized_alias = normalizarTituloPagina(alias);
    if (!normalized_alias) return;
    const target_id = target ?? [...previous].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).find(ref => ref.normalized_alias === normalized_alias)?.target_id ?? null;
    found.set(target_id ? `id:${target_id}` : `alias:${normalized_alias}`, { alias, normalized_alias, target_id });
  };
  const visit = (node: BlocoDocumento) => {
    if (node.type === "wikiLink") add(String(node.attrs?.alias ?? ""), typeof node.attrs?.target_id === "string" ? node.attrs.target_id : null);
    if (node.type === "text") for (const match of (node.text ?? "").matchAll(/\[\[([^\]\n]{1,200})\]\]/g)) add(match[1]!, null);
    for (const child of node.content ?? []) visit(child);
  };
  visit(document); return [...found.values()];
}
export function resolverReferenciaNoDocumento(document: DocumentoPagina, alias: string, targetId: string): DocumentoPagina {
  const normalized = normalizarTituloPagina(alias);
  const visit = (node: BlocoDocumento): BlocoDocumento[] => {
    if (node.type === "wikiLink" && normalizarTituloPagina(String(node.attrs?.alias ?? "")) === normalized) return [{ ...node, attrs: { alias: String(node.attrs?.alias), target_id: targetId } }];
    if (node.type === "text") {
      const pieces: BlocoDocumento[] = []; const text = node.text ?? ""; let offset = 0;
      for (const match of text.matchAll(/\[\[([^\]\n]{1,200})\]\]/g)) {
        if (normalizarTituloPagina(match[1]!) !== normalized) continue;
        if (match.index! > offset) pieces.push({ ...node, text: text.slice(offset, match.index) });
        pieces.push({ type: "wikiLink", attrs: { alias: match[1]!.trim(), target_id: targetId } }); offset = match.index! + match[0].length;
      }
      if (!pieces.length) return [node]; if (offset < text.length) pieces.push({ ...node, text: text.slice(offset) }); return pieces;
    }
    return [{ ...node, ...(node.content ? { content: node.content.flatMap(visit) } : {}) }];
  };
  return visit(structuredClone(document))[0] as DocumentoPagina;
}
