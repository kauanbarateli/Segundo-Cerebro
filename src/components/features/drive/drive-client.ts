"use client";
import { validarSnapshotDrive, type DriveDTO } from "@/core/drive";
import { FileClientError } from "@/components/layout/file-upload";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function createDriveClient(userId: string, fetcher: typeof fetch = fetch) {
  return { async load(signal?: AbortSignal): Promise<DriveDTO> {
    const response = await fetcher("/api/files", { credentials: "same-origin", cache: "no-store", headers: { "X-Expected-User-ID": userId }, signal });
    const value: unknown = await response.json();
    if (!response.ok) throw new FileClientError(object(value) && typeof value.code === "string" ? value.code : "UNAVAILABLE", object(value) && typeof value.message === "string" ? value.message : "Não foi possível abrir seus arquivos.");
    if (!object(value) || !Array.isArray(value.folders) || !Array.isArray(value.files) || !Array.isArray(value.projects) || ![value.usage_bytes, value.capacity_bytes, value.max_file_bytes].every(item => Number.isSafeInteger(item) && Number(item) >= 0)) throw new FileClientError("INVALID_RESPONSE", "Não foi possível validar seus arquivos.");
    const dto = value as unknown as DriveDTO;
    validarSnapshotDrive({ ...dto, revision: "0", receipts: [] }, userId);
    if (dto.files.some(file => file.kind !== "drive")) throw new FileClientError("INVALID_RESPONSE", "A resposta do Drive é inválida.");
    return dto;
  } };
}
