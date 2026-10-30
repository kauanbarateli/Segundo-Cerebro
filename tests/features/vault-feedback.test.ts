import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultPasswordError, vaultFailureMessage } from "../../src/components/features/cofre/vault-lifecycle";
afterEach(() => { vi.unstubAllGlobals(); });
describe("Cofre failure messages name the real cause", () => {
  it("a wrong master password never mentions the recovery kit", () => {
    const message = vaultFailureMessage(new VaultPasswordError("unlock"), "unlock");
    expect(message).toMatch(/senha mestra está incorreta/i);
    expect(message).not.toMatch(/kit|metade/i);
  });
  it("a wrong current password during a change is named as such", () => {
    expect(vaultFailureMessage(new VaultPasswordError("change"), "change")).toMatch(/senha mestra atual está incorreta/i);
  });
  it("a refused recovery points to the kit halves and the new password", () => {
    expect(vaultFailureMessage(new VaultPasswordError("recover"), "recover")).toMatch(/duas metades do kit e a nova senha/i);
  });
  it.each(["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "Network request failed"])(
    "browser network failure %s is reported as a connection problem, not a password problem", text => {
      const message = vaultFailureMessage(new TypeError(text), "unlock");
      expect(message).toMatch(/sem conexão/i);
      expect(message).toMatch(/Cofre não foi alterado/);
      expect(message).not.toMatch(/senha|kit|metade/i);
    });
  it("an offline browser overrides any other cause", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(vaultFailureMessage(new Error("qualquer coisa"), "unlock")).toMatch(/sem conexão/i);
  });
  it("aborted or timed-out requests are connection problems", () => {
    expect(vaultFailureMessage(new DOMException("x", "AbortError"), "unlock")).toMatch(/sem conexão/i);
    expect(vaultFailureMessage(new DOMException("x", "TimeoutError"), "unlock")).toMatch(/sem conexão/i);
  });
  it("a TypeError that is not a fetch failure is not disguised as a network problem", () => {
    expect(vaultFailureMessage(new TypeError("Cannot read properties of undefined"), "unlock")).toBe("Não foi possível concluir. Tente de novo.");
  });
  it("server unavailability and unknown commit results ask to wait and retry", () => {
    for (const code of ["UNAVAILABLE", "COMMIT_UNKNOWN"]) {
      expect(vaultFailureMessage(Object.assign(new Error("x"), { code }), "unlock")).toMatch(/servidor não respondeu/i);
    }
  });
  it("this module's own validation messages are shown as written", () => {
    for (const text of ["Preencha senhas iguais.", "Kit: baixe as duas metades antes de continuar.", "Use ao menos 10 caracteres.", "O Cofre mudou em outra aba."]) {
      expect(vaultFailureMessage(new Error(text), "create")).toBe(text);
    }
  });
  it("unknown failures get a neutral message; only recovery mentions the kit", () => {
    expect(vaultFailureMessage(new Error(""), "unlock")).toBe("Não foi possível concluir. Tente de novo.");
    expect(vaultFailureMessage("stringão", "create")).toBe("Não foi possível concluir. Tente de novo.");
    expect(vaultFailureMessage(new Error(""), "recover")).toMatch(/metades do kit/);
  });
});
