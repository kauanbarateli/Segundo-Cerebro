import { describe, expect, it, vi } from "vitest";
import { uploadFile } from "../../src/components/layout/file-upload";
import { LOCAL_STORAGE_ORIGIN, PERSONAL_STORAGE_ORIGIN, type StorageOrigin } from "../../src/lib/files/storage-origin";

const userId = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002", token = "ephemeral-capability";
const path = `/storage/v1/object/upload/sign/second-brain-staging/${userId}/${id}`;
const reservation = (origin = LOCAL_STORAGE_ORIGIN) => ({ id, token, upload_url: `${origin}${path}?token=${token}`, expires_at: new Date(Date.now() + 150000).toISOString() });
const pdf = () => new File(["%PDF-1.7\nowned-bytes"], "documento.pdf", { type: "application/pdf" });
const saved = { id, user_id: userId, kind: "drive", name: "documento.pdf", mime: "application/pdf", bytes: 20 };

describe("Upload conectado usa a origem confiável e uma capacidade efêmera", () => {
  it("usa os mesmos bytes e política sem cookies/Authorization/apikey no PUT local", async () => {
    // HTTP and the finalize reply are explicit doubles; no connected GUI claim.
    const file = pdf(), fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(reservation())).mockResolvedValueOnce(Response.json({})), sender = vi.fn(async () => saved);
    await expect(uploadFile({ file, kind: "drive", userId, storageOrigin: LOCAL_STORAGE_ORIGIN, sender, fetcher, clientId: "stable" })).resolves.toEqual(saved);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: "same-origin", redirect: "error", headers: { "X-Expected-User-ID": userId } });
    const [destination, request] = fetcher.mock.calls[1]!;
    expect(destination).toBe(reservation().upload_url); expect(request).toMatchObject({ method: "PUT", credentials: "omit", redirect: "error", headers: { "x-upsert": "false" } });
    const headers = new Headers(request?.headers); expect(headers.has("authorization")).toBe(false); expect(headers.has("apikey")).toBe(false); expect(headers.has("cookie")).toBe(false);
    const body = request?.body as FormData, bytes = body.get("") as File;
    expect([...body.keys()]).toEqual(["cacheControl", ""]); expect(body.get("cacheControl")).toBe("0"); expect(await bytes.text()).toBe(await file.text()); expect(bytes.size).toBe(file.size);
    expect(sender).toHaveBeenCalledWith("file.upload.finalize", { upload_id: id, client_id: "stable" }); expect(JSON.stringify(sender.mock.calls)).not.toMatch(/ephemeral|token|upload_url|sb_secret/);
  });
  it("sem origem explícita preserva o destino pessoal e não aceita loopback da resposta", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(reservation())), sender = vi.fn();
    await expect(uploadFile({ file: pdf(), kind: "drive", userId, sender, fetcher })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockReset().mockResolvedValueOnce(Response.json(reservation(PERSONAL_STORAGE_ORIGIN))).mockResolvedValueOnce(Response.json({})); sender.mockResolvedValue(saved);
    await expect(uploadFile({ file: pdf(), kind: "drive", userId, sender, fetcher })).resolves.toEqual(saved);
  });
  it.each([
    `https://foreign.invalid${path}?token=${token}`,
    `${PERSONAL_STORAGE_ORIGIN}${path}?token=${token}`,
    `http://localhost:54321${path}?token=${token}`,
    `http://2130706433:54321${path}?token=${token}`,
    `http://user@127.0.0.1:54321${path}?token=${token}`,
    `${LOCAL_STORAGE_ORIGIN}${path}?token=${token}#fragment`,
    `${LOCAL_STORAGE_ORIGIN}${path}?token=${token}&token=${token}`,
    `${LOCAL_STORAGE_ORIGIN}${path}?token=${token}&download=1`,
    `${LOCAL_STORAGE_ORIGIN}${path.replace(userId, id)}?token=${token}`,
    `${LOCAL_STORAGE_ORIGIN}${path.replace("second-brain-staging", "second-brain-files")}?token=${token}`,
    `${LOCAL_STORAGE_ORIGIN}${path.replace("/" + userId, "%2F" + userId)}?token=${token}`,
    `${LOCAL_STORAGE_ORIGIN}${path}?token=foreign-capability`,
  ])("recusa endereço/capacidade trocado antes de transmitir bytes (%#)", async upload_url => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ...reservation(), upload_url })), sender = vi.fn();
    await expect(uploadFile({ file: pdf(), kind: "drive", userId, storageOrigin: LOCAL_STORAGE_ORIGIN, sender, fetcher })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); expect(fetcher).toHaveBeenCalledTimes(1); expect(sender).not.toHaveBeenCalled();
  });
  it("recusa origem inválida injetada antes de qualquer reserva", async () => {
    const fetcher = vi.fn<typeof fetch>(), sender = vi.fn();
    await expect(uploadFile({ file: pdf(), kind: "drive", userId, storageOrigin: "https://foreign.invalid" as StorageOrigin, sender, fetcher })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("não finaliza após uma resposta de PUT redirecionada", async () => {
    const redirected = Response.json({}); Object.defineProperty(redirected, "redirected", { value: true });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(reservation())).mockResolvedValueOnce(redirected), sender = vi.fn();
    await expect(uploadFile({ file: pdf(), kind: "drive", userId, storageOrigin: LOCAL_STORAGE_ORIGIN, sender, fetcher })).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(sender).not.toHaveBeenCalled();
  });
});
