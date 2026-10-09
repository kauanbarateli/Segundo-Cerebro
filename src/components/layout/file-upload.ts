"use client";

import { nomeSeguroArquivo, type Arquivo, type TipoArquivo } from "@/core/drive";

export type UploadPhase = "reserving" | "uploading" | "validating";
export class FileClientError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "FileClientError"; }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const STORAGE_ORIGIN = "https://rishenjoikgmfubmnfiu.supabase.co";

export function fileReadUrl(fileId: string, userId: string, download = false) {
  return `/api/files/read?id=${encodeURIComponent(fileId)}&user=${encodeURIComponent(userId)}${download ? "&download=1" : ""}`;
}

/** Signed credentials are used in memory for this staging upload only. */
export async function uploadFile({ file, kind, userId, folderId = null, sender, onPhase, fetcher = fetch, clientId = crypto.randomUUID() }: {
  file: File; kind: TipoArquivo; userId: string; folderId?: string | null;
  sender: (command: string, input: unknown) => Promise<unknown>;
  onPhase?: (phase: UploadPhase) => void; fetcher?: typeof fetch; clientId?: string;
}): Promise<Arquivo> {
  const name = nomeSeguroArquivo(file.name);
  if (!file.size) throw new FileClientError("VALIDATION", "Escolha um arquivo com conteúdo.");
  onPhase?.("reserving");
  let reply: Response;
  try { reply = await fetcher("/api/files/uploads", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Expected-User-ID": userId }, body: JSON.stringify({ kind, name, folder_id: folderId, client_id: clientId }) }); }
  catch { throw new FileClientError("UNAVAILABLE", "Não foi possível preparar o envio. Tente novamente."); }
  let value: unknown;
  try { value = await reply.json(); } catch { throw new FileClientError("INVALID_RESPONSE", "Não foi possível preparar o envio."); }
  if (!reply.ok) throw new FileClientError(object(value) && typeof value.code === "string" ? value.code : "UNAVAILABLE", object(value) && typeof value.message === "string" ? value.message : "Não foi possível preparar o envio.");
  if (!object(value) || !uuid(value.id) || typeof value.upload_url !== "string" || typeof value.token !== "string" || typeof value.expires_at !== "string") throw new FileClientError("INVALID_RESPONSE", "A reserva do arquivo é inválida.");
  let url: URL;
  try { url = new URL(value.upload_url); } catch { throw new FileClientError("INVALID_RESPONSE", "O endereço de envio é inválido."); }
  const expectedPath = `/storage/v1/object/upload/sign/second-brain-staging/${userId}/${value.id}`;
  if (url.origin !== STORAGE_ORIGIN || decodeURIComponent(url.pathname) !== expectedPath || !value.token || url.searchParams.get("token") !== value.token || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= Date.now()) throw new FileClientError("INVALID_RESPONSE", "A reserva do arquivo não pertence a esta conta.");
  onPhase?.("uploading");
  const body = new FormData(); body.append("cacheControl", "0"); body.append("", file);
  let stored: Response;
  try { stored = await fetcher(url.toString(), { method: "PUT", credentials: "omit", headers: { "x-upsert": "false" }, body }); }
  catch { throw new FileClientError("UNAVAILABLE", "O envio foi interrompido. Escolha o arquivo para tentar novamente."); }
  if (!stored.ok) throw new FileClientError("UNAVAILABLE", "Não foi possível enviar o arquivo. Tente novamente.");
  onPhase?.("validating");
  const result = await sender("file.upload.finalize", { upload_id: value.id, client_id: clientId });
  if (!object(result) || result.user_id !== userId || result.id !== value.id || result.kind !== kind || typeof result.name !== "string" || typeof result.mime !== "string" || !Number.isSafeInteger(result.bytes) || Number(result.bytes) <= 0) throw new FileClientError("INVALID_RESPONSE", "O arquivo enviado ainda não foi confirmado.");
  return result as unknown as Arquivo;
}
