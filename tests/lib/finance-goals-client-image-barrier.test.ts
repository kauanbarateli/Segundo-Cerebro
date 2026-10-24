import { describe, expect, it, vi } from "vitest";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { FinanceGoalsBrowserClient } from "../../src/lib/finance-goals-client";
import { FinanceGoalsJournal, type GoalsJournalEnvironment } from "../../src/lib/finance-goals-journal";
import type { GoalImageFinanceController } from "../../src/lib/files/goal-image-upload-finance-barrier";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1);
const intent = (): Extract<GoalCommand, { command: "finance.goal.create" }> => ({ command: "finance.goal.create", input: { client_id: id(3), expected_finance_revision: "0", name: "Synthetic", target_cents: 1, deadline: null, image_file_id: null } });
async function fixture() {
  const values = new Map<string, string>(), queues = new Map<string, Promise<void>>(); let current = true;
  const environment: GoalsJournalEnvironment = { uuid: () => id(2), storage: { keys: () => [...values.keys()], getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } }, exclusive: async (name, work) => { let release!: () => void; const previous = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(done => { release = done; })); await previous; try { return await work(); } finally { release(); } } };
  const journal = new FinanceGoalsJournal(owner, environment); await journal.open(); const fetcher = vi.fn(async () => { throw Error("No HTTP allowed"); });
  const client = new FinanceGoalsBrowserClient(owner, journal, { fetcher, isCurrent: () => current });
  const controller: GoalImageFinanceController = { current: () => current, matches: (id, candidate) => id === owner && candidate === client, state: () => ({ journal: journal.snapshot() }) };
  return { values, journal, client, controller, fetcher, stale: () => { current = false; } };
}
describe("concrete client image barrier — same private journal, no HTTP", () => {
  it("requires loadPending and lends the same already-open journal without writes", async () => {
    const h = await fixture(), writes = vi.fn(() => undefined); await expect(h.client.imageUploadBarrier.runLocalTransition(h.controller, writes)).rejects.toBeDefined(); expect(writes).not.toHaveBeenCalled();
    await h.client.loadPending(); const before = [...h.values]; await h.client.imageUploadBarrier.runLocalTransition(h.controller, guard => { guard(); writes(); return undefined; });
    expect(writes).toHaveBeenCalledTimes(1); expect([...h.values]).toEqual(before); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("sees a real pending B and current reconfirmation before any callback", async () => {
    const h = await fixture(); await h.client.loadPending(); await h.journal.exclusive(async lease => { lease.stage(intent()); }); const before = [...h.values], writes = vi.fn(() => undefined);
    await expect(h.client.imageUploadBarrier.runLocalTransition(h.controller, writes)).rejects.toMatchObject({ code: "PENDING" }); expect([...h.values]).toEqual(before); expect(writes).not.toHaveBeenCalled();
    await h.journal.exclusive(async lease => { lease.confirmed(intent()); }); await expect(h.client.imageUploadBarrier.runLocalTransition(h.controller, writes)).rejects.toMatchObject({ code: "PENDING" }); expect(writes).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("waits for the owner lock and reads the winner, not a previous free observation", async () => {
    const h = await fixture(); await h.client.loadPending(); let release!: () => void, entered!: () => void;
    const hold = new Promise<void>(done => { release = done; }), inside = new Promise<void>(done => { entered = done; });
    const first = h.journal.exclusive(async lease => { entered(); await hold; lease.stage(intent()); }); await inside;
    const writes = vi.fn(() => undefined), pending = h.client.imageUploadBarrier.runLocalTransition(h.controller, writes), refused = expect(pending).rejects.toMatchObject({ code: "PENDING" }); release(); await first; await refused;
    expect(writes).not.toHaveBeenCalled(); expect(h.journal.snapshot().pending?.intent).toEqual(intent()); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("dispose does not redact, and explicit client logout fences this same capability", async () => {
    const h = await fixture(); await h.client.loadPending(); const before = [...h.values]; h.client.dispose(); expect([...h.values]).toEqual(before);
    const writes = vi.fn(() => undefined); await expect(h.client.imageUploadBarrier.runLocalTransition(h.controller, writes)).rejects.toBeDefined(); expect(writes).not.toHaveBeenCalled();
    const next = await fixture(); await next.client.loadPending(); next.client.revokeIdentity(); await expect(next.client.imageUploadBarrier.runLocalTransition(next.controller, writes)).rejects.toBeDefined(); expect(next.fetcher).not.toHaveBeenCalled();
  });
});
