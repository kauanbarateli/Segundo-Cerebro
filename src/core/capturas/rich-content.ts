import { ErroDeDominio, exigir } from "../contracts/base";
import { MAX_DOCUMENT_BYTES, textoDoDocumento, validarDocumento, type BlocoDocumento, type DocumentoPagina } from "../contracts/rich-document";

export type LeituraDocumentalDaCaptura =
  | { readonly kind: "legacy"; readonly content: string | null; readonly document: null; readonly document_version: 0 }
  | { readonly kind: "rich"; readonly content: string | null; readonly document: DocumentoPagina; readonly document_version: number };

type DadoJson = null | string | number | boolean | DadoJson[] | { [key: string]: DadoJson };
type VisitaJson = { source: unknown; assign: (value: DadoJson) => void } | { leave: object };

/** Reflection may invoke Proxy introspection traps, but values never use get. */
function dadosProprios(value: object): Record<string, unknown> {
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(value);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    exigir(typeof key === "string", "O conteúdo não aceita chaves simbólicas.");
    const descriptor = descriptors[key]!;
    exigir(Object.hasOwn(descriptor, "value"), "O conteúdo exige propriedades de dados.");
    result[key] = descriptor.value;
  }
  return result;
}

function prototipoDeDados(value: object, array: boolean) {
  const prototype = Object.getPrototypeOf(value);
  exigir(prototype === null || prototype === (array ? Array.prototype : Object.prototype), "Objeto de conteúdo inválido.");
}

/** Copy JSON iteratively before any stringify, schema validation or projection. */
function copiarDocumento(value: unknown): DadoJson {
  let result: DadoJson = null, bytes = 0;
  const active = new Set<object>();
  const pending: VisitaJson[] = [{ source: value, assign: copy => { result = copy; } }];
  const debit = (size: number) => {
    bytes += size;
    exigir(bytes <= MAX_DOCUMENT_BYTES, "O documento excede 512 KiB.");
  };
  const stringBytes = (text: string) => {
    exigir(text.length <= MAX_DOCUMENT_BYTES, "O documento excede 512 KiB.");
    return new TextEncoder().encode(JSON.stringify(text)).length;
  };
  while (pending.length) {
    const visit = pending.pop()!;
    if ("leave" in visit) { active.delete(visit.leave); continue; }
    const source = visit.source;
    if (source === null || typeof source === "boolean") {
      debit(source === null || source === true ? 4 : 5); visit.assign(source); continue;
    }
    if (typeof source === "string") { debit(stringBytes(source)); visit.assign(source); continue; }
    if (typeof source === "number") {
      exigir(Number.isFinite(source), "Número de conteúdo inválido.");
      debit(JSON.stringify(source).length); visit.assign(source); continue;
    }
    exigir(typeof source === "object", "O documento exige dados JSON completos.");
    exigir(!active.has(source), "O documento não aceita ciclos.");
    const array = Array.isArray(source);
    prototipoDeDados(source, array);
    const fields = dadosProprios(source), keys = Object.keys(fields);
    active.add(source);
    pending.push({ leave: source });
    if (array) {
      const length = fields.length;
      exigir(typeof length === "number" && Number.isSafeInteger(length) && length >= 0 && keys.length === length + 1, "Lista de conteúdo inválida.");
      debit(2 + Math.max(0, length - 1));
      const copy: DadoJson[] = new Array(length);
      visit.assign(copy);
      for (let index = length - 1; index >= 0; index--) {
        exigir(Object.hasOwn(fields, String(index)), "O documento não aceita listas esparsas.");
        pending.push({ source: fields[String(index)], assign: child => { copy[index] = child; } });
      }
    } else {
      debit(2 + Math.max(0, keys.length - 1));
      const copy: { [key: string]: DadoJson } = Object.create(null);
      visit.assign(copy);
      for (const key of keys) {
        debit(stringBytes(key) + 1);
        pending.push({ source: fields[key], assign: child => { copy[key] = child; } });
      }
    }
  }
  return result;
}

function conferirNamespace(node: BlocoDocumento): void {
  exigir(node.type !== "wikiLink", "Referências de Página não pertencem ao documento da Captura.");
  for (const child of node.content ?? []) conferirNamespace(child);
}

/** A pure reader: no conversion of legacy text, version allocation or writes. */
export function lerConteudoDocumentalDaCaptura(input: unknown): LeituraDocumentalDaCaptura {
  try {
    exigir(input !== null && typeof input === "object" && !Array.isArray(input), "Informe o conteúdo da Captura.");
    prototipoDeDados(input, false);
    const fields = dadosProprios(input), keys = Object.keys(fields);
    if (fields.kind === "legacy") {
      exigir(keys.length === 2 && Object.hasOwn(fields, "content"), "Campos de conteúdo legado inválidos.");
      exigir(fields.content === null || typeof fields.content === "string" && fields.content.length <= 30_000, "O conteúdo deve ter até 30.000 caracteres.");
      return { kind: "legacy", content: fields.content, document: null, document_version: 0 };
    }
    exigir(fields.kind === "rich" && keys.length === 3 && Object.hasOwn(fields, "document") && Object.hasOwn(fields, "document_version"), "Campos de documento inválidos.");
    const revision = fields.document_version;
    exigir(typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 1, "Revisão de documento inválida.");
    const document = copiarDocumento(fields.document);
    validarDocumento(document);
    conferirNamespace(document);
    const text = textoDoDocumento(document);
    exigir(text.length <= 30_000, "O conteúdo deve ter até 30.000 caracteres.");
    return { kind: "rich", document, document_version: revision, content: text.trim() || null };
  } catch {
    // Traps may throw any value, including a fake domain error or another Proxy.
    // This reader never inspects or propagates the thrown value.
    throw new ErroDeDominio("VALIDATION", "Conteúdo documental inválido.");
  }
}
