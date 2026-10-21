import type { FeatureKey } from "../access/resolve-access";
import { exigir } from "../contracts/base";
import type { Arquivo, TipoArquivo } from "./types";

/** SPEC-08 v1: purpose is authority, never an arbitrary bucket or URL. */
export const FILE_FEATURES = {
  drive: "drive", capture_image: "capturar", avatar: "configuracoes",
  project_cover: "projetos", habit_image: "habitos",
  finance_goal_image: "financeiro", home_focus_image: "inicio",
} as const satisfies Record<TipoArquivo, FeatureKey>;
export function isFileKind(value: unknown): value is TipoArquivo {
  return typeof value === "string" && Object.hasOwn(FILE_FEATURES, value);
}
export type EntityImagePurpose = "project_cover" | "home_focus_image";
export interface EntityImageBinding {
  version: 1; user_id: string; id: string; purpose: EntityImagePurpose; file_id: string | null;
}
export interface SetEntityImage {
  version: 1; purpose: EntityImagePurpose; entity_id: string; file_id: string | null; expected_file_id: string | null; client_id: string;
}
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function decodeEntityImage(value: unknown): SetEntityImage {
  exigir(!!value && typeof value === "object" && !Array.isArray(value), "Vínculo de imagem inválido.");
  const row = value as Record<string, unknown>;
  exigir(Object.keys(row).length === 6 && Object.keys(row).every(key => ["version", "purpose", "entity_id", "file_id", "expected_file_id", "client_id"].includes(key)) && row.version === 1, "Campos ou versão de imagem não permitidos.");
  exigir(row.purpose === "project_cover" || row.purpose === "home_focus_image", "Destino de imagem indisponível.");
  exigir(uuid(row.entity_id) && (row.file_id === null || uuid(row.file_id)) && (row.expected_file_id === null || uuid(row.expected_file_id)), "Identificador de imagem inválido.");
  exigir(typeof row.client_id === "string" && row.client_id.trim().length > 0 && row.client_id.length <= 200, "Informe o identificador do envio.");
  return { version: 1, purpose: row.purpose, entity_id: row.entity_id.toLowerCase(), file_id: row.file_id?.toLowerCase() ?? null,
    expected_file_id: row.expected_file_id?.toLowerCase() ?? null, client_id: row.client_id };
}
/** Called after the adapter has established finalization; metadata alone is not a receipt. */
export function validateEntityImageFile(file: Arquivo, userId: string, purpose: EntityImagePurpose) {
  exigir(file.user_id === userId && file.kind === purpose && file.deleted_at === null && file.folder_id === null &&
    ["image/png", "image/jpeg"].includes(file.mime) && file.bytes > 0 && file.bytes <= 8 * 1024 * 1024 &&
    Number.isSafeInteger(file.width) && Number.isSafeInteger(file.height) && Number(file.width) > 0 && Number(file.height) > 0 &&
    Number(file.width) * Number(file.height) <= 24_000_000, "A imagem não está disponível para este destino.");
}
