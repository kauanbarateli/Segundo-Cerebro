import { describe, expect, it } from "vitest";
import { linhaTemporalDaCompetencia, totaisFinanceiros, type ContaFinanceira, type LancamentoFinanceiro } from "../../src/core/financeiro";

const account = (patch: Partial<ContaFinanceira> = {}): ContaFinanceira => ({ id: "cash", user_id: "owner", name: "Conta sintética", kind: "checking", institution: null,
  currency: "BRL", opening_balance_cents: 0, color_key: "stone", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...patch });
const card = account({ id: "card", kind: "credit_card", statement_closing_day: 28, payment_due_day: 5 });
const transaction = (patch: Partial<LancamentoFinanceiro> = {}): LancamentoFinanceiro => ({ id: "tx", user_id: "owner", account_id: "cash", category_id: null,
  kind: "expense", amount_cents: 1000, paid_cents: 1000, description: "Exemplo sintético", payee: null, occurred_on: "2026-10-04", transfer_group_id: null,
  notes: null, created_at: "2026-10-04T00:00:00Z", updated_at: "2026-10-04T00:00:00Z", installment_group_id: null, installment_no: null, installment_total: null,
  statement_month: null, serie_tipo: null, status: "confirmed", source: "manual", due_date: null, deleted_at: null, ...patch });
const timeline = (transactions: readonly LancamentoFinanceiro[] = [], accounts: readonly ContaFinanceira[] = [account()], month = "2026-10-01") => linhaTemporalDaCompetencia({ transactions, accounts, month });

describe("SPEC-08: entradas e despesas da competência", () => {
  it("preserva datas fora do mês num ponto inicial e termina no total existente", () => {
    const rows = [transaction({ id: "september", account_id: "card", occurred_on: "2026-09-29", statement_month: "2026-10-01", paid_cents: 0 }),
      transaction({ id: "november", account_id: "card", occurred_on: "2026-11-02", statement_month: "2026-10-01", paid_cents: 0, amount_cents: 2000 }),
      transaction({ id: "income", kind: "income", occurred_on: "2026-10-02", amount_cents: 5000, paid_cents: 5000 }), transaction()];
    const result = timeline(rows, [account(), card]);
    expect(result.points[0]).toMatchObject({ day: null, label: "Anteriores desta competência", expenseCents: 3000, incomeCents: 0, transactionCount: 2 });
    expect(result.points[1]!.expenseCents).toBe(3000);
    expect(result.points[2]!.incomeCents).toBe(5000);
    expect(result.points[3]!.expenseCents).toBe(3000);
    expect(result.points[4]!.expenseCents).toBe(4000);
    expect(result.points.at(-1)).toMatchObject(totaisFinanceiros(rows, [account(), card], ["2026-10-01"]));
    expect(result.rows.find(row => row.id === "september")).toMatchObject({ occurred_on: "2026-09-29", competence: "2026-10-01" });
    expect(result.rows.find(row => row.id === "november")).toMatchObject({ occurred_on: "2026-11-02", statement_month: "2026-10-01" });
  });
  it.each([500, 1000, 1500])("pagamento de fatura de %i não cria segunda despesa ou receita", paid => {
    const rows = [transaction({ id: "purchase", account_id: "card", paid_cents: 0, statement_month: "2026-10-01" }),
      transaction({ id: "payment-out", amount_cents: paid, paid_cents: paid, transfer_group_id: "payment" }),
      transaction({ id: "payment-in", kind: "income", account_id: "card", amount_cents: paid, paid_cents: paid, transfer_group_id: "payment", statement_month: "2026-10-01" })];
    expect(timeline(rows, [account(), card]).points.at(-1)).toMatchObject({ incomeCents: 0, expenseCents: 1000, transactionCount: 1 });
    expect(timeline(rows, [account(), card]).rows.map(row => row.id)).toEqual(["purchase"]);
  });
  it("reutiliza estados reais, lixeira e competência histórica sem alterar pagamentos", () => {
    const rows = [transaction({ id: "confirmed", paid_cents: 400 }), transaction({ id: "reconciled", status: "reconciled" }),
      transaction({ id: "planned", status: "planned" }), transaction({ id: "pending", status: "pending" }), transaction({ id: "cancelled", status: "cancelled" }),
      transaction({ id: "deleted", deleted_at: "2026-10-05T00:00:00Z" }), transaction({ id: "other-month", occurred_on: "2026-09-04" })];
    const result = timeline(rows, [account({ archived_at: "2026-10-05T00:00:00Z" })]);
    expect(result.points.at(-1)).toMatchObject({ expenseCents: 2000, transactionCount: 2 });
    expect(result.rows.find(row => row.id === "confirmed")!.paid_cents).toBe(400);
  });
  it("expõe órfãos para correção em vez de inventar uma competência", () => {
    const rows = [transaction({ account_id: "card", statement_month: null, occurred_on: "2026-09-29" })];
    const result = timeline(rows, [card]);
    expect(result.rows).toEqual([]); expect(result.points.at(-1)!.expenseCents).toBe(0);
    expect(result.unassigned).toEqual([expect.objectContaining({ id: "tx", occurred_on: "2026-09-29", competence: null, statement_month: null })]);
  });
  it.each([["2024-02-01", 29], ["2026-02-01", 28], ["2026-04-01", 30], ["2026-10-01", 31]] as const)("%s tem %i dias civis sem movimento", (month, days) => {
    const result = timeline([], [], month);
    expect(result.points).toHaveLength(days + 1);
    expect(result.points.at(-1)!.day).toBe(`${month.slice(0, 7)}-${days}`);
    expect(result.points.every(point => point.incomeCents === 0 && point.expenseCents === 0 && point.balanceCents === 0)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
  it("é determinística e não modifica snapshots congelados", () => {
    const rows = [Object.freeze(transaction({ id: "b" })), Object.freeze(transaction({ id: "a", kind: "income" }))];
    const accounts = Object.freeze([Object.freeze(account())]);
    const result = timeline(Object.freeze(rows), accounts);
    expect(timeline([...rows].reverse(), accounts)).toEqual(result);
    expect(result.rows.map(row => row.id)).toEqual(["a", "b"]);
    expect(result.rows[0]).not.toBe(rows[1]);
  });
  it("recusa mistura de usuários, relações ausentes e IDs duplicados", () => {
    expect(() => timeline([transaction({ user_id: "other" })])).toThrow(/usuário/);
    expect(() => timeline([], [account(), account({ id: "foreign", user_id: "other" })])).toThrow(/usuário/);
    expect(() => timeline([transaction({ account_id: "missing" })])).toThrow(/conta/);
    expect(() => timeline([transaction(), transaction()])).toThrow(/duplicada/);
    expect(() => timeline([], [account(), account()])).toThrow(/duplicada/);
  });
  it("rejeita datas impossíveis, estados desconhecidos e centavos inseguros", () => {
    for (const month of ["2026-02-30", "2026-13", "2026-10-extra"]) expect(() => timeline([], [], month)).toThrow();
    expect(() => timeline([transaction({ occurred_on: "2026-02-30" })])).toThrow();
    expect(() => timeline([transaction({ statement_month: "2026-02-30" })])).toThrow();
    expect(() => timeline([transaction({ status: "unknown" as never })])).toThrow(/Estado/);
    expect(() => timeline([transaction({ amount_cents: 10.5 })])).toThrow(RangeError);
    expect(() => timeline([transaction({ id: "max", amount_cents: Number.MAX_SAFE_INTEGER, paid_cents: 0 }), transaction({ id: "extra", amount_cents: 1, paid_cents: 0 })])).toThrow(RangeError);
  });
});
