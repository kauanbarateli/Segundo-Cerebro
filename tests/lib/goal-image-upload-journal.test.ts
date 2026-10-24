import { describe, expect, it } from "vitest";
import { decodeGoalImageUploadJournalState, decodeGoalImageUploadMetadata, decodeGoalImageUploadScope, GOAL_IMAGE_UPLOAD_METADATA_BYTES, serializeGoalImageUploadJournalState, serializeGoalImageUploadMetadata, type GoalImageUploadJournalSnapshot, type GoalImageUploadMetadata } from "../../src/lib/files/goal-image-upload-contract";
import { GoalImageUploadJournal, type GoalImageUploadEnvironment, type GoalImageUploadLease } from "../../src/lib/files/goal-image-upload-journal";

const id = (n: number) => `7b200000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), epoch = id(2);
function metadata(client = id(3)): GoalImageUploadMetadata {
  return { version: 1, purpose: "finance_goal_image", scope: { ownerId: owner, epoch, editorKey: "synthetic-editor", goalId: id(4), goalRevision: "0", baselineFileId: id(5) }, selection: { generation: 1, name: "synthetic.png", size: 1024, mime: "image/png", sha256: "a".repeat(64) }, uploadClientId: client, uploadId: null, phase: "prepared" };
}
function state(attempt: GoalImageUploadMetadata | null = metadata(), revision = "1", kind: GoalImageUploadJournalSnapshot["state"] = "active"): GoalImageUploadJournalSnapshot {
  return { version: 2, ownerId: owner, epoch, revision, state: kind, attempt };
}
async function fixture() {
  const values = new Map<string, string>(), writes: string[] = [], queues = new Map<string, Promise<void>>(); let current = true;
  const environment: GoalImageUploadEnvironment = { isCurrent: () => current, storage: {
    keys: () => [...values.keys()], getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes.push("set:" + key); values.set(key, value); }, removeItem: key => { writes.push("remove:" + key); values.delete(key); },
  }, exclusive: async (name, work) => { let release!: () => void; const before = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(done => { release = done; })); await before; try { return await work(); } finally { release(); } } };
  const journal = new GoalImageUploadJournal(owner, epoch, environment); await journal.open();
  const prefix = `segundo-cerebro:goal-image-upload:v1:${owner}:`, key = prefix + "state:" + epoch;
  const stage = async (value = metadata()) => journal.exclusive(async lease => lease.stage(value));
  return { values, writes, environment, journal, prefix, key, stage, changeIdentity: () => { current = false; } };
}

describe("Goal image upload J2 — local fake Storage/locks, not upload proof", () => {
  it("keeps the B2a scope shape and closed bounded metadata without File, capability or financial intent", () => {
    const value = metadata(), encoded = serializeGoalImageUploadJournalState(state());
    expect(decodeGoalImageUploadScope(value.scope)).toEqual(value.scope); expect(decodeGoalImageUploadMetadata(value)).toEqual(value);
    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(GOAL_IMAGE_UPLOAD_METADATA_BYTES);
    expect(encoded).not.toMatch(/upload_url|token|Authorization|GoalCommand|target_cents|canonical_input|data:|blob:/);
    for (const change of [{ purpose: "avatar" }, { version: 2 }, { file: {} }, { token: "synthetic" }, { upload_url: "https://invalid.test" }, { command: "finance.goal.create" }]) expect(() => decodeGoalImageUploadMetadata({ ...value, ...change })).toThrow();
    for (const selection of [{ ...value.selection, size: 0 }, { ...value.selection, size: 8388609 }, { ...value.selection, generation: 0 }, { ...value.selection, generation: 2147483648 }, { ...value.selection, mime: "image/svg+xml" }, { ...value.selection, sha256: "x".repeat(64) }, { ...value.selection, name: " unsafe.png " }, { ...value.selection, name: "attack.svg" }]) expect(() => decodeGoalImageUploadMetadata({ ...value, selection })).toThrow();
    let getters = 0; expect(() => decodeGoalImageUploadMetadata({ ...value, get selection() { getters++; return value.selection; } })).toThrow(); expect(getters).toBe(0);
    expect(() => decodeGoalImageUploadScope({ ...value.scope, goalId: null })).toThrow();
    expect(() => decodeGoalImageUploadScope({ ...value.scope, goalRevision: "00" })).toThrow();
    expect(decodeGoalImageUploadJournalState(state())).toEqual(state());
    for (const invalid of [{ ...state(), version: 1 }, { ...state(), proof: true }, { ...state(), revision: "00" }, { ...state(), revision: "9223372036854775808" }, state(value, "0"), state(null), state(value, "0", "empty"), state(null, "1", "empty"), state(value, "2", "retirement-review")]) expect(() => decodeGoalImageUploadJournalState(invalid)).toThrow();
  });
  it("writes ONE complete A before admission returns and restores only that exact attempt", async () => {
    const h = await fixture(); h.writes.length = 0; const result = await h.stage(); expect(result.attempt).toEqual(metadata());
    expect(result).toEqual(state()); expect(h.writes).toEqual(["set:" + h.key]); expect(h.values.get(h.key)).toBe(serializeGoalImageUploadJournalState(state()));
    expect([...h.values.keys()].some(key => /:(admission|slot|attempt):/.test(key))).toBe(false);
    const reopened = new GoalImageUploadJournal(owner, epoch, h.environment); expect((await reopened.open()).attempt).toEqual(metadata());
    const before = [...h.values]; await h.stage(); expect([...h.values]).toEqual(before);
    await expect(h.stage(metadata(id(99)))).rejects.toMatchObject({ code: "PENDING" }); expect([...h.values]).toEqual(before);
  });
  it("clones input/output and advances only exact CAS with immutable scope/source/client/upload IDs", async () => {
    const h = await fixture(), input = metadata(); await h.stage(input); input.selection.name = "different.png";
    const copy = h.journal.snapshot(); if (!copy.attempt) throw Error("Expected metadata"); copy.attempt.selection.sha256 = "b".repeat(64); expect(h.journal.snapshot().attempt).toEqual(metadata());
    const advance = async (expected: GoalImageUploadJournalSnapshot, phase: string, uploadId: string | null) => h.journal.exclusive(async lease => lease.advance(expected, { phase, uploadId }));
    let expected = state(); expected = await advance(expected, "reserving", null);
    await expect(advance(state(), "reserving", null)).rejects.toMatchObject({ code: "STALE" });
    await expect(advance(expected, "ready-unbound", id(10))).rejects.toMatchObject({ code: "INVALID" });
    expected = await advance(expected, "reserved", id(10));
    await expect(advance(expected, "put-uncertain", id(11))).rejects.toMatchObject({ code: "INVALID" });
    if (!expected.attempt) throw Error("Expected metadata");
    const expectedAttempt = expected.attempt, altered = { ...expected, attempt: { ...expectedAttempt, selection: { ...expectedAttempt.selection, sha256: "b".repeat(64) } } };
    await expect(h.journal.exclusive(async lease => lease.advance(altered, { phase: "put-uncertain", uploadId: id(10) }))).rejects.toMatchObject({ code: "STALE" });
    expected = await advance(expected, "put-uncertain", id(10));
    expected = await advance(expected, "finalizing", id(10));
    expected = await advance(expected, "ready-unbound", id(10));
    expect(expected.attempt?.phase).toBe("ready-unbound"); expect(Object.keys(expected.attempt ?? {}).sort()).toEqual(["phase", "purpose", "scope", "selection", "uploadClientId", "uploadId", "version"]);
    await expect(h.stage(metadata(id(99)))).rejects.toMatchObject({ code: "PENDING" }); // Metadata ready grants no new admission or proof.
    await expect(advance(expected, "prepared", null)).rejects.toMatchObject({ code: "INVALID" });
    expect(await h.stage()).toEqual(expected); // Exact replay never resets a progressed attempt.
  });
  it("quota without SET effect preserves initial empty; this instance retries only A, without admitting RAM-only A remotely", async () => {
    const h = await fixture(), before = [...h.values], set = h.environment.storage.setItem;
    h.environment.storage.setItem = () => { throw Error("Synthetic quota before effect"); };
    await expect(h.stage()).rejects.toMatchObject({ code: "UNAVAILABLE" }); h.environment.storage.setItem = set; expect([...h.values]).toEqual(before);
    await expect(h.stage(metadata(id(99)))).rejects.toMatchObject({ code: "PENDING" });
    // No A was durably admitted: no caller could have started IO. Reload is
    // empty, not an invented recovery of the original metadata held only in RAM.
    expect(await new GoalImageUploadJournal(owner, epoch, h.environment).open()).toEqual(state(null, "0", "empty"));
    expect(await h.stage()).toEqual(state());
  });
  it("SET with effect plus readback failure preserves the original for a fresh handle and never admits B", async () => {
    const h = await fixture(), read = h.environment.storage.getItem; let justWritten = false;
    const set = h.environment.storage.setItem; h.environment.storage.setItem = (key, value) => { set(key, value); if (key === h.key) justWritten = true; };
    h.environment.storage.getItem = key => { if (key === h.key && justWritten) { justWritten = false; throw Error("Synthetic readback failure"); } return read(key); };
    await expect(h.stage()).rejects.toMatchObject({ code: "UNAVAILABLE" }); h.environment.storage.getItem = read; h.environment.storage.setItem = set;
    const fresh = new GoalImageUploadJournal(owner, epoch, h.environment); expect((await fresh.open()).attempt).toEqual(metadata());
    await expect(fresh.exclusive(async lease => lease.stage(metadata(id(99))))).rejects.toMatchObject({ code: "PENDING" });
  });
  it("an advance SET failure keeps the old exact attempt and the complete state", async () => {
    const h = await fixture(); await h.stage(); const before = [...h.values], set = h.environment.storage.setItem;
    h.environment.storage.setItem = () => { throw Error("Synthetic quota"); };
    await expect(h.journal.exclusive(async lease => lease.advance(state(), { phase: "reserving", uploadId: null }))).rejects.toMatchObject({ code: "UNAVAILABLE" }); h.environment.storage.setItem = set;
    expect([...h.values]).toEqual(before); await expect(h.stage(metadata(id(99)))).rejects.toMatchObject({ code: "PENDING" });
  });
  it("SET that takes effect before throwing leaves one complete recoverable A, never a half-slot", async () => {
    const h = await fixture(), set = h.environment.storage.setItem;
    h.environment.storage.setItem = (key, value) => { set(key, value); if (key === h.key) throw Error("Synthetic SET effect before error"); };
    await expect(h.stage()).rejects.toMatchObject({ code: "UNAVAILABLE" }); h.environment.storage.setItem = set;
    const fresh = new GoalImageUploadJournal(owner, epoch, h.environment); expect(await fresh.open()).toEqual(state());
    await expect(fresh.exclusive(async lease => lease.stage(metadata(id(99))))).rejects.toMatchObject({ code: "PENDING" });
    h.environment.storage.setItem = (key, value) => { set(key, value); throw Error("Synthetic advance SET effect before error"); };
    await expect(fresh.exclusive(async lease => lease.advance(state(), { phase: "reserving", uploadId: null }))).rejects.toMatchObject({ code: "UNAVAILABLE" }); h.environment.storage.setItem = set;
    expect(await new GoalImageUploadJournal(owner, epoch, h.environment).open()).toEqual(state({ ...metadata(), phase: "reserving" }, "2"));
  });
  it("full-state revision fences old generations even when phase is repeated, without numeric coercion", async () => {
    const h = await fixture(); await h.stage(); const advance = (expected: GoalImageUploadJournalSnapshot) => h.journal.exclusive(async lease => lease.advance(expected, { phase: "reserving", uploadId: null }));
    const second = await advance(state()), third = await advance(second); expect(third.revision).toBe("3"); h.writes.length = 0;
    await expect(advance(second)).rejects.toMatchObject({ code: "STALE" }); expect(h.writes).toEqual([]); expect(h.journal.snapshot()).toEqual(third);
    const exhausted = { ...third, revision: "9223372036854775807" }; h.values.set(h.key, serializeGoalImageUploadJournalState(exhausted));
    await expect(advance(exhausted)).rejects.toMatchObject({ code: "INVALID" }); expect(h.writes).toEqual([]); expect(h.journal.snapshot()).toEqual(exhausted);
  });
  it("recognizes retirement-review but exposes no retirement/clear authority or admission for B", async () => {
    const h = await fixture(); await h.stage(); const retired = state({ ...metadata(), phase: "ready-unbound", uploadId: id(10) }, "8", "retirement-review");
    h.values.set(h.key, serializeGoalImageUploadJournalState(retired)); const fresh = new GoalImageUploadJournal(owner, epoch, h.environment); expect(await fresh.open()).toEqual(retired); h.writes.length = 0;
    await expect(fresh.exclusive(async lease => lease.stage(metadata()))).rejects.toMatchObject({ code: "PENDING" });
    await expect(fresh.exclusive(async lease => lease.stage(metadata(id(99))))).rejects.toMatchObject({ code: "PENDING" });
    await expect(fresh.exclusive(async lease => lease.advance(retired, { phase: "ready-unbound", uploadId: id(10) }))).rejects.toMatchObject({ code: "PENDING" });
    expect("retire" in fresh || "clear" in fresh || "reset" in fresh).toBe(false); expect(h.writes).toEqual([]); expect(fresh.snapshot()).toEqual(retired);
    h.values.delete(h.key); await expect(new GoalImageUploadJournal(owner, epoch, h.environment).open()).rejects.toMatchObject({ code: "CORRUPT" });
    await expect(fresh.exclusive(async lease => lease.stage(metadata(id(99))))).rejects.toMatchObject({ code: "CORRUPT" }); expect(h.writes).toEqual([]);
  });
  it.each(["admission", "slot-only", "body-only", "sealed-empty", "intact", "other-epoch"] as const)("quarantines unpublished legacy V1 %s, without migration or new-epoch escape", async mode => {
    const h = await fixture(); h.values.delete(h.key);
    if (mode === "admission" || mode === "intact") h.values.set(h.prefix + "admission:" + epoch, "1");
    if (mode === "slot-only" || mode === "intact") h.values.set(h.prefix + "slot:" + epoch, id(3));
    if (mode === "body-only" || mode === "intact") h.values.set(h.prefix + "attempt:" + epoch, serializeGoalImageUploadMetadata(metadata()));
    if (mode === "other-epoch") h.values.set(h.prefix + "slot:" + id(80), id(3));
    const before = [...h.values]; h.writes.length = 0;
    await expect(new GoalImageUploadJournal(owner, epoch, h.environment).open()).rejects.toMatchObject({ code: "CORRUPT" });
    await expect(new GoalImageUploadJournal(owner, id(10), h.environment).open()).rejects.toBeDefined(); expect(h.writes).toEqual([]); expect([...h.values]).toEqual(before);
  });
  it.each(["extra", "duplicate", "oversize", "owner", "epoch", "revision", "missing-entry", "admission", "hash"] as const)("refuses corrupt %s without writes or treating it as a fresh upload", async mode => {
    const h = await fixture(); await h.stage(); const value = state();
    if (mode === "extra") h.values.set(h.key, JSON.stringify({ ...value, token: "synthetic" }));
    if (mode === "duplicate") h.values.set(h.key, '{"version":2,' + JSON.stringify(value).slice(1));
    if (mode === "oversize") h.values.set(h.key, JSON.stringify(value) + " ".repeat(8193));
    if (mode === "owner") h.values.set(h.key, JSON.stringify({ ...value, ownerId: id(99) }));
    if (mode === "epoch") h.values.set(h.key, JSON.stringify({ ...value, epoch: id(99) }));
    if (mode === "revision") h.values.set(h.key, JSON.stringify({ ...value, revision: "00" }));
    if (mode === "missing-entry") h.values.delete(h.key);
    if (mode === "admission") h.values.set(h.prefix + "admission:" + epoch, "1");
    if (mode === "hash") h.values.set(h.key, JSON.stringify({ ...value, attempt: { ...metadata(), selection: { ...metadata().selection, sha256: "x" } } }));
    const before = [...h.values]; h.writes.length = 0;
    await expect(h.journal.exclusive(async lease => lease.stage(metadata(id(100))))).rejects.toMatchObject({ code: "CORRUPT" }); expect(h.writes).toEqual([]); expect([...h.values]).toEqual(before);
  });
  it("failed opening never recreates a missing seen/alive/pointer fence or admits an orphan", async () => {
    for (const key of ["seen:", "state:", "alive:", "pointer"] as const) {
      const h = await fixture(); const set = h.environment.storage.setItem;
      h.environment.storage.setItem = (name, value) => { if (name === h.prefix + key + (key === "pointer" ? "" : id(10))) throw Error("Synthetic opening failure"); set(name, value); };
      h.journal.revokeIdentity(); const next = new GoalImageUploadJournal(owner, id(10), h.environment);
      await expect(next.open()).rejects.toBeDefined(); h.environment.storage.setItem = set;
      // No callback may use the failed factory; a partial write is not an open journal.
      await expect(next.exclusive(async lease => lease.stage({ ...metadata(), scope: { ...metadata().scope, epoch: id(10) } }))).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    }
    const h = await fixture(); await h.stage(); h.values.delete(h.prefix + "alive:" + epoch); h.writes.length = 0;
    await expect(new GoalImageUploadJournal(owner, epoch, h.environment).open()).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(h.writes).toEqual([]);
    h.values.set(h.prefix + "alive:" + epoch, "corrupt");
    await expect(new GoalImageUploadJournal(owner, epoch, h.environment).open()).rejects.toMatchObject({ code: "CORRUPT" }); expect(h.writes).toEqual([]);
  });
  it("explicit revoke uses DELETE before redaction and works when every SET fails, fencing all old handles", async () => {
    const h = await fixture(); await h.stage(); const peer = new GoalImageUploadJournal(owner, epoch, h.environment); await peer.open(); const fence = peer.captureFence(); h.writes.length = 0;
    h.environment.storage.setItem = () => { throw Error("Synthetic quota"); };
    expect(h.journal.revokeIdentity()).toEqual({ hadProtectedAttempt: true });
    expect(h.writes[0]).toBe("remove:" + h.prefix + "alive:" + epoch); expect(h.values.has(h.key)).toBe(false);
    expect(() => fence()).toThrow(); await expect(peer.exclusive(async lease => lease.stage(metadata(id(99))))).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await expect(new GoalImageUploadJournal(owner, epoch, h.environment).open()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  });
  it("DELETE failure before verified revocation does not redact the protected metadata", async () => {
    const h = await fixture(); await h.stage(); const before = h.values.get(h.key), remove = h.environment.storage.removeItem;
    h.environment.storage.removeItem = key => { if (key === h.prefix + "alive:" + epoch) throw Error("Synthetic DELETE refusal"); remove(key); };
    expect(() => h.journal.revokeIdentity()).toThrow(); expect(h.values.get(h.key)).toBe(before);
    // The host must still revoke its financial identity. A failed local DELETE
    // is reported, never described as successful cleanup.
  });
  it("DELETE with effect plus failed readback still revokes fresh and stale handles before redaction", async () => {
    const h = await fixture(); await h.stage(); const peer = new GoalImageUploadJournal(owner, epoch, h.environment); await peer.open();
    const read = h.environment.storage.getItem, remove = h.environment.storage.removeItem; let deletedAlive = false;
    h.environment.storage.removeItem = key => { remove(key); if (key === h.prefix + "alive:" + epoch) deletedAlive = true; };
    h.environment.storage.getItem = key => { if (deletedAlive && key === h.prefix + "alive:" + epoch) { deletedAlive = false; throw Error("Synthetic revoke readback failure"); } return read(key); };
    expect(() => h.journal.revokeIdentity()).toThrow(); h.environment.storage.getItem = read; h.environment.storage.removeItem = remove;
    expect(h.values.get(h.key)).toBe(serializeGoalImageUploadJournalState(state()));
    expect(() => peer.snapshot()).toThrow(); await expect(new GoalImageUploadJournal(owner, epoch, h.environment).open()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    h.journal.revokeIdentity(); expect(h.values.has(h.key)).toBe(false);
  });
  it("late old-epoch revoke/lease cannot remove B or change the new pointer", async () => {
    const h = await fixture(); await h.stage(); let escaped!: GoalImageUploadLease; await h.journal.exclusive(async lease => { escaped = lease; }); h.journal.revokeIdentity();
    const nextEpoch = id(10), next = new GoalImageUploadJournal(owner, nextEpoch, h.environment); await next.open(); const nextMetadata = { ...metadata(id(99)), scope: { ...metadata().scope, epoch: nextEpoch } };
    await next.exclusive(async lease => lease.stage(nextMetadata)); const before = [...h.values];
    h.journal.revokeIdentity(); expect([...h.values]).toEqual(before); expect(() => escaped.stage(metadata())).toThrow(); expect(next.snapshot().attempt).toEqual(nextMetadata);
  });
  it("dispose is not logout and permits a new current handle to recover the same body", async () => {
    const h = await fixture(); await h.stage(); const before = [...h.values]; h.journal.dispose(); expect([...h.values]).toEqual(before);
    await expect(h.journal.exclusive(async lease => lease.snapshot())).rejects.toMatchObject({ code: "CLOSED" });
    const next = new GoalImageUploadJournal(owner, epoch, h.environment); expect((await next.open()).attempt).toEqual(metadata());
  });
  it("owner change cannot publish writes; no cross-owner record is inspected or removed", async () => {
    const h = await fixture(); await h.stage(); const before = [...h.values]; h.changeIdentity();
    await expect(h.journal.exclusive(async lease => lease.advance(state(), { phase: "reserving", uploadId: null }))).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect([...h.values]).toEqual(before);
    const secondOwner = id(20), second = new GoalImageUploadJournal(secondOwner, id(21), { ...h.environment, isCurrent: () => true }); await second.open();
    const secondMetadata = { ...metadata(id(22)), scope: { ...metadata().scope, ownerId: secondOwner, epoch: id(21) } }; await second.exclusive(async lease => lease.stage(secondMetadata));
    h.journal.revokeIdentity(); expect(second.snapshot().attempt).toEqual(secondMetadata);
  });
  it("checks identity again after a queued lock and after an awaited lease callback", async () => {
    const h = await fixture(); await h.stage(); const before = [...h.values];
    let release!: () => void; const gate = new Promise<void>(done => { release = done; }); let entered!: () => void; const inside = new Promise<void>(done => { entered = done; });
    const first = h.journal.exclusive(async lease => { entered(); await gate; return lease.snapshot(); }); await inside;
    let secondCalls = 0; const second = h.journal.exclusive(async lease => { secondCalls++; return lease.advance(state(), { phase: "reserving", uploadId: null }); });
    const firstCheck = expect(first).rejects.toMatchObject({ code: "SESSION_CHANGED" }), secondCheck = expect(second).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    h.changeIdentity(); release(); await Promise.all([firstCheck, secondCheck]); expect(secondCalls).toBe(0); expect([...h.values]).toEqual(before);
    const late = await fixture(); await late.stage(); let done!: () => void; const wait = new Promise<void>(resolve => { done = resolve; }); let captured!: () => void; const started = new Promise<void>(resolve => { captured = resolve; });
    const pending = late.journal.exclusive(async lease => { const result = lease.snapshot(); captured(); await wait; return result; }); await started;
    const refusal = expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" }); late.changeIdentity(); done(); await refusal;
  });
});
