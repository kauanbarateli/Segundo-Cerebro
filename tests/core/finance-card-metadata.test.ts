import { describe, expect, it } from "vitest";
import { criarAdapterMemoria } from "../../src/adapters/memory";
import { criarContaFinanceira, editarContaFinanceira, faturaFinanceira, saldosFinanceiros, type CamposContaFinanceira, type ContaFinanceira } from "../../src/core/financeiro";
import { createDemoFixture, DEMO_NOW, DEMO_USER_ID } from "../../src/lib/demo/fixtures";

const context = { user_id: DEMO_USER_ID, canal: "web" as const };
const card: CamposContaFinanceira = { name: "Cartão pessoal", kind: "credit_card", institution: null, opening_balance_cents: 0, color_key: "fin-1", credit_limit_cents: 100000, statement_closing_day: 28, payment_due_day: 5 };
function setup(prepare?: (accounts: ContaFinanceira[]) => void) {
  let next = 0;
  const deps = { clock: { now: () => DEMO_NOW }, ids: { next: () => "card-metadata-" + (++next) } };
  const initial = createDemoFixture().initial;
  prepare?.(initial.finance_account!);
  const store = criarAdapterMemoria({ ...deps, initial });
  return { store, deps, read: store.read(DEMO_USER_ID) };
}

describe("T052 — metadados opcionais do cartão", () => {
  it("ausência legada continua ausente no payload e significa não configurado", async () => {
    const h = setup();
    const saved = await criarContaFinanceira(h.store, h.deps, context, { ...card, client_id: "legacy" });
    expect(Object.hasOwn(saved, "last_four")).toBe(false);
    expect(Object.hasOwn(saved, "default_payment_account_id")).toBe(false);
    expect(saved.last_four ?? null).toBeNull();
    expect(saved.default_payment_account_id ?? null).toBeNull();
  });
  it("salva final com zero à esquerda e conta própria sem alterar lançamentos, saldos ou fatura", async () => {
    const h = setup(), before = await h.read.financeiro.contas.get("account-nubank");
    const rows = await h.read.financeiro.lancamentos.list(), accounts = await h.read.financeiro.contas.list();
    const invoice = faturaFinanceira(rows, before!, "2026-09-01"), balances = saldosFinanceiros(rows, accounts);
    const input = { id: before!.id, client_id: "metadata", patch: { last_four: "0042", default_payment_account_id: "account-itau" } };
    const saved = await editarContaFinanceira(h.store, h.deps, context, input);
    expect(saved).toMatchObject(input.patch);
    expect(await editarContaFinanceira(h.store, h.deps, context, input)).toEqual(saved);
    expect(await h.read.eventos.list()).toHaveLength(1);
    expect(await h.read.financeiro.lancamentos.list()).toEqual(rows);
    expect(faturaFinanceira(rows, saved, "2026-09-01")).toEqual(invoice);
    expect(saldosFinanceiros(rows, await h.read.financeiro.contas.list())).toEqual(balances);
    await expect(editarContaFinanceira(h.store, h.deps, context, { ...input, patch: { ...input.patch, last_four: "0043" } })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await h.read.financeiro.contas.get(before!.id)).toEqual(saved);
  });
  it("limpeza explícita usa null e preserva o ciclo", async () => {
    const h = setup();
    await editarContaFinanceira(h.store, h.deps, context, { id: "account-nubank", client_id: "set", patch: { last_four: "0042", default_payment_account_id: "account-itau" } });
    const saved = await editarContaFinanceira(h.store, h.deps, context, { id: "account-nubank", client_id: "clear", patch: { last_four: null, default_payment_account_id: null } });
    expect(saved).toMatchObject({ last_four: null, default_payment_account_id: null, statement_closing_day: 28, payment_due_day: 5 });
    expect(await h.read.eventos.list()).toHaveLength(2);
  });
  it.each(["", "123", "12345", "1234 5678 9012 3456", "12a4", "１２３４", 1234])("recusa final inválido %s sem evento", async (last_four) => {
    const h = setup();
    await expect(criarContaFinanceira(h.store, h.deps, context, { ...card, last_four: last_four as string, client_id: "invalid" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.read.eventos.list()).toEqual([]);
  });
  it.each(["missing", "account-nubank"])("recusa conta sugerida ausente ou cartão: %s", async (default_payment_account_id) => {
    const h = setup();
    await expect(criarContaFinanceira(h.store, h.deps, context, { ...card, default_payment_account_id, client_id: "invalid" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.read.eventos.list()).toEqual([]);
  });
  it("recusa outra pessoa, moeda incompatível e conta arquivada", async () => {
    for (const patch of [{ user_id: "other-user" }, { currency: "USD" }, { archived_at: DEMO_NOW }]) {
      const h = setup(accounts => Object.assign(accounts.find(account => account.id === "account-itau")!, patch));
      await expect(criarContaFinanceira(h.store, h.deps, context, { ...card, default_payment_account_id: "account-itau", client_id: "invalid" })).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await h.read.eventos.list()).toEqual([]);
    }
  });
  it("renomear cartão conserva sugestão arquivada posteriormente, sem reaplicá-la ao pagamento", async () => {
    const h = setup(accounts => {
      accounts.find(account => account.id === "account-itau")!.archived_at = DEMO_NOW;
      accounts.find(account => account.id === "account-nubank")!.default_payment_account_id = "account-itau";
    });
    const saved = await editarContaFinanceira(h.store, h.deps, context, { id: "account-nubank", client_id: "rename", patch: { name: "Nome revisado" } });
    expect(saved.default_payment_account_id).toBe("account-itau");
  });
  it("conta comum não recebe metadados de cartão", async () => {
    const h = setup();
    await expect(editarContaFinanceira(h.store, h.deps, context, { id: "account-itau", client_id: "invalid", patch: { last_four: "1234" } })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(editarContaFinanceira(h.store, h.deps, context, { id: "account-itau", client_id: "invalid2", patch: { default_payment_account_id: "account-cdb" } })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
