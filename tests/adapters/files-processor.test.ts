import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import sharp from "sharp";
import { prepararArquivo } from "../../src/adapters/db/files-processor";
const policy = { quota_bytes: 1024 ** 3, drive_max_bytes: 25 * 1024 ** 2, image_max_bytes: 8 * 1024 ** 2, max_pixels: 24_000_000, lease_seconds: 300 };
describe("Imagens preparadas no servidor", () => {
  it("mede e recodifica JPEG removendo EXIF e girando orientação", async () => {
    const input = await sharp({ create: { width: 60, height: 40, channels: 3, background: "#123456" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await prepararArquivo("capture_image", "foto-declarada.png", input, policy), metadata = await sharp(result.bytes).metadata();
    expect(result).toMatchObject({ mime: "image/jpeg", name: "foto-declarada.jpg", width: 40, height: 60 }); expect(result.sha256).toMatch(/^[a-f0-9]{64}$/); expect(metadata.exif).toBeUndefined(); expect(metadata.orientation).toBeUndefined();
  });
  it("avatar reduz para 512 e recodifica PNG como JPEG", async () => {
    const input = await sharp({ create: { width: 800, height: 600, channels: 4, background: "#abcdef" } }).png().toBuffer();
    const result = await prepararArquivo("avatar", "avatar.png", input, policy); expect(result).toMatchObject({ name: "avatar.jpg", mime: "image/jpeg", width: 512, height: 512 });
  });
  it("assinatura válida sem imagem decodificável, excesso real e pixels demais são recusados", async () => {
    await expect(prepararArquivo("capture_image", "fake.png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), policy)).rejects.toThrow();
    const input = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).png().toBuffer();
    await expect(prepararArquivo("capture_image", "image.png", input, { ...policy, image_max_bytes: 8 })).rejects.toThrow("limite");
    await expect(prepararArquivo("capture_image", "image.png", input, { ...policy, max_pixels: 399 })).rejects.toThrow();
  });
});
