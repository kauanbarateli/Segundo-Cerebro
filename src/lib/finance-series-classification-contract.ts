import { exigir } from "../core/contracts/base";

export type SeriesGroupClassification =
  | { version: 2; group_id: string; kind: "legacy" }
  | { version: 2; group_id: string; kind: "managed"; available: boolean };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
/** A missing/error response is never a positive legacy classification. */
export function decodeSeriesGroupClassification(value: unknown, expectedGroup: string): SeriesGroupClassification {
  exigir(uuid(expectedGroup) && !!value && typeof value === "object" && !Array.isArray(value), "Classificação de grupo inválida.");
  const row = value as Record<string, unknown>, keys = row.kind === "legacy" ? ["version", "group_id", "kind"] : ["version", "group_id", "kind", "available"];
  exigir(Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key)) && row.version === 2 && row.group_id === expectedGroup && (row.kind === "legacy" || row.kind === "managed" && typeof row.available === "boolean"), "Classificação de grupo inválida.");
  return structuredClone(row) as unknown as SeriesGroupClassification;
}
