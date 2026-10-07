import type { CaptureDraft } from "./model";

export const DRAFT_STORAGE_PREFIX = "segundo-cerebro:captures:drafts:v1:";
export const draftStorageKey = (userId: string) => `${DRAFT_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
export type DraftMap = Record<string, CaptureDraft>;
/** URL/storage keys are data, including names inherited from Object.prototype. */
export function findDraft(drafts: DraftMap, id: string): CaptureDraft | undefined {
  return Object.hasOwn(drafts, id) ? drafts[id] : undefined;
}
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function isDraft(value: unknown): value is CaptureDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<CaptureDraft>;
  return typeof draft.id === "string" && typeof draft.title === "string" && draft.title.length <= 120 && typeof draft.content === "string" && draft.content.length <= 30_000 &&
    ["note", "idea", "task", "reminder"].includes(draft.type ?? "") && (draft.category_id === null || typeof draft.category_id === "string") && (draft.project_id === null || typeof draft.project_id === "string") &&
    Array.isArray(draft.linked_capture_ids) && draft.linked_capture_ids.every((id) => typeof id === "string") && Array.isArray(draft.attachments) && draft.attachments.length <= 6 &&
    draft.attachments.every((image) => image && typeof image.id === "string" && typeof image.name === "string" && ["image/png", "image/jpeg"].includes(image.mime) && Number.isSafeInteger(image.width) && image.width > 0 && Number.isSafeInteger(image.height) && image.height > 0 && Number.isSafeInteger(image.bytes) && image.bytes > 0 && image.bytes <= 8 * 1024 * 1024) && typeof draft.exampleAttachment === "boolean";
}
export function readDrafts(storage: DraftStorage | null, userId: string): { drafts: DraftMap; available: boolean } {
  if (!storage) return { drafts: {}, available: false };
  try {
    const parsed: unknown = JSON.parse(storage.getItem(draftStorageKey(userId)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { drafts: {}, available: true };
    return { drafts: Object.fromEntries(Object.entries(parsed).filter(([id, draft]) => isDraft(draft) && id === draft.id)), available: true };
  } catch { return { drafts: {}, available: false }; }
}
export function writeDrafts(storage: DraftStorage | null, userId: string, drafts: DraftMap): boolean {
  if (!storage) return false;
  try { storage.setItem(draftStorageKey(userId), JSON.stringify(drafts)); return true; } catch { return false; }
}
export function clearDrafts(storage: DraftStorage | null, userId: string): void {
  try { storage?.removeItem(draftStorageKey(userId)); } catch { /* Mounted drafts are cleared separately even if storage is unavailable. */ }
}
