import { describe, expect, it } from "vitest";
import { parseSignupOrigin } from "../../src/core/acquisition/signup-origin";

describe("origem facultativa do cadastro", () => {
  it("não lê nem retorna dados quando não há consentimento", () => {
    const input = Object.defineProperty({}, "utm_source", { get() { throw new Error("não deve ler"); } });
    expect(parseSignupOrigin(false, input)).toBeNull();
    expect(parseSignupOrigin("true", input)).toBeNull();
    expect(parseSignupOrigin(1, input)).toBeNull();
  });
  it("aceita apenas os cinco campos, normaliza e ignora os demais", () => {
    expect(parseSignupOrigin(true, { utm_source: "  busca ", utm_medium: "cpc", utm_campaign: "início", utm_term: "foco", utm_content: "a", referrer: "privado", role: "master" })).toEqual({ utm_source: "busca", utm_medium: "cpc", utm_campaign: "início", utm_term: "foco", utm_content: "a" });
  });
  it("ignora campos inválidos sem impedir os válidos", () => {
    expect(parseSignupOrigin(true, { utm_source: "<script>", utm_medium: "ok", utm_campaign: "x".repeat(201), utm_term: "a\u0000b", utm_content: 42 })).toEqual({ utm_medium: "ok" });
    expect(parseSignupOrigin(true, { utm_source: "  " })).toBeNull();
  });
  it("respeita o teto total em bytes UTF-8", () => {
    const result = parseSignupOrigin(true, Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].map((key) => [key, "🧠".repeat(200)])));
    expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThanOrEqual(1024);
    expect(result?.utm_source).toHaveLength(400);
    expect(result?.utm_medium).toBeUndefined();
  });
});
