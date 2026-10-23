import { exigir } from "../contracts/base";
import { documentoDeTexto, validarDocumento, type BlocoDocumento, type DocumentoPagina } from "../contracts/rich-document";
import { lerEstadoDocumentalDaCaptura } from "../capturas/rich-content-write";
import type { Captura } from "../capturas/types";
import type { Pagina } from "./types";

/** Capture IDs stay in their namespace until an explicit origin maps to a Page. */
export function documentoDaCapturaPromovida(capture: Captura, captures: readonly Captura[], pages: readonly Pagina[]): DocumentoPagina {
  const read = lerEstadoDocumentalDaCaptura(capture);
  const document = read.kind === "rich" ? structuredClone(read.document) : documentoDeTexto(read.content ?? "");
  const linked = captures.filter(item => item.user_id === capture.user_id && (capture.linked_capture_ids ?? []).includes(item.id));
  const visit = (node: BlocoDocumento): BlocoDocumento[] => {
    if (node.type === "captureLink") {
      const target = node.attrs?.target_id;
      if (typeof target === "string") exigir(captures.some(item => item.user_id === capture.user_id && item.id === target), "Vínculo fora do usuário.");
      const page = typeof target === "string" ? pages.find(item => item.user_id === capture.user_id && item.origin_capture_id === target) : undefined;
      return [{ ...node, ...(page ? { type: "wikiLink", attrs: { ...node.attrs, target_id: page.id } } : {}) }];
    }
    if (node.type === "text") {
      const text = node.text ?? "", pieces: BlocoDocumento[] = []; let offset = 0;
      for (const match of text.matchAll(/\[\[([^\]\n]{1,200})\]\]/g)) {
        if (!match[1]!.trim()) continue;
        if (match.index! > offset) pieces.push({ ...node, text: text.slice(offset, match.index) });
        // Titles may describe an already explicit Capture link. They never
        // resolve a Page or create a relationship to a homonymous Page.
        const matches = linked.filter(item => item.title === match[1]);
        const target = matches.length === 1 ? matches[0]!.id : null;
        const page = target ? pages.find(item => item.user_id === capture.user_id && item.origin_capture_id === target) : undefined;
        pieces.push({ type: page ? "wikiLink" : "captureLink", attrs: { alias: match[1]!, target_id: page?.id ?? target }, ...(node.marks ? { marks: node.marks.filter(mark => mark.type !== "link") } : {}) });
        offset = match.index! + match[0].length;
      }
      if (!pieces.length) return [node];
      if (offset < text.length) pieces.push({ ...node, text: text.slice(offset) });
      return pieces;
    }
    return [{ ...node, ...(node.content ? { content: node.content.flatMap(visit) } : {}) }];
  };
  const result = visit(document)[0]!; validarDocumento(result); return result;
}

/** Id-based resolution leaves all formatting, other references and IDs intact. */
export function resolverCapturaPromovida(document: DocumentoPagina, captureId: string, pageId: string): DocumentoPagina {
  const visit = (node: BlocoDocumento): BlocoDocumento => node.type === "captureLink" && node.attrs?.target_id === captureId
    ? { ...node, type: "wikiLink", attrs: { ...node.attrs, target_id: pageId } }
    : { ...node, ...(node.content ? { content: node.content.map(visit) } : {}) };
  const result = visit(structuredClone(document)); validarDocumento(result); return result;
}
