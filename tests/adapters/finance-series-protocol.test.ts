import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assinatura } from "../../src/core/contracts/base";
import type { CategoriaFinanceira, ContaFinanceira, EtiquetaFinanceira } from "../../src/core/financeiro/fused";
import type { FinanceSeriesCommand } from "../../src/core/financeiro/series/series-types";
import { parseSeriesDetail, parseSeriesPage, parseSeriesReceipt, parseSeriesRevision, parseSeriesSnapshot, type FinanceSeriesSnapshot } from "../../src/adapters/db/finance-series-protocol";
import { channelCreate, emptySeriesSnapshot } from "../fixtures/finance-series-channel";
import { managedOccurrence, managedSeries, seriesAccount, seriesCategory, seriesId, SERIES_NOW, SERIES_OWNER } from "../fixtures/finance-series";

function historical() {
  const series = managedSeries({ total: 120, revision: "1", next_index: 121, materialized_through: "2036-09-23" });
  const snapshot: FinanceSeriesSnapshot = { version: 2, finance_revision: "9007199254740993", series: [series], occurrences: [], transactions: [], accounts: [structuredClone(seriesAccount)], categories: [structuredClone(seriesCategory)], tags: [], receipt: null };
  const tag = (n: number): EtiquetaFinanceira => ({ id: seriesId(n), user_id: SERIES_OWNER, name: `Etiqueta sintética ${n} ç`, normalized_name: `etiqueta sintética ${n} ç`, color_key: "fin-1", created_at: SERIES_NOW, updated_at: SERIES_NOW });
  series.template.tag_ids = Array.from({ length: 30 }, (_, i) => seriesId(20000 + i)); snapshot.tags.push(...Array.from({ length: 30 }, (_, i) => tag(20000 + i)));
  for (let n = 1; n <= 120; n++) {
    const { occurrence, row } = managedOccurrence(series, n), account: ContaFinanceira = { ...seriesAccount, id: seriesId(4000 + n) }, category: CategoriaFinanceira = { ...seriesCategory, id: seriesId(5000 + n) };
    occurrence.id = seriesId(10000 + n); row.id = seriesId(11000 + n); occurrence.transaction_id = row.id;
    occurrence.configuration_revision = "0"; row.account_id = account.id; row.category_id = category.id; row.tag_ids = Array.from({ length: 30 }, (_, i) => seriesId(30000 + n * 30 + i));
    snapshot.occurrences.push(occurrence); snapshot.transactions.push(row); snapshot.accounts.push(account); snapshot.categories.push(category); snapshot.tags.push(...Array.from({ length: 30 }, (_, i) => tag(30000 + n * 30 + i)));
  }
  const request: FinanceSeriesCommand = { command: "finance.recurring.update_future", input: { client_id: seriesId(901), expected_finance_revision: snapshot.finance_revision, series_id: series.id, expected_revision: "1", from_on: "2026-10-23", patch: { template: { ...series.template, account_id: seriesId(6000), category_id: seriesId(6001), tag_ids: Array.from({ length: 30 }, (_, i) => seriesId(21000 + i)) } }, statement_assignments: [] } };
  const detail = { version: 2 as const, finance_revision: snapshot.finance_revision, series: structuredClone(series), occurrences: structuredClone(snapshot.occurrences), transactions: structuredClone(snapshot.transactions), accounts: structuredClone(snapshot.accounts), categories: structuredClone(snapshot.categories), tags: structuredClone(snapshot.tags) };
  snapshot.accounts.push({ ...seriesAccount, id: seriesId(6000) }); snapshot.categories.push({ ...seriesCategory, id: seriesId(6001) }); snapshot.tags.push(...Array.from({ length: 30 }, (_, i) => tag(21000 + i)));
  return { snapshot, request, detail };
}
describe("T053-B3: DTO fechado e agregado finito do dono", () => {
  it("aceita união máxima de referências históricas Unicode sem truncamento", () => {
    const h = historical(), parsed = parseSeriesSnapshot(h.snapshot, SERIES_OWNER, h.request);
    expect(parsed.accounts).toHaveLength(122); expect(parsed.categories).toHaveLength(122); expect(parsed.tags).toHaveLength(3660); expect(parsed.finance_revision).toBe("9007199254740993");
    const detail = parseSeriesDetail(h.detail, SERIES_OWNER, h.detail.series.id)!; expect(detail.accounts).toHaveLength(121); expect(detail.categories).toHaveLength(121); expect(detail.tags).toHaveLength(3630); expect(Object.keys(detail)).not.toContain("receipt");
  });
  it.each(["extra", "foreign", "missing_historical", "duplicate_slot", "unmapped_row", "extra_field"] as const)("recusa %s sem reduzir silenciosamente o agregado", change => {
    const h = historical();
    if (change === "extra") h.snapshot.accounts.push({ ...seriesAccount, id: seriesId(9999) });
    if (change === "foreign") h.snapshot.tags[0]!.user_id = seriesId(9999);
    if (change === "missing_historical") h.snapshot.tags = h.snapshot.tags.filter(tag => tag.id !== h.snapshot.transactions[0]!.tag_ids![0]);
    if (change === "duplicate_slot") h.snapshot.occurrences[1]!.index = h.snapshot.occurrences[0]!.index;
    if (change === "unmapped_row") h.snapshot.transactions[0]!.id = seriesId(9999);
    const value = change === "extra_field" ? { ...h.snapshot, provider_secret: "synthetic-only" } : h.snapshot;
    expect(() => parseSeriesSnapshot(value, SERIES_OWNER, h.request)).toThrow();
  });
  it("referência pedida ausente não bloqueia receipt-first, histórico ausente continua inválido", () => {
    const request = channelCreate(), result = { version: 2 as const, series: managedSeries(), affected: { created: 2, updated: 0, suppressed: 0, restored: 0, skipped: 0 } };
    const receipt = { user_id: SERIES_OWNER, command: request.command, client_id: request.input.client_id, fingerprint: assinatura(request.input), result };
    const snapshot = { ...emptySeriesSnapshot(), accounts: [], categories: [], receipt };
    expect(parseSeriesSnapshot(snapshot, SERIES_OWNER, request).receipt).toEqual(receipt);
    for (const patch of [{ user_id: seriesId(9999) }, { command: "finance.series.create" }, { client_id: seriesId(902) }, { result: { ...result, version: 1 } }, { extra: true }]) expect(() => parseSeriesReceipt({ ...receipt, ...patch }, SERIES_OWNER, request)).toThrow();
    const existing: FinanceSeriesCommand = { command: "finance.recurring.pause", input: { client_id: seriesId(902), expected_finance_revision: "0", series_id: result.series.id, expected_revision: "0", from_on: "2026-10-23" } };
    const existingReceipt = { ...receipt, command: existing.command, client_id: existing.input.client_id, fingerprint: assinatura(existing.input) };
    expect(parseSeriesSnapshot({ ...snapshot, finance_revision: "999", receipt: existingReceipt }, SERIES_OWNER, existing).receipt).toEqual(existingReceipt);
  });
  it("detail nulo permanece ausência, falha de DTO não vira ausência/legado", () => {
    expect(parseSeriesDetail(null, SERIES_OWNER, seriesId(4))).toBeNull(); const h = historical();
    expect(() => parseSeriesDetail({ ...h.detail, events: [] }, SERIES_OWNER, h.detail.series.id)).toThrow(); expect(() => parseSeriesDetail(h.detail, SERIES_OWNER, seriesId(9999))).toThrow();
  });
  it("paginação é própria, ordenada e fechada, sem conversão Number de bigint", () => {
    const series = managedSeries(), query = { cursor: null, limit: 1 }, page = { version: 2, finance_revision: "9007199254740993", items: [series], next_cursor: series.id };
    expect(parseSeriesPage(page, SERIES_OWNER, query).finance_revision).toBe("9007199254740993");
    for (const value of [undefined, 1, "01", "-1", "9223372036854775808"]) expect(() => parseSeriesRevision(value)).toThrow();
    expect(() => parseSeriesPage({ ...page, next_cursor: seriesId(9999) }, SERIES_OWNER, query)).toThrow(); expect(() => parseSeriesPage(page, SERIES_OWNER, { cursor: series.id, limit: 1 })).toThrow();
    expect(() => parseSeriesPage({ ...page, items: [{ ...series, user_id: seriesId(9999) }] }, SERIES_OWNER, query)).toThrow();
  });
});
