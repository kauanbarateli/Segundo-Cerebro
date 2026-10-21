import { describe, expect, it } from "vitest";
import { ErroDeDominio } from "../../src/core/contracts/base";
import { apurarReservasParaMetas } from "../../src/core/financeiro";

const reservation = (patch: Record<string, unknown> = {}) => ({ id: "r1", user_id: "owner", goal_id: "goal", account_id: "account", amount_cents: 20000, ...patch });
const release = (patch: Record<string, unknown> = {}) => ({ id: "l1", user_id: "owner", reservation_id: "r1", amount_cents: 5000, ...patch });
const input = (patch: Record<string, unknown> = {}) => ({ version: 1, user_id: "owner", reservations: [reservation()], releases: [] as unknown[], ...patch });
const invalid = (value: unknown) => expect(() => apurarReservasParaMetas(value)).toThrow(expect.objectContaining({ code: "VALIDATION", message: "Apuração de reservas inválida." }));

describe("SPEC-08: apuração declarada de reservas virtuais", () => {
  it("aceita coleções vazias sem inventar contas, metas ou saldo", () => {
    expect(apurarReservasParaMetas(input({ reservations: [] }))).toEqual({ version: 1, user_id: "owner", reservations: [], by_account: [], by_goal: [] });
  });

  it("apura aporte e duas liberações parciais sem criar saldo ou despesa", () => {
    expect(apurarReservasParaMetas(input())).toEqual({ version: 1, user_id: "owner", reservations: [{ reservation_id: "r1", goal_id: "goal", account_id: "account", remaining_cents: 20000 }], by_account: [{ account_id: "account", reserved_cents: 20000 }], by_goal: [{ goal_id: "goal", reserved_cents: 20000 }] });
    const result = apurarReservasParaMetas(input({ releases: [release(), release({ id: "l2", amount_cents: 3000 })] }));
    expect(result.reservations[0]!.remaining_cents).toBe(12000);
    expect(result.by_account).toEqual([{ account_id: "account", reserved_cents: 12000 }]);
    expect(result.by_goal).toEqual([{ goal_id: "goal", reserved_cents: 12000 }]);
    expect(Object.keys(result).sort()).toEqual(["by_account", "by_goal", "reservations", "user_id", "version"]);
    expect(Object.keys(result.reservations[0]!).sort()).toEqual(["account_id", "goal_id", "remaining_cents", "reservation_id"]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("mantém o aporte e os grupos zerados após liberação integral", () => {
    const result = apurarReservasParaMetas(input({ releases: [release({ amount_cents: 20000 })] }));
    expect(result.reservations).toEqual([{ reservation_id: "r1", goal_id: "goal", account_id: "account", remaining_cents: 0 }]);
    expect(result.by_account).toEqual([{ account_id: "account", reserved_cents: 0 }]);
    expect(result.by_goal).toEqual([{ goal_id: "goal", reserved_cents: 0 }]);
  });

  it("agrupa várias contas e metas pelo líquido e independe da ordem de entrada", () => {
    const reservations = [reservation({ id: "b", account_id: "A", goal_id: "y", amount_cents: 300 }), reservation({ id: "a", account_id: "B", goal_id: "x", amount_cents: 200 }), reservation({ id: "c", account_id: "A", goal_id: "x", amount_cents: 100 })];
    const releases = [release({ id: "l2", reservation_id: "b", amount_cents: 100 }), release({ id: "l1", reservation_id: "a", amount_cents: 50 })];
    const result = apurarReservasParaMetas(input({ reservations, releases }));
    expect(result.reservations.map(row => [row.reservation_id, row.remaining_cents])).toEqual([["a", 150], ["b", 200], ["c", 100]]);
    expect(result.by_account).toEqual([{ account_id: "A", reserved_cents: 300 }, { account_id: "B", reserved_cents: 150 }]);
    expect(result.by_goal).toEqual([{ goal_id: "x", reserved_cents: 250 }, { goal_id: "y", reserved_cents: 200 }]);
    expect(apurarReservasParaMetas(input({ reservations: [...reservations].reverse(), releases: [...releases].reverse() }))).toEqual(result);
  });

  it("mantém namespaces separados e IDs que coincidem com propriedades de objetos", () => {
    const ids = ["toString", "__proto__", "constructor"];
    const reservations = ids.map(id => reservation({ id, goal_id: id, account_id: id, amount_cents: 1 }));
    const releases = ids.map(id => release({ id, reservation_id: id, amount_cents: 1 }));
    const result = apurarReservasParaMetas(input({ reservations, releases }));
    expect(result.reservations).toHaveLength(3);
    expect(result.by_account.map(row => [row.account_id, row.reserved_cents])).toEqual([["__proto__", 0], ["constructor", 0], ["toString", 0]]);
    expect(result.by_goal.map(row => [row.goal_id, row.reserved_cents])).toEqual(result.by_account.map(row => [row.account_id, row.reserved_cents]));
  });

  it("ordena identificadores por ASCII sem ordenação numérica ou de idioma", () => {
    const ids = ["a", "_", "A", "2", "10", "0", "-"];
    const result = apurarReservasParaMetas(input({ reservations: ids.map(id => reservation({ id, account_id: id, goal_id: id, amount_cents: 1 })) }));
    const expected = ["-", "0", "10", "2", "A", "_", "a"];
    expect(result.reservations.map(row => row.reservation_id)).toEqual(expected);
    expect(result.by_account.map(row => row.account_id)).toEqual(expected);
    expect(result.by_goal.map(row => row.goal_id)).toEqual(expected);
  });

  it("confere somente resultados líquidos públicos, sem teto global ou bruto inventado", () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    const reservations = [reservation({ id: "a", amount_cents: maximum }), reservation({ id: "b", amount_cents: maximum })];
    const releases = [release({ id: "a", reservation_id: "a", amount_cents: maximum }), release({ id: "b", reservation_id: "b", amount_cents: maximum })];
    const zero = apurarReservasParaMetas(input({ reservations, releases }));
    expect(zero.by_account).toEqual([{ account_id: "account", reserved_cents: 0 }]);
    expect(zero.by_goal).toEqual([{ goal_id: "goal", reserved_cents: 0 }]);
    const separate = apurarReservasParaMetas(input({ reservations: [reservation({ id: "a", account_id: "A", goal_id: "x", amount_cents: maximum }), reservation({ id: "b", account_id: "B", goal_id: "y", amount_cents: maximum })] }));
    expect(separate.by_account.map(row => row.reserved_cents)).toEqual([maximum, maximum]);
    expect(separate.by_goal.map(row => row.reserved_cents)).toEqual([maximum, maximum]);
  });

  it.each(["account", "goal"])("recusa estouro líquido por %s sem alterar o aporte", grouping => {
    const rows = [reservation({ id: "a", amount_cents: Number.MAX_SAFE_INTEGER }), reservation({ id: "b", amount_cents: 1, account_id: grouping === "account" ? "account" : "other", goal_id: grouping === "goal" ? "goal" : "other" })];
    invalid(input({ reservations: rows }));
  });

  it("recusa liberação excedente por aporte mesmo quando outro tem saldo", () => {
    invalid(input({ reservations: [reservation({ amount_cents: 10 }), reservation({ id: "r2", amount_cents: 1000 })], releases: [release({ amount_cents: 6 }), release({ id: "l2", amount_cents: 5 })] }));
    invalid(input({ releases: [release({ amount_cents: 20001 })] }));
  });

  it("recusa duplicatas em cada coleção inclusive linhas idênticas e liberações órfãs", () => {
    invalid(input({ reservations: [reservation(), reservation()] }));
    invalid(input({ releases: [release(), release()] }));
    invalid(input({ releases: [release({ reservation_id: "absent" })] }));
    invalid(input({ reservations: [], releases: [release()] }));
  });

  it.each(["reservation", "release"])("recusa dono divergente em %s", collection => {
    invalid(input(collection === "reservation" ? { reservations: [reservation({ user_id: "other" })] } : { releases: [release({ user_id: "other" })] }));
  });

  it.each([0, -0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null, undefined, true, 1n])("recusa centavos inválidos nos dois tipos de linha", amount_cents => {
    invalid(input({ reservations: [reservation({ amount_cents })] }));
    invalid(input({ releases: [release({ amount_cents })] }));
  });

  it.each(["", " ", "id ", " id", "id\n", "id\r\n", "á", "a/b", "a:b", "a\tb", "x".repeat(129), null, undefined, 1, {}])("recusa identidade inválida sem normalizar", id => {
    invalid(input({ user_id: id }));
    for (const key of ["id", "user_id", "goal_id", "account_id"]) invalid(input({ reservations: [reservation({ [key]: id })] }));
    for (const key of ["id", "user_id", "reservation_id"]) invalid(input({ releases: [release({ [key]: id })] }));
  });

  it("aceita IDs ASCII nos dois limites, sem UUID ou transformação", () => {
    const id = "x".repeat(128);
    const result = apurarReservasParaMetas(input({ user_id: "_", reservations: [reservation({ id, user_id: "_", account_id: "-", goal_id: "A0_" })], releases: [release({ id, user_id: "_", reservation_id: id, amount_cents: 1 })] }));
    expect(result.user_id).toBe("_"); expect(result.reservations[0]).toMatchObject({ reservation_id: id, account_id: "-", goal_id: "A0_", remaining_cents: 19999 });
  });

  it.each([undefined, null, "1", 0, 2, true, 1n])("exige versão literal numérica 1", version => { invalid(input({ version })); });

  it("fecha os campos do envelope e das duas linhas inclusive extras não enumeráveis", () => {
    for (const source of [input(), reservation(), release()]) {
      const wrap = (value: unknown) => "version" in source ? value : "goal_id" in source ? input({ reservations: [value] }) : input({ releases: [value] });
      for (const key of Object.keys(source)) { const missing = { ...source }; Reflect.deleteProperty(missing, key); invalid(wrap(missing)); }
      invalid(wrap({ ...source, extra: undefined }));
      invalid(wrap({ ...source, [Symbol("extra")]: true }));
      invalid(wrap(Object.defineProperty({ ...source }, "extra", { value: undefined })));
    }
    for (const extra of ["balance_cents", "target_cents", "archived_at", "client_id", "receipt"]) invalid(input({ [extra]: undefined }));
    for (const value of [null, undefined, [], "input", 1, {}]) invalid(value);
  });

  it.each(["reservations", "releases"] as const)("valida separadamente o limite de 10.000 em %s", collection => {
    const rows = Array.from({ length: 10000 }, (_, index) => collection === "reservations" ? reservation({ id: `r_${index}`, amount_cents: 1 }) : release({ id: `l_${index}`, amount_cents: 1 }));
    const payload = input({ reservations: [reservation({ amount_cents: 10000 })], [collection]: rows });
    const result = apurarReservasParaMetas(payload);
    expect(result.reservations).toHaveLength(collection === "reservations" ? 10000 : 1);
    expect(result.by_account[0]!.reserved_cents).toBe(collection === "reservations" ? 10000 : 0);
    invalid(input({ reservations: [reservation({ amount_cents: 10001 })], [collection]: [...rows, collection === "reservations" ? reservation({ id: "overflow", amount_cents: 1 }) : release({ id: "overflow", amount_cents: 1 })] }));
  });

  it("recusa buracos, índices herdados, extras de lista e elementos accessor sem get", () => {
    let reads = 0;
    const accessor = Object.defineProperty([reservation()], "0", { get() { reads++; return reservation(); } });
    const inherited = Object.setPrototypeOf(new Array(1), { 0: reservation() });
    const lists = [undefined, null, {}, new Array(1), accessor, inherited, Object.assign([reservation()], { extra: true }), Object.assign([reservation()], { [Symbol("extra")]: true })];
    for (const value of lists) { invalid(input({ reservations: value })); invalid(input({ releases: value })); }
    expect(reads).toBe(0);
  });

  it("não executa accessors de envelope/linhas nem aceita protótipos customizados", () => {
    let reads = 0, writes = 0;
    invalid({ ...input(), get user_id() { reads++; return "owner"; } });
    invalid(input({ reservations: [{ ...reservation(), get id() { reads++; return "r1"; } }] }));
    invalid(input({ releases: [Object.defineProperty(release(), "id", { set() { writes++; } })] }));
    invalid(Object.assign(Object.create({ get unexpected() { reads++; return true; } }), input()));
    expect(reads).toBe(0); expect(writes).toBe(0);
  });

  it.each(["data", "getter"])("não preenche buraco com descriptor herdado: %s", mode => {
    const rows = Object.assign(new Array(1), { extra: reservation() });
    const payload = input({ reservations: rows });
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, "0");
    let reads = 0, error: unknown;
    try {
      Object.defineProperty(Object.prototype, "0", mode === "data"
        ? { value: { value: reservation() }, writable: true, configurable: true }
        : { get() { reads++; throw Error("PRIVATE_INHERITED_INDEX"); }, configurable: true });
      try { apurarReservasParaMetas(payload); } catch (caught) { error = caught; }
    } finally {
      if (previous) Object.defineProperty(Object.prototype, "0", previous);
      else Reflect.deleteProperty(Object.prototype, "0");
    }
    // Restore the prototype before assertions or any asynchronous work.
    expect(error).toMatchObject({ code: "VALIDATION", message: "Apuração de reservas inválida." });
    expect(reads).toBe(0);
  });

  it("aceita propriedades próprias não enumeráveis, protótipos nulos e dados congelados", () => {
    const plain = <T extends object>(value: T): T => Object.assign(Object.create(null), value);
    const rows = Object.freeze(Object.setPrototypeOf([Object.freeze(plain(reservation()))], null));
    const releases = Object.freeze(Object.setPrototypeOf([], null));
    const envelope = Object.freeze(Object.defineProperty(plain(input({ reservations: rows, releases })), "version", { value: 1, enumerable: false }));
    expect(apurarReservasParaMetas(envelope)).toEqual(apurarReservasParaMetas(input()));
  });

  it("usa descriptors sem get de Proxy no envelope, listas ou linhas", () => {
    let reads = 0;
    const observe = <T extends object>(value: T): T => new Proxy(value, { get() { reads++; throw Error("PRIVATE_GET"); } });
    const value = observe(input({ reservations: observe([observe(reservation())]), releases: observe([observe(release())]) }));
    expect(apurarReservasParaMetas(value).reservations[0]!.remaining_cents).toBe(15000);
    expect(reads).toBe(0);
  });

  it("normaliza qualquer falha de reflexão sem inspecionar o valor lançado", () => {
    for (const thrown of [Error("PRIVATE"), new ErroDeDominio("NOT_FOUND", "PRIVATE"), new ErroDeDominio("VALIDATION", "PRIVATE"), null, undefined]) {
      invalid(new Proxy(input(), { ownKeys() { throw thrown; } }));
      invalid(input({ reservations: new Proxy([], { getOwnPropertyDescriptor() { throw thrown; } }) }));
      invalid(input({ reservations: [new Proxy(reservation(), { getPrototypeOf() { throw thrown; } })] }));
    }
    let reads = 0;
    const thrown = new Proxy({}, { get() { reads++; throw Error("PRIVATE_ERROR"); }, getPrototypeOf() { reads++; throw Error("PRIVATE_ERROR"); } });
    invalid(new Proxy(input(), { getPrototypeOf() { throw thrown; } }));
    expect(reads).toBe(0);
    const revoked = Proxy.revocable(input(), {}); revoked.revoke(); invalid(revoked.proxy);
  });

  it("não modifica input e devolve cópias independentes de cada coleção e item", () => {
    const value = input({ releases: [release()] }), before = JSON.stringify(value);
    const first = apurarReservasParaMetas(value), second = apurarReservasParaMetas(value);
    expect(first).toEqual(second); expect(first).not.toBe(second);
    expect(first.reservations).not.toBe(second.reservations); expect(first.reservations[0]).not.toBe(second.reservations[0]);
    expect(first.by_account).not.toBe(second.by_account); expect(first.by_account[0]).not.toBe(second.by_account[0]);
    expect(first.by_goal).not.toBe(second.by_goal); expect(first.by_goal[0]).not.toBe(second.by_goal[0]);
    expect(JSON.stringify(value)).toBe(before);
    value.reservations[0]!.amount_cents = 999;
    expect(first.reservations[0]!.remaining_cents).toBe(15000);
    (first.reservations[0]! as { remaining_cents: number }).remaining_cents = 123;
    expect(second.reservations[0]!.remaining_cents).toBe(15000);
  });
});
