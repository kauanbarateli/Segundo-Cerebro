import { describe, expect, it } from "vitest";
import { acessoPara } from "../../src/components/features/conheca/content";
import { readSignupCapability } from "../../src/lib/access/signup-capability";

describe("contrato de acesso da apresentação", () => {
  it("nasce fechado: a composição atual não autoriza cadastro", () => {
    expect(readSignupCapability()).toEqual({ available: false });
  });

  it("com cadastro fechado só oferece Entrar", () => {
    const acesso = acessoPara(false);
    expect(acesso.principal).toEqual({ href: "/entrar", rotulo: "Entrar" });
    expect(acesso.conta).toBeNull();
    expect(acesso.cabecalho.entrar.href).toBe("/entrar");
    expect(acesso.cabecalho.criar).toBeNull();
    expect(acesso.texto).toMatch(/ainda não está aberta/);
  });

  it("com cadastro aberto oferece Criar conta gratuita sem esconder Entrar", () => {
    const acesso = acessoPara(true);
    expect(acesso.principal).toEqual({ href: "/criar-conta", rotulo: "Criar conta gratuita" });
    expect(acesso.conta?.href).toBe("/entrar");
    expect(acesso.cabecalho.entrar.href).toBe("/entrar");
    expect(acesso.cabecalho.criar?.href).toBe("/criar-conta");
  });

  it.each([false, true])("a copy não promete preço, cartão nem prazo (cadastro aberto: %s)", aberto => {
    const texto = JSON.stringify(acessoPara(aberto)).toLocaleLowerCase("pt-BR");
    for (const proibido of ["r$", "cartão", "vitalíci", "para sempre", "assine"]) expect(texto).not.toContain(proibido);
  });
});
