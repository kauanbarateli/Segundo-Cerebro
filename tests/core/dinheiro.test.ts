/** Portado de segundo_cerebro@ffdf06435a5b8dcd047574172cddf1cc772dfd09. */
import { describe, expect, it } from "vitest";
import { formatBRL, formatCentsPlain, parseBRLToCents } from "../../src/core/dinheiro";

describe("dinheiro em centavos", () => {
  it("0,10 + 0,20 = 0,30 — sem erro de ponto flutuante", () => {
    const a = parseBRLToCents("0,10");
    const b = parseBRLToCents("0,20");
    expect(a).toBe(10);
    expect(b).toBe(20);
    expect(a! + b!).toBe(30);
    expect(formatBRL(a! + b!)).toContain("0,30");
  });

  it("oculta o valor quando pedido", () => {
    expect(formatBRL(123456, { hidden: true })).toBe("R$ ••••");
  });
});

describe("contrato decimal e regressões do porte", () => {
  it("formata o campo sem símbolo nem separador de milhares", () => {
    expect(formatCentsPlain(123456)).toBe("1234,56");
    expect(formatCentsPlain(-1)).toBe("-0,01");
    expect(formatCentsPlain(0)).toBe("0,00");
  });

  it("preserva os formatos legados de entrada e valores negativos", () => {
    for (const entrada of ["1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "1,234.56"]) expect(parseBRLToCents(entrada)).toBe(123456);
    expect(parseBRLToCents("-1234,56")).toBe(-123456);
    expect(parseBRLToCents(".5")).toBe(50);
    expect(parseBRLToCents("1,")).toBe(100);
  });

  it("arredonda frações decimais exatamente, sem perder centavo por representação binária", () => {
    expect(parseBRLToCents("1,005")).toBe(101);
    expect(parseBRLToCents("1,255")).toBe(126);
    expect(parseBRLToCents("1,0049")).toBe(100);
    expect(parseBRLToCents("-1,255")).toBe(-125);
    expect(parseBRLToCents("-1,2551")).toBe(-126);
    expect(parseBRLToCents("-0,001")).toBe(0);
  });

  it("recusa texto sem valor e separadores/sinais incompatíveis", () => {
    for (const entrada of ["", "R$", "-", ".", "1,2,3", "1.2.3", "--1", "1-2"]) expect(parseBRLToCents(entrada)).toBeNull();
  });

  it("aceita só centavos representáveis como inteiro seguro, inclusive após arredondar", () => {
    expect(parseBRLToCents("90071992547409,91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseBRLToCents("-90071992547409,91")).toBe(-Number.MAX_SAFE_INTEGER);
    expect(parseBRLToCents("90071992547409,92")).toBeNull();
    expect(parseBRLToCents("90071992547409,915")).toBeNull();
    expect(parseBRLToCents("900719925474099999999999,00")).toBeNull();
  });

  it("a formatação preserva cada centavo também no limite inteiro seguro", () => {
    for (const cents of [0, 1, -1, 123456, -123456, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, -Number.MAX_SAFE_INTEGER]) {
      expect(parseBRLToCents(formatCentsPlain(cents))).toBe(cents);
      expect(parseBRLToCents(formatBRL(cents))).toBe(cents);
    }
    expect(formatCentsPlain(Number.MAX_SAFE_INTEGER - 1)).toBe("90071992547409,90");
    expect(formatBRL(-1)).toContain("0,01");
    expect(formatBRL(-1)).toContain("-");
  });

  it("não disfarça centavos inválidos como um valor monetário formatado", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => formatBRL(value)).toThrow(RangeError);
      expect(() => formatCentsPlain(value)).toThrow(RangeError);
    }
  });
});
