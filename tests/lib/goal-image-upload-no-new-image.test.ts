import { afterEach, describe, expect, it, vi } from "vitest";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { FinanceGoalsBrowserClient, inspectGoalImageLinkedProof } from "../../src/lib/finance-goals-client";
import type { GoalJournalView } from "../../src/lib/finance-goals-client-contract";
import { createGoalsController } from "../../src/components/features/financeiro/goals/goals-ui-model";
import { FinanceGoalsJournal } from "../../src/lib/finance-goals-journal";
import { GoalImageUploadCoordinator, GoalImageUploadError, type GoalImageNoNewImageBasis, type GoalImageNoNewImageChoice } from "../../src/lib/files/goal-image-upload";
import { GOAL_IMAGE_UPLOAD_PHASES, type GoalImageUploadMetadata, type GoalImageUploadPhase, type GoalImageUploadScope } from "../../src/lib/files/goal-image-upload-contract";
import { GoalImageUploadJournal } from "../../src/lib/files/goal-image-upload-journal";
import { LOCAL_STORAGE_ORIGIN } from "../../src/lib/files/storage-origin";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
interface Pause { entered: Promise<void>; drained: Promise<void>; release(): void }
async function fixture(choice: GoalImageNoNewImageChoice = "create-null", phase: GoalImageUploadPhase = "prepared", review = false, owner = id(1), epoch = id(2), empty = false) {
  const values = new Map<string, string>(), queues = new Map<string, Promise<void>>(), locks: string[] = [];
  let current = true;
  let nextPause: { kind: "upload" | "finance"; entered(): void; wait: Promise<void>; drained(): void } | null = null;
  const storage = { keys: () => [...values.keys()], getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, text: string) => { values.set(key, text); }), removeItem: vi.fn((key: string) => { values.delete(key); }) };
  const exclusive = async <T,>(name: string, work: () => Promise<T>): Promise<T> => {
    let release!: () => void; const prior = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(done => { release = done; }));
    const kind = name.includes("goal-image-upload") ? "upload" : "finance", paused = nextPause?.kind === kind ? nextPause : null;
    if (paused) nextPause = null;
    await prior;
    try { locks.push(kind); if (paused) { paused.entered(); await paused.wait; } return await work(); }
    finally { release(); paused?.drained(); }
  };
  const financeJournal = new FinanceGoalsJournal(owner, { storage, exclusive, uuid: () => epoch }); await financeJournal.open();
  const fetcher = vi.fn<typeof fetch>(async input => {
    if (input !== "/api/finance/goals/availability") throw Error("Only setup availability is permitted");
    const response = Response.json({ ok: true, result: { available: true } }); Object.defineProperty(response, "url", { value: new URL(input, "https://g0.invalid").href }); return response;
  });
  const finance = new FinanceGoalsBrowserClient(owner, financeJournal, { origin: "https://g0.invalid", isCurrent: () => current, fetcher });
  const scope: GoalImageUploadScope = { ownerId: owner, epoch, editorKey: "current-editor", goalId: choice === "create-null" ? null : id(8), goalRevision: choice === "create-null" ? null : "2", baselineFileId: choice === "create-null" ? null : id(9) };
  let target = structuredClone(scope);
  const journal = new GoalImageUploadJournal(owner, epoch, { storage, exclusive, isCurrent: () => current }); await journal.open();
  const original: GoalImageUploadMetadata = { version: 1, purpose: "finance_goal_image", scope: { ownerId: owner, epoch, editorKey: "retained-A-editor", goalId: id(3), goalRevision: "1", baselineFileId: id(4) }, selection: { generation: 1, name: "retained.png", size: 1, mime: "image/png", sha256: "a".repeat(64) }, uploadClientId: id(5), uploadId: null, phase: "prepared" };
  if (!empty) await journal.exclusive(async lease => {
    lease.stage(original);
    const progress: { phase: GoalImageUploadPhase; uploadId: string | null }[] = [ { phase: "reserving", uploadId: null }, { phase: "reserved", uploadId: id(6) }, { phase: "put-uncertain", uploadId: id(6) }, { phase: "put-confirmed", uploadId: id(6) }, { phase: "finalizing", uploadId: id(6) }, { phase: "ready-unbound", uploadId: id(6) } ];
    if (phase !== "prepared") for (const step of progress) { lease.advance(lease.snapshot(), step); if (step.phase === phase) break; }
    if (review) lease.retire(lease.snapshot()); // Metadata fixture, never a finalize/retirement proof.
  });
  const controller = createGoalsController(owner, finance), opened = await controller.open();
  if (!opened.ok) throw Error("Concrete controller did not open for fixture");
  const controllerState = controller.state;
  let selectedController = controller;
  const sender = vi.fn<(command: string, input: unknown) => Promise<unknown>>(async () => { throw Error("No finalize in no-new-image admission"); });
  const app = { userId: owner, mode: "connected" as const, initializeJournal: async () => undefined, getCommandSnapshot: () => ({ status: "idle" }), executeDomainCommand: sender };
  const transport = { reserve: vi.fn(async () => { throw Error("No reserve"); }), observe: vi.fn(async () => { throw Error("No observe"); }), put: vi.fn(async () => { throw Error("No PUT"); }) };
  const createId = vi.fn(() => { throw Error("No upload UUID allocation"); }), digest = vi.fn(async () => { throw Error("No File hashing"); });
  const options: Parameters<typeof GoalImageUploadCoordinator.open>[0] = { scope, journal, finance, financeBarrier: finance.imageUploadBarrier, controller: () => selectedController, application: () => app, isCurrent: () => current, currentScope: () => target, origin: "https://g0.invalid", storageOrigin: LOCAL_STORAGE_ORIGIN, transport, createId, digest };
  const coordinator = await GoalImageUploadCoordinator.open(options);
  storage.setItem.mockClear(); storage.removeItem.mockClear(); fetcher.mockClear(); locks.length = 0;
  const basis = (): GoalImageNoNewImageBasis => ({ scope: structuredClone(scope), financeRevision: "7", fields: { name: "New financial choice", target_cents: 10000, deadline: "2027-07-01" }, choice });
  const pause = (kind: "upload" | "finance"): Pause => {
    let entered!: () => void, release!: () => void, drained!: () => void;
    const entry = new Promise<void>(done => { entered = done; }), wait = new Promise<void>(done => { release = done; }), drain = new Promise<void>(done => { drained = done; });
    nextPause = { kind, entered, wait, drained }; return { entered: entry, drained: drain, release };
  };
  return { owner, epoch, values, storage, locks, finance, financeJournal, journal, coordinator, options, basis, pause, sender, transport, createId, digest, fetcher,
    hold: (value: GoalJournalView | null | undefined) => { controller.state = () => { const original = controllerState(); return { ...original, journal: value === undefined ? original.journal : value }; }; }, stale: () => { current = false; }, target: (value: GoalImageUploadScope) => { target = structuredClone(value); }, replaceController: () => { selectedController = { ...controller }; } };
}
function noIo(h: Awaited<ReturnType<typeof fixture>>) {
  expect(h.sender).not.toHaveBeenCalled(); expect(h.transport.reserve).not.toHaveBeenCalled(); expect(h.transport.observe).not.toHaveBeenCalled(); expect(h.transport.put).not.toHaveBeenCalled(); expect(h.createId).not.toHaveBeenCalled(); expect(h.digest).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
}
const pending = (): GoalCommand => ({ command: "finance.goal.create", input: { client_id: id(90), expected_finance_revision: "0", name: "Another human attempt", target_cents: 500, deadline: null, image_file_id: null } });
afterEach(() => vi.useRealTimers());

describe("G0 no-new-image — nominal local admission, retained A, actual finance barrier", () => {
  for (const phase of GOAL_IMAGE_UPLOAD_PHASES) for (const choice of ["create-null", "update-omit", "update-remove"] satisfies GoalImageNoNewImageChoice[]) {
    it(`${choice} in ${phase} preserves A and every durable byte without File or IO`, async () => {
      const h = await fixture(choice, phase), before = h.journal.snapshot(), bytes = [...h.values];
      h.storage.setItem.mockImplementation(() => { throw Error("No writes allowed during G0"); }); h.storage.removeItem.mockImplementation(() => { throw Error("No deletion allowed during G0"); });
      const proof = await h.coordinator.authorizeNoNewImage(h.basis()); await h.coordinator.claimNoNewImage(proof, h.basis());
      expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(bytes); expect(h.storage.setItem).not.toHaveBeenCalled(); expect(h.storage.removeItem).not.toHaveBeenCalled(); expect(h.locks).toEqual(["upload", "finance", "upload", "finance"]); noIo(h);
    });
  }
  for (const choice of ["create-null", "update-omit", "update-remove"] satisfies GoalImageNoNewImageChoice[]) it(`${choice} also preserves retirement-review A without re-finalizing`, async () => {
    const h = await fixture(choice, "ready-unbound", true), before = h.journal.snapshot(), bytes = [...h.values];
    const proof = await h.coordinator.authorizeNoNewImage(h.basis()); await h.coordinator.claimNoNewImage(proof, h.basis());
    expect(before.state).toBe("retirement-review"); expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(bytes); noIo(h);
  });
  it("proofs are one-use and bound to the issuing instance; another receiver cannot burn A's proof", async () => {
    const h = await fixture(), proof = await h.coordinator.authorizeNoNewImage(h.basis()), other = await GoalImageUploadCoordinator.open(h.options);
    await expect(other.claimNoNewImage(proof, h.basis())).rejects.toMatchObject({ code: "INVALID" });
    await h.coordinator.claimNoNewImage(proof, h.basis()); await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toMatchObject({ code: "INVALID" }); noIo(h);
  });
  it("clones, forged objects and proxy hooks do not carry authority, nor is G0 Ready or Linked", async () => {
    const h = await fixture(), proof = await h.coordinator.authorizeNoNewImage(h.basis()), get = vi.fn(() => { throw Error("No proof property access"); });
    for (const counterfeit of [Object.freeze({}), structuredClone(proof), new Proxy({}, { get, getPrototypeOf: get }), new Proxy(proof, { get, getPrototypeOf: get })]) await expect(Reflect.apply(h.coordinator.claimNoNewImage, h.coordinator, [counterfeit, h.basis()])).rejects.toMatchObject({ code: "INVALID" });
    expect(get).not.toHaveBeenCalled(); expect(() => Reflect.apply(h.coordinator.inspectReady, h.coordinator, [proof, h.basis().scope])).toThrow(GoalImageUploadError);
    expect(() => Reflect.apply(inspectGoalImageLinkedProof, undefined, [proof, h.finance])).toThrow(); await h.coordinator.claimNoNewImage(proof, h.basis()); noIo(h);
  });
  it("changed fields, revision, baseline or choice cannot reuse a captured admission, even after failed claim", async () => {
    const changes: ((basis: GoalImageNoNewImageBasis) => GoalImageNoNewImageBasis)[] = [ value => ({ ...value, fields: { ...value.fields, name: "Different" } }), value => ({ ...value, financeRevision: "8" }), value => ({ ...value, scope: { ...value.scope, baselineFileId: id(88) } }), value => ({ ...value, choice: "update-remove" }) ];
    for (const change of changes) {
      const h = await fixture("update-omit"), bytes = [...h.values], proof = await h.coordinator.authorizeNoNewImage(h.basis());
      await expect(h.coordinator.claimNoNewImage(proof, change(h.basis()))).rejects.toMatchObject({ code: "STALE" }); await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toMatchObject({ code: "INVALID" }); expect([...h.values]).toEqual(bytes); noIo(h);
    }
  });
  it("another actor advancing A between authorization and claim invalidates the whole snapshot", async () => {
    const h = await fixture(), proof = await h.coordinator.authorizeNoNewImage(h.basis());
    await h.journal.exclusive(async lease => { lease.advance(lease.snapshot(), { phase: "reserving", uploadId: null }); }); const current = h.journal.snapshot(), bytes = [...h.values];
    await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toMatchObject({ code: "STALE" }); expect(h.journal.snapshot()).toEqual(current); expect([...h.values]).toEqual(bytes); noIo(h);
  });
  it("a physically pending financial journal rejects issuance and a pending that appears later burns claim", async () => {
    for (const afterIssuance of [false, true]) {
      const h = await fixture(), proof = afterIssuance ? await h.coordinator.authorizeNoNewImage(h.basis()) : null;
      await h.financeJournal.exclusive(async lease => { lease.stage(pending()); }); const bytes = [...h.values], a = h.journal.snapshot();
      if (proof) await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toBeInstanceOf(GoalImageUploadError);
      else await expect(h.coordinator.authorizeNoNewImage(h.basis())).rejects.toBeInstanceOf(GoalImageUploadError);
      expect(h.journal.snapshot()).toEqual(a); expect([...h.values]).toEqual(bytes); noIo(h);
    }
  });
  it("logical hold and reconfirmation block even when the physical pending is null; nothing acknowledges them", async () => {
    for (const kind of ["hold", "reconfirm", "missing-controller-state"]) {
      const h = await fixture(), physical = h.financeJournal.snapshot(); expect(physical.pending).toBeNull();
      h.hold(kind === "missing-controller-state" ? null : { ...physical, pending: kind === "hold" ? { intent: pending(), phase: "uncertain" } : null, reconfirmRequired: kind === "reconfirm" }); const bytes = [...h.values];
      await expect(h.coordinator.authorizeNoNewImage(h.basis())).rejects.toBeInstanceOf(GoalImageUploadError); expect([...h.values]).toEqual(bytes); expect(h.financeJournal.snapshot()).toEqual(physical); noIo(h);
    }
  });
  it("only the current target scope is admitted, without rebasing retained A's old editor or goal", async () => {
    const h = await fixture(), a = h.journal.snapshot(); expect(a.attempt?.scope.editorKey).not.toBe(h.basis().scope.editorKey);
    h.target({ ...h.basis().scope, editorKey: "B" }); await expect(h.coordinator.authorizeNoNewImage(h.basis())).rejects.toMatchObject({ code: "STALE" }); expect(h.journal.snapshot()).toEqual(a); noIo(h);
  });
  it("basis is captured before the upload await; a mutable source cannot replace the captured fields", async () => {
    const h = await fixture(), value = { ...h.basis(), fields: { ...h.basis().fields } }, gate = h.pause("upload"), before = [...h.values];
    const result = h.coordinator.authorizeNoNewImage(value), refused = expect(result).rejects.toMatchObject({ code: "STALE" }); await gate.entered; value.fields.name = "Mutated while waiting"; gate.release(); await refused; await gate.drained; expect([...h.values]).toEqual(before); noIo(h);
  });
  for (const kind of ["upload", "finance"] as const) it(`a late ${kind} lease fences session/controller/target changes before admission`, async () => {
    for (const change of ["logout", "controller", "target"]) {
      const h = await fixture(), gate = h.pause(kind), bytes = [...h.values], result = h.coordinator.authorizeNoNewImage(h.basis()), refused = expect(result).rejects.toBeInstanceOf(GoalImageUploadError);
      await gate.entered; if (change === "logout") h.stale(); else if (change === "controller") h.replaceController(); else h.target({ ...h.basis().scope, editorKey: "changed" }); gate.release(); await refused; await gate.drained; expect([...h.values]).toEqual(bytes); noIo(h);
    }
  });
  for (const kind of ["upload", "finance"] as const) for (const operation of ["authorize", "claim"]) it(`a timed-out ${kind} ${operation} queue drains without minting or invoking another effect`, async () => {
    vi.useFakeTimers(); const h = await fixture(), proof = operation === "claim" ? await h.coordinator.authorizeNoNewImage(h.basis()) : null, gate = h.pause(kind), bytes = [...h.values];
    const result = proof ? h.coordinator.claimNoNewImage(proof, h.basis()) : h.coordinator.authorizeNoNewImage(h.basis()), refused = expect(result).rejects.toMatchObject({ code: "UNAVAILABLE" }); await gate.entered; const financeEntries = h.locks.filter(lock => lock === "finance").length;
    await vi.advanceTimersByTimeAsync(kind === "upload" ? 150_000 : 30_000); await refused; gate.release(); await gate.drained;
    expect(h.locks.filter(lock => lock === "finance")).toHaveLength(financeEntries); expect([...h.values]).toEqual(bytes); expect(h.storage.setItem).not.toHaveBeenCalled(); expect(h.storage.removeItem).not.toHaveBeenCalled(); if (proof) await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toMatchObject({ code: "INVALID" }); noIo(h);
  });
  it("an owner/epoch receiver has no authority over another instance's proof", async () => {
    const a = await fixture(), b = await fixture("create-null", "prepared", false, id(50), id(60)), proof = await a.coordinator.authorizeNoNewImage(a.basis()), aBytes = [...a.values], bBytes = [...b.values];
    await expect(b.coordinator.claimNoNewImage(proof, b.basis())).rejects.toMatchObject({ code: "INVALID" }); await a.coordinator.claimNoNewImage(proof, a.basis()); expect([...a.values]).toEqual(aBytes); expect([...b.values]).toEqual(bBytes); noIo(a); noIo(b);
  });
  it("a second human request cannot race the first queued authorization into two claims", async () => {
    const h = await fixture(), gate = h.pause("upload"), pending = h.coordinator.authorizeNoNewImage(h.basis()); await gate.entered;
    await expect(h.coordinator.authorizeNoNewImage(h.basis())).rejects.toMatchObject({ code: "BUSY" }); gate.release(); const proof = await pending; await gate.drained; await h.coordinator.claimNoNewImage(proof, h.basis()); noIo(h);
  });
  it("claim rechecks mutable fields after its finance await and cannot mint again", async () => {
    const h = await fixture(), proof = await h.coordinator.authorizeNoNewImage(h.basis()), value = { ...h.basis(), fields: { ...h.basis().fields } }, gate = h.pause("finance"), bytes = [...h.values];
    const pending = h.coordinator.claimNoNewImage(proof, value), refused = expect(pending).rejects.toMatchObject({ code: "STALE" }); await gate.entered; value.fields.deadline = "2028-01-01"; gate.release(); await refused; await gate.drained;
    await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toMatchObject({ code: "INVALID" }); expect([...h.values]).toEqual(bytes); noIo(h);
  });
  it("explicit epoch revocation cannot be undone by a previously issued proof", async () => {
    const h = await fixture(), proof = await h.coordinator.authorizeNoNewImage(h.basis()); await h.journal.revokeIdentity(); const afterLogout = [...h.values];
    await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toBeDefined(); expect([...h.values]).toEqual(afterLogout); noIo(h);
  });
  it("dispose revokes issued capabilities without clearing either durable journal", async () => {
    const h = await fixture(), proof = await h.coordinator.authorizeNoNewImage(h.basis()), bytes = [...h.values]; h.coordinator.dispose();
    await expect(h.coordinator.claimNoNewImage(proof, h.basis())).rejects.toMatchObject({ code: "INVALID" }); expect([...h.values]).toEqual(bytes); noIo(h);
  });
  it("a valid empty J2 record is not an admission to bypass the ordinary editor path", async () => {
    const h = await fixture("create-null", "prepared", false, id(1), id(2), true), before = h.journal.snapshot(), bytes = [...h.values];
    expect(before.state).toBe("empty"); await expect(h.coordinator.authorizeNoNewImage(h.basis())).rejects.toMatchObject({ code: "PENDING" }); expect(h.journal.snapshot()).toEqual(before); expect([...h.values]).toEqual(bytes); noIo(h);
  });
  it("missing/corrupt/legacy/read-refused J2 state cannot become empty or an authorization", async () => {
    for (const mode of ["missing", "corrupt", "legacy", "read-refused"]) {
      const h = await fixture(), stateKey = [...h.values.keys()].find(key => key.includes("goal-image-upload") && key.includes(":state:")); if (!stateKey) throw Error("Expected fixture J2 state");
      if (mode === "missing") h.values.delete(stateKey); else if (mode === "corrupt") h.values.set(stateKey, "{}"); else if (mode === "legacy") h.values.set(stateKey.replace(":state:", ":attempt:"), "legacy");
      const get = h.storage.getItem.getMockImplementation(); if (!get) throw Error("Expected storage fixture"); if (mode === "read-refused") h.storage.getItem.mockImplementation(key => { if (key === stateKey) throw Error("Read refused"); return get(key); });
      const bytes = [...h.values]; await expect(h.coordinator.authorizeNoNewImage(h.basis())).rejects.toBeDefined(); expect([...h.values]).toEqual(bytes); noIo(h);
    }
  });
  it("normal resume refuses retained A from another editor without falling back to G0", async () => {
    const h = await fixture(), authorize = vi.spyOn(h.coordinator, "authorizeNoNewImage"), claim = vi.spyOn(h.coordinator, "claimNoNewImage"), bytes = [...h.values];
    await expect(h.coordinator.resume()).rejects.toMatchObject({ code: "PENDING" }); expect(authorize).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled(); expect([...h.values]).toEqual(bytes); noIo(h);
  });
  it("normal resume of the original editor asks for its lost File without falling back to G0", async () => {
    const h = await fixture(), original = h.journal.snapshot().attempt;
    if (!original) throw Error("Expected retained A");
    h.coordinator.dispose();
    const coordinator = await GoalImageUploadCoordinator.open({ ...h.options, scope: original.scope, currentScope: () => original.scope });
    const authorize = vi.spyOn(coordinator, "authorizeNoNewImage"), claim = vi.spyOn(coordinator, "claimNoNewImage"), bytes = [...h.values];
    try {
      const reply = await coordinator.resume();
      expect(reply).toEqual({ kind: "need-file", selection: original.selection }); expect(authorize).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled(); expect([...h.values]).toEqual(bytes); noIo(h);
    } finally { coordinator.dispose(); }
  });
  it("invalid choices/shape/fields are refused without hooks, leases or upload UUID", async () => {
    const h = await fixture(), getter = vi.fn(() => "name"), basis = h.basis();
    for (const invalid of [{ ...basis, choice: "update-omit" }, { ...basis, financeRevision: "01" }, { ...basis, fields: { ...basis.fields, target_cents: 1.5 } }, { ...basis, fields: { ...basis.fields, deadline: "2027-02-30" } }, { ...basis, extra: true }, { ...basis, fields: Object.defineProperty({ target_cents: 1, deadline: null }, "name", { get: getter, enumerable: true }) }]) await expect(Reflect.apply(h.coordinator.authorizeNoNewImage, h.coordinator, [invalid])).rejects.toMatchObject({ code: "INVALID" });
    expect(getter).not.toHaveBeenCalled(); expect(h.locks).toEqual([]); noIo(h);
  });
});
