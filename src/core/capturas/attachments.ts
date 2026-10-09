import type { AnexoCaptura } from "./types";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Metadata only. The database separately verifies finalized ownership and bytes. */
export function validCaptureAttachments(value: unknown): value is AnexoCaptura[] {
  if (!Array.isArray(value) || value.length > 6) return false;
  const ids = new Set<string>();
  return value.every(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) ||
      Object.keys(row).length !== 6 || !Object.keys(row).every(key => ["id", "name", "mime", "width", "height", "bytes"].includes(key))) return false;
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string" || !UUID.test(item.id) || ids.has(item.id) ||
      typeof item.name !== "string" || !item.name.trim() || item.name.length > 200 ||
      !["image/png", "image/jpeg"].includes(String(item.mime)) ||
      ![item.width, item.height, item.bytes].every(number => Number.isSafeInteger(number) && Number(number) > 0) ||
      Number(item.width) * Number(item.height) > 24_000_000 || Number(item.bytes) > 8 * 1024 * 1024) return false;
    ids.add(item.id); return true;
  });
}
