import type { AnexoCaptura, Captura, TipoCaptura } from "@/core/capturas";
import { normalizarTituloCaptura, reescreverReferenciaWiki } from "../../../core/capturas/wiki";

export const TYPE_LABELS: Record<TipoCaptura, string> = { note: "Nota", idea: "Ideia", task: "Tarefa", reminder: "Lembrete" };
export const normalize = normalizarTituloCaptura;
export interface CaptureDraft {
  id: string; title: string; content: string; type: TipoCaptura; category_id: string | null; project_id: string | null;
  linked_capture_ids: string[]; attachments: AnexoCaptura[]; exampleAttachment: boolean;
}
export function draftFrom(capture?: Captura, personalCategoryId: string | null = null): CaptureDraft {
  return { id: capture?.id ?? "new", title: capture?.title ?? "", content: capture?.content ?? "", type: capture?.type ?? "note",
    category_id: capture ? capture.category_id : personalCategoryId, project_id: capture?.project_id ?? null,
    linked_capture_ids: [...capture?.linked_capture_ids ?? []], attachments: structuredClone(capture?.attachments ?? []), exampleAttachment: capture?.id === "book" };
}
export function references(draft: Pick<CaptureDraft, "id" | "content" | "linked_capture_ids">, items: readonly Captura[]) {
  const ids = new Set(draft.linked_capture_ids.filter((id) => id !== draft.id && items.some((item) => item.id === id)));
  const missing = new Set<string>();
  for (const match of draft.content.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const title = match[1]!;
    const target = items.find((item) => normalize(item.title ?? "") === normalize(title));
    if (!target) missing.add(title); else if (target.id !== draft.id) ids.add(target.id);
  }
  return { ids: [...ids], missing: [...missing] };
}
export function incoming(id: string, items: readonly Captura[]): Captura[] {
  return items.filter((item) => item.id !== id && !item.deleted_at && references({ id: item.id, content: item.content ?? "", linked_capture_ids: item.linked_capture_ids ?? [] }, items).ids.includes(id));
}
export const rewriteWiki = reescreverReferenciaWiki;
export function validateDraft(draft: CaptureDraft, items: readonly Captura[]): string | null {
  if (!draft.title.trim()) return "Dê um título à nota para conseguir encontrá-la depois.";
  if (draft.title.trim().length > 120) return "O título pode ter até 120 caracteres.";
  if (items.some((item) => item.id !== draft.id && !item.deleted_at && normalize(item.title ?? "") === normalize(draft.title))) return "Já existe uma nota com esse título. Use um nome diferente.";
  if (draft.content.length > 30_000) return "O texto pode ter até 30.000 caracteres.";
  return null;
}
export function filterCaptures(items: readonly Captura[], filter: "all" | "inbox" | "archived", query: string): Captura[] {
  const term = normalize(query);
  return items.filter((item) => !item.deleted_at && (filter === "archived" ? item.status === "archived" : item.status !== "archived" && (filter !== "inbox" || item.status === "inbox")) && normalize(`${item.title ?? ""} ${item.content ?? ""} ${TYPE_LABELS[item.type]}`).includes(term))
    .sort((first, second) => Date.parse(second.captured_at) - Date.parse(first.captured_at) || first.id.localeCompare(second.id));
}
export function sameDraft(first: CaptureDraft, second: CaptureDraft) { return JSON.stringify(first) === JSON.stringify(second); }
export function hasDraftContent(draft: CaptureDraft) { return !!(draft.title || draft.content || draft.linked_capture_ids.length || draft.attachments.length || draft.exampleAttachment); }
