import { describe, expect, it } from "vitest";
import { readSignupForm } from "../../src/lib/auth/signup-form-body";

function form(body: string, headers: Record<string, string> = {}) { return new Request("https://app.example.invalid", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body }); }
describe("leitura limitada do formulário de cadastro", () => {
  it("aceita somente campos esperados e decodifica texto válido", async () => {
    expect(await readSignupForm(form("email=a%40example.com&password=senha+longa"), ["email", "password"])).toEqual({ email: "a@example.com", password: "senha longa" });
  });
  it("recusa campos duplicados, desconhecidos, UTF-8 inválido ou excesso de dados", async () => {
    for (const body of ["email=a&email=b", "role=master", "email=%E0%A4%A", `email=${"a".repeat(8193)}`]) expect(await readSignupForm(form(body), ["email"])).toBeNull();
    expect(await readSignupForm(form("email=a", { "content-type": "application/json" }), ["email"])).toBeNull();
  });
});
