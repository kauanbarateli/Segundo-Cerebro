import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import tokens from "../design-system/tokens/tokens.json";
import { backgrounds, contrastRatio, findRawValues, renderTokensCss, textColors, validateTokens } from "../design-system/validate.mjs";

describe("contrato DS 2.1", () => {
  it("aprova o dataset completo e mede cada texto nos quatro fundos dos dois temas", async () => {
    const css = await readFile("design-system/tokens/tokens.css", "utf8");
    const result = validateTokens(tokens, css);
    expect(result.failures).toEqual([]);
    for (const theme of ["light", "dark"]) {
      for (const foreground of textColors) {
        for (const background of backgrounds) {
          expect(result.measurements.find((item) => item.theme === theme && item.foreground === foreground && item.background === background)).toMatchObject({ floor: 4.5, ratio: expect.any(Number) });
        }
      }
    }
    expect(result.measurements.every((item) => item.ratio >= item.floor)).toBe(true);
  });

  it("reprova contraste sabotado mesmo com CSS regenerado", () => {
    const sabotaged = structuredClone(tokens);
    sabotaged.color.light["work-ink"] = sabotaged.color.light["surface-hover"];
    const result = validateTokens(sabotaged, renderTokensCss(sabotaged));
    expect(result.failures).toContainEqual(expect.stringContaining("contraste abaixo de 4.5:1: light.work-ink"));
    expect(result.failures.some((failure) => failure.includes("JSON/CSS"))).toBe(false);
  });

  it("reprova divergência do CSS mesmo quando o JSON mantém contraste", () => {
    const css = renderTokensCss(tokens).replace("--ink: #161613", "--ink: #ffffff");
    expect(validateTokens(tokens, css).failures).toContainEqual(expect.stringContaining("divergência JSON/CSS"));
  });

  it("reprova exclusão de um papel semântico obrigatório", () => {
    const incomplete = structuredClone(tokens);
    Reflect.deleteProperty(incomplete.color.dark, "fin-ink");
    expect(validateTokens(incomplete, "").failures).toContain("token ausente/inválido: color.dark.fin-ink");
  });

  it("usa a fórmula WCAG e não arredonda o limite de aprovação", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    const sabotaged = structuredClone(tokens);
    sabotaged.color.light["success-ink"] = "#12775a";
    expect(validateTokens(sabotaged, renderTokensCss(sabotaged)).failures).toContainEqual(expect.stringContaining("4.455:1"));
  });

  it.each(["calc(8px)", "var(--missing)", "invalid", "NaNpx", "Infinitypx", "1e309px", "16", "16rem", "15.999px", "-16px"])("recusa piso de campo/editor inválido: %s", (value) => {
    for (const role of ["campo", "editor"] as const) {
      const sabotaged = structuredClone(tokens);
      sabotaged.typography.scale[role].fontSize = value;
      expect(validateTokens(sabotaged, renderTokensCss(sabotaged)).failures).toContainEqual(expect.stringContaining(`${role}: tamanho inválido ou abaixo do piso de 16px`));
    }
  });

  it.each(["calc(20px)", "var(--target)", "invalid", "NaNpx", "Infinitypx", "1e309px", "44", "44%", "43.999px", "-44px"])("recusa alvo inválido: %s", (value) => {
    const sabotaged = structuredClone(tokens);
    sabotaged.control.target = value;
    expect(validateTokens(sabotaged, renderTokensCss(sabotaged)).failures).toContainEqual(expect.stringContaining("alvo: tamanho inválido ou abaixo do piso de 44px"));
  });

  it("aceita os pisos exatos e medidas decimais acima deles", () => {
    const valid = structuredClone(tokens);
    valid.typography.scale.campo.fontSize = "16.0px";
    valid.typography.scale.editor.fontSize = "17.5px";
    valid.control.target = "44.0px";
    expect(validateTokens(valid, renderTokensCss(valid)).failures).toEqual([]);
  });

  it.each([
    "color: #fff",
    "background: rgb(10 20 30 / 0.5)",
    "stroke=\"red\"",
    "text-blue-500",
    "text-sm",
    "style={{backgroundColor:'red'}}",
    "border: 1px solid red",
    "color: rebeccapurple",
    "borderInlineStartColor: 'PapayaWhip'",
    '"backgroundColor": "aliceblue"',
    "boxShadow: '0 2px 4px darkslategrey'",
    "outline: 2px solid lightgoldenrodyellow",
    "background-image: linear-gradient(cornflowerblue, mediumvioletred)",
    "color: var(--ink, mistyrose)",
    "fill={'yellowgreen'}",
  ])("recusa valor cru %s no runtime", (source) => {
    expect(findRawValues(source).length).toBeGreaterThan(0);
  });

  it("permite variáveis, currentColor e aliases semânticos do Tailwind", () => {
    expect(findRawValues("color: var(--ink); background: color-mix(in srgb, var(--surface) 50%, transparent); fill=\"currentColor\"; className=\"text-ink bg-surface text-corpo\"")).toEqual([]);
  });

  it("não confunde nomes de tokens, URLs ou texto comum com cor crua", () => {
    expect(findRawValues("color: var(--red); background-image: url('/red.png'); content: 'rebeccapurple'; const label = 'goldenrod'; style={{borderColor:'var(--line)', backgroundColor:'inherit'}}")).toEqual([]);
  });
});
