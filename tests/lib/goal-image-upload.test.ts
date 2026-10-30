import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceGoalsBrowserClient } from "../../src/lib/finance-goals-client";
import { FinanceGoalsJournal, type GoalsJournalEnvironment } from "../../src/lib/finance-goals-journal";
import { GoalImageUploadCoordinator, GoalImageUploadError, goalImageUploadDiagnosticCode } from "../../src/lib/files/goal-image-upload";
import { GoalImageUploadJournal, type GoalImageUploadEnvironment } from "../../src/lib/files/goal-image-upload-journal";
import type { GoalImageUploadScope } from "../../src/lib/files/goal-image-upload-contract";
import { createGoalImageUploadTransport, GoalImageUploadTransportError } from "../../src/lib/files/goal-image-upload-transport";
import { LOCAL_STORAGE_ORIGIN } from "../../src/lib/files/storage-origin";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), epoch = id(2), upload = id(9), origin = "https://synthetic.invalid";
const source = () => new File([new Uint8Array([1])], "synthetic.png", { type: "image/png" });
type ObservationState = "staging" | "missing-observed" | "indeterminate" | "final";
const finalized = () => ({ id: upload, user_id: owner, kind: "finance_goal_image", folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 1, sha256: "b".repeat(64), width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: "2026-10-24T00:00:00Z", updated_at: "2026-10-24T00:00:00Z", modified_at: "2026-10-24T00:00:00Z" });
function response(url: string, value: unknown, status = 200) { const reply = Response.json(value, { status }); Object.defineProperty(reply, "url", { value: url }); return reply; }
async function fixture() {
  const values = new Map<string, string>(), queues = new Map<string, Promise<void>>(), calls: { url: string; init: RequestInit }[] = [], sends: { command: string; input: unknown }[] = [];
  let current = true, globalState = "idle", putStatus = 200, observed: ObservationState = "missing-observed", digestByte = 0xaa, ids = 0;
  const scope: GoalImageUploadScope = { ownerId: owner, epoch, editorKey: "synthetic-editor", goalId: id(4), goalRevision: "0", baselineFileId: id(5) }; let target = structuredClone(scope);
  const storage = { keys: () => [...values.keys()], getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const exclusive = async <T,>(name: string, work: () => Promise<T>): Promise<T> => { let release!: () => void; const prior = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(done => { release = done; })); await prior; try { return await work(); } finally { release(); } };
  const financialEnvironment: GoalsJournalEnvironment = { storage, exclusive, uuid: () => epoch }, financialJournal = new FinanceGoalsJournal(owner, financialEnvironment); await financialJournal.open();
  const financeFetch = vi.fn(async () => { throw Error("No financial HTTP"); }), finance = new FinanceGoalsBrowserClient(owner, financialJournal, { isCurrent: () => current, fetcher: financeFetch }); await finance.loadPending();
  const controller = { current: () => current, matches: (candidateOwner: string, candidate: unknown) => candidateOwner === owner && candidate === finance, state: () => ({ journal: financialJournal.snapshot() }) };
  const environment: GoalImageUploadEnvironment = { storage, exclusive, isCurrent: () => current }, journal = new GoalImageUploadJournal(owner, epoch, environment);
  let sendReply: (command: string, input: unknown) => Promise<unknown> = async () => finalized();
  const app = { userId: owner, mode: "connected" as const, executeDomainCommand: async (command: string, input: unknown) => { sends.push({ command, input: structuredClone(input) }); return sendReply(command, input); }, initializeJournal: async () => undefined, getCommandSnapshot: () => ({ status: globalState }) };
  const transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin, assertCurrent: () => { if (!current) throw Error("closed"); }, fetcher: async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/observe?")) return response(url, { version: 1, user_id: owner, upload_id: upload, purpose: "finance_goal_image", state: observed, file: observed === "final" ? finalized() : null });
    if (init.method === "POST") return response(url, { id: upload, upload_url: LOCAL_STORAGE_ORIGIN + `/storage/v1/object/upload/sign/second-brain-staging/${owner}/${upload}?token=synthetic-token`, token: "synthetic-token", expires_at: "2099-01-01T00:00:00Z" });
    if (putStatus === 200) observed = "staging"; return response(url, {}, putStatus);
  } });
  const options: Parameters<typeof GoalImageUploadCoordinator.open>[0] = { scope, journal, finance, financeBarrier: finance.imageUploadBarrier, controller: () => controller, application: () => app, isCurrent: () => current, currentScope: () => target, origin, storageOrigin: LOCAL_STORAGE_ORIGIN, transport, createId: () => { ids++; return id(3); }, digest: async () => new Uint8Array(32).fill(digestByte) };
  const coordinator = await GoalImageUploadCoordinator.open(options);
  async function markFinalizing(finalizing = true) { await journal.exclusive(async lease => { lease.advance(lease.snapshot(), { phase: "reserving", uploadId: null }); lease.advance(lease.snapshot(), { phase: "reserved", uploadId: upload }); lease.advance(lease.snapshot(), { phase: "put-uncertain", uploadId: upload }); if (finalizing) lease.advance(lease.snapshot(), { phase: "finalizing", uploadId: upload }); }); }
  return { values, calls, sends, environment, journal, financialJournal, financeFetch, scope, coordinator, options, markFinalizing, ids: () => ids, reply: (next: typeof sendReply) => { sendReply = next; }, global: (next: string) => { globalState = next; }, putStatus: (next: number) => { putStatus = next; }, observe: (next: ObservationState) => { observed = next; }, digest: (next: number) => { digestByte = next; }, stale: () => { current = false; }, target: () => { target = { ...target, goalRevision: "1" }; }, reload: async () => { coordinator.dispose(); return GoalImageUploadCoordinator.open(options); } };
}
async function holdUploadLease(journal: GoalImageUploadJournal, environment: GoalImageUploadEnvironment) {
  let enter!: () => void, unlock!: () => void, queued!: () => void;
  const entered = new Promise<void>(done => { enter = done; }), held = new Promise<void>(done => { unlock = done; });
  const holder = journal.exclusive(async () => { enter(); await held; }); await entered;
  const original = environment.exclusive, waiting = new Promise<void>(done => { queued = done; });
  environment.exclusive = (name, work) => { queued(); return original(name, work); };
  return { waiting, release: async () => { environment.exclusive = original; unlock(); await holder; await journal.exclusive(async () => undefined); } };
}
afterEach(() => vi.useRealTimers());
describe("Goal image C2a — synthetic Storage/HTTP/CommandSession, not connected proof", () => {
  it("opens locally, persists A, uploads once and mints only a nominal own-finalize proof", async () => {
    const h = await fixture(); expect(h.calls).toEqual([]); expect(h.sends).toEqual([]); await h.coordinator.select(source(), 1); expect(h.journal.snapshot().attempt?.selection.sha256).toBe("a".repeat(64));
    const result = await h.coordinator.resume(); if (result.kind !== "ready") throw Error("Expected own finalize");
    expect(h.coordinator.inspectReady(result.proof, h.scope)).toEqual({ imageFileId: upload, scope: h.scope, generation: 1 }); expect(h.sends).toEqual([{ command: "file.upload.finalize", input: { upload_id: upload, client_id: id(3) } }]); expect(h.financeFetch).not.toHaveBeenCalled();
    expect(JSON.stringify(result.proof)).toBe("{}"); expect(() => Reflect.apply(h.coordinator.inspectReady, h.coordinator, [structuredClone(result.proof), h.scope])).toThrow(); expect(() => Reflect.apply(h.coordinator.inspectReady, h.coordinator, [finalized(), h.scope])).toThrow();
    expect(h.journal.snapshot().attempt?.phase).toBe("ready-unbound"); expect("retire" in h.coordinator || "clear" in h.coordinator).toBe(false); await expect(h.coordinator.select(source(), 2)).rejects.toBeDefined(); expect(h.ids()).toBe(1);
  });
  it("quota before stage effect admits no IO and retries only the same cached clientId", async () => {
    const h = await fixture(), set = h.environment.storage.setItem; h.environment.storage.setItem = () => { throw Error("quota"); };
    await expect(h.coordinator.select(source(), 1)).rejects.toBeDefined(); expect(h.calls).toEqual([]); expect(h.sends).toEqual([]); h.environment.storage.setItem = set;
    await h.coordinator.select(source(), 1); expect(h.ids()).toBe(1); expect(h.journal.snapshot().attempt?.uploadClientId).toBe(id(3));
  });
  it.each(["pending", "journal-error", "session-changed"])("general journal %s blocks non-journal IO", async status => {
    const h = await fixture(); await h.coordinator.select(source(), 1); h.global(status); await expect(h.coordinator.resume()).rejects.toBeDefined(); expect(h.calls).toEqual([]); expect(h.sends).toEqual([]); expect(h.journal.snapshot().attempt?.phase).toBe("prepared");
  });
  it("a real financial B blocks before reservation and does not modify B", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1);
    const intent = { command: "finance.goal.create" as const, input: { client_id: id(90), expected_finance_revision: "0", name: "Synthetic B", target_cents: 1, deadline: null, image_file_id: null } };
    await h.financialJournal.exclusive(async lease => { lease.stage(intent); }); const before = h.financialJournal.snapshot(); await expect(h.coordinator.resume()).rejects.toBeDefined(); expect(h.financialJournal.snapshot()).toEqual(before); expect(h.calls).toEqual([]); expect(h.sends).toEqual([]);
  });
  it("reload finalizing resolves the ORIGINAL finalize before any observe/reserve/PUT", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); await h.markFinalizing(); const next = await h.reload(); h.global("pending"); const result = await next.resume(); expect(result.kind).toBe("ready"); expect(h.calls).toEqual([]); expect(h.sends).toEqual([{ command: "file.upload.finalize", input: { upload_id: upload, client_id: id(3) } }]);
  });
  it("reload of never-dispatched prepared A asks for the original File without reserving", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); const next = await h.reload(); expect((await next.resume()).kind).toBe("need-file"); expect(h.calls).toEqual([]); expect(h.sends).toEqual([]); expect(h.ids()).toBe(1);
  });
  it("raw observation final cannot mint proof if the exact finalize fails", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); await h.markFinalizing(false); const next = await h.reload(); h.observe("final"); h.reply(async () => { throw Error("PRIVATE_REMOTE_CANARY"); });
    await expect(next.resume()).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(h.sends).toHaveLength(1); expect(h.calls).toHaveLength(1); expect(h.calls[0]?.url).toContain("/observe?"); expect(h.journal.snapshot().attempt?.phase).toBe("finalizing");
  });
  it("lost finalize response preserves A and repeats only its exact command, with no extra Storage IO", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); let count = 0; h.reply(async () => { if (count++ === 0) throw Error("response lost"); return finalized(); });
    await expect(h.coordinator.resume()).rejects.toMatchObject({ code: "UNAVAILABLE" }); const prior = h.calls.length; expect(h.journal.snapshot().attempt?.phase).toBe("finalizing"); expect((await h.coordinator.resume()).kind).toBe("ready"); expect(h.calls).toHaveLength(prior); expect(h.sends[0]).toEqual(h.sends[1]); expect(h.ids()).toBe(1);
  });
  it("a sender mutating its input or returning a foreign/getter DTO does not replace the captured binding", async () => {
    for (const mode of ["input", "owner", "getter"] as const) {
      const h = await fixture(); await h.coordinator.select(source(), 1); let getters = 0;
      h.reply(async (_command, input) => { if (mode === "input" && input && typeof input === "object") { Reflect.set(input, "upload_id", id(99)); return { ...finalized(), id: id(99) }; } if (mode === "owner") return { ...finalized(), user_id: id(99) }; return { ...finalized(), get sha256() { getters++; return "b".repeat(64); } }; });
      await expect(h.coordinator.resume()).rejects.toBeDefined(); expect(h.sends[0]?.input).toEqual({ upload_id: upload, client_id: id(3) }); expect(getters).toBe(0); expect(h.journal.snapshot().attempt?.phase).toBe("finalizing");
    }
  });
  it("reload without File requires exact reselection/hash for conditional PUT, never a new identity", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); await h.markFinalizing(false); const next = await h.reload(); expect((await next.resume()).kind).toBe("need-file"); expect(h.calls.filter(value => value.init.method === "PUT")).toEqual([]);
    h.digest(0xbb); await expect(next.reselect(source())).rejects.toMatchObject({ code: "INVALID" }); expect(h.ids()).toBe(1); h.digest(0xaa); await next.reselect(source()); expect((await next.resume()).kind).toBe("ready"); expect(h.ids()).toBe(1); expect(h.sends[0]?.input).toEqual({ upload_id: upload, client_id: id(3) });
  });
  it("indeterminate is a hold, and a failed conditional PUT has no automatic retry", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); h.putStatus(503); await expect(h.coordinator.resume()).rejects.toBeDefined(); expect(h.journal.snapshot().attempt?.phase).toBe("put-uncertain"); const calls = h.calls.length;
    h.observe("indeterminate"); expect((await h.coordinator.resume()).kind).toBe("held"); expect(h.calls).toHaveLength(calls + 1); expect(h.sends).toEqual([]); expect(h.ids()).toBe(1);
  });
  it("stale target cannot produce an editor-ready proof or rebase its revision", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); await h.markFinalizing(); h.target(); expect((await h.coordinator.resume()).kind).toBe("stale"); expect(h.journal.snapshot().attempt?.scope.goalRevision).toBe("0"); expect(h.sends).toHaveLength(1); expect(h.calls).toEqual([]);
  });
  it("dispose fences late success without logout/redaction, and keeps A for a new handle", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); let resolve!: (value: unknown) => void, entered!: () => void;
    const result = new Promise<unknown>(done => { resolve = done; }), inside = new Promise<void>(done => { entered = done; }); h.reply(async () => { entered(); return result; });
    const pending = h.coordinator.resume(), refused = expect(pending).rejects.toBeDefined(); await inside; const before = h.journal.snapshot(); h.coordinator.dispose(); resolve(finalized()); await refused; expect(h.journal.snapshot()).toEqual(before); expect(h.ids()).toBe(1);
  });
  it("a late old-owner finalize cannot publish ready or mutate the durable image state", async () => {
    const h = await fixture(); await h.coordinator.select(source(), 1); let resolve!: (value: unknown) => void, entered!: () => void;
    const result = new Promise<unknown>(done => { resolve = done; }), inside = new Promise<void>(done => { entered = done; }); h.reply(async () => { entered(); return result; });
    const pending = h.coordinator.resume(), refused = expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" }); await inside; const before = [...h.values]; h.stale(); resolve(finalized()); await refused; expect([...h.values]).toEqual(before); expect(h.ids()).toBe(1);
  });
  it.each(["finalizing", "ready-unbound"] as const)("a %s lease acquired after the operation deadline cannot dispatch finalize", async phase => {
    vi.useFakeTimers(); const h = await fixture(); await h.coordinator.select(source(), 1); await h.markFinalizing();
    if (phase === "ready-unbound") await h.journal.exclusive(async lease => { lease.advance(lease.snapshot(), { phase, uploadId: upload }); });
    const before = h.journal.snapshot(), stored = [...h.values], lock = await holdUploadLease(h.journal, h.environment);
    const pending = h.coordinator.resume(), refused = expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" }); await lock.waiting;
    await vi.advanceTimersByTimeAsync(150_001); await refused;
    expect(h.sends).toEqual([]); expect(h.calls).toEqual([]); expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(stored);
    await lock.release(); // Drain the expired callback, rather than only observing the outer rejection.
    expect(h.sends).toEqual([]); expect(h.calls).toEqual([]); expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(stored); expect(h.ids()).toBe(1); expect(h.financeFetch).not.toHaveBeenCalled();
  });
  it("a selection queued past the operation deadline cannot stage metadata or allocate an identity", async () => {
    vi.useFakeTimers(); const h = await fixture(), before = h.journal.snapshot(), stored = [...h.values], lock = await holdUploadLease(h.journal, h.environment);
    const pending = h.coordinator.select(source(), 1), refused = expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" }); await lock.waiting;
    await vi.advanceTimersByTimeAsync(150_001); await refused; await lock.release();
    expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(stored); expect(h.ids()).toBe(0); expect(h.sends).toEqual([]); expect(h.calls).toEqual([]); expect(h.financeFetch).not.toHaveBeenCalled();
  });
  it("a reselection queued past the operation deadline cannot retain its File after rejection", async () => {
    vi.useFakeTimers(); const h = await fixture(); await h.coordinator.select(source(), 1); const next = await h.reload();
    const before = h.journal.snapshot(), stored = [...h.values], lock = await holdUploadLease(h.journal, h.environment);
    const pending = next.reselect(source()), refused = expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" }); await lock.waiting;
    await vi.advanceTimersByTimeAsync(150_001); await refused; await lock.release();
    expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(stored); expect((await next.resume()).kind).toBe("need-file");
    expect(h.ids()).toBe(1); expect(h.sends).toEqual([]); expect(h.calls).toEqual([]); expect(h.financeFetch).not.toHaveBeenCalled();
  });
  it("timeout cannot later mint a proof or clear A when a finalize port ignores abort", async () => {
    vi.useFakeTimers(); const h = await fixture(); await h.coordinator.select(source(), 1); let resolve!: (value: unknown) => void, entered!: () => void;
    const delayed = new Promise<unknown>(done => { resolve = done; }), inside = new Promise<void>(done => { entered = done; }); h.reply(async () => { entered(); return delayed; });
    const pending = h.coordinator.resume(), refused = expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" }); await inside; await vi.advanceTimersByTimeAsync(25001); await refused; const before = h.journal.snapshot(); resolve(finalized()); await Promise.resolve(); expect(h.journal.snapshot()).toEqual(before); expect(before.attempt?.phase).toBe("finalizing"); expect(h.sends).toHaveLength(1);
  });
});

describe("closed Goal image diagnostics — no provider content", () => {
  it("accepts only nominal own data codes without inspecting message or cause", () => {
    for (const code of ["INVALID_RESPONSE", "UNAVAILABLE", "INVALID", "SESSION_CHANGED"] as const) expect(goalImageUploadDiagnosticCode(new GoalImageUploadTransportError(code))).toBe(code);
    expect(goalImageUploadDiagnosticCode(new GoalImageUploadError("STALE"))).toBe("STALE");
    let calls = 0;
    const nominal = new GoalImageUploadTransportError("INVALID_RESPONSE");
    for (const key of ["message", "cause", "stack"]) Object.defineProperty(nominal, key, { get() { calls++; throw Error("PRIVATE_CANARY"); } });
    expect(goalImageUploadDiagnosticCode(nominal)).toBe("INVALID_RESPONSE");
    Object.defineProperty(nominal, "code", { get() { calls++; return "INVALID_RESPONSE"; } });
    expect(goalImageUploadDiagnosticCode(nominal)).toBe("UNKNOWN");
    const lookalike = Object.defineProperty({}, "code", { get() { calls++; return "INVALID_RESPONSE"; } });
    for (const value of [lookalike, { code: "INVALID_RESPONSE" }, Error("PRIVATE_CANARY"), null, new Proxy({}, { getPrototypeOf() { throw Error("PRIVATE_CANARY"); } })]) expect(goalImageUploadDiagnosticCode(value)).toBe("UNKNOWN");
    expect(calls).toBe(0);
  });
  it("carries INVALID_RESPONSE through the real coordinator while preserving UNAVAILABLE flow and one reserve", async () => {
    const h = await fixture(); h.coordinator.dispose();
    const reserve = vi.fn(async () => { throw new GoalImageUploadTransportError("INVALID_RESPONSE"); });
    const observe = vi.fn(async () => { throw Error("No observation"); }), put = vi.fn(async () => { throw Error("No PUT"); });
    const coordinator = await GoalImageUploadCoordinator.open({ ...h.options, transport: { reserve, observe, put } });
    await coordinator.select(source(), 1); const original = h.journal.snapshot().attempt;
    let failure: unknown; try { await coordinator.resume(); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(GoalImageUploadError); expect(failure).toMatchObject({ code: "UNAVAILABLE" });
    expect(goalImageUploadDiagnosticCode(failure)).toBe("INVALID_RESPONSE");
    expect(h.journal.snapshot().attempt).toEqual({ ...original, phase: "reserving" });
    expect(reserve).toHaveBeenCalledTimes(1); expect(observe).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
    expect(h.sends).toEqual([]); expect(h.financeFetch).not.toHaveBeenCalled(); expect(h.ids()).toBe(1);
  });
});
