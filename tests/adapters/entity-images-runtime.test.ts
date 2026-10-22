import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn() }));
vi.mock("../../src/lib/auth/clients", () => ({ createPrivilegedClient: seams.create }));
import { entityImagesForRequest } from "../../src/adapters/db/entity-images-runtime";
import { FilesCommitUnknown } from "../../src/adapters/db/files-store";
import type { SetEntityImage } from "../../src/core/drive/entity-images";
const user = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002";
const config = {} as never, actor = { userId: user, sessionId: id } as never;
const input: SetEntityImage = { version: 1, purpose: "project_cover", entity_id: id, file_id: id, expected_file_id: null, client_id: "same" };
const binding = { version: 1, user_id: user, id, purpose: "project_cover", file_id: id };
beforeEach(() => { vi.resetAllMocks(); seams.create.mockReturnValue({ rpc: seams.rpc }); });
describe("Entity image RPC ACK and isolation", () => {
  it("binds actor/session outside the client DTO and reuses the complete intention", async () => {
    seams.rpc.mockResolvedValue({ data: binding, error: null });
    const service = entityImagesForRequest(config, actor);
    expect(await service.set(input)).toEqual(binding); expect(await service.set(input)).toEqual(binding);
    expect(seams.rpc).toHaveBeenNthCalledWith(1, "file_entity_image_set", { p_user: user, p_session: id, p_request: input });
  });
  it.each([null, { ...binding, user_id: id }, { ...binding, id: user }, { ...binding, purpose: "home_focus_image" }, { ...binding, file_id: "-".repeat(36) }, { ...binding, file_id: user }, { ...binding, file_id: null }, { ...binding, version: 2 }, { version: 1, user_id: user, id }])("keeps malformed post-commit ACK uncertain %#", async data => {
    seams.rpc.mockResolvedValue({ data, error: null }); await expect(entityImagesForRequest(config, actor).set(input)).rejects.toBeInstanceOf(FilesCommitUnknown);
  });
  it("keeps malformed GET as a read failure", async () => {
    seams.rpc.mockResolvedValue({ data: null, error: null }); await expect(entityImagesForRequest(config, actor).get("project_cover", id)).rejects.not.toBeInstanceOf(FilesCommitUnknown);
  });
  it("distinguishes authoritative veto, CAS conflict and unknown transport", async () => {
    const service = entityImagesForRequest(config, actor);
    for (const [code, expected] of [["42501", "forbidden"], ["40001", "CONFLICT"], ["23505", "CONFLICT"]]) { seams.rpc.mockResolvedValueOnce({ data: null, error: { code } }); await expect(service.set(input)).rejects.toMatchObject({ code: expected }); }
    seams.rpc.mockRejectedValueOnce(new Error("lost reply")); await expect(service.set(input)).rejects.toBeInstanceOf(FilesCommitUnknown);
  });
});
