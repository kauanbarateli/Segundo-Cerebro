import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinanceCardOverview } from "../../src/components/features/financeiro/finance-panels";
import { accountDraft, accountFields, FinanceFormError, suggestedStatementAccount } from "../../src/components/features/financeiro/finance-form";
import { createDemoFixture } from "../../src/lib/demo/fixtures";

const fixture = createDemoFixture().initial;
const data = { accounts: fixture.finance_account!, categories: fixture.finance_category!, transactions: fixture.finance_transaction!, budgets: fixture.finance_budget!, tags: fixture.finance_tag ?? [] };
const card = { ...data.accounts.find(account => account.kind === "credit_card")!, last_four: "0042", default_payment_account_id: "account-itau" };
const bank = data.accounts.find(account => account.id === "account-itau")!;
const actions = { edit() {}, openCard() {}, allCards() {} };
describe("T052 — composição e privacidade dos cartões", () => {
  it("renderiza final real e mês da fatura sem inventar número para legado", () => {
    const html = renderToStaticMarkup(<FinanceCardOverview data={{ ...data, accounts: [card] }} month="2026-09-01" hidden={false} {...actions} />);
    expect(html).toContain("Meus cartões");
    expect(html).toContain("Final 0042");
    expect(html).toContain("setembro de 2026");
    const legacy = renderToStaticMarkup(<FinanceCardOverview data={data} month="2026-09-01" hidden={false} {...actions} />);
    expect(legacy).not.toContain("0042");
  });
  it("máscara remove final e valores do markup da coluna", () => {
    const html = renderToStaticMarkup(<FinanceCardOverview data={{ ...data, accounts: [card] }} month="2026-09-01" hidden {...actions} />);
    expect(html).not.toContain("0042");
    expect(html).toContain("Final oculto");
    expect(html).not.toContain("aria-valuenow");
    expect(html).not.toMatch(/data-(?:value|amount|balance)/);
  });
  it("vazio continua uma orientação de cadastro, sem valores fictícios", () => {
    const html = renderToStaticMarkup(<FinanceCardOverview data={{ ...data, accounts: [] }} month="2026-09-01" hidden={false} {...actions} />);
    expect(html).toContain("Adicione um cartão para acompanhar");
    expect(html).toContain("Adicionar cartão");
  });
  it("sugestão é apenas ID elegível; ausente, arquivada, estrangeira, cartão ou moeda diferente ficam sem seleção", () => {
    expect(suggestedStatementAccount(card, [bank])).toBe(bank.id);
    for (const accounts of [[], [{ ...bank, archived_at: "2026-09-24T12:00:00Z" }], [{ ...bank, user_id: "other" }], [{ ...bank, kind: "credit_card" as const }], [{ ...bank, currency: "USD" }]]) {
      expect(suggestedStatementAccount(card, accounts)).toBe("");
    }
    expect(suggestedStatementAccount({ ...card, default_payment_account_id: null }, [bank])).toBe("");
  });
  it("rascunho preserva ausência e permite limpar os dois campos explicitamente", () => {
    const legacy = accountFields(accountDraft(data.accounts.find(account => account.kind === "credit_card")), data.accounts);
    expect(Object.hasOwn(legacy, "last_four")).toBe(false);
    expect(Object.hasOwn(legacy, "default_payment_account_id")).toBe(false);
    expect(accountFields({ ...accountDraft(card), lastFour: "", paymentAccount: "" }, data.accounts)).toMatchObject({ last_four: null, default_payment_account_id: null });
  });
  it("formulário recusa número completo e conta sugerida inelegível", () => {
    expect(() => accountFields({ ...accountDraft(card), lastFour: "1234567890123456" }, data.accounts)).toThrow(FinanceFormError);
    expect(() => accountFields({ ...accountDraft(card), paymentAccount: card.id }, data.accounts)).toThrow(FinanceFormError);
  });
  it("editar nome conserva a referência arquivada; abrir pagamento não a sugere", () => {
    const archived = { ...bank, archived_at: "2026-09-24T12:00:00Z" };
    expect(accountFields({ ...accountDraft(card), name: "Nome revisado" }, [archived], card).default_payment_account_id).toBe(bank.id);
    expect(suggestedStatementAccount(card, [archived])).toBe("");
  });
});
