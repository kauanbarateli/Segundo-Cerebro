import { describe, expect, it } from "vitest";
import { ErroDeDominio } from "../../src/core/contracts/base";
import { planejarCopiaDoPlanoMensal } from "../../src/core/financeiro";

const input = () => ({ batch_id: "batch_A-01", month: "2026-12-01", category_id: null, limit_cents: 2990 });
const invalid = (value: unknown) => expect(() => planejarCopiaDoPlanoMensal(value)).toThrow(expect.objectContaining({ code: "VALIDATION", message: "Plano de cópia mensal inválido." }));

describe("SPEC-08: intenções puras de cópia do plano total por doze meses", () => {
  it("planeja o mês escolhido mais onze, com chaves que vinculam a intenção inteira", () => {
    const result = planejarCopiaDoPlanoMensal(input());
    const months = ["2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01", "2027-04-01", "2027-05-01", "2027-06-01", "2027-07-01", "2027-08-01", "2027-09-01", "2027-10-01", "2027-11-01"];
    expect(result).toMatchObject({ version: 1, ...input() });
    expect(Object.keys(result).sort()).toEqual(["batch_id", "category_id", "items", "limit_cents", "month", "version"]);
    expect(result.items).toHaveLength(12);
    expect(result.items.map(item => item.month)).toEqual(months);
    expect(result.items.map(item => item.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(result.items.map(item => item.intent_key)).size).toBe(12);
    for (const [index, item] of result.items.entries()) {
      expect(Object.keys(item).sort()).toEqual(["category_id", "intent_key", "limit_cents", "month", "ordinal"]);
      const tuple = ["batch_A-01", index + 1, months[index], null, 2990];
      expect(item).toMatchObject({ category_id: null, limit_cents: 2990 });
      expect(JSON.parse(item.intent_key)).toEqual(tuple);
      expect(item.intent_key).toBe(JSON.stringify(tuple));
    }
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it.each([
    ["0001-01-01", "0001-12-01"], ["0099-12-01", "0100-11-01"],
    ["2024-02-01", "2025-01-01"], ["2026-01-01", "2026-12-01"],
    ["9998-12-01", "9999-11-01"], ["9999-01-01", "9999-12-01"],
  ])("preserva o calendário %s até %s sem relógio ou ano implícito", (month, last) => {
    const result = planejarCopiaDoPlanoMensal({ ...input(), month });
    expect(result.month).toBe(month); expect(result.items[0]!.month).toBe(month);
    expect(result.items[11]!.month).toBe(last);
  });

  it.each(["9999-02-01", "9999-11-01", "9999-12-01"])("recusa o horizonte que ultrapassa 9999 a partir de %s", month => {
    invalid({ ...input(), month });
  });

  it.each(["0000-01-01", "10000-01-01", "2026-00-01", "2026-13-01", "2026-02-29", "2026-02-31", "2026-01", "2026-1-01", "2026-01-1", "2026-01-01\n", " 2026-01-01", "2026-01-01T00:00:00Z", null, undefined, 20260101, {}])("recusa mês não canônico: %j", month => {
    invalid({ ...input(), month });
  });

  it.each(["A", "aZ09_-", "x".repeat(128)])("conserva identidade ASCII opaca válida", batch_id => {
    const result = planejarCopiaDoPlanoMensal({ ...input(), batch_id });
    expect(result.batch_id).toBe(batch_id);
    expect(JSON.parse(result.items[0]!.intent_key)[0]).toBe(batch_id);
  });

  it.each(["", " ", " a", "a ", "a\n", "a\r\n", "a\tb", "á", "a/b", "a:b", "a\"b", "a\\b", "x".repeat(129), null, undefined, 1, {}])("recusa identidade fora do contrato ASCII", batch_id => {
    invalid({ ...input(), batch_id });
  });

  it.each([1, Number.MAX_SAFE_INTEGER])("conserva limite inteiro seguro %i em cada intenção, sem inventar soma temporal", limit_cents => {
    const result = planejarCopiaDoPlanoMensal({ ...input(), limit_cents });
    expect(result.limit_cents).toBe(limit_cents);
    expect(result.items.every(item => item.limit_cents === limit_cents)).toBe(true);
  });

  it.each([0, -0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, -Infinity, "2990", null, undefined, true, 1n])("recusa limite ausente, inseguro ou não positivo", limit_cents => {
    invalid({ ...input(), limit_cents });
  });

  it.each([undefined, "category", "", 0, false, {}])("exige categoria null explícita sem somar alocações", category_id => { invalid({ ...input(), category_id }); });

  it("recusa campos ausentes e extras inclusive undefined, sem aceitar snapshot ou autoridade", () => {
    for (const key of Object.keys(input())) {
      const missing = input(); Reflect.deleteProperty(missing, key); invalid(missing);
    }
    for (const key of ["version", "items", "budgets", "categories", "user_id", "expected_version", "client_id"]) invalid({ ...input(), [key]: undefined });
    for (const value of [null, undefined, [], "month", 1, {}]) invalid(value);
  });

  it("produz cópias independentes e determinísticas sem detectar reuso sem histórico", () => {
    const frozen = Object.freeze(input()), before = JSON.stringify(frozen);
    const first = planejarCopiaDoPlanoMensal(frozen), second = planejarCopiaDoPlanoMensal(frozen);
    expect(first).toEqual(second); expect(first).not.toBe(second); expect(first.items).not.toBe(second.items);
    for (let index = 0; index < 12; index++) expect(first.items[index]).not.toBe(second.items[index]);
    expect(JSON.stringify(frozen)).toBe(before);
    for (const patch of [{ batch_id: "another" }, { month: "2027-01-01" }, { limit_cents: 2991 }]) {
      const other = planejarCopiaDoPlanoMensal({ ...frozen, ...patch });
      expect(other.items[0]!.intent_key).not.toBe(first.items[0]!.intent_key);
    }
    // Same batch and changed intent still returns a plan: only an executor
    // with the stored original manifest can decide that this is a conflict.
    expect(planejarCopiaDoPlanoMensal({ ...frozen, limit_cents: 2991 }).batch_id).toBe(frozen.batch_id);
  });

  it("não executa getters próprios ou herdados nem aceita símbolos", () => {
    let reads = 0;
    const own = { ...input(), get limit_cents() { reads++; throw Error("PRIVATE_GET"); } };
    const inherited = Object.assign(Object.create({ get unexpected() { reads++; throw Error("PRIVATE_GET"); } }), input());
    invalid(own); invalid(inherited); invalid({ ...input(), [Symbol("extra")]: true });
    expect(reads).toBe(0);
  });

  it("aceita protótipo nulo e usa só descriptors sem get de Proxy", () => {
    let reads = 0;
    const fields = Object.assign(Object.create(null), input());
    const proxy = new Proxy(fields, { get() { reads++; throw Error("PRIVATE_GET"); } });
    expect(planejarCopiaDoPlanoMensal(proxy)).toEqual(planejarCopiaDoPlanoMensal(input()));
    expect(reads).toBe(0);
  });

  it("confere propriedades não enumeráveis e recusa acessor apenas de escrita", () => {
    const hidden = Object.defineProperty(input(), "limit_cents", { value: 2990, enumerable: false });
    expect(planejarCopiaDoPlanoMensal(hidden).limit_cents).toBe(2990);
    invalid(Object.defineProperty(input(), "extra", { value: undefined, enumerable: false }));
    let writes = 0;
    const setter = Object.defineProperty(input(), "limit_cents", { set() { writes++; }, enumerable: true });
    invalid(setter); expect(writes).toBe(0);
    invalid(new Proxy(input(), { getOwnPropertyDescriptor() { throw new ErroDeDominio("NOT_FOUND", "PRIVATE_DESCRIPTOR"); } }));
  });

  it("normaliza falhas de reflexão sem inspecionar ou repropagar o valor lançado", () => {
    for (const thrown of [new Error("PRIVATE_REFLECTION"), new ErroDeDominio("CONFLICT", "PRIVATE_REFLECTION"), new ErroDeDominio("VALIDATION", "PRIVATE_REFLECTION"), null, undefined]) {
      invalid(new Proxy({}, { ownKeys() { throw thrown; } }));
    }
    let reads = 0;
    const thrown = new Proxy({}, { get() { reads++; throw Error("PRIVATE_ERROR"); }, getPrototypeOf() { reads++; throw Error("PRIVATE_ERROR"); } });
    invalid(new Proxy({}, { getPrototypeOf() { throw thrown; } })); expect(reads).toBe(0);
    const { proxy, revoke } = Proxy.revocable({}, {}); revoke(); invalid(proxy);
  });
});
