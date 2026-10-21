import { describe, expect, it } from "vitest";
import { decodeEntityImage, FILE_FEATURES, isFileKind, validateEntityImageFile } from "../../src/core/drive/entity-images";
import { validarEntradaArquivo, type Arquivo } from "../../src/core/drive";
const user = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002";
const input = { version: 1, purpose: "project_cover", entity_id: id, file_id: id, expected_file_id: null, client_id: "same-intention" };
const file: Arquivo = { id, user_id: user, kind: "project_cover", name: "Capa.jpg", folder_id: null, mime: "image/jpeg", bytes: 100, width: 1200, height: 600, sha256: "a".repeat(64), starred: false, deleted_at: null, deletion_batch_id: null, created_at: "2026-10-21T05:00:00Z", updated_at: "2026-10-21T05:00:00Z", modified_at: "2026-10-21T05:00:00Z" };
describe("SPEC-08 image authority v1", () => {
  it("keeps every purpose separate from visibility and Drive", () => {
    expect(FILE_FEATURES).toMatchObject({ project_cover: "projetos", habit_image: "habitos", finance_goal_image: "financeiro", home_focus_image: "inicio", avatar: "configuracoes" });
    for (const unknown of [null, "__proto__", "constructor", "settings", "arbitrary", {}]) expect(isFileKind(unknown)).toBe(false);
  });
  it("accepts removal and old-link CAS, cloning the closed DTO", () => {
    const decoded = decodeEntityImage(input); expect(decoded).toEqual(input); expect(decoded).not.toBe(input);
    expect(decodeEntityImage({ ...input, file_id: null, expected_file_id: id }).file_id).toBeNull();
    const upper = "ABCDEF00-ABCD-4000-8000-ABCDEF123456";
    expect(decodeEntityImage({ ...input, entity_id: upper, file_id: upper, expected_file_id: upper })).toMatchObject({ entity_id: upper.toLowerCase(), file_id: upper.toLowerCase(), expected_file_id: upper.toLowerCase() });
  });
  it.each([{ ...input, feature: "configuracoes" }, { ...input, user_id: user }, { ...input, purpose: "habit_image" }, { ...input, version: 2 }, { ...input, expected_file_id: undefined }, { ...input, entity_id: "foreign" }, { ...input, file_id: "https://example.invalid/photo" }, { ...input, client_id: " " }])("rejects owner/authority injection and incomplete CAS %#", value => expect(() => decodeEntityImage(value)).toThrow());
  it.each([{ ...file, user_id: id }, { ...file, kind: "avatar" }, { ...file, deleted_at: file.created_at }, { ...file, width: 6000, height: 5000 }, { ...file, bytes: 8 * 1024 * 1024 + 1 }, { ...file, folder_id: id }, { ...file, mime: "image/svg+xml" }])("rejects foreign/wrong-purpose/inactive file metadata %#", value => expect(() => validateEntityImageFile(value as Arquivo, user, "project_cover")).toThrow());
  it("reuses byte sniffing and image limits for all four purposes", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    for (const purpose of ["project_cover", "habit_image", "finance_goal_image", "home_focus_image"] as const) expect(validarEntradaArquivo(purpose, "Capa.jpg", bytes, 8 * 1024 * 1024)).toBe("image/jpeg");
    expect(() => validarEntradaArquivo("project_cover", "Texto.txt", new TextEncoder().encode("texto"), 1000)).toThrow("imagem");
    expect(() => validateEntityImageFile(file, user, "project_cover")).not.toThrow();
  });
});
