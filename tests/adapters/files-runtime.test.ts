import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ create: vi.fn(), rpc: vi.fn(), prepare: vi.fn(), staged: vi.fn(), upload: vi.fn(), signedUpload: vi.fn(), signedRead: vi.fn() }));
vi.mock("../../src/lib/auth/clients", () => ({ createPrivilegedClient: seams.create }));
vi.mock("../../src/adapters/db/files-processor", () => ({ prepararArquivo: seams.prepare }));
import { filesServicesForRequest, FINAL_BUCKET, STAGING_BUCKET } from "../../src/adapters/db/files-runtime";
const user = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002", session = "10000000-0000-4000-8000-000000000003";
const reservation = { id, user_id: user, kind: "capture_image", name: "Image.png", folder_id: null, staging_path: `${user}/${id}`, final_path: `${user}/${id}`, max_bytes: 1024, quota_bytes: 1024 ** 3, expires_at: new Date(Date.now() + 150_000).toISOString(), status: "processing", lease_id: session, lease_until: new Date(Date.now() + 30_000).toISOString(), file_id: null };
const prepared = { bytes: new Uint8Array([5, 4, 3, 2, 1]), mime: "image/png", name: "Image.png", width: 20, height: 40, sha256: "a".repeat(64) };
const config = { supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co" } as never, actor = { userId: user, sessionId: session } as never;
beforeEach(() => {
  vi.resetAllMocks(); seams.staged.mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null }); seams.upload.mockResolvedValue({ data: {}, error: null }); seams.prepare.mockResolvedValue(prepared);
  seams.signedUpload.mockResolvedValue({ data: { signedUrl: "temporary", token: "ephemeral" }, error: null });
  seams.rpc.mockImplementation(async (name, args) => ({ data: name === "file_upload_claim" ? { reservation, file: null } : name === "file_upload_complete" ? args.p_file : name === "file_upload_reserve" ? reservation : null, error: null }));
  seams.create.mockReturnValue({ rpc: seams.rpc, storage: { from: (bucket: string) => bucket === STAGING_BUCKET ? { download: seams.staged, createSignedUploadUrl: seams.signedUpload } : { upload: seams.upload, createSignedUrl: seams.signedRead } } });
});
describe("Server-only file pipeline", () => {
  it("only server validates bytes and publishes immutable final before atomic metadata", async () => {
    const result = await filesServicesForRequest(config, actor).finalize(id, "stable");
    expect(seams.prepare).toHaveBeenCalledWith("capture_image", "Image.png", new Uint8Array([1, 2, 3]), expect.anything());
    expect(seams.upload).toHaveBeenCalledWith(`${user}/${id}`, prepared.bytes, { contentType: "image/png", upsert: false, cacheControl: "0" });
    expect(result).toMatchObject({ id, user_id: user, mime: "image/png", bytes: 5, width: 20, height: 40 });
    for (const [, args] of seams.rpc.mock.calls) expect(args).toMatchObject({ p_user: user, p_session: session });
    expect(JSON.stringify(seams.rpc.mock.calls)).not.toMatch(/token|temporary|ephemeral/);
    expect(FINAL_BUCKET).toBe("second-brain-files");
  });
  it("does not publish invalid content, releases lease and cannot switch owner path", async () => {
    seams.prepare.mockRejectedValueOnce(new Error("decode")); await expect(filesServicesForRequest(config, actor).finalize(id, "stable")).rejects.toThrow("decode"); expect(seams.upload).not.toHaveBeenCalled(); expect(seams.rpc.mock.calls.some(([name]) => name === "file_upload_release")).toBe(true);
    seams.rpc.mockResolvedValueOnce({ data: { reservation: { ...reservation, final_path: `${session}/${id}` }, file: null }, error: null }); await expect(filesServicesForRequest(config, actor).finalize(id, "other")).rejects.toThrow("Reserva inválida");
  });
  it("expired/revoked claim never reads Storage and replay returns without reprocessing", async () => {
    seams.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } }); await expect(filesServicesForRequest(config, actor).finalize(id, "revoked")).rejects.toMatchObject({ code: "forbidden" }); expect(seams.staged).not.toHaveBeenCalled();
    const saved = { id, user_id: user, kind: "capture_image", name: "Image.png", mime: "image/png", bytes: 5, sha256: "a".repeat(64) }; seams.rpc.mockResolvedValueOnce({ data: { reservation: null, file: saved }, error: null }); expect(await filesServicesForRequest(config, actor).finalize(id, "same")).toEqual(saved); expect(seams.staged).not.toHaveBeenCalled();
  });
  it("reservation mints only owner staging capability, never final URL", async () => {
    const value = await filesServicesForRequest(config, actor).reserve("capture_image", "Image.png", null, "stable"); expect(value).toMatchObject({ id, token: "ephemeral" }); expect(seams.signedUpload).toHaveBeenCalledWith(`${user}/${id}`, { upsert: false }); expect(seams.upload).not.toHaveBeenCalled();
  });
});
