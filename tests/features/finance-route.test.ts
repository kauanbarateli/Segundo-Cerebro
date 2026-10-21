import { describe, expect, it } from "vitest";
import { financeFilterPatch, financeHref, parseFinanceRoute } from "../../src/components/features/financeiro/finance-route";
import { adjacentFinanceMonth, financePeriodChange } from "../../src/components/features/financeiro/finance-period";

describe("T011: estado financeiro compartilhável", () => {
  const today = "2026-09-23";
  it("mês usa o dia civil fornecido, nunca o relógio/TZ do processo", () => {
    const route = parseFinanceRoute(new URLSearchParams(), "2026-01-31");
    expect(route.month).toBe("2026-01-01");
    expect(route.tab).toBe("painel");
  });
  it("reconstitui todas as dimensões do recorte sem estado local paralelo", () => {
    const route = parseFinanceRoute(new URLSearchParams("tab=lancamentos&month=2025-12&q=almoço&kind=expense&account=conta%20A&category=none&status=pending&page=3&sort=amount_cents&dir=asc"), today);
    expect(route).toEqual({ tab: "lancamentos", month: "2025-12-01", search: "almoço", kind: "expense", account: "conta A", category: "none", status: "pending", page: 3, sort: { columnId: "amount_cents", direction: "asc" } });
    expect(parseFinanceRoute(new URL(financeHref(route), "https://example.test").searchParams, "2028-05-01")).toEqual(route);
  });
  it.each(["0", "-3", "1.5", "Infinity", "NaN", "9007199254740992", "1e3"])("página inválida %s não altera a primeira página", (page) => {
    expect(parseFinanceRoute(new URLSearchParams({ page }), today).page).toBe(1);
  });
  it.each(["2026-00", "2026-13", "0000-01", "26-01", "2026-01-01"])("mês inválido %s usa o mês do aplicativo", (month) => {
    expect(parseFinanceRoute(new URLSearchParams({ month }), today).month).toBe("2026-09-01");
  });
  it("ignora abas, estados e colunas fora da allowlist", () => {
    const state = parseFinanceRoute(new URLSearchParams("tab=admin&kind=unknown&status=unknown&sort=__proto__&dir=sideways"), today);
    expect(state).toMatchObject({ tab: "painel", kind: "all", status: "all", sort: { columnId: "occurred_on", direction: "desc" } });
  });
  it("filtro alterado mantém ordenação e reinicia paginação", () => {
    const state = parseFinanceRoute(new URLSearchParams("tab=lancamentos&page=3&sort=amount_cents&dir=asc"), today);
    expect(financeFilterPatch(state, { category: "alimentacao" })).toEqual({ ...state, category: "alimentacao", page: 1 });
    expect(state.page).toBe(3);
  });
  it("nunca propaga máscara, valores de formulário ou parâmetros desconhecidos", () => {
    const state = parseFinanceRoute(new URLSearchParams("tab=contas&hideValues=true&amount_cents=55500&draft=segredo"), today);
    expect(financeHref(state)).toBe("/financeiro?tab=contas&month=2026-09");
  });
  it("ordem original também sobrevive ao link compartilhado", () => {
    const state = parseFinanceRoute(new URLSearchParams("tab=lancamentos&sort=original"), today);
    expect(state.sort).toBeNull();
    expect(parseFinanceRoute(new URL(financeHref(state), "https://example.test").searchParams, today).sort).toBeNull();
  });
  it.each(["painel", "lancamentos", "contas", "categorias", "orcamentos"])("trocar período preserva a URL legada %s e cada filtro, reiniciando só a página", (tab) => {
    const state = parseFinanceRoute(new URLSearchParams({ tab, month: "2026-12", q: "revisão", kind: "expense", account: "A", category: "none", status: "trash", page: "3", sort: "amount_cents", dir: "asc" }), today);
    const changed = financePeriodChange(state, adjacentFinanceMonth(state.month, 1)!);
    expect(changed).toEqual({ ...state, month: "2027-01-01", page: 1 });
    expect(parseFinanceRoute(new URL(financeHref(changed), "https://example.test").searchParams, today)).toEqual(changed);
    expect(state.month).toBe("2026-12-01"); expect(state.page).toBe(3);
  });
  it("Mês atual segue today civil, mantendo a ordenação original e filtros", () => {
    const state = parseFinanceRoute(new URLSearchParams("tab=contas&month=2030-01&account=A&sort=original&page=8"), "2026-12-31");
    expect(financePeriodChange(state, "2026-12-01")).toEqual({ ...state, month: "2026-12-01", page: 1 });
  });
  it.each([
    ["0001-01-01", -1, null], ["0001-01-01", 1, "0001-02-01"],
    ["0099-12-01", 1, "0100-01-01"], ["0100-01-01", -1, "0099-12-01"],
    ["2024-02-01", 1, "2024-03-01"], ["9999-12-01", 1, null], ["9999-12-01", -1, "9999-11-01"],
  ] as const)("seta civil %s / %s respeita 0001..9999", (month, direction, expected) => {
    expect(adjacentFinanceMonth(month, direction)).toBe(expected);
  });
  it.each(["0000-01-01", "10000-01-01", "2026-00-01", "2026-13-01", "2026-01", "2026-01-02"])("seletor recusa mês não canônico %s antes de alterar rota", (month) => {
    const state = parseFinanceRoute(new URLSearchParams(), today);
    expect(() => financePeriodChange(state, month)).toThrow(RangeError);
    expect(() => adjacentFinanceMonth(month, 1)).toThrow(RangeError);
  });
});
