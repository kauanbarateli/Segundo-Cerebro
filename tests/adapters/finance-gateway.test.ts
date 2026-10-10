import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createFinanceGateway, parseFinanceSnapshot, validateFinanceRow, type FinanceRpc } from "../../src/adapters/db/finance-gateway";
import { decodeFinanceRequest } from "../../src/adapters/db/finance-commands";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import type { FinanceCommit } from "../../src/adapters/db/finance-store";
import { accounts, FINANCE_ACTOR, FINANCE_NOW } from "../fixtures/finance-regression";
const session = "10000000-0000-4000-8000-000000000002", id = "10000000-0000-4000-8000-000000000003";
const account = { ...accounts[0]!, id };
const snapshot = () => ({ revision: "0", accounts: [account], categories: [], tags: [], transactions: [], budgets: [], events: [], receipts: [] });
describe("financial gateway validates server DTOs and response certainty", () => {
  it("preserves the own monthly total in a snapshot and its committed receipt", async () => {
    const budget = { id: "10000000-0000-4000-8000-000000000004", user_id: FINANCE_ACTOR, category_id: null, month: "2026-07-01", limit_cents: 400000, created_at: FINANCE_NOW, updated_at: FINANCE_NOW };
    const rpc = vi.fn<FinanceRpc>(async () => ({ data: { ...snapshot(), budgets: [budget] }, error: null }));
    expect((await createFinanceGateway(FINANCE_ACTOR, session, "read.finance", rpc).presentation()).budgets).toEqual([budget]);
    rpc.mockResolvedValueOnce({ data: { status: "committed", result: budget }, error: null });
    const receipt = { user_id: FINANCE_ACTOR, command: "finance.budget.save", client_id: "monthly-total", fingerprint: "{}", result: budget };
    const request: FinanceCommit = { expectedRevision: "0", context: { user_id: FINANCE_ACTOR, canal: "web" }, changes: [{ type: "finance_budget", before: null, after: budget }], events: [], receipt };
    expect(await createFinanceGateway(FINANCE_ACTOR, session, "finance.budget.save", rpc).commit(request)).toEqual({ status: "committed", result: budget });
    for (const patch of [{ category_id: undefined }, { category_id: 0 }, { category_id: "" }, { user_id: session }, { unexpected_secret: "synthetic" }]) {
      expect(() => parseFinanceSnapshot({ ...snapshot(), budgets: [{ ...budget, ...patch }] }, FINANCE_ACTOR)).toThrow();
    }
  });
  it("returns only the presentation collections after validating owner", async () => {
    const rpc: FinanceRpc = async () => ({ data: snapshot(), error: null }); const gateway = createFinanceGateway(FINANCE_ACTOR, session, "read.finance", rpc);
    expect(await gateway.presentation()).toEqual({ accounts: [account], categories: [], tags: [], transactions: [], budgets: [] });
    expect(() => parseFinanceSnapshot({ ...snapshot(), accounts: [{ ...account, user_id: session }] }, FINANCE_ACTOR)).toThrow();
  });
  it.each([{ color_key: null }, { opening_balance_cents: 1.1 }, { unexpected_secret: "must not reach UI" }])("rejects malformed fields: %j", patch => {
    expect(() => validateFinanceRow({ ...account, ...patch }, "finance_account", FINANCE_ACTOR)).toThrow();
  });
  it("revocation is an explicit denial before receipt replay", async () => {
    const rpc: FinanceRpc = async () => ({ data: null, error: { code: "42501" } });
    await expect(createFinanceGateway(FINANCE_ACTOR, session, "finance.account.close", rpc).receipt("finance.account.close", "same")).rejects.toMatchObject({ code: "forbidden" });
  });
  it("structured SQL validation remains a rejection; transport failure preserves unknown write outcome", async () => {
    const request: FinanceCommit = { expectedRevision: "0", context: { user_id: FINANCE_ACTOR, canal: "web" }, changes: [], events: [], receipt: { user_id: FINANCE_ACTOR, command: "finance.account.close", client_id: "close", fingerprint: "{}", result: account } };
    const rejected: FinanceRpc = async () => ({ data: null, error: { code: "23514" } });
    await expect(createFinanceGateway(FINANCE_ACTOR, session, "finance.account.close", rejected).commit(request)).rejects.toMatchObject({ code: "VALIDATION" });
    const unavailable: FinanceRpc = async () => { throw new Error("transport"); };
    await expect(createFinanceGateway(FINANCE_ACTOR, session, "finance.account.close", unavailable).commit(request)).rejects.toBeInstanceOf(CommitOutcomeUnknown);
  });
  it("dispatches close to its transactional RPC and treats malformed successful result as unknown", async () => {
    const rpc = vi.fn<FinanceRpc>(async () => ({ data: { status: "committed", result: { id } }, error: null }));
    const request: FinanceCommit = { expectedRevision: "0", context: { user_id: FINANCE_ACTOR, canal: "web" }, changes: [], events: [], receipt: { user_id: FINANCE_ACTOR, command: "finance.account.close", client_id: "close", fingerprint: "{}", result: { ...account, archived_at: FINANCE_NOW } } };
    await expect(createFinanceGateway(FINANCE_ACTOR, session, "finance.account.close", rpc).commit(request)).rejects.toBeInstanceOf(CommitOutcomeUnknown);
    expect(rpc.mock.calls[0]![0]).toBe("close_account");
  });
});
describe("financial public decoder rejects ownership and derived-field injection", () => {
  it("accepts a finite series intention, not a transaction batch", () => {
    const input = { client_id: "series", fields: { account_id: id, category_id: null, kind: "expense", amount_cents: 10001, paid_cents: 0, description: "Parcelas", payee: null, occurred_on: "2026-07-10", status: "confirmed", due_date: null, notes: null }, serie_tipo: "parcelamento", count: 12 };
    expect(decodeFinanceRequest({ command: "finance.series.create", input })).toEqual({ command: "finance.series.create", input });
    expect(() => decodeFinanceRequest({ command: "finance.series.create", input: { ...input, changes: [] } })).toThrow();
  });
  it.each([{ user_id: FINANCE_ACTOR }, { is_paid: true }, { transfer_group_id: id }])("blocks injected transaction patch %j", patch => {
    expect(() => decodeFinanceRequest({ command: "finance.transaction.update", input: { client_id: "patch", id, patch } })).toThrow();
  });
});
