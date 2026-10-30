import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GoalImageHostBinding, type GoalImageHostCurrent } from "../../src/components/features/financeiro/goals/goal-image-host-binding";
import { GoalImagePicker } from "../../src/components/features/financeiro/goals/goal-image-picker";
import { createGoalsController } from "../../src/components/features/financeiro/goals/goals-ui-model";
import { FinanceGoalsBrowserClient } from "../../src/lib/finance-goals-client";
import { FinanceGoalsJournal } from "../../src/lib/finance-goals-journal";
import { GoalImageUploadJournal } from "../../src/lib/files/goal-image-upload-journal";
import { GOAL_IMAGE_UPLOAD_PHASES, type GoalImageUploadMetadata, type GoalImageUploadPhase, type GoalImageUploadScope } from "../../src/lib/files/goal-image-upload-contract";
import { LOCAL_STORAGE_ORIGIN } from "../../src/lib/files/storage-origin";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-10-24T00:00:00.000Z";
const basis = () => ({ goalId: id(3), goalRevision: "4", baselineFileId: id(5) });
const sourceFile = () => new File([new Uint8Array([1])], "original.png", { type: "image/png" });
async function fixture(phase: GoalImageUploadPhase | null = null, same = false, enabled = true) {
  const owner = id(1), epoch = id(2), values = new Map<string, string>(), queues = new Map<string, Promise<void>>(), calls: string[] = [];
  let live = true;
  const storage = { keys: () => [...values.keys()], getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, text: string) => { values.set(key, text); }, removeItem: (key: string) => { values.delete(key); } };
  const exclusive = async <T,>(name: string, work: () => Promise<T>): Promise<T> => { const prior = queues.get(name) ?? Promise.resolve(); let release!: () => void; queues.set(name, new Promise<void>(done => { release = done; })); await prior; try { return await work(); } finally { release(); } };
  const financeJournal = new FinanceGoalsJournal(owner, { storage, exclusive, uuid: () => epoch }); await financeJournal.open();
  const client = new FinanceGoalsBrowserClient(owner, financeJournal, { isCurrent: () => live, fetcher: async path => { calls.push(path); if (!path.endsWith("/availability")) throw Error("No financial HTTP in binder unit"); return Response.json({ ok: true, result: { available: true } }); } });
  const controller = createGoalsController(owner, client); if (!(await controller.open()).ok) throw Error("Concrete controller did not open"); calls.length = 0;
  const seed = new GoalImageUploadJournal(owner, epoch, { storage, exclusive, isCurrent: () => live }); await seed.open();
  const scope: GoalImageUploadScope = { ownerId: owner, epoch, editorKey: "retained-A", ...(same ? basis() : { goalId: id(33), goalRevision: "1", baselineFileId: id(35) }) };
  const metadata: GoalImageUploadMetadata = { version: 1, purpose: "finance_goal_image", scope, selection: { generation: 7, name: "original.png", size: 1, mime: "image/png", sha256: createHash("sha256").update(new Uint8Array([1])).digest("hex") }, uploadClientId: id(6), uploadId: null, phase: "prepared" };
  if (phase) await seed.exclusive(async lease => { lease.stage(metadata); const end = GOAL_IMAGE_UPLOAD_PHASES.indexOf(phase); for (let index = 1; index <= end; index++) { const next = GOAL_IMAGE_UPLOAD_PHASES[index]!; lease.advance(lease.snapshot(), { phase: next, uploadId: next === "reserving" ? null : id(7) }); } });
  const actual = () => { const row = seed.snapshot().attempt; if (!row?.uploadId) throw Error("No own finalized upload"); return { id: row.uploadId, user_id: owner, kind: "finance_goal_image", folder_id: null, name: row.selection.name, mime: row.selection.mime, bytes: row.selection.size, sha256: row.selection.sha256, width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: at, updated_at: at, modified_at: at }; };
  const sender = vi.fn<(command: string, input: unknown) => Promise<unknown>>(async (command, input) => { calls.push(command); const row = actual(); if (command !== "file.upload.finalize" || JSON.stringify(input) !== JSON.stringify({ upload_id: row.id, client_id: metadata.uploadClientId })) throw Error("Only original finalize"); return row; });
  const app = { userId: owner, mode: "connected" as const, closing: false, initializeJournal: vi.fn(async () => undefined), getCommandSnapshot: () => ({ status: "idle" }), executeDomainCommand: sender };
  let view: GoalImageHostCurrent = { ownerId: owner, providerEpoch: 0, client, application: app, storageOrigin: LOCAL_STORAGE_ORIGIN, origin: "https://binder.invalid", hidden: false, imagesEnabled: enabled };
  const journals: GoalImageUploadJournal[] = [];
  const journalFactory = vi.fn(async (boundOwner: string, boundEpoch: string, current: () => boolean) => { const journal = new GoalImageUploadJournal(boundOwner, boundEpoch, { storage, exclusive, isCurrent: current }); journals.push(journal); await journal.open(); return journal; });
  const reserve = vi.fn(async () => { throw Error("No reserve in this unit"); }), observe = vi.fn(async () => { throw Error("No observation in this unit"); }), put = vi.fn(async () => { throw Error("No PUT in this unit"); });
  const createEditorKey = vi.fn(() => "local-target-B"), loadPicker = vi.fn(async () => GoalImagePicker);
  const options = { current: () => live, read: () => view, journalFactory, loadPicker, createEditorKey, transport: { reserve, observe, put } };
  const binding = new GoalImageHostBinding(options), getController = () => controller;
  const noFinancial = () => { expect(calls.filter(path => path !== "file.upload.finalize")).toEqual([]); expect(reserve).not.toHaveBeenCalled(); expect(observe).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); };
  return { owner, epoch, binding, options, client, controller, getController, seed, values, journals, journalFactory, createEditorKey, loadPicker, sender, reserve, observe, put, metadata, calls, noFinancial, read: () => view, update: (next: Partial<GoalImageHostCurrent>) => { view = { ...view, ...next }; }, closeOwner: () => { live = false; } };
}

describe("image host binding — actual controller/client/J2, synthetic transports", () => {
  it("constructs without opening J2/Picker/HTTP and memoizes one actual J2 by human preparation", async () => {
    const h = await fixture(); expect(h.journalFactory).not.toHaveBeenCalled(); expect(h.loadPicker).not.toHaveBeenCalled();
    const first = await h.binding.prepareEditor(basis(), h.getController), second = await h.binding.prepareEditor(basis(), h.getController);
    expect(h.journalFactory).toHaveBeenCalledTimes(1); expect(h.journals).toHaveLength(1); expect(first.capability.isCurrent()).toBe(false); expect(second.capability.scope.editorKey).toBe(first.capability.scope.editorKey); expect(h.createEditorKey).toHaveBeenCalledTimes(1); h.noFinancial();
  });
  it("adopts A's exact editorKey only for the same goal/revision/baseline", async () => {
    const h = await fixture("prepared", true), before = h.seed.snapshot(), prepared = await h.binding.prepareEditor(basis(), h.getController);
    expect(prepared.capability.scope).toEqual(h.metadata.scope); expect(prepared.source).toBeNull(); expect(h.createEditorKey).not.toHaveBeenCalled(); expect(h.seed.snapshot()).toEqual(before); h.noFinancial();
  });
  it("never adopts A's editorKey when any target component changes", async () => {
    for (const change of [{ goalId: id(99) }, { goalRevision: "5" }, { baselineFileId: null }]) {
      const h = await fixture("prepared", true), before = h.seed.snapshot(), prepared = await h.binding.prepareEditor({ ...basis(), ...change }, h.getController);
      expect(prepared.capability.scope.editorKey).toBe("local-target-B"); expect(prepared.source).not.toBeNull(); expect(h.seed.snapshot()).toEqual(before); expect(h.createEditorKey).toHaveBeenCalledTimes(1); h.noFinancial();
    }
  });
  it("keeps a foreign-source A separate and exposes no financial method or select on its source handle", async () => {
    const h = await fixture("prepared"), before = h.seed.snapshot(), prepared = await h.binding.prepareEditor(basis(), h.getController);
    expect(prepared.capability.scope.goalId).toBe(basis().goalId); expect(prepared.source).not.toBeNull(); const source = await prepared.source!.open();
    expect(prepared.capability.isCurrent()).toBe(false); expect(Object.keys(source).sort()).toEqual(["current", "dispose", "reselect", "resume", "view"]); expect(await source.resume()).toBe("need-file"); expect(h.seed.snapshot()).toEqual(before); expect(h.sender).not.toHaveBeenCalled(); h.noFinancial();
  });
  it("only an actual original finalize yields source-ready, without preparing/binding any Goal", async () => {
    const h = await fixture("finalizing"), prepare = vi.spyOn(h.controller, "prepare"), financial = structuredClone(h.client.epoch);
    const prepared = await h.binding.prepareEditor(basis(), h.getController), source = await prepared.source!.open();
    expect(await source.resume()).toBe("ready"); expect(source.view().phase).toBe("ready-unbound"); expect(h.sender).toHaveBeenCalledTimes(1); expect(prepare).not.toHaveBeenCalled(); expect(h.client.epoch).toBe(financial); h.noFinancial();
    const after = await h.binding.prepareEditor(basis(), h.getController); expect(source.current()).toBe(false); expect(after.capability.scope.goalId).toBe(basis().goalId); expect(after.capability.scope.editorKey).toBe(prepared.capability.scope.editorKey);
  });
  it("new-images false rejects admission/replacement and early resume, but permits original finalize and real G0", async () => {
    const held = await fixture("prepared", false, false), before = held.seed.snapshot(); const prepared = await held.binding.prepareEditor(basis(), held.getController), handle = await prepared.capability.open(structuredClone(prepared.capability.scope));
    await expect(handle.select(sourceFile(), 1)).rejects.toMatchObject({ code: "UNAVAILABLE" }); await expect(handle.replaceRetired(sourceFile(), 8, prepared.capability.scope)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    const source = await prepared.source!.open(); await expect(source.resume()).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(held.seed.snapshot()).toEqual(before); held.noFinancial();
    const ready = await fixture("finalizing", false, false), editor = await ready.binding.prepareEditor(basis(), ready.getController), actual = await editor.capability.open(structuredClone(editor.capability.scope));
    const input = { scope: structuredClone(editor.capability.scope), financeRevision: "4", fields: { name: "Own target", target_cents: 10000, deadline: null }, choice: "update-omit" as const };
    const proof = await actual.authorizeNoNewImage(input); await actual.claimNoNewImage(proof, input); expect(ready.sender).not.toHaveBeenCalled();
    const original = await editor.source!.open(); expect(await original.resume()).toBe("ready"); ready.noFinancial();
  });
  it("wrong original File/hash is refused with complete A retained and no new photo UUID", async () => {
    const h = await fixture("prepared"), before = h.seed.snapshot(), prepared = await h.binding.prepareEditor(basis(), h.getController), source = await prepared.source!.open();
    await expect(source.reselect(new File([new Uint8Array([2])], "original.png", { type: "image/png" }))).rejects.toMatchObject({ code: "INVALID" }); expect(h.seed.snapshot()).toEqual(before); expect(h.sender).not.toHaveBeenCalled(); h.noFinancial();
  });
  it("requires the same REAL controller and owner/client/provider epoch after queued preparation", async () => {
    for (const changed of ["owner", "provider", "client", "controller", "service", "privacy", "dispose"] as const) {
      const h = await fixture("prepared"); let release!: () => void, started!: () => void; const gate = new Promise<void>(done => { release = done; }), inside = new Promise<void>(done => { started = done; });
      h.loadPicker.mockImplementation(async () => { started(); await gate; return GoalImagePicker; }); const controller = h.controller;
      const pending = h.binding.prepareEditor(basis(), () => controller), refused = expect(pending).rejects.toBeDefined(); await inside;
      if (changed === "owner") h.closeOwner(); else if (changed === "provider") h.update({ providerEpoch: 1 }); else if (changed === "client") h.client.dispose(); else if (changed === "controller") { controller.close(); } else if (changed === "service") h.update({ application: { ...h.read().application, executeDomainCommand: async () => undefined } }); else if (changed === "privacy") { h.update({ hidden: true }); h.binding.conceal(); } else h.binding.dispose();
      release(); await refused; expect(h.sender).not.toHaveBeenCalled(); h.noFinancial();
    }
  });
  it("privacy invalidates late capabilities without redaction, then requires a fresh human preparation", async () => {
    const h = await fixture("prepared", true), prepared = await h.binding.prepareEditor(basis(), h.getController), stored = [...h.values]; h.update({ hidden: true }); h.binding.conceal();
    expect(prepared.capability.isCurrent()).toBe(false); await expect(prepared.capability.open(structuredClone(prepared.capability.scope))).rejects.toBeDefined(); expect([...h.values]).toEqual(stored);
    h.update({ hidden: false }); const fresh = await h.binding.prepareEditor(basis(), h.getController); expect(fresh.capability.scope.editorKey).toBe(prepared.capability.scope.editorKey); expect(h.journalFactory).toHaveBeenCalledTimes(1); expect([...h.values]).toEqual(stored); h.noFinancial();
  });
  it("a dispatched original finalize cannot publish ready after its host/service/privacy fence changes", async () => {
    for (const changed of ["service", "privacy", "dispose"] as const) {
      const h = await fixture("finalizing"), prepared = await h.binding.prepareEditor(basis(), h.getController), source = await prepared.source!.open(), original = h.sender.getMockImplementation();
      if (!original) throw Error("Missing synthetic sender");
      let release!: () => void, entered!: () => void, finish!: () => void; const gate = new Promise<void>(done => { release = done; }), inside = new Promise<void>(done => { entered = done; }), finished = new Promise<void>(done => { finish = done; });
      h.sender.mockImplementationOnce(async (command, input) => { entered(); try { await gate; return await original(command, input); } finally { finish(); } });
      const pending = source.resume(), refused = expect(pending).rejects.toBeDefined(); await inside;
      if (changed === "service") h.update({ application: { ...h.read().application, executeDomainCommand: async () => undefined } });
      else if (changed === "privacy") { h.update({ hidden: true }); h.binding.conceal(); } else h.binding.dispose();
      release(); await refused; await finished; expect(source.current()).toBe(false); expect(h.seed.snapshot().attempt?.phase).toBe("finalizing"); expect(h.sender).toHaveBeenCalledTimes(1); h.noFinancial();
    }
  });
  it("advancing A's phase preserves its original scope instead of rebasing it to the target", async () => {
    const h = await fixture("prepared"), prepared = await h.binding.prepareEditor(basis(), h.getController);
    await h.seed.exclusive(async lease => { lease.advance(lease.snapshot(), { phase: "reserving", uploadId: null }); });
    const source = await prepared.source!.open(); expect(source.view().phase).toBe("reserving");
    // A phase change keeps the ORIGINAL identity. Another identity remains
    // blocked by the concrete J2/receiver; no scope is rebased to the target.
    expect(h.seed.snapshot().attempt?.scope).toEqual(h.metadata.scope); expect(prepared.capability.scope).not.toEqual(h.metadata.scope); source.dispose(); expect(h.sender).not.toHaveBeenCalled(); h.noFinancial();
  });
  it("closed/extra basis and a failed local read never authorize a legacy empty fallback", async () => {
    const h = await fixture("prepared"); await expect(Reflect.apply(h.binding.prepareEditor, h.binding, [{ ...basis(), ownerId: id(99) }, h.getController])).rejects.toBeDefined(); expect(h.journalFactory).not.toHaveBeenCalled();
    h.journalFactory.mockRejectedValueOnce(Error("Synthetic quota/read refusal")); await expect(h.binding.prepareEditor(basis(), h.getController)).rejects.toBeDefined(); expect(h.sender).not.toHaveBeenCalled(); h.noFinancial();
  });
  it("dispose closes image handles without revoking the concrete financial client or deleting A", async () => {
    const h = await fixture("finalizing"), prepared = await h.binding.prepareEditor(basis(), h.getController), source = await prepared.source!.open(), stored = [...h.values]; h.binding.dispose();
    expect(source.current()).toBe(false); expect(h.client.isCurrent()).toBe(true); expect([...h.values]).toEqual(stored); await expect(source.resume()).rejects.toBeDefined(); expect(h.sender).not.toHaveBeenCalled();
  });
});
