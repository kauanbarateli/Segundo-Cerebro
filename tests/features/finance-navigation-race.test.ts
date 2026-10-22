import { describe, expect, it, vi } from "vitest";
import { financeNavigationGuard } from "../../src/components/features/financeiro/finance-route";
import { financeHref, parseFinanceRoute } from "../../src/components/features/financeiro/finance-route";
import { financePeriodChange } from "../../src/components/features/financeiro/finance-period";
describe("Finance navigation after a published row and unfinished command", () => {
 it("restore response preserves budget tab chosen after the restored row became visible", async () => {
  let location = "https://example.invalid/financeiro?tab=lancamentos&status=trash", restoredRowVisible = false;
  const navigate = vi.fn(() => { location = "https://example.invalid/financeiro?tab=lancamentos"; }), guard = financeNavigationGuard(() => location);
  let complete!: () => void; const command = new Promise<void>(resolve => { complete = resolve; });
  const response = command.then(() => guard(navigate));
  // The memory/connected query can publish before the action's Promise resolves.
  restoredRowVisible = true; expect(restoredRowVisible).toBe(true);
  location = "https://example.invalid/financeiro?tab=orcamentos&q=alimenta%C3%A7%C3%A3o";
  complete(); await response;
  expect(navigate).not.toHaveBeenCalled(); expect(location).toContain("tab=orcamentos"); expect(location).toContain("q=");
 });
 it("unchanged location still navigates to the restored transaction's competence", async () => {
  let location = "https://example.invalid/financeiro?tab=lancamentos&status=trash"; const guard = financeNavigationGuard(() => location);
  await Promise.resolve(); expect(guard(() => { location = "https://example.invalid/financeiro?tab=lancamentos&month=2026-10"; })).toBe(true); expect(location).toContain("month=2026-10");
 });
 it("old pagination effect cannot replace a newly chosen tab or new filter", () => {
  const oldRender = "/financeiro?tab=lancamentos&page=99";
  for (const location of ["/financeiro?tab=orcamentos", "/financeiro?tab=lancamentos&q=new", "/tarefas?task=one"]) { const replace = vi.fn(); expect(financeNavigationGuard(() => location, oldRender)(replace)).toBe(false); expect(replace).not.toHaveBeenCalled(); }
 });
 it("a picker event from an old render cannot erase a newer period, filter or tab", () => {
  const rendered = "/financeiro?tab=lancamentos&month=2026-09&page=99", state = parseFinanceRoute(new URL(rendered, "https://example.invalid").searchParams, "2026-09-23");
  for (const current of ["/financeiro?tab=lancamentos&month=2027-01", "/financeiro?tab=contas&month=2026-09", "/financeiro?tab=lancamentos&month=2026-09&q=novo", "/tarefas"]) {
   let location = current;
   expect(financeNavigationGuard(() => location, rendered)(() => { location = financeHref(financePeriodChange(state, "2026-12-01")); })).toBe(false);
   expect(location).toBe(current);
  }
 });
 it("a pending restore and old page clamp both yield to the period chosen afterwards", async () => {
  let location = "/financeiro?tab=lancamentos&month=2026-09&status=trash&page=99";
  const oldRender = location, restore = financeNavigationGuard(() => location), state = parseFinanceRoute(new URL(location, "https://example.invalid").searchParams, "2026-09-23");
  let complete!: () => void; const response = new Promise<void>((resolve) => { complete = resolve; }).then(() => restore(() => { location = "/financeiro?tab=lancamentos&month=2026-09"; }));
  location = financeHref(financePeriodChange(state, "2027-01-01")); const chosen = location;
  expect(financeNavigationGuard(() => location, oldRender)(() => { location = oldRender; })).toBe(false);
  complete(); await response; expect(location).toBe(chosen); expect(location).toContain("month=2027-01"); expect(location).toContain("status=trash");
 });
});
