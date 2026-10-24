import { describe, expect, it } from "vitest";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { FinanceGoalsJournal, type GoalsJournalEnvironment, type GoalsJournalLease } from "../../src/lib/finance-goals-journal";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1);
const intent = (): Extract<GoalCommand, { command: "finance.goal.create" }> => ({ command: "finance.goal.create", input: { client_id: id(2), expected_finance_revision: "0", name: "private-synthetic-goal", target_cents: 10000, deadline: null, image_file_id: null } });
function environment() {
  const values = new Map<string, string>(), trace: string[] = [], queues = new Map<string, Promise<void>>(); let sequence = 100;
  const env: GoalsJournalEnvironment = { uuid: () => id(++sequence), storage: { keys: () => [...values.keys()], getItem(key) { trace.push("get:" + key); return values.get(key) ?? null; }, setItem(key, value) { trace.push("set:" + key); values.set(key, value); }, removeItem(key) { trace.push("remove:" + key); values.delete(key); } }, exclusive: async (name, work) => { let release!: () => void; const previous = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(yes => { release = yes; })); await previous; try { return await work(); } finally { release(); } } };
  return { values, trace, env };
}
const prefix = `segundo-cerebro:finance-goals:v1:${owner}:`;
const pending = (j: FinanceGoalsJournal) => prefix + "pending:" + j.epoch;
describe("Metas — durable journal algorithm, fake Storage/locks only", () => {
  it("opens sentinel before pointer, stages/readbacks a clone, and restores without dispatch", async () => {
    const h = environment(), journal = new FinanceGoalsJournal(owner, h.env); await journal.open(); const pointer = h.trace.indexOf("set:" + prefix + "epoch"), alive = h.trace.findIndex(v => v.startsWith("set:" + prefix + "alive:")); expect(alive).toBeLessThan(pointer);
    const command = intent(); await journal.exclusive(async lease => { lease.stage(command); command.input.client_id = id(9); expect(lease.snapshot().pending?.intent).toEqual(intent()); lease.uncertain(intent()); });
    const restored = new FinanceGoalsJournal(owner, h.env); expect(await restored.open()).toMatchObject({ ownerId: owner, epoch: journal.epoch, pending: { intent: intent(), phase: "uncertain" } });
  });
  it("requires a previously opened durable fence", () => { const h = environment(), j = new FinanceGoalsJournal(owner, h.env); expect(() => j.captureFence()).toThrow(); expect(() => j.snapshot()).toThrow(); expect(h.values.size).toBe(0); });
  it("never overwrites a different concurrent intention", async () => {
    const h = environment(), a = new FinanceGoalsJournal(owner, h.env), b = new FinanceGoalsJournal(owner, h.env), other = intent(); other.input.client_id = id(3);
    const outcomes = await Promise.allSettled([a.exclusive(async lease => { lease.stage(intent()); }), b.exclusive(async lease => { lease.stage(other); })]); expect(outcomes.map(v => v.status)).toEqual(["fulfilled", "rejected"]); expect(a.snapshot().pending?.intent).toEqual(intent());
  });
  it("quota before sentinel or pointer never fabricates a usable epoch", async () => {
    for (const part of ["alive:", "epoch"]) { const h = environment(), write = h.env.storage.setItem; h.env.storage.setItem = (key, value) => { if (part === "epoch" ? key.endsWith(":epoch") : key.includes(part)) throw Error("synthetic-quota"); write(key, value); }; const j = new FinanceGoalsJournal(owner, h.env); await expect(j.open()).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(() => j.captureFence()).toThrow(); }
  });
  it("failed exclusive lock never falls back to an unlocked or memory operation", async () => { const h = environment(); h.env.exclusive = async () => { throw Error("synthetic-lock-unavailable"); }; await expect(new FinanceGoalsJournal(owner, h.env).open()).rejects.toThrow(); expect(h.values.size).toBe(0); });
  it("stage write/readback failures never reach a dispatch seam", async () => {
    const h = environment(), j = new FinanceGoalsJournal(owner, h.env); await j.open(); let dispatch = 0; h.env.storage.setItem = () => { throw Error("synthetic-quota"); };
    await expect(j.exclusive(async lease => { lease.stage(intent()); dispatch++; })).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(dispatch).toBe(0);
  });
  it("missing sentinel rotates only under lock and requires human reconfirmation", async () => {
    const h = environment(), a = new FinanceGoalsJournal(owner, h.env); await a.exclusive(async lease => { lease.stage(intent()); }); const first = a.epoch, fence = a.captureFence(); h.values.delete(prefix + "alive:" + first);
    expect(fence).toThrow(); const b = new FinanceGoalsJournal(owner, h.env); expect(await b.open()).toMatchObject({ reconfirmRequired: true, pending: null }); expect(b.epoch).not.toBe(first); await expect(b.exclusive(async lease => { lease.stage(intent()); })).rejects.toMatchObject({ code: "RECONFIRM" });
    await b.exclusive(async lease => { lease.acknowledgeReview(); lease.stage(intent()); }); expect(b.snapshot().pending?.intent).toEqual(intent());
  });
  it("corrupt sentinel refuses without clearing the body", async () => { const h = environment(), j = new FinanceGoalsJournal(owner, h.env); await j.exclusive(async lease => { lease.stage(intent()); }); const key = pending(j), before = h.values.get(key); h.values.set(prefix + "alive:" + j.epoch, "bad"); await expect(new FinanceGoalsJournal(owner, h.env).open()).rejects.toMatchObject({ code: "CORRUPT" }); expect(h.values.get(key)).toBe(before); });
  it("logout SET quota still revokes other handles via DELETE sentinel", async () => {
    const h = environment(), a = new FinanceGoalsJournal(owner, h.env), b = new FinanceGoalsJournal(owner, h.env); await a.exclusive(async lease => { lease.stage(intent()); lease.uncertain(intent()); }); await b.open(); const key = pending(a), fence = b.captureFence(), write = h.env.storage.setItem;
    h.env.storage.setItem = () => { throw Error("synthetic-quota"); }; expect(() => a.revoke()).toThrow(); expect(h.values.has(key)).toBe(false); expect(fence).toThrow(); expect(() => b.snapshot()).toThrow(); expect([...h.values.values()].join()).not.toContain("private-synthetic-goal");
    h.env.storage.setItem = write; const next = new FinanceGoalsJournal(owner, h.env); expect(await next.open()).toMatchObject({ reconfirmRequired: true, pending: null }); await expect(next.exclusive(async lease => { lease.stage(intent()); })).rejects.toMatchObject({ code: "RECONFIRM" });
  });
  it("failed DELETE at logout preserves the unresolved body", async () => { const h = environment(), j = new FinanceGoalsJournal(owner, h.env); await j.exclusive(async lease => { lease.stage(intent()); }); const key = pending(j), before = h.values.get(key); h.env.storage.removeItem = () => { throw Error("synthetic-delete-failure"); }; expect(() => j.revoke()).toThrow(); expect(h.values.get(key)).toBe(before); });
  it("a late e1 revoke never deletes e2 or adopts its pointer", async () => {
    const h = environment(), old = new FinanceGoalsJournal(owner, h.env); await old.exclusive(async lease => { lease.stage(intent()); }); old.revoke(); const next = new FinanceGoalsJournal(owner, h.env); await next.open(); const other = intent(); other.input.client_id = id(8); await next.exclusive(async lease => { lease.acknowledgeReview(); lease.stage(other); }); const epoch = next.epoch, key = pending(next), before = h.values.get(key); old.revoke(); expect(next.epoch).toBe(epoch); expect(h.values.get(key)).toBe(before); expect(() => old.snapshot()).toThrow();
  });
  it("fresh repeated empty logout cannot adopt a future session", async () => { const h = environment(), logout = new FinanceGoalsJournal(owner, h.env); logout.revoke(); const next = new FinanceGoalsJournal(owner, h.env); await next.open(); await next.exclusive(async lease => { lease.stage(intent()); }); const key = pending(next), before = h.values.get(key); logout.revoke(); expect(h.values.get(key)).toBe(before); next.assertSession(); });
  it("owner B never reads owner A body", async () => { const h = environment(), a = new FinanceGoalsJournal(owner, h.env); await a.exclusive(async lease => { lease.stage(intent()); }); h.trace.length = 0; const b = new FinanceGoalsJournal(id(99), h.env); expect((await b.open()).pending).toBeNull(); expect(h.trace.filter(v => v.startsWith("get:")).every(v => v.startsWith(`get:segundo-cerebro:finance-goals:v1:${id(99)}:`))).toBe(true); expect(a.snapshot().pending?.intent).toEqual(intent()); });
  it("rejects orphan, corrupt owner/body and closed leaked lease", async () => {
    const h = environment(); h.values.set(prefix + "pending:" + id(4), "{}"); await expect(new FinanceGoalsJournal(owner, h.env).open()).rejects.toMatchObject({ code: "CORRUPT" }); h.values.clear();
    const j = new FinanceGoalsJournal(owner, h.env); let leaked: GoalsJournalLease | null = null; await j.exclusive(async lease => { leaked = lease; lease.stage(intent()); }); expect(() => (leaked as GoalsJournalLease | null)?.snapshot()).toThrow(); const key = pending(j), stored = JSON.parse(h.values.get(key)!); h.values.set(key, JSON.stringify({ ...stored, ownerId: id(99) })); expect(() => j.snapshot()).toThrow();
  });
  it("DELETE with effect then failing readback still requires review on a new handle", async () => {
    const h = environment(), j = new FinanceGoalsJournal(owner, h.env); await j.exclusive(async lease => { lease.stage(intent()); lease.uncertain(intent()); }); const key = pending(j), get = h.env.storage.getItem, remove = h.env.storage.removeItem; let deleted = false, failed = false;
    h.env.storage.removeItem = name => { remove(name); if (name === key) deleted = true; }; h.env.storage.getItem = name => { if (name === key && deleted && !failed) { failed = true; throw Error("synthetic-readback"); } return get(name); };
    await expect(j.exclusive(async lease => { lease.confirmed(intent()); })).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(h.values.has(key)).toBe(false);
    h.env.storage.getItem = get; const next = new FinanceGoalsJournal(owner, h.env); expect(await next.open()).toMatchObject({ reconfirmRequired: true, pending: null }); await expect(next.exclusive(async lease => { lease.stage(intent()); })).rejects.toMatchObject({ code: "RECONFIRM" });
  });
  it("invalidates an old ack before the durable cleanup warning", async () => {
    const h = environment(), j = new FinanceGoalsJournal(owner, h.env); await j.open(); await j.exclusive(async lease => { lease.acknowledgeReview(); lease.stage(intent()); }); const epoch = j.epoch, key = pending(j), get = h.env.storage.getItem, remove = h.env.storage.removeItem; let deleted = false;
    h.env.storage.removeItem = name => { remove(name); if (name === key) deleted = true; }; h.env.storage.getItem = name => { if (name === key && deleted) throw Error("synthetic-readback"); return get(name); };
    await expect(j.exclusive(async lease => { lease.confirmed(intent()); })).rejects.toThrow(); h.env.storage.getItem = get; expect(h.values.has(prefix + "ack:" + epoch)).toBe(false); expect((await new FinanceGoalsJournal(owner, h.env).open()).reconfirmRequired).toBe(true);
  });
  it("cleanup metadata SET failure preserves the body before DELETE", async () => {
    const h = environment(), j = new FinanceGoalsJournal(owner, h.env); await j.exclusive(async lease => { lease.stage(intent()); }); const key = pending(j), before = h.values.get(key), write = h.env.storage.setItem;
    h.env.storage.setItem = (name, value) => { if (name === prefix + "epoch") throw Error("synthetic-quota"); write(name, value); }; await expect(j.exclusive(async lease => { lease.confirmed(intent()); })).rejects.toThrow(); expect(h.values.get(key)).toBe(before);
  });
  it("positive confirmation keeps a durable review gate until an explicit human ack", async () => {
    const h = environment(), j = new FinanceGoalsJournal(owner, h.env); await j.exclusive(async lease => { lease.stage(intent()); lease.uncertain(intent()); lease.confirmed(intent()); expect(lease.snapshot()).toMatchObject({ reconfirmRequired: true, pending: null }); });
    const next = new FinanceGoalsJournal(owner, h.env); await next.open(); await expect(next.exclusive(async lease => { lease.stage(intent()); })).rejects.toMatchObject({ code: "RECONFIRM" }); await next.exclusive(async lease => { lease.acknowledgeReview(); lease.stage(intent()); }); expect(next.snapshot().pending?.intent).toEqual(intent());
  });
  it("only confirmation of the same intent clears, never ack or another UUID", async () => { const h = environment(), j = new FinanceGoalsJournal(owner, h.env), other = intent(); other.input.client_id = id(8); await j.exclusive(async lease => { lease.stage(intent()); lease.uncertain(intent()); expect(() => lease.confirmed(other)).toThrow(); expect(() => lease.acknowledgeReview()).toThrow(); expect(lease.snapshot().pending?.phase).toBe("uncertain"); lease.confirmed(intent()); expect(lease.snapshot().pending).toBeNull(); }); });
});
