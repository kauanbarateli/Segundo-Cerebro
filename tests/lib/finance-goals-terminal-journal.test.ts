import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { FinanceGoalsJournal, type GoalsJournalEnvironment } from "../../src/lib/finance-goals-journal";
import { captureGoalTerminalBrowserAttempt, receiveGoalTerminalBrowserOutcome, type GoalTerminalDigest, type GoalTerminalProof } from "../../src/lib/finance-goals-terminal-browser";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1);
const command = (n = 2): GoalCommand => ({ command: "finance.goal.create", input: { client_id: id(n), expected_finance_revision: "0", name: "Synthetic private original", target_cents: 10000, deadline: null, image_file_id: null } });
const digest: GoalTerminalDigest = async (_, bytes) => Uint8Array.from(createHash("sha256").update(new Uint8Array(bytes)).digest()).buffer;
async function positive(epoch: string, intent = command()): Promise<GoalTerminalProof> {
  const abort = new AbortController(), capture = await captureGoalTerminalBrowserAttempt(owner, epoch, intent, abort.signal, () => undefined, digest);
  const bound = { ...capture.binding }, reply = { version: 2, kind: "closed", binding: bound, disposition: { ...bound, id: id(90), closed_at: "2026-10-23T12:00:00.000Z" } };
  const outcome = await receiveGoalTerminalBrowserOutcome(capture, async () => ({ ok: true, result: reply }), abort.signal, () => undefined);
  if (!outcome.proof) throw Error("Expected a positive fake-transport proof"); return outcome.proof;
}
async function fixture() {
  const values = new Map<string, string>(), writes: string[] = [], queues = new Map<string, Promise<void>>(); let sequence = 100;
  const env: GoalsJournalEnvironment = { uuid: () => id(++sequence), storage: { keys: () => [...values.keys()], getItem: key => values.get(key) ?? null, setItem: (key, value) => { writes.push("set:" + key); values.set(key, value); }, removeItem: key => { writes.push("remove:" + key); values.delete(key); } }, exclusive: async (name, work) => { let release!: () => void; const before = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(yes => { release = yes; })); await before; try { return await work(); } finally { release(); } } };
  const journal = new FinanceGoalsJournal(owner, env); await journal.open(); await journal.exclusive(async lease => { lease.stage(command()); });
  const prefix = `segundo-cerebro:finance-goals:v1:${owner}:`, key = prefix + "pending:" + journal.epoch;
  return { values, writes, env, journal, prefix, key };
}
describe("terminal recognition — fake Storage/locks; no absence authority", () => {
  it("requires nominal proof and exact body before invalidating ack or changing any byte", async () => {
    const h = await fixture(), before = [...h.values];
    await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal({ kind: "goal-terminal-positive" }, command()); })).rejects.toThrow(); expect([...h.values]).toEqual(before);
    const proof = await positive(h.journal.epoch);
    await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal(proof, command(3)); })).rejects.toThrow(); expect([...h.values]).toEqual(before);
  });
  it("clears A only after durable reconfirmation and requires explicit review before a new stage", async () => {
    const h = await fixture(), proof = await positive(h.journal.epoch); h.writes.length = 0;
    await h.journal.exclusive(async lease => { lease.recognizeTerminal(proof, command()); expect(lease.snapshot()).toMatchObject({ pending: null, reconfirmRequired: true }); });
    const metadata = h.writes.indexOf("set:" + h.prefix + "epoch"), removal = h.writes.indexOf("remove:" + h.key), ack = h.writes.indexOf("remove:" + h.prefix + "ack:" + h.journal.epoch);
    expect(ack).toBeLessThan(metadata); expect(metadata).toBeLessThan(removal);
    await expect(h.journal.exclusive(async lease => { lease.stage(command(3)); })).rejects.toMatchObject({ code: "RECONFIRM" });
    await h.journal.exclusive(async lease => { lease.acknowledgeReview(); lease.stage(command(3)); }); expect(h.journal.snapshot().pending?.intent).toEqual(command(3));
  });
  it("recovers DELETE-with-effect/readback-failure only with a NEW positive A, never null or an old proof", async () => {
    const h = await fixture(), first = await positive(h.journal.epoch), read = h.env.storage.getItem, remove = h.env.storage.removeItem; let deleted = false, failed = false;
    h.env.storage.removeItem = key => { remove(key); if (key === h.key) deleted = true; };
    h.env.storage.getItem = key => { if (key === h.key && deleted && !failed) { failed = true; throw Error("Synthetic readback failure"); } return read(key); };
    await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal(first, command()); })).rejects.toMatchObject({ code: "UNAVAILABLE" });
    h.env.storage.getItem = read; expect(h.journal.snapshot()).toMatchObject({ pending: null, reconfirmRequired: true });
    const before = [...h.values]; await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal(first, command()); })).rejects.toThrow(); expect([...h.values]).toEqual(before);
    await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal({ kind: "goal-terminal-positive" }, command()); })).rejects.toThrow(); expect([...h.values]).toEqual(before);
    const fresh = await positive(h.journal.epoch); await h.journal.exclusive(async lease => { lease.recognizeTerminal(fresh, command()); }); expect(h.journal.snapshot()).toMatchObject({ pending: null, reconfirmRequired: true });
  });
  it("pending B causes refusal before any metadata or ack mutation, including after a partial clear", async () => {
    const h = await fixture(), proof = await positive(h.journal.epoch), stored = JSON.parse(h.values.get(h.key)!); stored.intent = command(3); h.values.set(h.key, JSON.stringify(stored));
    const before = [...h.values]; h.writes.length = 0;
    await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal(proof, command()); })).rejects.toMatchObject({ code: "PENDING" });
    expect(h.writes).toEqual([]); expect([...h.values]).toEqual(before); expect(h.journal.snapshot().pending?.intent).toEqual(command(3));
  });
  it("quota or DELETE failure retains A and consumes the old proof without manufacturing resolution", async () => {
    for (const mode of ["metadata", "delete"] as const) {
      const h = await fixture(), proof = await positive(h.journal.epoch), set = h.env.storage.setItem, remove = h.env.storage.removeItem;
      h.env.storage.setItem = (key, value) => { if (mode === "metadata" && key === h.prefix + "epoch") throw Error("Synthetic quota"); set(key, value); };
      h.env.storage.removeItem = key => { if (mode === "delete" && key === h.key) throw Error("Synthetic DELETE failure"); remove(key); };
      await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal(proof, command()); })).rejects.toMatchObject({ code: "UNAVAILABLE" });
      h.env.storage.setItem = set; h.env.storage.removeItem = remove; expect(h.journal.snapshot().pending?.intent).toEqual(command());
      await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal(proof, command()); })).rejects.toThrow();
      const fresh = await positive(h.journal.epoch); await h.journal.exclusive(async lease => { lease.recognizeTerminal(fresh, command()); }); expect(h.journal.snapshot().pending).toBeNull();
    }
  });
  it("old epoch proof and handle cannot delete the next epoch's B", async () => {
    const h = await fixture(), proof = await positive(h.journal.epoch); h.journal.revoke();
    const next = new FinanceGoalsJournal(owner, h.env); await next.open(); await next.exclusive(async lease => { lease.acknowledgeReview(); lease.stage(command(3)); });
    const before = [...h.values]; await expect(next.exclusive(async lease => { lease.recognizeTerminal(proof, command()); })).rejects.toThrow(); expect([...h.values]).toEqual(before);
    await expect(h.journal.exclusive(async lease => { lease.recognizeTerminal(proof, command()); })).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(next.snapshot().pending?.intent).toEqual(command(3));
  });
});
