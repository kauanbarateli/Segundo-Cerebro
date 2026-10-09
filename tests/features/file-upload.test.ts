import { describe, expect, it, vi } from "vitest";
import { fileReadUrl, uploadFile } from "../../src/components/layout/file-upload";
const userId = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002", origin = "https://rishenjoikgmfubmnfiu.supabase.co";
const reservation = { id, upload_url: `${origin}/storage/v1/object/upload/sign/second-brain-staging/${userId}/${id}?token=ephemeral`, token: "ephemeral", expires_at: new Date(Date.now() + 150_000).toISOString() };
const result = { id, user_id: userId, kind: "capture_image", name: "foto.png", mime: "image/png", bytes: 10, width: 20, height: 20 };
const file = () => new File([new Uint8Array([1, 2, 3])], "foto.png", { type: "image/png" });
describe("Pipeline de upload compartilhado", () => {
  it("reserva cookie-only, envia sem credenciais e journal contém só identificadores", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(reservation)).mockResolvedValueOnce(Response.json({})); const sender = vi.fn(async () => result), phase = vi.fn();
    expect(await uploadFile({ file: file(), kind: "capture_image", userId, sender, fetcher, clientId: "stable", onPhase: phase })).toEqual(result);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: "same-origin", headers: { "X-Expected-User-ID": userId } });
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: "PUT", credentials: "omit", headers: { "x-upsert": "false" } });
    expect(sender).toHaveBeenCalledWith("file.upload.finalize", { upload_id: id, client_id: "stable" }); expect(JSON.stringify(sender.mock.calls)).not.toMatch(/ephemeral|token|upload_url/);
    expect(phase.mock.calls.flat()).toEqual(["reserving", "uploading", "validating"]);
    expect(fileReadUrl(id, userId, true)).toBe(`/api/files/read?id=${id}&user=${userId}&download=1`);
  });
  it.each([`${origin}/storage/v1/object/upload/sign/second-brain-files/${userId}/${id}?token=ephemeral`, `https://evil.invalid/storage/v1/object/upload/sign/second-brain-staging/${userId}/${id}?token=ephemeral`, `${origin}/storage/v1/object/upload/sign/second-brain-staging/${id}/${id}?token=ephemeral`])("recusa destino trocado antes de enviar arquivo", async upload_url => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ...reservation, upload_url })), sender = vi.fn();
    await expect(uploadFile({ file: file(), kind: "capture_image", userId, sender, fetcher })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); expect(fetcher).toHaveBeenCalledTimes(1); expect(sender).not.toHaveBeenCalled();
  });
  it("não confirma staging falho e preserva resultado incerto do journal", async () => {
    const sender = vi.fn(async () => { throw { outcomeUnknown: true, code: "COMMIT_UNKNOWN" }; }), fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(reservation)).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(uploadFile({ file: file(), kind: "capture_image", userId, sender, fetcher })).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(sender).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(Response.json(reservation)).mockResolvedValueOnce(Response.json({})); await expect(uploadFile({ file: file(), kind: "capture_image", userId, sender, fetcher })).rejects.toMatchObject({ outcomeUnknown: true });
  });
});
