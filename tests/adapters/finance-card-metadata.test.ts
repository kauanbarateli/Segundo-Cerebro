import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decodeFinanceRequest } from "../../src/adapters/db/finance-commands";
import { parseFinanceSnapshot, validateFinanceRow } from "../../src/adapters/db/finance-gateway";
import { accounts, FINANCE_ACTOR } from "../fixtures/finance-regression";

const card = { ...accounts.find(account => account.kind === "credit_card")!, id: "10000000-0000-4000-8000-000000000003" };
const bank = { ...accounts.find(account => account.kind !== "credit_card")!, id: "10000000-0000-4000-8000-000000000004" };
const snapshot = (rows: unknown[]) => ({ revision: "0", accounts: rows, categories: [], transactions: [], budgets: [], tags: [], events: [], receipts: [] });
describe("T052 — bordas dos metadados de cartão", () => {
  it("aceita ausência, null e quatro dígitos sem transformar o payload legado", () => {
    for (const patch of [{}, { last_four: null, default_payment_account_id: null }, { last_four: "0042", default_payment_account_id: bank.id }]) {
      const row = { ...card, ...patch };
      expect(parseFinanceSnapshot(snapshot([row, bank]), FINANCE_ACTOR).accounts[0]).toEqual(row);
    }
  });
  it.each([{ last_four: 1234 }, { last_four: "123" }, { last_four: "12345" }, { last_four: "１２３４" }, { default_payment_account_id: "" }, { default_payment_account_id: 1234 }, { pan: "synthetic" }, { cvv: "synthetic" }])("recusa metadado malformado ou campo proibido %j", patch => {
    expect(() => validateFinanceRow({ ...card, ...patch }, "finance_account", FINANCE_ACTOR)).toThrow();
  });
  it("referência atual exige conta presente do mesmo dono, moeda e tipo", () => {
    const row = { ...card, default_payment_account_id: bank.id };
    for (const target of [undefined, { ...bank, user_id: "other" }, { ...bank, currency: "USD" }, { ...bank, kind: "credit_card" }]) {
      expect(() => parseFinanceSnapshot(snapshot([row, ...(target ? [target] : [])]), FINANCE_ACTOR)).toThrow();
    }
  });
  it("decoder mantém apenas os dois novos nomes fechados e valida UUID da referência", () => {
    const input = { id: card.id, client_id: "metadata", patch: { last_four: "0042", default_payment_account_id: bank.id } };
    expect(decodeFinanceRequest({ command: "finance.account.update", input })).toEqual({ command: "finance.account.update", input });
    for (const patch of [{ default_payment_account_id: "not-uuid" }, { card_number: "synthetic" }, { cvv: "synthetic" }, { user_id: FINANCE_ACTOR }]) {
      expect(() => decodeFinanceRequest({ command: "finance.account.update", input: { ...input, patch } })).toThrow();
    }
  });
});
