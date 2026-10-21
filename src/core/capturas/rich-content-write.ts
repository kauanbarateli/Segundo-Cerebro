import { ErroDeDominio, exigir } from "../contracts/base";
import type { DocumentoPagina } from "../contracts/rich-document";
import { lerConteudoDocumentalDaCaptura, type LeituraDocumentalDaCaptura } from "./rich-content";

export type BaseDocumentalDaCaptura = { kind: "legacy"; content: string | null } | { kind: "rich"; document_version: number };
export interface AtualizacaoDocumentalDaCaptura { id: string; client_id: string; expected_content: BaseDocumentalDaCaptura; patch: { document: DocumentoPagina } }
export const CAPTURE_DOCUMENT_BODY_LIMIT = 768 * 1024;
export const CAPTURE_DOCUMENT_FINGERPRINT_LIMIT = 2 * 1024 * 1024;

/** Reflection errors are never inspected or propagated, including hostile Proxies. */
function dados(value: unknown): Record<string, unknown> {
  try {
    exigir(value !== null && typeof value === "object" && !Array.isArray(value), "Envelope documental inválido.");
    exigir([null, Object.prototype].includes(Object.getPrototypeOf(value)), "Envelope documental inválido.");
    const descriptors = Object.getOwnPropertyDescriptors(value), result: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      exigir(typeof key === "string", "Envelope documental inválido.");
      const descriptor = descriptors[key]!;
      exigir(Object.hasOwn(descriptor, "value"), "Envelope documental inválido.");
      result[key] = descriptor.value;
    }
    return result;
  } catch { throw new ErroDeDominio("VALIDATION", "Envelope documental inválido."); }
}
function exatos(value: Record<string, unknown>, keys: readonly string[]) {
  exigir(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), "Campos documentais inválidos.");
}
function linksComDestino(document: DocumentoPagina) {
  const pending = [...document.content];
  while (pending.length) {
    const node = pending.pop()!;
    for (const mark of node.marks ?? []) exigir(mark.type !== "link" || mark.attrs !== undefined, "Link documental sem destino.");
    pending.push(...(node.content ?? []));
  }
}
export function validarBaseDocumentalDaCaptura(value: unknown): BaseDocumentalDaCaptura {
  const fields = dados(value);
  if (fields.kind === "legacy") {
    exatos(fields, ["kind", "content"]);
    return { kind: "legacy", content: lerConteudoDocumentalDaCaptura(fields).content };
  }
  exatos(fields, ["kind", "document_version"]);
  exigir(fields.kind === "rich" && typeof fields.document_version === "number" && Number.isSafeInteger(fields.document_version) && fields.document_version > 0, "Revisão documental inválida.");
  return { kind: "rich", document_version: fields.document_version };
}

/** Persisted rows, event states and receipts share the same pair/cache invariant. */
export function lerEstadoDocumentalDaCaptura(value: unknown): LeituraDocumentalDaCaptura {
  const fields = dados(value), document = Object.hasOwn(fields, "document"), revision = Object.hasOwn(fields, "document_version");
  exigir(!Object.hasOwn(fields, "bodyHtml") && !Object.hasOwn(fields, "content_html"), "Representação documental não permitida.");
  exigir(Object.hasOwn(fields, "content") && document === revision, "Estado documental incompleto.");
  if (!document) return lerConteudoDocumentalDaCaptura({ kind: "legacy", content: fields.content });
  const result = lerConteudoDocumentalDaCaptura({ kind: "rich", document: fields.document, document_version: fields.document_version });
  if (result.kind === "rich") linksComDestino(result.document);
  exigir(fields.content === result.content, "Cache documental inconsistente.");
  return result;
}

/** A closed intent; the client never supplies the next revision or derived cache. */
export function validarAtualizacaoDocumentalDaCaptura(value: unknown): AtualizacaoDocumentalDaCaptura {
  const fields = dados(value); exatos(fields, ["id", "client_id", "expected_content", "patch"]);
  exigir(typeof fields.id === "string" && fields.id.length > 0 && typeof fields.client_id === "string" && fields.client_id.trim().length > 0 && fields.client_id.length <= 200, "Identificação documental inválida.");
  const expected_content = validarBaseDocumentalDaCaptura(fields.expected_content), patch = dados(fields.patch); exatos(patch, ["document"]);
  const candidate = lerConteudoDocumentalDaCaptura({ kind: "rich", document: patch.document, document_version: 1 });
  exigir(candidate.kind === "rich", "Documento inválido.");
  linksComDestino(candidate.document);
  return { id: fields.id, client_id: fields.client_id, expected_content, patch: { document: candidate.document } };
}

/** Called inside the transaction, after its receipt lookup, with server-read current. */
export function planejarAtualizacaoDocumentalDaCaptura(input: unknown): Extract<LeituraDocumentalDaCaptura, { kind: "rich" }> {
  const fields = dados(input); exatos(fields, ["current", "expected", "document"]);
  const current = lerConteudoDocumentalDaCaptura(fields.current), expected = validarBaseDocumentalDaCaptura(fields.expected);
  if (current.kind === "rich") linksComDestino(current.document);
  if (current.kind !== expected.kind || current.kind === "legacy" && expected.kind === "legacy" && current.content !== expected.content
    || current.kind === "rich" && expected.kind === "rich" && current.document_version !== expected.document_version) {
    throw new ErroDeDominio("CONFLICT", "O conteúdo desta Captura mudou. Preserve sua edição e recarregue a base.");
  }
  if (current.kind === "rich" && current.document_version === Number.MAX_SAFE_INTEGER) throw new ErroDeDominio("CONFLICT", "A revisão documental não pode avançar.");
  const result = lerConteudoDocumentalDaCaptura({ kind: "rich", document: fields.document, document_version: current.kind === "legacy" ? 1 : current.document_version + 1 });
  exigir(result.kind === "rich", "Documento inválido.");
  linksComDestino(result.document);
  return result;
}
