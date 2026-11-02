import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS } from "../../src/lib/legal/documents";

describe("retirada da origem de cadastro", () => {
  it("aponta a retirada autenticada na política de privacidade versionada", () => {
    const cookies = LEGAL_DOCUMENTS.privacidade.sections.find(section => section.id === "cookies");
    expect(cookies?.paragraphs.some(paragraph => paragraph.includes("Você pode retirar o consentimento na página de origem de cadastro"))).toBe(true);
    expect(cookies?.links?.some(link => link.href === "/privacidade/origem-cadastro")).toBe(true);
    expect(LEGAL_DOCUMENTS.privacidade.version).toBe("0.5 · origem de cadastro");
  });
});
