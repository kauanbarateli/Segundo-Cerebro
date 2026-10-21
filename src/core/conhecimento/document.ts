import type { BlocoDocumento, DocumentoPagina } from "../contracts/rich-document";
import type { ReferenciaPagina } from "./types";
export { MAX_DOCUMENT_BYTES, documentoVazio, validarDocumento, textoDoDocumento, documentoDeTexto } from "../contracts/rich-document";

export const normalizarTituloPagina = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
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
