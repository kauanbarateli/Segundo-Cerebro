import type { Arquivo } from "../../core/drive";
import { validateEntityImageFile, type EntityImagePurpose } from "../../core/drive/entity-images";

export type ImageUploadObservation = {
  version: 1; user_id: string; upload_id: string; purpose: EntityImagePurpose;
} & ({ state: "final"; file: Arquivo } | { state: "staging" | "missing-observed" | "indeterminate"; file: null });
const fields = ["id", "user_id", "kind", "folder_id", "name", "mime", "bytes", "sha256", "width", "height", "starred", "deleted_at", "deletion_batch_id", "created_at", "updated_at", "modified_at"];
export function isImageUploadInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0), days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]! && Number(match[4]) < 24 && Number(match[5]) < 60 && Number(match[6]) < 60 && Number.isFinite(Date.parse(value));
}
export function observedImageFile(value: unknown, userId: string, uploadId: string, purpose: EntityImagePurpose): Arquivo {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Imagem não confirmada.");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== fields.length || fields.some(key => !Object.hasOwn(row, key)) || row.id !== uploadId || row.user_id !== userId ||
    typeof row.name !== "string" || typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.bytes) || typeof row.starred !== "boolean" || row.deletion_batch_id !== null ||
    ![row.created_at, row.updated_at, row.modified_at].every(isImageUploadInstant)) throw new Error("Imagem não confirmada.");
  validateEntityImageFile(row as unknown as Arquivo, userId, purpose);
  return { ...row } as unknown as Arquivo;
}
export function decodeImageUploadObservation(value: unknown, userId: string, uploadId: string, purpose: EntityImagePurpose): ImageUploadObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Observação de imagem inválida.");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join() !== "file,purpose,state,upload_id,user_id,version" || row.version !== 1 || row.user_id !== userId || row.upload_id !== uploadId || row.purpose !== purpose) throw new Error("Observação fora do envio.");
  if (row.state === "final") return { version: 1, user_id: userId, upload_id: uploadId, purpose, state: "final", file: observedImageFile(row.file, userId, uploadId, purpose) };
  if (typeof row.state !== "string" || !["staging", "missing-observed", "indeterminate"].includes(row.state) || row.file !== null) throw new Error("Observação não confirmada.");
  return { version: 1, user_id: userId, upload_id: uploadId, purpose, state: row.state as "staging" | "missing-observed" | "indeterminate", file: null };
}
