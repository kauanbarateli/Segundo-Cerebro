import { describe, expect, it } from "vitest";
import { parseKnowledgeImage } from "../../src/adapters/db/knowledge-images";
const owner = "10000000-0000-4000-8000-000000000001", page = "10000000-0000-4000-8000-000000000002", file = "10000000-0000-4000-8000-000000000003";
const metadata = () => ({ version: 1, user_id: owner, page_id: page, storage_path: `${owner}/${file}`, file: { id: file, user_id: owner, kind: "capture_image", name: "Imagem.png", mime: "image/png", bytes: 45, sha256: "a".repeat(64), deleted_at: null } });
describe("page-bound private image metadata", () => {
  it("uses page/owner/file facts and yields only a storage path and label", () => { expect(parseKnowledgeImage(metadata(), owner, page, file)).toEqual({ storage_path: `${owner}/${file}`, name: "Imagem.png" }); });
  it.each([
    { user_id: page }, { page_id: file }, { version: 2 }, { storage_path: `other/${file}` }, { url: "https://private-canary.invalid" },
    { file: { ...metadata().file, kind: "drive" } }, { file: { ...metadata().file, user_id: page } }, { file: { ...metadata().file, id: page } },
    { file: { ...metadata().file, mime: "text/html" } }, { file: { ...metadata().file, deleted_at: "2026-10-22T12:00:00Z" } },
  ])("refuses a mismatched scope or file purpose %#", delta => { expect(() => parseKnowledgeImage({ ...metadata(), ...delta }, owner, page, file)).toThrow(); });
});
