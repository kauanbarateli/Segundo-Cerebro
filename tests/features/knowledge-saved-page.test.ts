import { describe, expect, it } from "vitest";
import type { ConhecimentoDTO, Pagina } from "@/core/conhecimento";
import { adoptKnowledgeSavedPage, mergeKnowledgeSavedPages, selectKnowledgeSavedPage } from "@/components/features/conhecimento/knowledge-drafts";
const owner = "59000000-0000-4000-8000-000000000002";
const original: Pagina = {
 id: "59000000-0000-4000-8000-000000000001", user_id: owner,
 notebook_id: "59000000-0000-4000-8000-000000000003", parent_id: null, origin_capture_id: null,
 title: "Salva v1", normalized_title: "salva v1", document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Conteúdo salvo v1" }] }] },
 content_text: "Conteúdo salvo v1", version: 1, position: 0, deleted_at: null, archived_at: null, deletion_batch_id: null,
 created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z",
};
const newer: Pagina = { ...original, title: "Salva v2", normalized_title: "salva v2", version: 2,
 document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Conteúdo salvo v2" }] }] }, content_text: "Conteúdo salvo v2",
 notebook_id: "59000000-0000-4000-8000-000000000004", parent_id: "59000000-0000-4000-8000-000000000005", updated_at: "2030-01-02T12:00:00Z",
 archived_at: "2030-01-02T12:00:00Z", deleted_at: "2030-01-02T12:00:00Z", deletion_batch_id: "59000000-0000-4000-8000-000000000006" };
const dto = (pages: Pagina[] = [original]): ConhecimentoDTO => ({ revision: "1", notebooks: [], pages, refs: [], links: [], targets: [] });
describe("confirmed Knowledge pages belong to the persistent workspace DTO", () => {
 it("chooses the complete adopted newer page with its metadata", () => {
  expect(selectKnowledgeSavedPage(original, newer)).toBe(newer);
  expect(selectKnowledgeSavedPage(original, newer)).toMatchObject({ updated_at: newer.updated_at, notebook_id: newer.notebook_id, parent_id: newer.parent_id, archived_at: newer.archived_at, deleted_at: newer.deleted_at });
 });
 it("prefers current props at equal version and accepts a later authoritative read", () => {
  const equal = { ...newer }, next = { ...newer, version: 3 };
  expect(selectKnowledgeSavedPage(equal, newer)).toBe(equal);
  expect(selectKnowledgeSavedPage(next, newer)).toBe(next);
  expect(selectKnowledgeSavedPage(original, null)).toBe(original);
 });
 it.each(["id", "user_id"] as const)("refuses an adopted page whose %s differs", key => {
  expect(selectKnowledgeSavedPage(original, { ...newer, [key]: "59000000-0000-4000-8000-000000000099" })).toBe(original);
 });
 it("adopts into the workspace so a freshly selected note sees v2 instead of parent v1", () => {
  const unrelated = { ...original, id: "59000000-0000-4000-8000-000000000007" }, before = dto([original, unrelated]);
  const after = adoptKnowledgeSavedPage(before, newer, owner)!;
  expect(after).not.toBe(before); expect(after.pages.find(page => page.id === original.id)).toBe(newer);
  expect(after.pages[1]).toBe(unrelated); expect(after.notebooks).toBe(before.notebooks); expect(after.refs).toBe(before.refs); expect(after.links).toBe(before.links);
  // Reader/discard receive this full saved row after the keyed editor unmounts.
  expect(selectKnowledgeSavedPage(after.pages[0]!, null)).toBe(newer);
  expect(before.pages[0]).toBe(original);
 });
 it("keeps equal/lower versions, absent rows, a different owner and closed no-data state unchanged", () => {
  const current = dto([newer]);
  for (const candidate of [original, { ...newer }, { ...newer, user_id: "foreign" }, { ...newer, id: "absent" }]) expect(adoptKnowledgeSavedPage(current, candidate, owner)).toBe(current);
  expect(adoptKnowledgeSavedPage(current, { ...newer, version: 3 }, "foreign")).toBe(current);
  expect(adoptKnowledgeSavedPage(null, newer, owner)).toBeNull();
 });
 it("never regresses the workspace when an older adoption completes later", () => {
  const v3 = { ...newer, version: 3 }, current = adoptKnowledgeSavedPage(dto(), v3, owner)!;
  expect(adoptKnowledgeSavedPage(current, newer, owner)).toBe(current); expect(current.pages[0]).toBe(v3);
 });
 it("retains adopted v2 when an already pending GET returns v1, without caching the rest of the DTO", () => {
  const known = adoptKnowledgeSavedPage(dto(), newer, owner)!, incoming = { ...dto(), revision: "next-read" };
  const after = mergeKnowledgeSavedPages(known, incoming, owner);
  expect(after.pages[0]).toBe(newer); expect(after.revision).toBe("next-read");
  expect(after.notebooks).toBe(incoming.notebooks); expect(after.refs).toBe(incoming.refs); expect(after.links).toBe(incoming.links); expect(after.targets).toBe(incoming.targets);
 });
 it("uses equal-version read metadata and later read versions, preserving the current props rule", () => {
  const equal = dto([{ ...newer }]), higher = dto([{ ...newer, version: 3 }]), known = dto([newer]);
  expect(mergeKnowledgeSavedPages(known, equal, owner)).toBe(equal);
  expect(mergeKnowledgeSavedPages(known, higher, owner)).toBe(higher);
  expect(mergeKnowledgeSavedPages(null, higher, owner)).toBe(higher);
 });
 it("never restores a missing row or transfers another owner's cached snapshot into a read", () => {
  const empty = dto([]), foreign = dto([{ ...newer, user_id: "foreign", version: 99 }]), incoming = dto();
  expect(mergeKnowledgeSavedPages(dto([newer]), empty, owner)).toBe(empty);
  expect(mergeKnowledgeSavedPages(foreign, incoming, owner)).toBe(incoming);
 });
 it("does not mutate snapshots or use temporary editable fields as confirmed content", () => {
  const before = structuredClone(original), saved = structuredClone(newer), current = dto();
  const after = adoptKnowledgeSavedPage(current, newer, owner)!;
  const draft = { title: "Rascunho não salvo", document: { type: "doc", content: [] }, version: 2 };
  expect(after.pages[0]).toBe(newer); expect(after.pages[0]!.title).not.toBe(draft.title);
  expect(original).toEqual(before); expect(newer).toEqual(saved); expect(current.pages[0]).toBe(original);
 });
});
