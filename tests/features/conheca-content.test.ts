import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const pasta = path.resolve("src/components/features/conheca");
const conteudo = readFileSync(path.join(pasta, "content.ts"), "utf8");
// Somente o texto publicado: comentários do módulo podem citar o que fica de fora.
const publicado = conteudo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const telas = readdirSync(path.join(pasta, "telas")).filter((nome) => nome.endsWith(".webp"));

describe("conteúdo da apresentação /conheca", () => {
  it("não promete funcionalidades fora do MVP nem condições comerciais", () => {
    // D-032 retirou o Drive; IA, cobrança e ofertas não existem no produto atual.
    for (const proibido of [/\bDrive\b/, /intelig[eê]ncia artificial/i, /\bIA\b/, /\bpre[çc]os?\b/i, /\bassinatura\b/i, /\bcheckout\b/i, /\bdesconto\b/i, /\bgr[aá]tis\b/i, /\bgarantia\b/i, /\bcupom\b/i, /\bofflines?\b/i, /\bkanban\b/i]) {
      expect(publicado, String(proibido)).not.toMatch(proibido);
    }
  });

  it("apresenta seis perguntas com âncoras únicas", () => {
    const ids = [...conteudo.matchAll(/^\s{6}id: "([a-z-]+)",$/gm)].map((match) => match[1]);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it("mantém a página fora dos buscadores até a decisão de domínio e oferta", () => {
    expect(conteudo).toMatch(/export const INDEXACAO_PUBLICA = false;/);
  });

  it("usa todas as capturas e cada uma declara a própria origem", async () => {
    expect(telas.length).toBeGreaterThan(0);
    for (const nome of telas) {
      expect(conteudo, nome).toContain(`./telas/${nome}`);
      const { exif } = await sharp(path.join(pasta, "telas", nome)).metadata();
      expect(exif?.toString("latin1") ?? "", nome).toContain("captura real do modo demonstra");
    }
  });
});
