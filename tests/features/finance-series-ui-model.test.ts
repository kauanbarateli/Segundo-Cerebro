import { describe, expect, it } from "vitest";
import { FinanceFormError } from "../../src/components/features/financeiro/finance-form";
import {
  explicitStatementSlots,
  initialSeriesForm,
  seriesEffectReview,
  seriesIntent,
  type SeriesAction,
  type SeriesCatalog,
  type SeriesFormState,
} from "../../src/components/features/financeiro/series/series-ui-model";
import type { ContaFinanceira } from "../../src/core/financeiro/fused";
import type { FinanceSeriesPreview, FinanceSeriesPreviewData } from "../../src/core/financeiro/series/series-preview-types";
import type { FinanceSeriesDetailView } from "../../src/core/financeiro/series/series-public-validation";
import type { FinanceSeriesCommand, ManagedFinanceSeries } from "../../src/core/financeiro/series/series-types";
import { managedOccurrence, managedSeries, seriesAccount, seriesCategory, seriesId, SERIES_NOW, SERIES_OWNER } from "../fixtures/finance-series";

const TODAY = "2026-10-23";
const CLIENT_ID = seriesId(30);
const CARD: ContaFinanceira = {
  ...seriesAccount, id: seriesId(8), name: "Cartão sintético", kind: "credit_card",
  credit_limit_cents: 500000, statement_closing_day: 20, payment_due_day: 5,
};
const CATALOG: SeriesCatalog = { accounts: [seriesAccount, CARD], categories: [seriesCategory], tags: [] };
type Pair = ReturnType<typeof managedOccurrence>;

function form(patch: Partial<SeriesFormState> = {}): SeriesFormState {
  return {
    ...initialSeriesForm(TODAY), description: "Previsão sintética", account: seriesAccount.id,
    category: seriesCategory.id, amount: "100,00", ...patch,
  };
}

function detail(series: ManagedFinanceSeries = managedSeries(), pairs: Pair[] = [], accounts: ContaFinanceira[] = [seriesAccount]): FinanceSeriesDetailView {
  return structuredClone({
    version: 2 as const, finance_revision: "17", series,
    occurrences: pairs.map(item => item.occurrence), transactions: pairs.map(item => item.row),
    accounts, categories: [seriesCategory], tags: [],
  });
}

function createIntent(draft: SeriesFormState = form(), catalog: SeriesCatalog = CATALOG, today = TODAY) {
  const request = seriesIntent({ form: draft, action: "create", detail: null, catalog, today, clientId: CLIENT_ID, financeRevision: "17" });
  if (request.command !== "finance.recurring.create") throw new Error("A criação deve produzir a intenção de criação.");
  return request;
}

function existingIntent(action: Exclude<SeriesAction, "create">, data: FinanceSeriesDetailView, patch: Partial<SeriesFormState> = {}, occurrenceId?: string) {
  return seriesIntent({
    form: { ...initialSeriesForm(TODAY, data, occurrenceId), ...patch }, action, detail: data,
    occurrenceId, catalog: CATALOG, today: TODAY, clientId: CLIENT_ID,
  });
}

function review(request: FinanceSeriesCommand, data: FinanceSeriesPreviewData = {
  series: null, occurrences: [], transactions: [], accounts: [seriesAccount, CARD], categories: [seriesCategory], tags: [],
}, today = TODAY): Extract<FinanceSeriesPreview, { kind: "review" }> {
  const requestedSeries = request.command === "finance.recurring.create" ? null : request.input.expected_revision;
  return {
    version: 2, kind: "review", command: request.command, client_id: request.input.client_id,
    today, consistency: "same",
    revisions: {
      requested_finance: request.input.expected_finance_revision, observed_finance: request.input.expected_finance_revision,
      requested_series: requestedSeries, observed_series: data.series?.revision ?? null,
    }, data,
  };
}

function fieldsOf(run: () => unknown) {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(FinanceFormError);
    if (error instanceof FinanceFormError) return error.fields;
    throw error;
  }
  throw new Error("A intenção inválida deveria indicar os campos a revisar.");
}

function suppress(pair: Pair, suppression: "series_pause" | "manual" | "ended" = "series_pause"): Pair {
  return {
    occurrence: { ...pair.occurrence, suppression },
    row: { ...pair.row, deleted_at: SERIES_NOW },
  };
}

describe("#78B3: rascunho e intenção das séries financeiras", () => {
  it("começa sem valor preenchido e sem declarar uma realização ou posições anteriores", () => {
    expect(initialSeriesForm(TODAY)).toMatchObject({
      amount: "", paid: "0,00", firstIndex: "1", total: "12", anchor: TODAY,
      frequency: "monthly", from: TODAY, until: "2027-10-23", assignments: {},
    });
  });

  it("abre o valor monetário e a realização histórica da ocorrência sem alterar o detalhe", () => {
    const series = managedSeries({ template: { ...managedSeries().template, amount_cents: 123456, tag_ids: [seriesId(31)] } });
    const pair = managedOccurrence(series);
    pair.row.paid_cents = 3750;
    pair.row.status = "reconciled";
    const data = detail(series, [pair]);
    const before = structuredClone(data);
    const draft = initialSeriesForm(TODAY, data, pair.occurrence.id);

    expect(draft).toMatchObject({ amount: "1234,56", paid: "37,50", realization: "reconciled", tags: [seriesId(31)] });
    draft.tags.push(seriesId(32));
    expect(data).toEqual(before);
  });

  it.each([
    ["1.234,56", 123456],
    ["1,005", 101],
    ["0,01", 1],
  ] as const)("converte o campo BRL %s em centavos exatos sem pagamento implícito", (amount, cents) => {
    const request = createIntent(form({ amount, description: "  Mensalidade  ", payee: "  Destinatário  ", notes: "  Observação  " }));
    expect(request.input.definition.template).toMatchObject({
      amount_cents: cents, description: "Mensalidade", payee: "Destinatário", notes: "Observação", statement_mode: "none",
    });
    expect(request.input).toMatchObject({ client_id: CLIENT_ID, expected_finance_revision: "17" });
    expect(request.input.definition.template).not.toHaveProperty("paid_cents");
    expect(request.input).not.toHaveProperty("user_id");
    expect(request.input).not.toHaveProperty("transactions");
  });

  it.each(["0", "-0,01", "sem valor", "90071992547409,92"])("associa o valor inválido %s ao campo monetário", amount => {
    expect(fieldsOf(() => createIntent(form({ amount })))).toHaveProperty("amount");
  });

  it.each([
    { firstIndex: "0" }, { firstIndex: "13" }, { firstIndex: "1.5" },
    { total: "1" }, { total: "121" }, { anchor: "2026-02-30" },
  ])("recusa uma definição inválida sem normalizar silenciosamente %j", patch => {
    const draft = form(patch);
    const before = structuredClone(draft);
    expect(() => createIntent(draft)).toThrow(FinanceFormError);
    expect(draft).toEqual(before);
  });

  it("recusa conta arquivada e categoria de outra natureza", () => {
    const unavailable: SeriesCatalog = {
      ...CATALOG,
      accounts: [{ ...seriesAccount, archived_at: SERIES_NOW }],
      categories: [{ ...seriesCategory, kind: "income" }],
    };
    expect(fieldsOf(() => createIntent(form(), unavailable))).toMatchObject({
      account: expect.any(String), category: expect.any(String),
    });
  });

  it("preserva rascunho e UUID após erro e permite corrigir a mesma intenção", () => {
    const draft = form({ amount: "0", description: "  Texto ainda editado  ", notes: "rascunho preservado" });
    const before = structuredClone(draft);
    const input = { form: draft, action: "create" as const, detail: null, catalog: CATALOG, today: TODAY, clientId: CLIENT_ID, financeRevision: "17" };

    expect(() => seriesIntent(input)).toThrow(FinanceFormError);
    expect(draft).toEqual(before);
    expect(input.clientId).toBe(CLIENT_ID);
    draft.amount = "25,50";
    expect(seriesIntent(input)).toEqual(seriesIntent(input));
    expect(seriesIntent(input).input).toMatchObject({ client_id: CLIENT_ID, expected_finance_revision: "17" });
    expect(draft.description).toBe("  Texto ainda editado  ");
  });

  it("não substitui um UUID inválido por outra identidade ao indicar erro de formulário", () => {
    const draft = form();
    const input = { form: draft, action: "create" as const, detail: null, catalog: CATALOG, today: TODAY, clientId: "uuid-inválido" };
    const before = structuredClone(input);
    expect(fieldsOf(() => seriesIntent(input))).toHaveProperty("form");
    expect(input).toEqual(before);
  });
});

describe("#78B3: preview finito calculado pelo Núcleo", () => {
  it("começar na posição 5 de um parcelamento não fabrica as posições 1–4 nem pagamentos passados", () => {
    const request = createIntent(form({ seriesKind: "parcelamento", amount: "100,01", firstIndex: "5", total: "12" }));
    const result = seriesEffectReview(review(request), request, SERIES_OWNER);

    expect(request.input.definition).toMatchObject({ first_index: 5, total: 12, anchor_on: TODAY });
    expect(result.planned.map(row => row.index)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.planned.map(row => row.amount_cents)).toEqual([833, 833, 833, 833, 833, 833, 833, 838]);
    expect(result.planned.every(row => row.paid_cents === 0 && row.status === "planned")).toBe(true);
    expect(result.planned.every(row => !Object.hasOwn(row, "id") && !Object.hasOwn(row, "transaction_id"))).toBe(true);
    expect(result).toMatchObject({ restored: [], eligible: [], exhausted: true });
  });

  it.each([
    { frequency: "weekly" as const, count: 53, last: "2027-10-22" },
    { frequency: "monthly" as const, count: 12, last: "2027-09-23" },
    { frequency: "yearly" as const, count: 1, last: TODAY },
  ])("limita $frequency ao horizonte exclusivo de doze meses", ({ frequency, count, last }) => {
    const request = createIntent(form({ frequency, total: "120" }));
    const result = seriesEffectReview(review(request), request, SERIES_OWNER);
    expect(request.input.horizon).toEqual({ from_on: TODAY, until_exclusive: "2027-10-23" });
    expect(result.planned).toHaveLength(count);
    expect(result.planned.at(-1)?.occurred_on).toBe(last);
    expect(result.planned.every(row => row.occurred_on >= TODAY && row.occurred_on < "2027-10-23")).toBe(true);
    expect(result.exhausted).toBe(false);
  });

  it("preserva a âncora mensal em 31 depois do clamp de fevereiro", () => {
    const today = "2027-01-31";
    const request = createIntent(form({ anchor: today, total: "4", until: "2027-05-01" }), CATALOG, today);
    const result = seriesEffectReview(review(request, undefined, today), request, SERIES_OWNER);
    expect(result.planned.map(row => row.occurred_on)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it.each([TODAY, "2027-10-24", "2027-02-30"])("indica o campo de horizonte inválido %s", until => {
    expect(fieldsOf(() => createIntent(form({ until })))).toHaveProperty("until");
  });

  it("distingue ocorrências já materializadas das novas sem alterar o histórico", () => {
    const series = managedSeries({ total: 4 });
    const pair = managedOccurrence(series, 1);
    pair.row.status = "confirmed";
    pair.row.paid_cents = pair.row.amount_cents;
    const data = detail(series, [pair]);
    const before = structuredClone(data);
    const request = existingIntent("materialize", data);
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);
    expect(result.planned.map(row => row.index)).toEqual([2, 3, 4]);
    expect(result.alreadyMaterialized).toBe(1);
    expect(result.planned.every(row => row.paid_cents === 0)).toBe(true);
    expect(data).toEqual(before);
  });

  it("propaga a recusa do planner quando a conta do modelo está arquivada", () => {
    const request = createIntent();
    const response = review(request);
    response.data.accounts = [{ ...seriesAccount, archived_at: SERIES_NOW }];
    expect(() => seriesEffectReview(response, request, SERIES_OWNER)).toThrow("Selecione uma conta ativa do mesmo Usuário.");
  });
});

describe("#78B3: competência explícita do cartão", () => {
  it("exige uma competência para cada posição nova e mantém os campos preenchidos após o erro", () => {
    const draft = form({ account: CARD.id, statementMode: "explicit", firstIndex: "3", total: "5", assignments: { 3: "2026-11", 5: "mês inválido" } });
    const before = structuredClone(draft);
    expect(explicitStatementSlots(draft, "create", null, TODAY, CATALOG)).toEqual([
      { index: 3, day: TODAY }, { index: 4, day: "2026-11-23" }, { index: 5, day: "2026-12-23" },
    ]);
    expect(fieldsOf(() => createIntent(draft))).toMatchObject({ "statement-4": expect.any(String), "statement-5": expect.any(String) });
    expect(draft).toEqual(before);
  });

  it("serializa competências independentes como AAAA-MM-01 sem inferir ciclos anteriores", () => {
    const draft = form({
      account: CARD.id, statementMode: "explicit", firstIndex: "3", total: "5",
      assignments: { 1: "2020-01", 3: "2026-12", 4: "2027-02", 5: "2027-02" },
    });
    const request = createIntent(draft);
    const result = seriesEffectReview(review(request), request, SERIES_OWNER);
    expect(request.input.statement_assignments).toEqual([
      { index: 3, statement_month: "2026-12-01" }, { index: 4, statement_month: "2027-02-01" }, { index: 5, statement_month: "2027-02-01" },
    ]);
    expect(result.planned.map(row => row.statement_month)).toEqual(["2026-12-01", "2027-02-01", "2027-02-01"]);
    expect(result.planned.every(row => row.status === "planned" && row.paid_cents === row.amount_cents)).toBe(true);
  });

  it("usa o ciclo do cartão no Núcleo quando a competência não é manual", () => {
    const request = createIntent(form({ account: CARD.id, total: "2", statementMode: "account_cycle", assignments: { 1: "2030-01" } }));
    const result = seriesEffectReview(review(request), request, SERIES_OWNER);
    expect(request.input.statement_assignments).toEqual([]);
    expect(result.planned.map(row => row.statement_month)).toEqual(["2026-11-01", "2026-12-01"]);
  });

  it("solicita atribuição só das novas posições na materialização e mantém a competência histórica", () => {
    const series = managedSeries({ total: 3, next_index: 2, template: { ...managedSeries().template, account_id: CARD.id, statement_mode: "explicit" } });
    const pair = managedOccurrence(series, 1);
    pair.row.statement_month = "2026-12-01";
    pair.row.paid_cents = pair.row.amount_cents;
    const data = detail(series, [pair], [CARD]);
    const draft = { ...initialSeriesForm(TODAY, data), assignments: { 1: "2030-01", 2: "2027-02", 3: "2027-04" } };
    const request = existingIntent("materialize", data, draft);
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);
    expect(explicitStatementSlots(draft, "materialize", data, TODAY, CATALOG).map(slot => slot.index)).toEqual([2, 3]);
    expect(request.input).toMatchObject({ statement_assignments: [{ index: 2, statement_month: "2027-02-01" }, { index: 3, statement_month: "2027-04-01" }] });
    expect(result.planned.map(row => row.statement_month)).toEqual(["2027-02-01", "2027-04-01"]);
    expect(data.transactions[0]!.statement_month).toBe("2026-12-01");
  });

  it("ao trocar para cartão pede competência só das futuras elegíveis até o término escolhido", () => {
    const series = managedSeries({ anchor_on: "2026-09-23", total: 5, next_index: 6 });
    const pairs = [1, 2, 3, 4, 5].map(index => managedOccurrence(series, index));
    pairs[2]!.row.paid_cents = 100;
    pairs[3] = suppress(pairs[3]!, "manual");
    const data = detail(series, pairs);
    const draft = {
      ...initialSeriesForm(TODAY, data), account: CARD.id, statementMode: "explicit" as const,
      ends: "2026-12-31", assignments: { 2: "2026-12" },
    };
    expect(explicitStatementSlots(draft, "update_future", data, TODAY, CATALOG)).toEqual([{ index: 2, day: TODAY }]);
    expect(existingIntent("update_future", data, draft).input).toMatchObject({
      statement_assignments: [{ index: 2, statement_month: "2026-12-01" }],
    });
  });
});

describe("#78B3: revisão de elegibilidade e retomada", () => {
  it.each(["pause", "end", "update_future"] as const)("%s preserva passado, parciais, realizados, conciliados e exclusões manuais", action => {
    const series = managedSeries({ anchor_on: "2026-09-23" });
    const pairs = Array.from({ length: 9 }, (_, index) => managedOccurrence(series, index + 1));
    pairs[2]!.row.paid_cents = 1;
    pairs[3]!.row.status = "confirmed";
    pairs[4]!.row.status = "reconciled";
    pairs[5] = suppress(pairs[5]!, "manual");
    pairs[6]!.row.status = "pending";
    pairs[7]!.row.status = "cancelled";
    pairs[8] = suppress(pairs[8]!, "ended");
    const data = detail(series, pairs);
    const before = structuredClone(data);
    const request = existingIntent(action, data);
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);
    expect(result.eligible.map(row => row.id)).toEqual([pairs[1]!.row.id, pairs[6]!.row.id]);
    expect(result.protectedCount).toBe(7);
    expect(data).toEqual(before);
  });

  it("retoma todas as identidades futuras pausadas, inclusive além do horizonte de novas criações", () => {
    const series = managedSeries({ state: "paused", anchor_on: "2026-09-23", total: 18, next_index: 15, materialized_through: "2027-10-23" });
    const pairs = [1, 2, 4, 6, 14].map(index => suppress(managedOccurrence(series, index)));
    const data = detail(series, pairs);
    const before = structuredClone(data);
    const request = existingIntent("resume", data, { until: "2027-01-01" });
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);
    expect(result.restored.map(row => row.id)).toEqual(pairs.slice(1).map(item => item.row.id));
    expect(result.restored.map(row => row.occurred_on)).toEqual([TODAY, "2026-12-23", "2027-02-23", "2027-10-23"]);
    expect(result.planned).toEqual([]);
    expect(result).toMatchObject({ alreadyMaterialized: 0, protectedCount: 1 });
    expect(data).toEqual(before);
  });

  it("retomar não restaura exclusão manual, encerramento, ocorrência ativa ou parcial", () => {
    const series = managedSeries({ state: "paused", total: 6, next_index: 7 });
    const pairs = [1, 2, 3, 4, 5, 6].map(index => managedOccurrence(series, index));
    pairs[0] = suppress(pairs[0]!);
    pairs[1] = suppress(pairs[1]!, "manual");
    pairs[2] = suppress(pairs[2]!, "ended");
    pairs[4] = suppress(pairs[4]!);
    pairs[4]!.row.paid_cents = 1;
    pairs[5] = suppress(pairs[5]!);
    pairs[5]!.row.status = "confirmed";
    const data = detail(series, pairs);
    const request = existingIntent("resume", data);
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);
    expect(result.restored.map(row => row.id)).toEqual([pairs[0]!.row.id]);
    expect(result).toMatchObject({ planned: [], protectedCount: 5, exhausted: true });
  });

  it("a projeção de compra planejada no cartão não é confundida com pagamento de fatura ao pausar", () => {
    const series = managedSeries({ total: 2, template: { ...managedSeries().template, account_id: CARD.id, statement_mode: "account_cycle" } });
    const pair = managedOccurrence(series);
    pair.row.paid_cents = pair.row.amount_cents;
    pair.row.statement_month = "2026-11-01";
    const data = detail(series, [pair], [CARD]);
    const request = existingIntent("pause", data);
    expect(seriesEffectReview(review(request, data), request, SERIES_OWNER)).toMatchObject({ eligible: [pair.row], protectedCount: 0 });
  });

  it("não antecipa término que removeria uma ocorrência parcial protegida", () => {
    const series = managedSeries({ total: 3 });
    const pair = managedOccurrence(series, 3);
    pair.row.paid_cents = 100;
    const data = detail(series, [pair]);
    const request = existingIntent("update_future", data, { ends: "2026-11-23" });
    expect(() => seriesEffectReview(review(request, data), request, SERIES_OWNER)).toThrow("O término não pode remover uma ocorrência paga, parcial ou realizada.");
  });
});

describe("#78B3: Antes e Depois da edição de próximas ocorrências", () => {
  it("projeta 100 para 200 em um clone e conserva o lançamento original entre os elegíveis", () => {
    const series = managedSeries();
    const pair = managedOccurrence(series);
    const data = detail(series, [pair]);
    const before = structuredClone(data);
    const request = existingIntent("update_future", data, { amount: "200,00", description: "  Próxima versão  " });
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);
    const projection = result.updatedPreview[0];

    expect(result.eligible[0]).toBe(data.transactions[0]);
    expect(result.eligible[0]?.amount_cents).toBe(10000);
    expect(projection?.before).toBe(data.transactions[0]);
    expect(projection?.after).toMatchObject({ id: pair.row.id, amount_cents: 20000, paid_cents: 0, description: "Próxima versão", status: "planned" });
    expect(projection?.after).not.toBe(data.transactions[0]);
    expect(data).toEqual(before);

    if (!projection?.after?.tag_ids) throw new Error("A projeção deve conter o lançamento e suas etiquetas.");
    expect(projection.after.tag_ids).not.toBe(data.transactions[0]?.tag_ids);
    projection.after.amount_cents = 30000;
    projection.after.tag_ids.push(seriesId(32));
    expect(data).toEqual(before);
  });

  it.each([
    { mode: "account_cycle" as const, assignments: {} as Record<number, string>, months: ["2026-11-01", "2026-12-01"] },
    { mode: "explicit" as const, assignments: { 1: "2027-02", 2: "2027-04" } as Record<number, string>, months: ["2027-02-01", "2027-04-01"] },
  ])("trocar conta comum por cartão projeta competência $mode e a dívida sem pagar fatura", ({ mode, assignments, months }) => {
    const series = managedSeries({ total: 2 });
    const pairs = [1, 2].map(index => managedOccurrence(series, index));
    const data = detail(series, pairs, [seriesAccount, CARD]);
    const before = structuredClone(data);
    const request = existingIntent("update_future", data, { account: CARD.id, statementMode: mode, assignments });
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);

    expect(result.updatedPreview.map(item => item.after?.statement_month)).toEqual(months);
    expect(result.updatedPreview.map(item => item.after)).toEqual(pairs.map((item, index) => ({
      ...item.row, account_id: CARD.id, paid_cents: item.row.amount_cents, statement_month: months[index],
    })));
    expect(result.eligible.map(row => ({ account: row.account_id, paid: row.paid_cents, month: row.statement_month }))).toEqual([
      { account: seriesAccount.id, paid: 0, month: null }, { account: seriesAccount.id, paid: 0, month: null },
    ]);
    expect(data).toEqual(before);
  });

  it("no mesmo cartão conserva a competência histórica mesmo depois de alterar o fechamento", () => {
    const series = managedSeries({ template: { ...managedSeries().template, account_id: CARD.id, statement_mode: "account_cycle" } });
    const pair = managedOccurrence(series);
    pair.row.paid_cents = pair.row.amount_cents;
    pair.row.statement_month = "2026-11-01";
    const changedClosing = { ...CARD, statement_closing_day: 30 };
    const data = detail(series, [pair], [changedClosing]);
    const before = structuredClone(data);
    const request = existingIntent("update_future", data, { amount: "200,00" });
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);

    expect(result.updatedPreview[0]?.after).toMatchObject({
      account_id: CARD.id, amount_cents: 20000, paid_cents: 20000, statement_month: "2026-11-01", status: "planned",
    });
    expect(result.updatedPreview[0]?.before).toMatchObject({ amount_cents: 10000, paid_cents: 10000, statement_month: "2026-11-01" });
    expect(data).toEqual(before);
  });

  it("cortar o término projeta Depois nulo para a ocorrência excluída e conserva todos os originais", () => {
    const series = managedSeries({ total: 3 });
    const pairs = [1, 2, 3].map(index => managedOccurrence(series, index));
    const data = detail(series, pairs);
    const before = structuredClone(data);
    const request = existingIntent("update_future", data, { amount: "200,00", ends: "2026-11-23" });
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);

    expect(result.updatedPreview.map(item => item.after?.amount_cents ?? null)).toEqual([20000, 20000, null]);
    expect(result.updatedPreview[2]).toEqual({ before: pairs[2]!.row, after: null });
    expect(result.eligible.map(row => row.id)).toEqual(pairs.map(item => item.row.id));
    expect(data).toEqual(before);
    expect(data.transactions.every(row => row.deleted_at === null && row.amount_cents === 10000)).toBe(true);
  });

  it("editar descrição do parcelamento conserva os valores de cada parcela e o resto da última", () => {
    const series = managedSeries({ kind: "parcelamento", total: 3, template: { ...managedSeries().template, amount_cents: 10001 } });
    const pairs = [1, 2, 3].map(index => managedOccurrence(series, index));
    pairs.forEach((pair, index) => { pair.row.amount_cents = index === 2 ? 3335 : 3333; });
    const data = detail(series, pairs);
    const before = structuredClone(data);
    const request = existingIntent("update_future", data, { description: "Parcelamento revisado" });
    const result = seriesEffectReview(review(request, data), request, SERIES_OWNER);

    expect(result.updatedPreview.map(item => item.after?.amount_cents)).toEqual([3333, 3333, 3335]);
    expect(result.updatedPreview.every(item => item.after?.description === "Parcelamento revisado")).toBe(true);
    expect(result.updatedPreview.map(item => item.before.amount_cents)).toEqual([3333, 3333, 3335]);
    expect(data).toEqual(before);
    expect(data.series.template.amount_cents).toBe(10001);
  });

  it("recusa trocar o total original do parcelamento sem alterar os lançamentos na prévia", () => {
    const series = managedSeries({ kind: "parcelamento", total: 3, template: { ...managedSeries().template, amount_cents: 10001 } });
    const pair = managedOccurrence(series);
    pair.row.amount_cents = 3333;
    const data = detail(series, [pair]);
    const before = structuredClone(data);
    const request = existingIntent("update_future", data, { amount: "200,00" });

    expect(() => seriesEffectReview(review(request, data), request, SERIES_OWNER)).toThrow("O total original do parcelamento é imutável.");
    expect(data).toEqual(before);
  });
});

describe("#78B3: realização explícita da ocorrência", () => {
  it.each([
    { paid: "37,50", status: "confirmed" as const, cents: 3750 },
    { paid: "100,00", status: "reconciled" as const, cents: 10000 },
  ])("envia pagamento $paid e estado $status escolhidos sem alterar a prévia", ({ paid, status, cents }) => {
    const series = managedSeries();
    const pair = managedOccurrence(series);
    const data = detail(series, [pair]);
    const before = structuredClone(data);
    const request = existingIntent("occurrence.update", data, { paid, realization: status }, pair.occurrence.id);
    expect(request).toEqual({
      command: "finance.recurring.occurrence.update",
      input: { client_id: CLIENT_ID, expected_finance_revision: "17", series_id: series.id, expected_revision: series.revision, occurrence_id: pair.occurrence.id, patch: { status, paid_cents: cents } },
    });
    expect(seriesEffectReview(review(request, data), request, SERIES_OWNER).eligible).toEqual([pair.row]);
    expect(data).toEqual(before);
  });

  it("não transforma o estado confirmado em quitação total de uma conta comum", () => {
    const series = managedSeries();
    const pair = managedOccurrence(series);
    const data = detail(series, [pair]);
    const request = existingIntent("occurrence.update", data, {}, pair.occurrence.id);
    expect(request.input).toMatchObject({ patch: { status: "confirmed", paid_cents: 0 } });
    expect(seriesEffectReview(review(request, data), request, SERIES_OWNER).eligible).toEqual([pair.row]);
  });

  it.each(["30,00", "100,01"])("a policy recusa reduzir pagamento anterior ou exceder o total: %s", paid => {
    const series = managedSeries();
    const pair = managedOccurrence(series);
    pair.row.paid_cents = 3500;
    const data = detail(series, [pair]);
    const request = existingIntent("occurrence.update", data, { paid }, pair.occurrence.id);
    expect(() => seriesEffectReview(review(request, data), request, SERIES_OWNER)).toThrow("A realização preserva pagamentos já registrados e não ultrapassa o valor.");
  });

  it("preserva o campo de pagamento e UUID quando o valor realizado é inválido", () => {
    const series = managedSeries();
    const pair = managedOccurrence(series);
    const data = detail(series, [pair]);
    const draft = { ...initialSeriesForm(TODAY, data, pair.occurrence.id), paid: "-0,01" };
    const input = { form: draft, action: "occurrence.update" as const, detail: data, occurrenceId: pair.occurrence.id, catalog: CATALOG, today: TODAY, clientId: CLIENT_ID };
    const before = structuredClone(input);
    expect(fieldsOf(() => seriesIntent(input))).toHaveProperty("paid");
    expect(input).toEqual(before);
  });

  it("realizar compra no cartão conserva a projeção e não emite comando de pagamento de fatura", () => {
    const series = managedSeries({ template: { ...managedSeries().template, account_id: CARD.id, statement_mode: "account_cycle" } });
    const pair = managedOccurrence(series);
    pair.row.paid_cents = pair.row.amount_cents;
    pair.row.statement_month = "2026-11-01";
    const data = detail(series, [pair], [CARD]);
    const request = existingIntent("occurrence.update", data, {}, pair.occurrence.id);
    expect(request.command).toBe("finance.recurring.occurrence.update");
    expect(request.input).toMatchObject({ patch: { status: "confirmed", paid_cents: pair.row.amount_cents } });
    expect(request.input).not.toHaveProperty("from_account_id");
    expect(request.input).not.toHaveProperty("statement_month");
    expect(seriesEffectReview(review(request, data), request, SERIES_OWNER).eligible).toEqual([pair.row]);

    const partialInvoice = existingIntent("occurrence.update", data, { paid: "25,00" }, pair.occurrence.id);
    expect(() => seriesEffectReview(review(partialInvoice, data), partialInvoice, SERIES_OWNER)).toThrow();
  });
});
