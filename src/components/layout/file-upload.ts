"use client";

import { nomeSeguroArquivo, type Arquivo, type TipoArquivo } from "@/core/drive";
import { isStorageOrigin, PERSONAL_STORAGE_ORIGIN, signedUploadUrl, type StorageOrigin } from "@/lib/files/storage-origin";

export type UploadPhase = "reserving" | "uploading" | "validating";
export class FileClientError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "FileClientError"; }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function fileReadUrl(fileId: string, userId: string, download = false) {
  return `/api/files/read?id=${encodeURIComponent(fileId)}&user=${encodeURIComponent(userId)}${download ? "&download=1" : ""}`;
}

/** Signed credentials are used in memory for this staging upload only. */
export async function uploadFile({ file, kind, userId, folderId = null, storageOrigin = PERSONAL_STORAGE_ORIGIN, sender, onPhase, onReserved, fetcher = fetch, clientId = crypto.randomUUID() }: {
  file: File; kind: TipoArquivo; userId: string; folderId?: string | null;
  storageOrigin?: StorageOrigin;
  sender: (command: string, input: unknown) => Promise<unknown>;
  onPhase?: (phase: UploadPhase) => void; fetcher?: typeof fetch; clientId?: string;
  onReserved?: (id: string) => void;
}): Promise<Arquivo> {
  const name = nomeSeguroArquivo(file.name);
  if (!file.size) throw new FileClientError("VALIDATION", "Escolha um arquivo com conteúdo.");
  if (!isStorageOrigin(storageOrigin)) throw new FileClientError("INVALID_RESPONSE", "A reserva do arquivo não pertence a esta conta.");
  onPhase?.("reserving");
  let reply: Response;
  try { reply = await fetcher("/api/files/uploads", { method: "POST", credentials: "same-origin", redirect: "error", headers: { "Content-Type": "application/json", "X-Expected-User-ID": userId }, body: JSON.stringify({ kind, name, folder_id: folderId, client_id: clientId }) }); }
  catch { throw new FileClientError("UNAVAILABLE", "Não foi possível preparar o envio. Tente novamente."); }
  let value: unknown;
  try { value = await reply.json(); } catch { throw new FileClientError("INVALID_RESPONSE", "Não foi possível preparar o envio."); }
  if (!reply.ok) throw new FileClientError(object(value) && typeof value.code === "string" ? value.code : "UNAVAILABLE", object(value) && typeof value.message === "string" ? value.message : "Não foi possível preparar o envio.");
  if (!object(value) || !uuid(value.id) || typeof value.upload_url !== "string" || typeof value.token !== "string" || typeof value.expires_at !== "string") throw new FileClientError("INVALID_RESPONSE", "A reserva do arquivo é inválida.");
  const url = signedUploadUrl(value.upload_url, storageOrigin, userId, value.id, value.token);
  if (!url || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= Date.now()) throw new FileClientError("INVALID_RESPONSE", "A reserva do arquivo não pertence a esta conta.");
  onReserved?.(value.id);
  onPhase?.("uploading");
  const body = new FormData(); body.append("cacheControl", "0"); body.append("", file);
  let stored: Response;
  try { stored = await fetcher(url, { method: "PUT", credentials: "omit", redirect: "error", headers: { "x-upsert": "false" }, body }); }
  catch { throw new FileClientError("UNAVAILABLE", "O envio foi interrompido. Escolha o arquivo para tentar novamente."); }
  if (!stored.ok || stored.redirected || stored.url && stored.url !== url) throw new FileClientError("UNAVAILABLE", "Não foi possível enviar o arquivo. Tente novamente.");
  onPhase?.("validating");
  const result = await sender("file.upload.finalize", { upload_id: value.id, client_id: clientId });
  if (!object(result) || result.user_id !== userId || result.id !== value.id || result.kind !== kind || typeof result.name !== "string" || typeof result.mime !== "string" || !Number.isSafeInteger(result.bytes) || Number(result.bytes) <= 0) throw new FileClientError("INVALID_RESPONSE", "O arquivo enviado ainda não foi confirmado.");
  return result as unknown as Arquivo;
}
