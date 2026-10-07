/** Pure rules ported from legacy imagem.ts at ffdf064. */
export const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type TipoDeImagem = (typeof TIPOS_ACEITOS)[number];
export const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024;
export const MAXIMO_DE_ANEXOS = 6;
export const BYTES_PARA_SNIFAR = 12;
const signatures: { type: TipoDeImagem; bytes: (number | null)[] }[] = [
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] },
];
export function sniffarImagem(bytes: Uint8Array): TipoDeImagem | null {
  return signatures.find((signature) => bytes.length >= signature.bytes.length && signature.bytes.every((byte, index) => byte === null || byte === bytes[index]))?.type ?? null;
}
export function tipoAceito(type: string | null | undefined): type is TipoDeImagem { return TIPOS_ACEITOS.includes(type as TipoDeImagem); }
export function extensaoDe(type: TipoDeImagem) { return type === "image/jpeg" ? "jpg" : type.slice("image/".length); }
export function nomeDoAnexo(type: TipoDeImagem, when: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `Captura ${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}.${extensaoDe(type)}`;
}
