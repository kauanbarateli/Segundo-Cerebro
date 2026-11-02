import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_SUPPORT_EMAIL } from "../../src/lib/legal/documents";

describe("retirada da origem de cadastro", () => {
  it("aponta o canal de suporte na política de privacidade versionada", () => {
    const cookies = LEGAL_DOCUMENTS.privacidade.sections.find(section => section.id === "cookies");
    expect(cookies?.paragraphs.some(paragraph => paragraph.includes(`Para solicitar a retirada do consentimento, escreva para ${LEGAL_SUPPORT_EMAIL}.`))).toBe(true);
    expect(LEGAL_DOCUMENTS.privacidade.version).toBe("0.5 · retirada pelo suporte");
  });
});
