import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinancialGoal, GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { FinanceGoalsBrowserClient } from "../../src/lib/finance-goals-client";
import { FinanceGoalsJournal, type GoalsJournalEnvironment } from "../../src/lib/finance-goals-journal";
import type { GoalJournalView } from "../../src/lib/finance-goals-client-contract";
import { GOAL_HTTP_PATHS } from "../../src/lib/finance-goals-http-contract";
import { GoalImageUploadCoordinator } from "../../src/lib/files/goal-image-upload";
import { GoalImageUploadJournal, type GoalImageUploadEnvironment } from "../../src/lib/files/goal-image-upload-journal";
import type { GoalImageUploadScope } from "../../src/lib/files/goal-image-upload-contract";
import { LOCAL_STORAGE_ORIGIN } from "../../src/lib/files/storage-origin";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), epoch = id(2), image = id(9);
const file = () => new File([new Uint8Array([1])], "synthetic.png", { type: "image/png" });
const original = (): Extract<GoalCommand, { command: "finance.goal.update" }> => ({ command: "finance.goal.update", input: { client_id: id(40), expected_finance_revision: "0", goal_id: id(4), expected_revision: "0", patch: { image_file_id: image } } });
const saved = (): FinancialGoal => ({ version: 1, id: id(4), user_id: owner, name: "Synthetic", target_cents: 10000, deadline: null, image_file_id: image, archived_at: null, revision: "1", created_at: "2026-10-24T00:00:00Z", updated_at: "2026-10-24T00:00:00Z" });
const finalized = () => ({ id: image, user_id: owner, kind: "finance_goal_image", folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 1, sha256: "b".repeat(64), width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: "2026-10-24T00:00:00Z", updated_at: "2026-10-24T00:00:00Z", modified_at: "2026-10-24T00:00:00Z" });
async function harness(preparedOnly = false) {
  const values = new Map<string, string>(), queues = new Map<string, Promise<void>>(), sends: unknown[] = [], financialCalls: string[] = []; let current = true, sequence = 99, storageCalls = 0, held: GoalJournalView | null | undefined;
  const storage = { keys: () => [...values.keys()], getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const exclusive = async <T,>(name: string, work: () => Promise<T>): Promise<T> => { let release!: () => void; const prior = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(done => { release = done; })); await prior; try { return await work(); } finally { release(); } };
  const financeEnvironment: GoalsJournalEnvironment = { storage, exclusive, uuid: () => epoch }, financeJournal = new FinanceGoalsJournal(owner, financeEnvironment); await financeJournal.open();
  const finance = new FinanceGoalsBrowserClient(owner, financeJournal, { isCurrent: () => current, origin: "https://synthetic.invalid", fetcher: async (path, init) => {
    financialCalls.push(path); if (path === GOAL_HTTP_PATHS.availability) return Response.json({ ok: true, result: { available: true } });
    const intent = JSON.parse(String(init.body)) as GoalCommand;
    if (intent.command !== "finance.goal.update") throw Error("Synthetic fixture expects update");
    const goal = { ...saved(), id: intent.input.goal_id, revision: (BigInt(intent.input.expected_revision) + 1n).toString(), image_file_id: intent.input.patch.image_file_id ?? image };
    return Response.json({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result: { version: 1, goal } });
  } }); await finance.loadPending(); await finance.availability();
  const scope: GoalImageUploadScope = { ownerId: owner, epoch, editorKey: "synthetic-editor", goalId: id(4), goalRevision: "0", baselineFileId: id(5) }; let target = structuredClone(scope);
  const environment: GoalImageUploadEnvironment = { storage, exclusive, isCurrent: () => current }, journal = new GoalImageUploadJournal(owner, epoch, environment);
  const controller = { current: () => current, matches: (candidate: string, service: unknown) => candidate === owner && service === finance, state: () => ({ journal: held === undefined ? financeJournal.snapshot() : held }) };
  let reply: (input: unknown) => Promise<unknown> = async input => {
    if (!input || typeof input !== "object" || !("upload_id" in input) || typeof input.upload_id !== "string") throw Error("Synthetic original input required");
    return { ...finalized(), id: input.upload_id };
  };
  const app = { userId: owner, mode: "connected" as const, initializeJournal: async () => undefined, getCommandSnapshot: () => ({ status: "idle" }), executeDomainCommand: async (command: string, input: unknown) => { sends.push({ command, input: structuredClone(input) }); return reply(input); } };
  const options: Parameters<typeof GoalImageUploadCoordinator.open>[0] = { scope, journal, finance, financeBarrier: finance.imageUploadBarrier, controller: () => controller, application: () => app, isCurrent: () => current, currentScope: () => target, origin: "https://synthetic.invalid", storageOrigin: LOCAL_STORAGE_ORIGIN, createId: () => id(++sequence), digest: async () => new Uint8Array(32).fill(0xaa),
    transport: { reserve: async () => { storageCalls++; throw Error("No synthetic Storage IO permitted"); }, observe: async () => { storageCalls++; throw Error("No synthetic Storage IO permitted"); }, put: async () => { storageCalls++; throw Error("No synthetic Storage IO permitted"); } } };
  const coordinator = await GoalImageUploadCoordinator.open(options); await coordinator.select(file(), 1);
  if (!preparedOnly) await journal.exclusive(async lease => { lease.advance(lease.snapshot(), { phase: "reserving", uploadId: null }); lease.advance(lease.snapshot(), { phase: "reserved", uploadId: image }); lease.advance(lease.snapshot(), { phase: "put-uncertain", uploadId: image }); lease.advance(lease.snapshot(), { phase: "finalizing", uploadId: image }); });
  return { values, storage, journal, finance, financeJournal, environment, coordinator, options, scope, sends, financialCalls, storageCalls: () => storageCalls, ids: () => sequence,
    target: (value: GoalImageUploadScope) => { target = structuredClone(value); }, hold: (value: typeof held) => { held = value; }, stale: () => { current = false; }, reply: (value: typeof reply) => { reply = value; },
    linked: async () => { await finance.stage(original()); expect((await finance.execute(original())).ok).toBe(true); const proof = finance.imageUploadLinks.current(); if (!proof) throw Error("Expected private link"); return proof; } };
}
afterEach(() => vi.useRealTimers());
describe("Goal upload retirement R — synthetic locks/HTTP, no mount or connected proof", () => {
  it("the original prepared A remains PENDING without a finalize or a retirement effect", async () => {
    const h = await harness(true), before = h.journal.snapshot(), stored = [...h.values];
    expect(before).toMatchObject({ state: "active", attempt: { uploadClientId: id(100), uploadId: null, phase: "prepared" } });
    await expect(h.coordinator.discardFinalized()).rejects.toMatchObject({ code: "PENDING" });
    expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(stored); expect(h.sends).toEqual([]); expect(h.storageCalls()).toBe(0); expect(h.ids()).toBe(100); expect(h.financialCalls).toEqual([GOAL_HTTP_PATHS.availability]);
  });
  it("requires resolved reconfirmation before consuming an exact linked proof, then preserves A in review", async () => {
    const h = await harness(), proof = await h.linked(), before = h.journal.snapshot();
    await expect(h.coordinator.retireLinked(proof)).rejects.toBeDefined(); expect(h.finance.imageUploadLinks.current()).toBe(proof); expect(h.journal.snapshot()).toEqual(before);
    await h.finance.acknowledgeReview(); const retired = await h.coordinator.retireLinked(proof);
    expect(retired.state).toBe("retirement-review"); expect(retired.attempt?.uploadClientId).toBe(id(100)); expect(retired.attempt?.scope).toEqual(h.scope); expect(retired.attempt?.phase).toBe("ready-unbound");
    expect(h.finance.imageUploadLinks.current()).toBeNull(); await expect(h.coordinator.retireLinked(proof)).rejects.toBeDefined(); expect(h.sends).toEqual([]); expect(h.storageCalls()).toBe(0);
  });
  it("fresh original discard admits B only explicitly and closes A before a NEW B handle is used", async () => {
    const h = await harness(), before = h.journal.snapshot(); const retired = await h.coordinator.discardFinalized();
    expect(retired.attempt?.selection).toEqual(before.attempt?.selection); expect(h.sends).toEqual([{ command: "file.upload.finalize", input: { upload_id: image, client_id: id(100) } }]);
    const scope = { ...h.scope, goalRevision: "1", baselineFileId: image }; h.target(scope);
    const next = await h.coordinator.replaceRetired(file(), 1, scope); expect(next).toMatchObject({ state: "active", attempt: { scope, phase: "prepared", uploadId: null, uploadClientId: id(101) } });
    expect(() => h.coordinator.view()).toThrow(); await expect(h.coordinator.resume()).rejects.toBeDefined();
    const b = await GoalImageUploadCoordinator.open({ ...h.options, scope }); expect((await b.resume()).kind).toBe("need-file"); expect(h.storageCalls()).toBe(0); expect(h.sends).toHaveLength(1);
  });
  it("stale A can be freshly observed for retirement without minting ready for editor B", async () => {
    const h = await harness(), scope = { ...h.scope, editorKey: "synthetic-editor-B", goalId: id(8), goalRevision: "2", baselineFileId: null }; h.target(scope);
    expect((await h.coordinator.resume()).kind).toBe("stale"); const count = h.sends.length;
    expect((await h.coordinator.discardFinalized()).state).toBe("retirement-review"); expect(h.sends).toHaveLength(count + 1);
    expect(h.sends.at(-1)).toEqual({ command: "file.upload.finalize", input: { upload_id: image, client_id: id(100) } });
    const next = await h.coordinator.replaceRetired(file(), 1, scope); expect(next.attempt?.scope).toEqual(scope); expect(next.attempt?.scope).not.toEqual(h.scope);
  });
  it("retirement-review after reload needs a NEW own positive, never authority reconstructed from metadata", async () => {
    const h = await harness(); await h.coordinator.discardFinalized(); h.coordinator.dispose();
    const fresh = await GoalImageUploadCoordinator.open(h.options), before = h.journal.snapshot();
    await expect(fresh.resume()).rejects.toMatchObject({ code: "PENDING" }); await expect(fresh.replaceRetired(file(), 2, h.scope)).rejects.toMatchObject({ code: "PENDING" });
    h.reply(async () => { throw Error("Synthetic response unavailable"); }); await expect(fresh.discardFinalized()).rejects.toBeDefined(); expect(h.journal.snapshot()).toEqual(before);
    h.reply(async () => finalized()); expect((await fresh.discardFinalized()).state).toBe("retirement-review"); expect((await fresh.replaceRetired(file(), 2, h.scope)).attempt?.uploadClientId).toBe(id(101));
  });
  it.each(["before", "readback"] as const)("a retirement %s failure burns the linked proof and never grants replacement", async mode => {
    const h = await harness(), proof = await h.linked(); await h.finance.acknowledgeReview(); const before = h.journal.snapshot(), set = h.storage.setItem, get = h.storage.getItem; let failRead = false;
    h.storage.setItem = (key, text) => { if (key.includes("goal-image-upload") && text.includes('"retirement-review"')) { if (mode === "before") throw Error("Synthetic SET refused"); set(key, text); failRead = true; } else set(key, text); };
    h.storage.getItem = key => { if (failRead && key.includes(":state:")) { failRead = false; throw Error("Synthetic readback"); } return get(key); };
    await expect(h.coordinator.retireLinked(proof)).rejects.toBeDefined(); h.storage.setItem = set; h.storage.getItem = get;
    expect(h.finance.imageUploadLinks.current()).toBeNull(); await expect(h.coordinator.retireLinked(proof)).rejects.toBeDefined(); await expect(h.coordinator.replaceRetired(file(), 2, h.scope)).rejects.toMatchObject({ code: "PENDING" });
    expect(h.journal.snapshot().state).toBe(mode === "before" ? "active" : "retirement-review"); expect(h.journal.snapshot().attempt?.uploadClientId).toBe(before.attempt?.uploadClientId);
    await h.coordinator.discardFinalized(); expect(h.sends).toHaveLength(1);
  });
  it("SET B with effect/readback failure retains B and fences EVERY A handler even with the same scope", async () => {
    const h = await harness(); await h.coordinator.discardFinalized(); const set = h.storage.setItem, get = h.storage.getItem; let fail = false;
    h.storage.setItem = (key, text) => { set(key, text); if (key.includes("goal-image-upload") && text.includes(id(101))) fail = true; };
    h.storage.getItem = key => { if (fail && key.includes(":state:")) { fail = false; throw Error("Synthetic B readback"); } return get(key); };
    await expect(h.coordinator.replaceRetired(file(), 2, h.scope)).rejects.toBeDefined(); h.storage.setItem = set; h.storage.getItem = get;
    const b = h.journal.snapshot(), stored = [...h.values], count = h.sends.length; expect(b.attempt?.uploadClientId).toBe(id(101));
    await expect(h.coordinator.resume()).rejects.toMatchObject({ code: "STALE" }); await expect(h.coordinator.discardFinalized()).rejects.toMatchObject({ code: "STALE" }); await expect(h.coordinator.replaceRetired(file(), 2, h.scope)).rejects.toMatchObject({ code: "PENDING" });
    expect(h.journal.snapshot()).toEqual(b); expect([...h.values]).toEqual(stored); expect(h.sends).toHaveLength(count); expect(h.ids()).toBe(101);
    const fresh = await GoalImageUploadCoordinator.open(h.options); expect((await fresh.resume()).kind).toBe("need-file");
  });
  it("SET B without effect retains the cached B identity but requires a NEW positive original before retry", async () => {
    const h = await harness(); await h.coordinator.discardFinalized(); const before = h.journal.snapshot(), set = h.storage.setItem;
    h.storage.setItem = (key, text) => { if (key.includes("goal-image-upload") && text.includes(id(101))) throw Error("Synthetic B quota"); set(key, text); };
    await expect(h.coordinator.replaceRetired(file(), 2, h.scope)).rejects.toBeDefined(); h.storage.setItem = set; expect(h.journal.snapshot()).toEqual(before); expect(h.ids()).toBe(101);
    await expect(h.coordinator.replaceRetired(file(), 2, h.scope)).rejects.toMatchObject({ code: "PENDING" }); await h.coordinator.discardFinalized();
    expect((await h.coordinator.replaceRetired(file(), 2, h.scope)).attempt?.uploadClientId).toBe(id(101)); expect(h.ids()).toBe(101);
  });
  it.each(["physical", "held", "reconfirm"] as const)("a %s financial barrier preserves A and admits no B", async mode => {
    const h = await harness(), intent = original();
    if (mode === "physical") await h.finance.stage(intent);
    else h.hold({ ownerId: owner, epoch, pending: mode === "held" ? { intent, phase: "uncertain" } : null, reconfirmRequired: mode === "reconfirm" });
    const before = h.journal.snapshot(), financial = h.financeJournal.snapshot(); await expect(h.coordinator.discardFinalized()).rejects.toBeDefined();
    expect(h.journal.snapshot()).toEqual(before); expect(h.financeJournal.snapshot()).toEqual(financial); expect(h.ids()).toBe(100); expect(h.storageCalls()).toBe(0);
  });
  it("a second upload tab winning B makes the old authorization/CAS refuse before writes", async () => {
    const h = await harness(); await h.coordinator.discardFinalized(); const other = await GoalImageUploadCoordinator.open(h.options); await other.discardFinalized();
    await other.replaceRetired(file(), 2, h.scope); const before = [...h.values], count = h.sends.length, ids = h.ids();
    await expect(h.coordinator.replaceRetired(file(), 2, h.scope)).rejects.toBeDefined(); await expect(h.coordinator.discardFinalized()).rejects.toMatchObject({ code: "STALE" });
    expect([...h.values]).toEqual(before); expect(h.sends).toHaveLength(count); expect(h.ids()).toBe(ids);
  });
  it("wrong own-finalize DTO or logout during its response cannot retire, admit B or mint ready", async () => {
    for (const mode of ["foreign", "getter", "logout"] as const) {
      const h = await harness(), before = [...h.values]; let getters = 0;
      h.reply(async () => { if (mode === "logout") { h.stale(); return finalized(); } if (mode === "foreign") return { ...finalized(), user_id: id(99) }; return { ...finalized(), get sha256() { getters++; return "b".repeat(64); } }; });
      await expect(h.coordinator.discardFinalized()).rejects.toBeDefined(); expect([...h.values]).toEqual(before); expect(getters).toBe(0); expect(h.storageCalls()).toBe(0); expect(h.ids()).toBe(100);
    }
  });
  it("a retirement lease entered after150s refuses before the ORIGINAL sender and drains without changing A", async () => {
    vi.useFakeTimers(); const h = await harness(), before = h.journal.snapshot(); let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(done => { enter = done; }), gate = new Promise<void>(done => { release = done; });
    const holder = h.journal.exclusive(async () => { enter(); await gate; }); await entered;
    const pending = h.coordinator.discardFinalized(), refused = expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" }); await vi.advanceTimersByTimeAsync(150_001); await refused; release(); await holder; await h.journal.exclusive(async () => undefined);
    expect(h.sends).toEqual([]); expect(h.journal.snapshot()).toEqual(before); expect(h.storageCalls()).toBe(0);
  });
  it.each(["goal", "image", "revision"] as const)("a genuine positive for another %s cannot retire A or consume its proof", async mode => {
    const h = await harness(), intent = original();
    if (mode === "goal") intent.input.goal_id = id(88); if (mode === "image") intent.input.patch.image_file_id = id(88); if (mode === "revision") intent.input.expected_revision = "2";
    await h.finance.stage(intent); expect((await h.finance.execute(intent)).ok).toBe(true); await h.finance.acknowledgeReview();
    const proof = h.finance.imageUploadLinks.current(); if (!proof) throw Error("Expected genuine other positive"); const before = [...h.values];
    await expect(h.coordinator.retireLinked(proof)).rejects.toMatchObject({ code: "STALE" }); expect([...h.values]).toEqual(before); expect(h.finance.imageUploadLinks.current()).toBe(proof); expect(h.sends).toEqual([]);
  });

  it.each(["after", "readback"] as const)("three successive %s replacement failures recover on NEW handles over the SAME journal, then admit another candidate", async mode => {
    const h = await harness(); let handle = h.coordinator;
    for (let cycle = 0; cycle < 3; cycle++) {
      await handle.discardFinalized(); const expectedId = id(h.ids() + 1), set = h.storage.setItem, get = h.storage.getItem; let failRead = false;
      h.storage.setItem = (key, text) => { set(key, text); if (key.includes("goal-image-upload") && text.includes(expectedId)) { if (mode === "after") throw Error("Synthetic B SET effect before error"); failRead = true; } };
      h.storage.getItem = key => { if (failRead && key.includes(":state:")) { failRead = false; throw Error("Synthetic B readback"); } return get(key); };
      await expect(handle.replaceRetired(file(), cycle + 2, h.scope)).rejects.toBeDefined(); h.storage.setItem = set; h.storage.getItem = get;
      const durable = h.journal.snapshot(), stored = [...h.values], sends = h.sends.length; expect(durable.attempt?.uploadClientId).toBe(expectedId);
      const next = await GoalImageUploadCoordinator.open(h.options); expect((await next.resume()).kind).toBe("need-file");
      expect([...h.values]).toEqual(stored); expect(h.sends).toHaveLength(sends); // Hold reconciliation itself writes nothing.
      await expect(handle.discardFinalized()).rejects.toMatchObject({ code: "STALE" }); expect([...h.values]).toEqual(stored);
      await h.journal.exclusive(async lease => { lease.advance(lease.snapshot(), { phase: "reserving", uploadId: null }); lease.advance(lease.snapshot(), { phase: "reserved", uploadId: id(200 + cycle) }); lease.advance(lease.snapshot(), { phase: "put-uncertain", uploadId: id(200 + cycle) }); lease.advance(lease.snapshot(), { phase: "finalizing", uploadId: id(200 + cycle) }); });
      handle = next;
    }
    await handle.discardFinalized(); const final = await handle.replaceRetired(file(), 5, h.scope);
    expect(final.attempt?.uploadClientId).toBe(id(104)); expect(h.ids()).toBe(104); expect(h.storageCalls()).toBe(0); expect(h.financialCalls).toEqual([GOAL_HTTP_PATHS.availability]);
  });

});
