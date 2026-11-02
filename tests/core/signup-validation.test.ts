import { describe, expect, it } from "vitest";
import { validateSignupRequest } from "../../src/lib/auth/signup-validation";

const current = { terms: "v1", privacy: "v2" };
const request = () => ({ email: " Pessoa@Example.COM ", password: "senha segura 123", acceptedLegal: true, termsVersion: "v1", privacyVersion: "v2" });

describe("entrada do cadastro básico", () => {
  it("normaliza e-mail, mantém senha exata e exige as versões legais atuais", () => {
    expect(validateSignupRequest(request(), current)).toEqual({ ok: true, value: { email: "pessoa@example.com", password: "senha segura 123", termsVersion: "v1", privacyVersion: "v2" } });
    expect(validateSignupRequest({ ...request(), termsVersion: "antiga" }, current)).toEqual({ ok: false, reason: "legal" });
    expect(validateSignupRequest({ ...request(), acceptedLegal: false }, current)).toEqual({ ok: false, reason: "legal" });
  });
  it("recusa campos extras e acessores sem executá-los", () => {
    expect(validateSignupRequest({ ...request(), role: "master" }, current)).toEqual({ ok: false, reason: "input" });
    const unsafe = Object.defineProperty(request(), "password", { get() { throw new Error("getter executado"); } });
    expect(validateSignupRequest(unsafe, current)).toEqual({ ok: false, reason: "input" });
  });
  it("aplica a política de senha existente sem ecoar segredos nos erros", () => {
    for (const password of ["curta", "abcdefghijkl\u0000", "🧠".repeat(19)]) {
      const result = validateSignupRequest({ ...request(), password }, current);
      expect(result).toEqual({ ok: false, reason: "password" });
      expect(JSON.stringify(result)).not.toContain(password);
    }
    expect(validateSignupRequest({ ...request(), email: "não é email" }, current)).toEqual({ ok: false, reason: "email" });
    expect(validateSignupRequest({ ...request(), email: "a\u0000@example.com" }, current)).toEqual({ ok: false, reason: "email" });
  });
});
