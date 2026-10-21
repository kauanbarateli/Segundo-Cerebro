import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageApiError } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ create: vi.fn(), rpc: vi.fn(), bucket: vi.fn(), info: vi.fn(), from: vi.fn() }));
vi.mock("../../src/lib/auth/clients", () => ({ createPrivilegedClient: seams.create }));
import { imageUploadObservationForRequest } from "../../src/adapters/db/image-upload-observation-runtime";
const user = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002", session = "10000000-0000-4000-8000-000000000003", bucket = "second-brain-staging";
const config = { supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co" } as never, actor = { userId: user, sessionId: session } as never;
const snapshot = { version: 1, user_id: user, upload_id: id, kind: "project_cover", status: "reserved", observed_at: "2026-10-21T00:00:00+00:00", expires_at: "2026-10-21T01:00:00+00:00", processing: false, file: null };
const file = { id, user_id: user, kind: "project_cover", folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 3, sha256: "a".repeat(64), width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: snapshot.observed_at, updated_at: snapshot.observed_at, modified_at: snapshot.observed_at };
const present = { data: { id: session, name: `${user}/${id}`, bucketId: bucket }, error: null };
const observe = () => imageUploadObservationForRequest(config, actor).observe(id, "project_cover", "original-reservation");
const missing = (statusCode = "404") => ({ data: null, error: new StorageApiError("synthetic", 404, statusCode, "storage", "NoSuchKey") });
beforeEach(() => {
  vi.resetAllMocks(); seams.rpc.mockResolvedValue({ data: snapshot, error: null }); seams.bucket.mockResolvedValue({ data: { id: bucket, name: bucket, public: false }, error: null }); seams.info.mockResolvedValue(present); seams.from.mockReturnValue({ info: seams.info });
  seams.create.mockReturnValue({ rpc: seams.rpc, storage: { getBucket: seams.bucket, from: seams.from } });
});
describe("Read-only image upload observation", () => {
  it("binds exact RPC actor/session/purpose/client and server-built Storage namespace, then rechecks", async () => {
    expect(await observe()).toEqual({ version: 1, user_id: user, upload_id: id, purpose: "project_cover", state: "staging", file: null });
    expect(seams.rpc).toHaveBeenCalledTimes(2);
    for (const call of seams.rpc.mock.calls) expect(call).toEqual(["file_entity_image_upload_observe", { p_user: user, p_session: session, p_upload: id, p_kind: "project_cover", p_client_id: "original-reservation" }]);
    expect(seams.bucket).toHaveBeenCalledWith(bucket); expect(seams.from).toHaveBeenCalledWith(bucket); expect(seams.info).toHaveBeenCalledWith(`${user}/${id}`);
    expect(seams.rpc.mock.invocationCallOrder[0]).toBeLessThan(seams.bucket.mock.invocationCallOrder[0]!); expect(seams.info.mock.invocationCallOrder[0]).toBeLessThan(seams.rpc.mock.invocationCallOrder[1]!);
  });
  it.each(["404", "NoSuchKey"])("only qualifies structured HTTP404/NoSuchKey, not statusCode alone (%s)", async statusCode => {
    seams.info.mockResolvedValue(missing(statusCode)); expect((await observe()).state).toBe("missing-observed"); expect(seams.rpc).toHaveBeenCalledTimes(2);
  });
  it.each([
    new StorageApiError("not found", 404, "404"), new StorageApiError("bucket", 404, "404", "storage", "NoSuchBucket"), new StorageApiError("legacy", 404, "404", "storage", "not_found"),
    new StorageApiError("denied", 403, "403", "storage", "NoSuchKey"), new StorageApiError("unavailable", 503, "503", "storage", "NoSuchKey"), { status: 404, code: "NoSuchKey" }, new Error("network"),
  ])("keeps generic/permission/legacy/unavailable Storage errors indeterminate %#", async error => {
    seams.info.mockResolvedValue({ data: null, error }); expect((await observe()).state).toBe("indeterminate"); expect(seams.rpc).toHaveBeenCalledTimes(2);
  });
  it("keeps thrown transport and missing data indeterminate", async () => {
    seams.info.mockRejectedValueOnce(new Error("network")); expect((await observe()).state).toBe("indeterminate");
    seams.info.mockResolvedValueOnce({ data: null, error: null }); expect((await observe()).state).toBe("indeterminate");
  });
  it.each([{ id: "wrong", name: bucket, public: false }, { id: bucket, name: "wrong", public: false }, { id: bucket, name: bucket, public: true }, null])("does not infer absence without the qualified private bucket %#", async data => {
    seams.bucket.mockResolvedValue({ data, error: null }); seams.info.mockResolvedValue(missing()); expect((await observe()).state).toBe("indeterminate"); expect(seams.info).not.toHaveBeenCalled();
  });
  it.each([{ ...present.data, name: `${session}/${id}` }, { ...present.data, bucketId: "second-brain-files" }])("rejects a substituted Storage namespace %#", async data => {
    seams.info.mockResolvedValue({ data, error: null }); expect((await observe()).state).toBe("indeterminate");
  });
  it("rechecks a veto/session revocation after external IO before returning absence", async () => {
    seams.rpc.mockResolvedValueOnce({ data: snapshot, error: null }).mockResolvedValueOnce({ data: null, error: { code: "42501" } }); seams.info.mockResolvedValue(missing());
    await expect(observe()).rejects.toMatchObject({ code: "forbidden" });
  });
  it("concurrent finalization wins over an observed absence without settling a receipt", async () => {
    seams.rpc.mockResolvedValueOnce({ data: snapshot, error: null }).mockResolvedValueOnce({ data: { ...snapshot, status: "finalized", file }, error: null }); seams.info.mockResolvedValue(missing());
    expect(await observe()).toEqual({ version: 1, user_id: user, upload_id: id, purpose: "project_cover", state: "final", file });
    expect(seams.rpc.mock.calls.every(([name]) => name === "file_entity_image_upload_observe")).toBe(true);
  });
  it("returns an active final file after reservation expiry without Storage or renewal", async () => {
    seams.rpc.mockResolvedValue({ data: { ...snapshot, expires_at: "2026-10-20T00:00:00Z", status: "finalized", file }, error: null });
    expect((await observe()).state).toBe("final"); expect(seams.bucket).not.toHaveBeenCalled(); expect(seams.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([{ status: "processing", processing: true }, { status: "processing", processing: false }, { status: "expired" }, { expires_at: snapshot.observed_at }])("never considers processing/expired reservations free %#", async delta => {
    seams.rpc.mockResolvedValue({ data: { ...snapshot, ...delta }, error: null }); expect((await observe()).state).toBe("indeterminate"); expect(seams.bucket).not.toHaveBeenCalled();
  });
  it("a lease acquired during Storage IO remains indeterminate", async () => {
    seams.rpc.mockResolvedValueOnce({ data: snapshot, error: null }).mockResolvedValueOnce({ data: { ...snapshot, status: "processing", processing: false }, error: null }); seams.info.mockResolvedValue(missing());
    expect((await observe()).state).toBe("indeterminate");
  });
  it.each([{ status: ["reserved"] }, { user_id: session }, { upload_id: session }, { kind: "home_focus_image" }, { version: 2 }, { processing: true }, { lease_id: session }, { observed_at: "10/11/2026" }, { file }, { status: "finalized", file: { ...file, modified_at: "10/11/2026" } }, { status: "finalized", file: { ...file, deleted_at: snapshot.observed_at } }])("rejects malformed or cross-intent RPC envelopes %#", async delta => {
    seams.rpc.mockResolvedValue({ data: { ...snapshot, ...delta }, error: null }); await expect(observe()).rejects.toMatchObject({ code: "unavailable" }); expect(seams.info).not.toHaveBeenCalled();
  });
});
