import { describe, expect, it } from "vitest";
import { decodeSeriesAvailability, decodeSeriesDetail, decodeSeriesPage, decodeSeriesPreview, decodeSeriesResult, publicSeriesRevision } from "../../src/core/financeiro/series/series-public-validation";
import { definitionOfSeries } from "../../src/core/financeiro/series/series-planning";
import type { FinanceSeriesCommand, FinanceSeriesResult } from "../../src/core/financeiro/series/series-types";
import { managedOccurrence, managedSeries, seriesAccount, seriesCategory, seriesId, SERIES_OWNER } from "../fixtures/finance-series";

const create = (): Extract<FinanceSeriesCommand, { command: "finance.recurring.create" }> => ({ command: "finance.recurring.create", input: { client_id: seriesId(901), expected_finance_revision: "0", definition: definitionOfSeries(managedSeries()), horizon: { from_on: "2026-10-23", until_exclusive: "2027-10-23" }, statement_assignments: [] } });
const detail = () => ({ version: 2, finance_revision: "9007199254740993", series: managedSeries({ next_index: 2, materialized_through: "2026-10-23" }), occurrences: [managedOccurrence(managedSeries()).occurrence], transactions: [managedOccurrence(managedSeries()).row], accounts: [structuredClone(seriesAccount)], categories: [structuredClone(seriesCategory)], tags: [] });
const result = (): FinanceSeriesResult => ({ version: 2, series: managedSeries(), affected: { created: 0, updated: 0, suppressed: 0, restored: 0, skipped: 0 } });
describe("T053-B3: DTO público puro, fechado e vinculado", () => {
  it("preserva bigint textual, nega aliases e campos extras na disponibilidade", () => { expect(publicSeriesRevision("9007199254740993")).toBe("9007199254740993"); for (const bad of ["00", 0, "9223372036854775808", "-1"]) expect(() => publicSeriesRevision(bad)).toThrow(); expect(decodeSeriesAvailability({ version: 2, available: false })).toEqual({ version: 2, available: false }); expect(() => decodeSeriesAvailability({ version: 2, available: true, owner: SERIES_OWNER })).toThrow(); });
  it("aceita agregado próprio e nega owner/ID externo, referência ausente, extra ou duplicada", () => {
    const view = detail(); expect(decodeSeriesDetail(view, SERIES_OWNER, view.series.id)).toEqual(view); const mutations = [() => { view.accounts[0]!.user_id = seriesId(9000); }, () => { view.accounts = []; }, () => { view.categories.push({ ...seriesCategory, id: seriesId(9000) }); }, () => { view.accounts.push(structuredClone(seriesAccount)); }, () => { view.occurrences[0]!.transaction_id = seriesId(9000); }];
    for (const mutate of mutations) { Object.assign(view, detail()); mutate(); expect(() => decodeSeriesDetail(view, SERIES_OWNER, view.series.id)).toThrow(); } expect(() => decodeSeriesDetail(detail(), SERIES_OWNER, seriesId(9000))).toThrow();
  });
  it("inclui as referências históricas próprias sem reduzir a dois catálogos atuais", () => {
    const view = detail(), historical = managedOccurrence(view.series, 2); view.series.next_index = 3; view.series.materialized_through = historical.row.occurred_on; historical.row.account_id = seriesId(500); historical.row.category_id = seriesId(501);
    view.occurrences.push(historical.occurrence); view.transactions.push(historical.row); view.accounts.push({ ...seriesAccount, id: seriesId(500) }); view.categories.push({ ...seriesCategory, id: seriesId(501) }); expect(decodeSeriesDetail(view, SERIES_OWNER, view.series.id)).toEqual(view);
  });
  it("paginação é ordenada, canônica e limitada sem truncar silenciosamente", () => {
    const view = { version: 2, finance_revision: "0", items: [managedSeries()], next_cursor: null }; expect(decodeSeriesPage(view, SERIES_OWNER, { cursor: null, limit: 20 })).toEqual(view);
    expect(() => decodeSeriesPage(view, SERIES_OWNER, { cursor: null, limit: 0 })).toThrow(); expect(() => decodeSeriesPage(view, SERIES_OWNER, { cursor: view.items[0]!.id, limit: 20 })).toThrow(); expect(() => decodeSeriesPage({ ...view, items: [view.items[0], view.items[0]] }, SERIES_OWNER, { cursor: null, limit: 20 })).toThrow(); expect(() => decodeSeriesPage({ ...view, next_cursor: view.items[0]!.id }, SERIES_OWNER, { cursor: null, limit: 20 })).toThrow();
  });
  it("resultado precisa pertencer à intenção e não pode ser confundido com outra criação", () => {
    const request = create(); expect(decodeSeriesResult(result(), SERIES_OWNER, request)).toEqual(result()); const wrong = result(); wrong.series.template.amount_cents++; expect(() => decodeSeriesResult(wrong, SERIES_OWNER, request)).toThrow(); const existing: FinanceSeriesCommand = { command: "finance.recurring.pause", input: { client_id: seriesId(901), expected_finance_revision: "0", series_id: seriesId(999), expected_revision: "0", from_on: "2026-10-23" } }; expect(() => decodeSeriesResult(result(), SERIES_OWNER, existing)).toThrow();
  });
  it("prévia vincula comando, UUID e revisões; recibo confirmado não traz o agregado atual", () => {
    const request = create(), view = { version: 2, kind: "review", command: request.command, client_id: request.input.client_id, today: "2026-10-23", consistency: "changed", revisions: { requested_finance: "0", observed_finance: "9007199254740993", requested_series: null, observed_series: null }, data: { series: null, occurrences: [], transactions: [], accounts: [seriesAccount], categories: [seriesCategory], tags: [] } };
    expect(decodeSeriesPreview(view, SERIES_OWNER, request)).toEqual(view); expect(() => decodeSeriesPreview({ ...view, consistency: "same" }, SERIES_OWNER, request)).toThrow(); expect(() => decodeSeriesPreview({ ...view, client_id: seriesId(902) }, SERIES_OWNER, request)).toThrow(); expect(() => decodeSeriesPreview({ ...view, revisions: { ...view.revisions, requested_finance: "1" } }, SERIES_OWNER, request)).toThrow();
    const confirmed = { version: 2, kind: "confirmed", command: request.command, client_id: request.input.client_id, result: result() }; expect(decodeSeriesPreview(confirmed, SERIES_OWNER, request)).toEqual(confirmed); expect(() => decodeSeriesPreview({ ...confirmed, data: view.data }, SERIES_OWNER, request)).toThrow();
  });
});
