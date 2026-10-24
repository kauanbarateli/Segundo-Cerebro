/** Browser-factory lifecycle with fake Storage/Web Locks only. No native lock,
 * Auth, HTTP, upload, file-finalization or financial acceptance is claimed. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GoalImageUploadMetadata } from "../../src/lib/files/goal-image-upload-contract";

const id = (n: number) => `7b400000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1), epoch = id(2), other = id(3), nextEpoch = id(4);
const prefix = (actor = owner) => `segundo-cerebro:goal-image-upload:v1:${actor}:`;
const metadata = (): GoalImageUploadMetadata => ({ version: 1, purpose: "finance_goal_image", scope: { ownerId: owner, epoch, editorKey: "synthetic-source", goalId: null, goalRevision: null, baselineFileId: null }, selection: { generation: 1, name: "synthetic.png", size: 100, mime: "image/png", sha256: "a".repeat(64) }, uploadClientId: id(5), uploadId: null, phase: "prepared" });

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
async function fixture(held = false) {
  const values = new Map<string, string>(), writes: string[] = [], events = new EventTarget(), queues = new Map<string, Promise<void>>(), waiters: Array<() => void> = [];
  const control: { held: boolean; blockRemove: boolean; onSet: ((key: string) => void) | null; locks: number } = { held, blockRemove: false, onSet: null, locks: 0 };
  const storage = {
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, text: string) { values.set(key, text); writes.push("set:" + key); control.onSet?.(key); },
    removeItem(key: string) { if (control.blockRemove) throw new Error("LOCAL_REMOVE_REFUSED"); writes.push("remove:" + key); values.delete(key); },
  };
  vi.stubGlobal("window", { localStorage: storage, addEventListener: events.addEventListener.bind(events) });
  vi.stubGlobal("navigator", { locks: { async request(name: string, options: { signal: AbortSignal }, work: () => Promise<unknown>) {
    control.locks++; let release!: () => void;
    const previous = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(done => { release = done; }));
    await previous;
    try { if (control.held) await new Promise<void>(done => waiters.push(done)); if (options.signal.aborted) throw new Error("LOCAL_ABORT"); return await work(); }
    finally { release(); }
  } } });
  const { browserGoalImageUploadJournal: open } = await import("../../src/lib/files/goal-image-upload-journal");
  const logout = (userId: unknown = owner) => events.dispatchEvent(new CustomEvent("segundo-cerebro:demo-logout", { detail: { userId } }));
  return { open, values, writes, control, logout, release() { control.held = false; waiters.splice(0).forEach(done => done()); } };
}

it("logout outside Financeiro removes only its registered epoch body and preserves durable fences", async () => {
  const f = await fixture(), journal = await f.open(owner, epoch, () => true);
  await journal.exclusive(async lease => lease.stage(metadata())); journal.dispose();
  f.values.set("unrelated-personal-key", "keep"); f.logout();
  expect(f.values.has(prefix() + "state:" + epoch)).toBe(false); expect(f.values.has(prefix() + "alive:" + epoch)).toBe(false);
  expect(f.values.get(prefix() + "seen:" + epoch)).toBe("1"); expect(f.values.has(prefix() + "pointer")).toBe(true); expect(f.values.get("unrelated-personal-key")).toBe("keep");
  await expect(f.open(owner, epoch, () => true)).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  const next = await f.open(owner, nextEpoch, () => true); expect(next.snapshot().state).toBe("empty");
});

it("a queued open is registered before await and cannot resurrect its epoch after logout", async () => {
  const f = await fixture(true), opening = f.open(owner, epoch, () => true);
  await Promise.resolve(); f.logout(); f.release();
  await expect(opening).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(f.writes.filter(value => value.startsWith("set:"))).toEqual([]);
  await expect(f.open(owner, epoch, () => true)).rejects.toMatchObject({ code: "SESSION_CHANGED" });
});

it("two same-epoch factories queued before initialization share the revocation token", async () => {
  const f = await fixture(true), first = f.open(owner, epoch, () => true), second = f.open(owner, epoch, () => true);
  const outcomes = Promise.allSettled([first, second]); await Promise.resolve(); f.logout(); f.release();
  const results = await outcomes;
  expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]);
  for (const result of results) { if (result.status !== "rejected") throw new Error("LATE_OPEN_ADMITTED"); expect(result.reason).toMatchObject({ code: "SESSION_CHANGED" }); }
  expect(f.writes.filter(value => value.startsWith("set:"))).toEqual([]);
});

it("logout during partial initialization prevents later body or pointer writes", async () => {
  const f = await fixture();
  f.control.onSet = key => { if (key === prefix() + "alive:" + epoch) { f.control.onSet = null; f.logout(); } };
  // Logout removed alive before put's own readback. Preserve that original
  // UNAVAILABLE refusal; it is not a certificate of successful redaction.
  await expect(f.open(owner, epoch, () => true)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  expect(f.values.get(prefix() + "seen:" + epoch)).toBe("1"); expect(f.values.has(prefix() + "alive:" + epoch)).toBe(false);
  expect(f.values.has(prefix() + "state:" + epoch)).toBe(false); expect(f.values.has(prefix() + "pointer")).toBe(false);
  await expect(f.open(owner, epoch, () => true)).rejects.toMatchObject({ code: "SESSION_CHANGED" });
});

it("route disposal and a new host preserve the exact protected attempt without a clear or new UUID", async () => {
  const f = await fixture(), first = await f.open(owner, epoch, () => true);
  await first.exclusive(async lease => lease.stage(metadata())); const before = f.values.get(prefix() + "state:" + epoch);
  first.dispose(); const second = await f.open(owner, epoch, () => true);
  expect(f.values.get(prefix() + "state:" + epoch)).toBe(before); expect(second.snapshot().attempt).toEqual(metadata());
  f.logout(); expect(() => second.snapshot()).toThrow(); expect(f.values.has(prefix() + "state:" + epoch)).toBe(false);
});

it("confirmed owner change revokes A while a later logout for A leaves B intact", async () => {
  const f = await fixture(), first = await f.open(owner, epoch, () => true);
  await first.exclusive(async lease => lease.stage(metadata())); const second = await f.open(other, nextEpoch, () => true);
  expect(() => first.snapshot()).toThrow(); expect(f.values.has(prefix() + "state:" + epoch)).toBe(false);
  const before = f.values.get(prefix(other) + "state:" + nextEpoch); f.logout(owner); f.logout({}); f.logout("not-a-uuid");
  expect(f.values.get(prefix(other) + "state:" + nextEpoch)).toBe(before); expect(second.snapshot().state).toBe("empty");
});

it("failed redaction retains its exact handle, blocks another owner and can be retried explicitly", async () => {
  const f = await fixture(), journal = await f.open(owner, epoch, () => true);
  await journal.exclusive(async lease => lease.stage(metadata())); const secondHandle = await f.open(owner, epoch, () => true);
  f.control.blockRemove = true; f.logout();
  expect(() => journal.snapshot()).toThrow(); expect(() => secondHandle.snapshot()).toThrow(); expect(f.values.has(prefix() + "state:" + epoch)).toBe(true);
  await expect(f.open(other, nextEpoch, () => true)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  expect(f.values.has(prefix(other) + "state:" + nextEpoch)).toBe(false);
  f.control.blockRemove = false; f.logout(); expect(f.values.has(prefix() + "state:" + epoch)).toBe(false);
  const second = await f.open(other, nextEpoch, () => true); expect(second.snapshot().state).toBe("empty");
});

it("a stale caller is refused before lock admission or a storage write", async () => {
  const f = await fixture(); await expect(f.open(owner, epoch, () => false)).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(f.control.locks).toBe(0); expect(f.writes).toEqual([]);
});
