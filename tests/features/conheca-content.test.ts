import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const pasta = path.resolve("src/components/features/conheca");
const conteudo = readFileSync(path.join(pasta, "content.ts"), "utf8");
const pagina = readFileSync(path.join(pasta, "landing-page.tsx"), "utf8");
// Somente o texto publicado: comentários podem nomear o que permanece de fora.
const publicado = conteudo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const usadas = [...conteudo.matchAll(/from "\.\/telas\/([^"/]+\.webp)"/g)].map(match => match[1]!);
// Retidas para rastreabilidade; sem import/bundle e sem exclusão neste lote.
// Closed Gallery contract: exact two scenes × two themes × two formats.
const galleryVariants = ["calendario-lista", "tarefas-kanban"].flatMap(scene => ["light", "dark"].flatMap(theme => [false, true].map(mobile => ({
  file: scene + (mobile ? "-celular" : "") + (theme === "dark" ? "-escuro" : "") + ".webp",
  scene, theme, mobile,
  route: scene === "calendario-lista" ? "/calendario?view=list&date=2026-09-23" : "/tarefas",
}))));
const historicas = ["capturar", "inicio", "projeto"].flatMap(cena => [cena + ".webp", cena + "-escuro.webp", cena + "-celular.webp", cena + "-celular-escuro.webp"]);
const aposentadas = ["busca", "cofre", "financeiro", "habitos"].flatMap(cena => [cena + ".webp", cena + "-escuro.webp", cena + "-celular.webp", cena + "-celular-escuro.webp"])
  .concat(["inicio-celular-dia.webp", "inicio-celular-dia-escuro.webp"]);

describe("conteúdo da apresentação /conheca", () => {
  it("preserva a fronteira não comercial e não promete recursos fora do MVP", () => {
    for (const proibido of [/\bDrive\b/, /intelig[eê]ncia artificial/i, /\bIA\b/, /\bpre[çc]os?\b/i, /\bassinatura\b/i, /\bcheckout\b/i, /\bdesconto\b/i, /\bgr[aá]tis\b/i, /\bgarantia\b/i, /\bcupom\b/i, /\bofflines?\b/i]) {
      expect(publicado, String(proibido)).not.toMatch(proibido);
    }
    expect(conteudo).toContain('tipo: "aviso"');
    expect(conteudo).toContain("O acesso ainda não está aberto ao público.");
    expect(pagina).toContain('href="/entrar" prefetch={false}');
    expect(pagina).toContain("<LegalLinks />");
  });

  it("apresenta somente Captura, Agenda e Projetos com âncoras únicas e prévia Kanban", () => {
    const ids = [...conteudo.matchAll(/^\s{6}id: "([a-z-]+)",$/gm)].map(match => match[1]);
    expect(ids).toEqual(["captura", "agenda", "projetos"]);
    expect(new Set(ids).size).toBe(3);
    expect(pagina).toContain('<ProjectPreview');
    expect(pagina).toContain('kanban={<ProductShot tela={previaKanban}');
    expect(pagina).not.toMatch(/id="(?:dispersao|conexoes)"/);
    expect(conteudo).toContain("Cofre cifrado no navegador");
    expect(conteudo).toContain("Painel administrativo sem conteúdo");
    expect(conteudo).toContain("Agenda somente leitura");
    expect(conteudo).toContain("financeiro e Cofre no mesmo espaço pessoal");
  });

  it("mantém indexação fechada, demonstração declarada e hero prioritária", () => {
    expect(conteudo).toMatch(/export const INDEXACAO_PUBLICA = false;/);
    expect(conteudo).toContain("modo demonstração, com dados fictícios");
    expect(pagina).toContain('tela={hero.tela} sizes={larguraUtil} priority');
  });

  it("usa vinte variantes reais; as dezoito anteriores sem uso permanecem inventariadas", async () => {
    const telas = readdirSync(path.join(pasta, "telas")).filter(nome => nome.endsWith(".webp"));
    expect(usadas).toHaveLength(20); expect(new Set(usadas).size).toBe(20);
    expect(aposentadas).toHaveLength(18);
    expect(telas.slice().sort()).toEqual([...usadas, ...aposentadas].sort());
    for (const nome of usadas) {
      const { exif, width, height } = await sharp(path.join(pasta, "telas", nome)).metadata();
      expect(width, nome).toBeGreaterThan(0); expect(height, nome).toBeGreaterThan(0);
      const origem = exif?.toString("latin1") ?? "";
      const registro = JSON.parse(readFileSync(path.join(pasta, "telas", nome + ".json"), "utf8"));
      const gallery = galleryVariants.find(variant => variant.file === nome);
      if (gallery) {
        expect(registro.capture, nome).toMatchObject({ version: 1, mode: "demo", scene: gallery.scene, route: gallery.route, theme: gallery.theme, density: gallery.mobile ? 3 : 2 });
        expect(registro.capture.source.sha, nome).toMatch(/^[a-f0-9]{40}$/);
        const description = `Segundo Cerebro | real demo capture | ${gallery.scene} | ${gallery.theme} | ${gallery.mobile ? "mobile" : "desktop"} | Source ${registro.capture.source.sha}`;
        expect(origem, nome).toContain(description);
      } else {
        expect(historicas, nome).toContain(nome);
        expect(origem, nome).toContain("captura real"); expect(origem, nome).toContain("modo demonstra");
      }
      expect(registro.prompt, nome).toContain("captura real");
    }
  });
});
