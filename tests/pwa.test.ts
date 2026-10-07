import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import manifest from "../src/app/manifest";
import assets from "../design-system/pwa-assets.json";
import tokens from "../design-system/tokens/tokens.json";

it("manifest mantém rotas próprias, tamanhos instaláveis e cores vindas dos tokens", () => {
  const value = manifest();
  expect(value).toMatchObject({ id: "/", scope: "/", start_url: "/", display: "standalone", background_color: tokens.color.light.canvas });
  expect(value.icons?.filter((icon) => icon.purpose === "maskable").map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
  expect(value.shortcuts?.map((shortcut) => shortcut.url)).toEqual(["/capturar", "/tarefas", "/financeiro"]);
  expect(value.share_target).toMatchObject({ action: "/compartilhar/receber", method: "POST", enctype: "multipart/form-data" });
});

it("ícones e splash têm proveniência verificável, dimensões e conteúdo íntegros", async () => {
  for (const asset of assets.assets) {
    const buffer = await readFile(new URL(`../${asset.path}`, import.meta.url));
    expect(buffer.subarray(1, 4).toString()).toBe("PNG");
    expect(buffer.readUInt32BE(16)).toBe(asset.width);
    expect(buffer.readUInt32BE(20)).toBe(asset.height);
    expect(createHash("sha256").update(buffer).digest("hex")).toBe(asset.sha256);
  }
  expect(assets.startupImages.some((image) => image.media.includes("prefers-color-scheme: dark"))).toBe(true);
});
