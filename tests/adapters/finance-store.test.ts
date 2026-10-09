import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assinatura, ErroDeDominio, type ReciboIdempotente } from "../../src/core/contracts";
import { transferirFinanceiro, arquivarContaFinanceira, type ContaFinanceira } from "../../src/core/financeiro";
import { createFinanceStore, type FinanceSnapshot, type FinanceCommit, type FinanceGateway } from "../../src/adapters/db/finance-store";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { AuthGuardError } from "../../src/lib/auth/types";
import { accounts, FINANCE_ACTOR, FINANCE_NOW } from "../fixtures/finance-regression";
const clone = <T>(v: T): T => structuredClone(v);
const context = { user_id: FINANCE_ACTOR, canal: "web" as const };
/** Injected atomic transport; this is not PostgreSQL execution evidence. */
class AtomicFinanceGateway implements FinanceGateway {
  readonly actorId = FINANCE_ACTOR;
  state: FinanceSnapshot = { revision: "0", accounts: clone(accounts), categories: [], transactions: [], budgets: [], tags: [], events: [], receipts: [] };
  loseResponse = false; failAt = -1; denied: Error | null = null; attempts = 0;
  async snapshot() { if (this.denied) throw this.denied; return clone(this.state); }
  async currentRevision() { if (this.denied) throw this.denied; return this.state.revision; }
  async receipt(command: string, clientId: string): Promise<ReciboIdempotente | null> { if (this.denied) throw this.denied; return clone(this.state.receipts.find(r => r.command === command && r.client_id === clientId) ?? null); }
  async commit(request: FinanceCommit) {
    this.attempts++; if (this.denied) throw this.denied;
    const receipt = this.state.receipts.find(r => r.command === request.receipt.command && r.client_id === request.receipt.client_id);
    if (receipt) { if (receipt.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "Payload conflict"); return { status: "replayed" as const, result: clone(receipt.result) }; }
    if (request.expectedRevision !== this.state.revision) return { status: "stale" as const };
    const draft = clone(this.state);
    for (const [index, change] of request.changes.entries()) {
      if (index === this.failAt) throw new Error("Injected mid-batch failure");
      const rows = change.type === "finance_account" ? draft.accounts : draft.transactions;
      const at = rows.findIndex(row => row.id === change.after.id);
      if (assinatura(at < 0 ? null : rows[at]) !== assinatura(change.before)) throw new Error("Stale before");
      if (at < 0) rows.push(clone(change.after) as ContaFinanceira & typeof draft.transactions[number]); else rows[at] = clone(change.after) as ContaFinanceira & typeof draft.transactions[number];
    }
    draft.events.push(...clone(request.events)); draft.receipts.push(clone(request.receipt)); draft.revision = String(BigInt(draft.revision) + 1n); this.state = draft;
    if (this.loseResponse) { this.loseResponse = false; throw new CommitOutcomeUnknown(); }
    return { status: "committed" as const, result: clone(request.receipt.result) };
  }
}
function setup() { let id = 0; const gateway = new AtomicFinanceGateway(), store = createFinanceStore(gateway); return { gateway, store, deps: { clock: { now: () => FINANCE_NOW }, ids: { next: () => `id-${++id}` } } }; }
const input = { client_id: "transfer", from_account_id: "cash", to_account_id: "reserve", amount_cents: 1000, occurred_on: "2026-07-10", description: "Transferência" };
describe("finance transactional adapter against injected atomic transport", () => {
  it("commits both legs, exact events and one receipt; concurrent replay creates no duplicate", async () => {
    const h = setup(); const [a, b] = await Promise.all([transferirFinanceiro(h.store, h.deps, context, input), transferirFinanceiro(h.store, h.deps, context, input)]);
    expect(a).toEqual(b); expect(h.gateway.state.transactions).toHaveLength(2); expect(h.gateway.state.events).toHaveLength(2); expect(h.gateway.state.receipts).toHaveLength(1);
    await expect(transferirFinanceiro(h.store, h.deps, context, { ...input, amount_cents: 2000 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("two distinct competing commands retry their stale snapshot", async () => {
    const h = setup(); await Promise.all([transferirFinanceiro(h.store, h.deps, context, input), transferirFinanceiro(h.store, h.deps, context, { ...input, client_id: "second" })]);
    expect(h.gateway.state.transactions).toHaveLength(4); expect(h.gateway.state.receipts).toHaveLength(2); expect(h.gateway.attempts).toBeGreaterThan(2);
  });
  it("mid-batch failure leaves no legs/events/receipt and retry succeeds", async () => {
    const h = setup(); h.gateway.failAt = 1;
    await expect(transferirFinanceiro(h.store, h.deps, context, input)).rejects.toThrow("mid-batch"); expect(h.gateway.state.transactions).toEqual([]); expect(h.gateway.state.events).toEqual([]); expect(h.gateway.state.receipts).toEqual([]);
    h.gateway.failAt = -1; expect((await transferirFinanceiro(h.store, h.deps, context, input)).transactions).toHaveLength(2);
  });
  it("lost response reconciles the receipt without reapplying", async () => {
    const h = setup(); h.gateway.loseResponse = true; const result = await transferirFinanceiro(h.store, h.deps, context, input);
    expect(result.transactions).toHaveLength(2); expect(h.gateway.state.receipts).toHaveLength(1); expect(h.gateway.attempts).toBe(1);
  });
  it("ports expire and missing events cannot commit", async () => {
    const h = setup(); let port: unknown;
    await h.store.transaction(context, async tx => { port = tx.financeiro.contas; return null; });
    await expect((port as { list(): Promise<unknown> }).list()).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
    await expect(h.store.transaction(context, async tx => { await tx.financeiro.contas.replace({ ...accounts[0]!, name: "Changed" }); })).rejects.toMatchObject({ code: "EVENT_REQUIRED" });
    expect(h.gateway.state.accounts[0]!.name).toBe(accounts[0]!.name);
  });
  it("owner and current authorization are checked before reads and replay", async () => {
    const h = setup(); await expect(arquivarContaFinanceira(h.store, h.deps, { ...context, user_id: "other" }, { id: "cash", client_id: "close" })).rejects.toMatchObject({ code: "VALIDATION" });
    await transferirFinanceiro(h.store, h.deps, context, input); h.gateway.denied = new AuthGuardError("forbidden");
    await expect(transferirFinanceiro(h.store, h.deps, context, input)).rejects.toMatchObject({ code: "forbidden" });
  });
});
