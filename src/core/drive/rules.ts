import { exigir } from "../contracts/base";
import type { Arquivo, Pasta, TipoArquivo } from "./types";
export const DRIVE_HARD_LIMIT = 25 * 1024 * 1024;
export const IMAGE_HARD_LIMIT = 8 * 1024 * 1024;
const executable = /\.(?:exe|dll|com|scr|msi|msp|bat|cmd|ps1|psm1|psd1|vbs|vbe|js|jse|mjs|cjs|ts|tsx|jsx|sh|bash|zsh|py|rb|pl|php|jar|hta|html?|svg|lnk|reg|app|desktop|apk|dmg|iso)$/i;
export function nomeSeguroPasta(value: unknown): string {
 exigir(typeof value === "string", "Informe o nome.");
 const name = value.normalize("NFC").trim();
 exigir(name.length > 0 && name.length <= 200 && !/[\u0000-\u001f\u007f\\/]/.test(name) && name !== "." && name !== "..", "Nome inválido.");return name;
}
export function nomeSeguroArquivo(value: unknown): string {
 const name = nomeSeguroPasta(value); exigir(!executable.test(name), "Arquivo executável não permitido."); return name;
}
export function tipoPelosBytes(bytes: Uint8Array): string | null {
 const prefix = (...values: number[]) => values.every((value,index) => bytes[index] === value);
 if (prefix(0x4d,0x5a) || prefix(0x7f,0x45,0x4c,0x46) || prefix(0x23,0x21) || prefix(0xca,0xfe,0xba,0xbe) || prefix(0xcf,0xfa,0xed,0xfe) || prefix(0xfe,0xed,0xfa,0xcf)) return null;
 if (prefix(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)) return "image/png";
 if (prefix(0xff,0xd8,0xff)) return "image/jpeg";
 const ascii = (start:number,count:number) => new TextDecoder("ascii").decode(bytes.slice(start,start+count));
 if (ascii(0,6)==="GIF87a" || ascii(0,6)==="GIF89a") return "image/gif";
 if (ascii(0,4)==="RIFF" && ascii(8,4)==="WEBP") return "image/webp";
 if (ascii(0,5)==="%PDF-") return "application/pdf";
 if (prefix(0x50,0x4b,0x03,0x04) || prefix(0x50,0x4b,0x05,0x06)) return "application/zip";
 if (ascii(0,4)==="RIFF" && ascii(8,4)==="WAVE") return "audio/wav";
 if (ascii(0,4)==="OggS") return "audio/ogg";
 if (ascii(0,3)==="ID3" || bytes[0]===0xff && ((bytes[1] ?? 0)&0xe0)===0xe0) return "audio/mpeg";
 if (ascii(4,4)==="ftyp") return "video/mp4";
 try { const text = new TextDecoder("utf-8",{fatal:true}).decode(bytes); if (!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) && !/^\s*(?:#!|<\?php|<\s*(?:script|svg|html|!doctype\s+html)\b)/i.test(text)) return "text/plain"; } catch { /* Unknown binary is refused. */ }
 return null;
}
export function validarEntradaArquivo(kind: TipoArquivo, name: string, bytes: Uint8Array, maxBytes: number) {
 nomeSeguroArquivo(name); exigir(["drive","capture_image","avatar"].includes(kind), "Tipo de envio inválido.");
 exigir(bytes.byteLength>0 && bytes.byteLength<=maxBytes && bytes.byteLength<=(kind==="drive"?DRIVE_HARD_LIMIT:IMAGE_HARD_LIMIT), "O arquivo excede o limite de envio.");
 const mime=tipoPelosBytes(bytes);exigir(mime,"Formato desconhecido ou executável não permitido.");
 if(kind!=="drive") exigir(mime.startsWith("image/"),"Escolha uma imagem PNG, JPEG, WebP ou GIF.");return mime;
}
export function arvorePastas(folders: readonly Pasta[], id: string): Pasta[] { const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const folder of folders)if(folder.parent_id&&ids.has(folder.parent_id)&&!ids.has(folder.id)){ids.add(folder.id);changed=true;}}return folders.filter(folder=>ids.has(folder.id)); }
export function caminhoPasta(folders: readonly Pasta[], id: string|null): Pasta[] | null { const trail:Pasta[]=[],seen=new Set<string>();let next=id;while(next){const folder=folders.find(item=>item.id===next&&!item.deleted_at);if(!folder||seen.has(next))return null;seen.add(next);trail.unshift(folder);next=folder.parent_id;}return trail; }
export const usoArquivos = (files: readonly Arquivo[]) => files.reduce((sum,file)=>sum+file.bytes,0);
