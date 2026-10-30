import { exigir } from "../../core/contracts/base";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
/** Scope facts come from the page-bound SQL read; href is never authority. */
export function parseKnowledgeImage(value: unknown, actor: string, pageId: string, fileId: string) {
  exigir(object(value) && Object.keys(value).length === 5 && value.version === 1 && value.user_id === actor && value.page_id === pageId && object(value.file) && typeof value.storage_path === "string", "Imagem da página indisponível.");
  const file = value.file;
  exigir(file.id === fileId && file.user_id === actor && file.kind === "capture_image" && file.deleted_at === null && typeof file.name === "string" && ["image/png", "image/jpeg"].includes(String(file.mime)) && Number.isSafeInteger(file.bytes) && Number(file.bytes) > 0 && typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256) && value.storage_path === `${actor}/${fileId}`, "Imagem da página inválida.");
  return { storage_path: value.storage_path, name: file.name };
}
