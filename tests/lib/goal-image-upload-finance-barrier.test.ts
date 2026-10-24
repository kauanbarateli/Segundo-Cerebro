import { describe, expect, it, vi } from "vitest";
import type { FinanceGoalsClient, GoalJournalView } from "../../src/lib/finance-goals-client-contract";
import { createGoalImageFinanceBarrier, type GoalImageFinanceController } from "../../src/lib/files/goal-image-upload-finance-barrier";
const owner = "00000000-0000-4000-8000-000000000001", epoch = "00000000-0000-4000-8000-000000000002";
function fixture() {
  let current = true, inLease = false, view: GoalJournalView = { ownerId: owner, epoch, reconfirmRequired: false, pending: null }, local: GoalJournalView | null = structuredClone(view);
  const forbidden = async () => { throw Error("No HTTP permitted"); };
  const client: FinanceGoalsClient = { ownerId: owner, epoch, isCurrent: () => current, loadPending: forbidden, availability: forbidden, page: forbidden, detail: forbidden, reservations: forbidden, releases: forbidden, prepare: forbidden, stage: forbidden, execute: forbidden, reconcile: forbidden, acknowledgeReview: forbidden };
  const controller: GoalImageFinanceController = { current: () => current, matches: (id, service) => id === owner && service === client, state: () => ({ journal: local }) };
  const barrier = createGoalImageFinanceBarrier({ client, assertSession: () => { if (!current) throw Error("closed"); }, exclusive: async work => { inLease = true; try { work(() => structuredClone(view)); } finally { inLease = false; } } });
  return { barrier, controller, inLease: () => inLease, stale: () => { current = false; }, setView: (next: GoalJournalView) => { view = next; }, setLocal: (next: GoalJournalView | null) => { local = next; }, view: () => structuredClone(view) };
}
describe("image finance barrier — synthetic read lease, not financial authority", () => {
  it("runs only synchronous local work under the actual supplied lease and expires its guard", async () => {
    const h = fixture(); let escaped!: () => void, calls = 0;
    await h.barrier.runLocalTransition(h.controller, guard => { expect(h.inLease()).toBe(true); guard(); escaped = guard; calls++; return undefined; });
    expect(calls).toBe(1); expect(() => escaped()).toThrow(); expect(h.view()).toEqual({ ownerId: owner, epoch, reconfirmRequired: false, pending: null });
  });
  it.each(["physical", "reconfirm", "memory-hold", "unopened", "foreign"] as const)("refuses %s before local writes", async mode => {
    const h = fixture(), free = h.view(), intent = { command: "finance.goal.create" as const, input: { client_id: epoch, expected_finance_revision: "0", name: "Synthetic", target_cents: 1, deadline: null, image_file_id: null } };
    if (mode === "physical") h.setView({ ...free, pending: { intent, phase: "uncertain" } });
    if (mode === "reconfirm") h.setView({ ...free, reconfirmRequired: true });
    if (mode === "memory-hold") h.setLocal({ ...free, pending: { intent, phase: "uncertain" } });
    if (mode === "unopened") h.setLocal(null);
    if (mode === "foreign") h.setView({ ...free, ownerId: epoch });
    const writes = vi.fn(() => undefined); await expect(h.barrier.runLocalTransition(h.controller, writes)).rejects.toBeDefined(); expect(writes).not.toHaveBeenCalled();
  });
  it("rejects async or non-undefined callbacks at runtime and expires an escaped async guard", async () => {
    const h = fixture(); let escaped!: () => void;
    await expect(Reflect.apply(h.barrier.runLocalTransition, h.barrier, [h.controller, async (guard: () => void) => { escaped = guard; }])).rejects.toMatchObject({ code: "INVALID" });
    expect(() => escaped()).toThrow(); await expect(Reflect.apply(h.barrier.runLocalTransition, h.barrier, [h.controller, () => ({ allowed: true })])).rejects.toMatchObject({ code: "INVALID" });
  });
  it("fences an identity change inside the synchronous transition", async () => {
    const h = fixture(); await expect(h.barrier.runLocalTransition(h.controller, guard => { h.stale(); guard(); return undefined; })).rejects.toBeDefined();
  });
});
