import { describe, expect, it } from "vitest";
import { decodeFeedbackSubmission } from "../../src/core/feedback/submission";

const valid = { category: "suggestion", text: "  Uma sugestão útil.  ", clientId: "00000000-0000-4000-8000-000000000001" };
describe("envio privado de feedback", () => {
  it("normaliza uma mensagem válida sem adicionar identidade", () => {
    expect(decodeFeedbackSubmission(valid)).toEqual({ ...valid, text: "Uma sugestão útil." });
  });
  it("recusa identidade e estado injetados pelo cliente", () => {
    for (const key of ["userId", "author", "status", "createdAt"]) expect(() => decodeFeedbackSubmission({ ...valid, [key]: "outro" })).toThrow();
  });
  it("valida categoria, limites e identidade da intenção", () => {
    for (const invalid of [{ category: "unknown" }, { text: "curta" }, { text: "x".repeat(5001) }, { text: "Olá\u0000 mundo!" }, { clientId: "inválido" }]) {
      expect(() => decodeFeedbackSubmission({ ...valid, ...invalid })).toThrow();
    }
  });
  it("conserva quebras de linha e trata conteúdo como texto", () => {
    expect(decodeFeedbackSubmission({ ...valid, text: "Linha inicial\n<script>alert(1)</script>" }).text).toContain("<script>");
  });
});
