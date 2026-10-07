import type { AnexoCaptura } from "@/core/capturas";
import { BYTES_PARA_SNIFAR, TAMANHO_MAXIMO_BYTES, nomeDoAnexo, sniffarImagem } from "./image-rules";

export interface PreparedCaptureImage extends AnexoCaptura { blob: Blob }
export const ACCEPT_IMAGES = "image/png,image/jpeg,image/webp,image/gif";
/** Pixel-only export drops source EXIF; animated input intentionally becomes one frame. */
export async function prepareImage(file: File): Promise<PreparedCaptureImage> {
  const inputType = sniffarImagem(new Uint8Array(await file.slice(0, BYTES_PARA_SNIFAR).arrayBuffer()));
  if (!inputType) throw new Error("Escolha uma imagem PNG, JPEG, WebP ou GIF. SVG não é aceito.");
  const source = URL.createObjectURL(new Blob([file], { type: inputType }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("Não foi possível ler esta imagem. Escolha outro arquivo.")); element.src = source;
    });
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) throw new Error("Não foi possível preparar a imagem neste navegador.");
    context.drawImage(image, 0, 0);
    const mime = inputType === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.9));
    if (!blob || sniffarImagem(new Uint8Array(await blob.slice(0, BYTES_PARA_SNIFAR).arrayBuffer())) !== mime) throw new Error("Não foi possível preparar a imagem. Tente outro arquivo.");
    if (blob.size > TAMANHO_MAXIMO_BYTES) throw new Error("A imagem preparada precisa ter até 8 MB.");
    return { id: crypto.randomUUID(), name: nomeDoAnexo(mime, new Date()), mime, width: canvas.width, height: canvas.height, bytes: blob.size, blob };
  } finally { URL.revokeObjectURL(source); }
}
export function imagesFrom(data: DataTransfer | null) { return data ? Array.from(data.files).filter((file) => file.type.startsWith("image/")) : []; }
