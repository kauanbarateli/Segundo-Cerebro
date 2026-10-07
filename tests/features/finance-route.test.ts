import { describe, expect, it } from "vitest";
import { financeFilterPatch, financeHref, parseFinanceRoute } from "../../src/components/features/financeiro/finance-route";

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
});
