import { describe, expect, it } from "vitest";
import { criarAdapterMemoria, type PontoDeFalha } from "../../src/adapters/memory";
import { criarContaFinanceira, editarContaFinanceira, criarCategoriaFinanceira, editarCategoriaFinanceira, criarLancamentoFinanceiro, editarLancamentoFinanceiro, excluirLancamentoFinanceiro, restaurarLancamentoFinanceiro, salvarOrcamentoFinanceiro, totaisFinanceiros, despesasPorCategoriaFinanceiras, faturasFinanceirasQueVencemEm, normalizarPagamento, type CamposLancamentoFinanceiro, type CamposContaFinanceira, type CamposCategoriaFinanceira } from "../../src/core/financeiro";
import { createDemoFixture, DEMO_NOW, DEMO_USER_ID } from "../../src/lib/demo/fixtures";
const context = { user_id: DEMO_USER_ID, canal: "web" as const };
function setup() {
  let count = 0; let fail: PontoDeFalha | null = null;
  const deps = { clock: { now: () => DEMO_NOW }, ids: { next: () => `finance-command-${++count}` } };
  const store = criarAdapterMemoria({ ...deps, initial: createDemoFixture().initial, beforeOperation(point) { if (point === fail) { fail = null; throw new Error("Falha de infraestrutura"); } } });
  return { store, deps, read: store.read(context.user_id), fail: (point: PontoDeFalha) => { fail = point; } };
}
const transaction = (extra: Partial<CamposLancamentoFinanceiro> = {}) => ({ client_id: "new", account_id: "account-itau", category_id: "fin-category-2", kind: "expense" as const, amount_cents: 10000, paid_cents: 4000, description: "Mercado", payee: null, occurred_on: "2026-09-29", status: "confirmed" as const, due_date: null, notes: null, ...extra });
const account: CamposContaFinanceira = { name: "Reserva", kind: "savings", institution: null, opening_balance_cents: 1000, color_key: "fin-2", credit_limit_cents: null, statement_closing_day: null, payment_due_day: null };

describe("comandos financeiros compartilhados de M1", () => {
  it("criação e replay registram uma entidade/evento; payload divergente conflita", async () => {
    const h = setup(); const input = transaction();
    const [a, b] = await Promise.all([criarLancamentoFinanceiro(h.store, h.deps, context, input), criarLancamentoFinanceiro(h.store, h.deps, context, input)]);
    expect(a).toEqual(b); expect(a).toMatchObject({ paid_cents: 4000, statement_month: null, source: "manual" });
    expect(await h.read.eventos.list()).toHaveLength(1);
    await expect(criarLancamentoFinanceiro(h.store, h.deps, context, { ...input, description: "Outro" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("cartão normaliza pagamento antes do limite e deriva competência uma única vez", async () => {
    const h = setup(); const card = (await h.read.financeiro.contas.get("account-nubank"))!;
    const row = await criarLancamentoFinanceiro(h.store, h.deps, context, transaction({ account_id: card.id, paid_cents: 0 }));
    expect(row).toMatchObject({ paid_cents: 10000, statement_month: "2026-10-01" });
    const reduced = await editarLancamentoFinanceiro(h.store, h.deps, context, { id: row.id, client_id: "reduce", patch: { amount_cents: 9000 } });
    expect(reduced.paid_cents).toBe(9000);
    expect(normalizarPagamento({ ...reduced, paid_cents: 100000 }, card).paid_cents).toBe(9000);
    await expect(criarLancamentoFinanceiro(h.store, h.deps, context, { ...transaction({ paid_cents: 10001 }), client_id: "invalid-cash" })).rejects.toThrow("ultrapassar");
  });
  it("editar ciclo/data não reatribui histórico; compra nova usa ciclo atual", async () => {
    const h = setup(); const row = await criarLancamentoFinanceiro(h.store, h.deps, context, transaction({ account_id: "account-nubank" }));
    await editarContaFinanceira(h.store, h.deps, context, { id: "account-nubank", client_id: "cycle", patch: { statement_closing_day: 31 } });
    const after = await editarLancamentoFinanceiro(h.store, h.deps, context, { id: row.id, client_id: "edit", patch: { description: "Descrição nova", occurred_on: "2026-09-10" } });
    expect(after.statement_month).toBe("2026-10-01");
    const newer = await criarLancamentoFinanceiro(h.store, h.deps, context, { ...transaction({ account_id: "account-nubank" }), client_id: "newer" });
    expect(newer.statement_month).toBe("2026-09-01");
  });
  it.each([undefined, null])("trocar conta para cartão com competência %s deriva mês", async (statement_month) => {
    const h = setup(); const row = await criarLancamentoFinanceiro(h.store, h.deps, context, transaction());
    const moved = await editarLancamentoFinanceiro(h.store, h.deps, context, { id: row.id, client_id: "move", patch: { account_id: "account-nubank", statement_month } });
    expect(moved).toMatchObject({ statement_month: "2026-10-01", paid_cents: 10000 });
    const cash = await editarLancamentoFinanceiro(h.store, h.deps, context, { id: row.id, client_id: "cash", patch: { account_id: "account-itau" } });
    expect(cash.statement_month).toBeNull();
  });
  it("refere somente entidades do usuário; bloqueia despesa em categoria de receita", async () => {
    const h = setup(); const foreign = await criarContaFinanceira(h.store, h.deps, { ...context, user_id: "foreign" }, { ...account, client_id: "foreign" });
    await expect(criarLancamentoFinanceiro(h.store, h.deps, context, transaction({ account_id: foreign.id }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(criarLancamentoFinanceiro(h.store, h.deps, context, transaction({ category_id: "fin-category-0" }))).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await criarLancamentoFinanceiro(h.store, h.deps, context, transaction({ kind: "income" }))).kind).toBe("income");
  });
  it.each(["event", "commit"] as const)("falha em %s desfaz entidade, evento e recibo", async (point) => {
    const h = setup(); const before = await h.read.financeiro.lancamentos.list(); h.fail(point);
    await expect(criarLancamentoFinanceiro(h.store, h.deps, context, transaction())).rejects.toThrow("infraestrutura");
    expect(await h.read.financeiro.lancamentos.list()).toEqual(before); expect(await h.read.eventos.list()).toEqual([]);
    expect(await criarLancamentoFinanceiro(h.store, h.deps, context, transaction())).toMatchObject({ description: "Mercado" });
  });
  it("lixeira e restauração preservam pagamento e ciclo de vida; vínculo composto não aceita edição isolada", async () => {
    const h = setup(); const row = await criarLancamentoFinanceiro(h.store, h.deps, context, transaction({ status: "pending" }));
    await excluirLancamentoFinanceiro(h.store, h.deps, context, { id: row.id, client_id: "delete" });
    await expect(editarLancamentoFinanceiro(h.store, h.deps, context, { id: row.id, client_id: "edit", patch: { status: "confirmed" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await restaurarLancamentoFinanceiro(h.store, h.deps, context, { id: row.id, client_id: "restore" })).toEqual(row);
    await expect(excluirLancamentoFinanceiro(h.store, h.deps, context, { id: "fin-transfer-out", client_id: "linked" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(editarLancamentoFinanceiro(h.store, h.deps, context, { id: "fin-transfer-out", client_id: "linked-edit", patch: { amount_cents: 1 } })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("conta valida cor/tipo no runtime, sem reclassificar histórico", async () => {
    const h = setup(); const row = await criarContaFinanceira(h.store, h.deps, context, { ...account, client_id: "account" });
    for (const patch of [{ kind: "credit_card", credit_limit_cents: 1000, statement_closing_day: 1, payment_due_day: 2 }, { color_key: ["fin-1"] }, "invalid", null, []]) {
      await expect(editarContaFinanceira(h.store, h.deps, context, { id: row.id, client_id: "bad", patch: patch as Partial<CamposContaFinanceira> })).rejects.toMatchObject({ code: "VALIDATION" });
    }
    expect(await h.read.financeiro.contas.get(row.id)).toEqual(row);
  });
  it("categorias normalizadas e orçamento único por mês conservam identidade", async () => {
    const h = setup(); const category = await criarCategoriaFinanceira(h.store, h.deps, context, { client_id: "category", name: "  Educação  ", kind: "expense", color_key: "fin-2" });
    await expect(criarCategoriaFinanceira(h.store, h.deps, context, { client_id: "duplicate", name: "EDUCACAO", kind: "expense", color_key: "fin-3" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(editarCategoriaFinanceira(h.store, h.deps, context, { id: category.id, client_id: "kind", patch: { kind: "income" } as Partial<CamposCategoriaFinanceira> })).rejects.toMatchObject({ code: "VALIDATION" });
    const input = { client_id: "budget", category_id: category.id, month: "2026-09-01", limit_cents: 10000 };
    const first = await salvarOrcamentoFinanceiro(h.store, h.deps, context, input);
    const next = await salvarOrcamentoFinanceiro(h.store, h.deps, context, { ...input, client_id: "budget-edit", limit_cents: 20000 });
    expect(next).toMatchObject({ id: first.id, created_at: first.created_at, limit_cents: 20000 });
    expect((await h.read.financeiro.orcamentos.list()).filter((row) => row.category_id === category.id)).toHaveLength(1);
    await expect(salvarOrcamentoFinanceiro(h.store, h.deps, context, { ...input, client_id: "bad-month", month: "2026-02-31" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it.each([{ amount_cents: 0 }, { amount_cents: 1.1 }, { paid_cents: -1 }, { occurred_on: "2026-02-31" }, { due_date: "2026-13-01" }, { status: "unknown" }])("recusa entrada inválida sem escrita: %j", async (patch) => {
    const h = setup(); await expect(criarLancamentoFinanceiro(h.store, h.deps, context, transaction(patch as Partial<CamposLancamentoFinanceiro>))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.read.eventos.list()).toHaveLength(0);
  });
  it("wrappers de gráfico e vencimento usam os mesmos reais da massa", async () => {
    const h = setup(); const accounts = await h.read.financeiro.contas.list(), categories = await h.read.financeiro.categorias.list(), transactions = await h.read.financeiro.lancamentos.list();
    const totals = totaisFinanceiros(transactions, accounts, ["2026-09-01"]);
    const chart = despesasPorCategoriaFinanceiras(transactions, categories, ["2026-09-01"], accounts);
    expect(chart.reduce((sum, row) => sum + row.totalCents, 0)).toBe(totals.expenseCents);
    expect(faturasFinanceirasQueVencemEm(transactions, accounts, "2026-09-01").reduce((sum, row) => sum + row.openCents, 0)).toBe(0);
    expect(faturasFinanceirasQueVencemEm(transactions, accounts, "2026-10-01")).toEqual([expect.objectContaining({ cardId: "account-nubank", openCents: 241280, vence: "2026-10-05" })]);
  });
  it("plano total null grava/atualiza/replay uma entidade sem consultar categoria", async () => {
    const h = setup(), input = { client_id: "total-plan", category_id: null, month: "2026-09-01", limit_cents: 40000 };
    const first = await salvarOrcamentoFinanceiro(h.store, h.deps, context, input);
    expect(await salvarOrcamentoFinanceiro(h.store, h.deps, context, input)).toEqual(first);
    const updated = await salvarOrcamentoFinanceiro(h.store, h.deps, context, { ...input, client_id: "total-edit", limit_cents: 50000 });
    expect(updated).toMatchObject({ id: first.id, category_id: null, limit_cents: 50000, created_at: first.created_at });
    expect((await h.read.financeiro.orcamentos.list()).filter(row => row.category_id === null && row.month === input.month)).toHaveLength(1);
    expect((await h.read.eventos.list()).filter(event => event.entity_type === "finance_budget")).toHaveLength(2);
    await expect(salvarOrcamentoFinanceiro(h.store, h.deps, context, { ...input, limit_cents: 40001 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each(["event", "commit"] as const)("falha em%s no plano total desfaz orçamento/evento/receipt", async point => {
    const h = setup(), before = await h.read.financeiro.orcamentos.list(), input = { client_id: "plan-atomic", category_id: null, month: "2026-09-01", limit_cents: 40000 };
    h.fail(point);
    await expect(salvarOrcamentoFinanceiro(h.store, h.deps, context, input)).rejects.toThrow("infraestrutura");
    expect(await h.read.financeiro.orcamentos.list()).toEqual(before);
    expect(await h.read.eventos.list()).toEqual([]);
    expect(await salvarOrcamentoFinanceiro(h.store, h.deps, context, input)).toMatchObject({ category_id: null, limit_cents: 40000 });
  });
  it.each([undefined, "", 1, false])("categoria inválida%j não é promovida a plano total", async category_id => {
    const h = setup();
    const input = { client_id: "invalid-plan", category_id, month: "2026-09-01", limit_cents: 40000 } as Parameters<typeof salvarOrcamentoFinanceiro>[3];
    await expect(salvarOrcamentoFinanceiro(h.store, h.deps, context, input)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.read.eventos.list()).toEqual([]);
  });
});
