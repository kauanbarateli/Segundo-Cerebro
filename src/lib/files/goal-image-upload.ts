import { nomeSeguroArquivo } from "../../core/drive/rules";
import type { FinanceGoalsClient } from "../finance-goals-client-contract";
import { consumeGoalImageLinkedProof, inspectGoalImageLinkedProof, type GoalImageLinkedProof } from "../finance-goals-client";
import { decodeGoalImageUploadMetadata, decodeGoalImageUploadScope, goalImageUploadRecord, serializeGoalImageUploadMetadata, serializeGoalImageUploadJournalState, type GoalImageUploadJournalSnapshot, type GoalImageUploadMetadata, type GoalImageUploadScope } from "./goal-image-upload-contract";
import { GoalImageUploadJournal, type GoalImageUploadLease } from "./goal-image-upload-journal";
import type { GoalImageFinanceBarrier, GoalImageFinanceController } from "./goal-image-upload-finance-barrier";
import { createGoalImageUploadTransport, type GoalImageStorageCapability, type GoalImageUploadTransport } from "./goal-image-upload-transport";
import { observedImageFile } from "./image-upload-observation";
import type { StorageOrigin } from "./storage-origin";

const READY = Symbol("GoalImageReady");
export interface GoalImageReadyProof { readonly [READY]: true }
export interface GoalImageReadyView { imageFileId: string; scope: GoalImageUploadScope; generation: number }
export type GoalImageReadyReply = { kind: "ready"; proof: GoalImageReadyProof } | { kind: "need-file"; selection: GoalImageUploadMetadata["selection"] } | { kind: "held" } | { kind: "stale" };
export class GoalImageUploadError extends Error {
  constructor(readonly code: "BUSY" | "INVALID" | "UNAVAILABLE" | "PENDING" | "SESSION_CHANGED" | "STALE") { super(code); this.name = "GoalImageUploadError"; }
}
interface Application {
  userId: string; mode: "demo" | "connected"; closing?: boolean;
  executeDomainCommand(command: string, input: unknown): Promise<unknown>;
  initializeJournal(): Promise<void>;
  getCommandSnapshot(): { status: string };
}
interface Options {
  scope: GoalImageUploadScope; journal: GoalImageUploadJournal; finance: FinanceGoalsClient;
  financeBarrier: GoalImageFinanceBarrier; controller(): GoalImageFinanceController;
  application(): Application; isCurrent(): boolean; currentScope(): GoalImageUploadScope;
  origin: string; storageOrigin: StorageOrigin; transport?: GoalImageUploadTransport;
  createId?: () => string; digest?: (bytes: Uint8Array) => Promise<Uint8Array>;
}
const fileFields = ["id", "user_id", "kind", "folder_id", "name", "mime", "bytes", "sha256", "width", "height", "starred", "deleted_at", "deletion_batch_id", "created_at", "updated_at", "modified_at"];
const identity = (value: GoalImageUploadMetadata) => serializeGoalImageUploadMetadata({ ...value, phase: "prepared", uploadId: null });
const scopeKey = (value: GoalImageUploadScope) => JSON.stringify(decodeGoalImageUploadScope(value));
const proofs = new WeakMap<GoalImageReadyProof, { instance: GoalImageUploadCoordinator; identity: string; uploadId: string }>();

/** Isolated upload/retirement service, never mounted here. Retirement changes
 * local tracking only; it never binds/deletes a Goal/file or clears finance. */
export class GoalImageUploadCoordinator {
  readonly ownerId: string; readonly epoch: string;
  private readonly scope: GoalImageUploadScope; private readonly controller: GoalImageFinanceController;
  private readonly journal: GoalImageUploadJournal; private readonly finance: FinanceGoalsClient; private readonly barrier: GoalImageFinanceBarrier;
  private readonly sender: Application["executeDomainCommand"]; private readonly initialize: Application["initializeJournal"]; private readonly commandSnapshot: Application["getCommandSnapshot"];
  private readonly transport: GoalImageUploadTransport; private active = true; private opened = false; private journalOpened = false; private busy = false;
  private sourceFile: File | null = null; private sourceIdentity: string | null = null;
  private prepared: GoalImageUploadMetadata | null = null;
  private issuedProof: GoalImageReadyProof | null = null;
  private uploadIdentity: string | null = null;
  private replacement: { state: GoalImageUploadJournalSnapshot; fence(): void; used: boolean } | null = null;
  private replacementPrepared: { source: string; value: GoalImageUploadMetadata } | null = null;
  private readonly controllers = new Set<AbortController>();
  private constructor(private readonly options: Options) {
    this.scope = decodeGoalImageUploadScope(options.scope); this.ownerId = this.scope.ownerId; this.epoch = this.scope.epoch; this.controller = options.controller();
    this.journal = options.journal; this.finance = options.finance; this.barrier = options.financeBarrier;
    const app = options.application(); this.sender = app.executeDomainCommand; this.initialize = app.initializeJournal; this.commandSnapshot = app.getCommandSnapshot;
    if (options.journal.ownerId !== this.ownerId || options.journal.epoch !== this.epoch || options.finance.ownerId !== this.ownerId || options.finance.epoch !== this.epoch || options.financeBarrier.ownerId !== this.ownerId || options.financeBarrier.epoch !== this.epoch) throw new GoalImageUploadError("SESSION_CHANGED");
    const transport = options.transport ?? createGoalImageUploadTransport(this.ownerId, options.storageOrigin, { origin: options.origin, assertCurrent: () => this.guard() });
    const reserve = transport.reserve, observe = transport.observe, put = transport.put;
    this.transport = Object.freeze({ reserve: (metadata: GoalImageUploadMetadata, known: string | null, signal: AbortSignal) => reserve.call(transport, metadata, known, signal), observe: (metadata: GoalImageUploadMetadata, signal: AbortSignal) => observe.call(transport, metadata, signal), put: (capability: GoalImageStorageCapability, metadata: GoalImageUploadMetadata, file: File, signal: AbortSignal) => put.call(transport, capability, metadata, file, signal) });
    this.guard();
  }
  static async open(options: Options): Promise<GoalImageUploadCoordinator> {
    const instance = new GoalImageUploadCoordinator(options), controller = new AbortController(); instance.controllers.add(controller);
    try {
      await instance.wait(instance.journal.open(), controller.signal, 30_000); instance.journalOpened = true; instance.guard();
      const initial = instance.journal.snapshot(); instance.uploadIdentity = initial.attempt ? identity(initial.attempt) : null;
      const financial = await instance.wait(instance.finance.loadPending(), controller.signal, 30_000); instance.guard();
      if (!financial.ok) throw new GoalImageUploadError("PENDING");
      if (financial.result.ownerId !== instance.ownerId || financial.result.epoch !== instance.epoch) throw new GoalImageUploadError("SESSION_CHANGED");
      instance.opened = true; return instance;
    } catch (error) { instance.dispose(); throw instance.safe(error); }
    finally { controller.abort(); instance.controllers.delete(controller); }
  }
  private safe(error: unknown): GoalImageUploadError { return error instanceof GoalImageUploadError ? error : new GoalImageUploadError("UNAVAILABLE"); }
  private app(): Application {
    const app = this.options.application();
    if (app.userId !== this.ownerId || app.mode !== "connected" || app.closing || app.executeDomainCommand !== this.sender || app.initializeJournal !== this.initialize || app.getCommandSnapshot !== this.commandSnapshot) throw new GoalImageUploadError("SESSION_CHANGED");
    return app;
  }
  private guard(signal?: AbortSignal) {
    if (!this.active || !this.options.isCurrent() || this.options.journal !== this.journal || this.journal.ownerId !== this.ownerId || this.journal.epoch !== this.epoch || this.options.finance !== this.finance || this.finance.ownerId !== this.ownerId || this.finance.epoch !== this.epoch || this.options.financeBarrier !== this.barrier || this.barrier.ownerId !== this.ownerId || this.barrier.epoch !== this.epoch || this.options.controller() !== this.controller || !this.controller.current() || !this.controller.matches(this.ownerId, this.finance) || !this.finance.isCurrent()) throw new GoalImageUploadError("SESSION_CHANGED");
    this.app(); if (signal?.aborted) throw new GoalImageUploadError("UNAVAILABLE");
    // The journal is opened by its factory. Never borrow another epoch.
    if (this.journalOpened) this.journal.assertSession();
  }
  private targetCurrent() { try { return scopeKey(this.options.currentScope()) === scopeKey(this.scope); } catch { return false; } }
  private async wait<T>(promise: Promise<T>, signal: AbortSignal, timeout: number): Promise<T> {
    this.guard(signal); let rejectWait!: (error: Error) => void;
    const stop = new Promise<never>((_, reject) => { rejectWait = reject; });
    const onAbort = () => rejectWait(new GoalImageUploadError("UNAVAILABLE")); signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => { for (const controller of this.controllers) if (controller.signal === signal) controller.abort(); onAbort(); }, timeout);
    try { const result = await Promise.race([promise, stop]); this.guard(signal); return result; }
    finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
  }
  private async operation<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.guard(); if (!this.opened) throw new GoalImageUploadError("UNAVAILABLE"); if (this.busy) throw new GoalImageUploadError("BUSY");
    this.busy = true; const controller = new AbortController(); this.controllers.add(controller);
    try { const result = await this.wait(work(controller.signal), controller.signal, 150_000); this.guard(controller.signal); return result; }
    catch (error) { throw this.safe(error); }
    finally { controller.abort(); this.controllers.delete(controller); this.busy = false; }
  }
  view(): GoalImageUploadJournalSnapshot { this.guard(); return this.journal.snapshot(); }
  private attempt(lease: GoalImageUploadLease, signal: AbortSignal): GoalImageUploadMetadata {
    this.guard(signal); const value = lease.snapshot(); this.guard(signal);
    if (value.state !== "active" || !value.attempt || scopeKey(value.attempt.scope) !== scopeKey(this.scope)) throw new GoalImageUploadError("PENDING");
    if (identity(value.attempt) !== this.uploadIdentity) throw new GoalImageUploadError("STALE");
    return value.attempt;
  }
  private advance(lease: GoalImageUploadLease, phase: GoalImageUploadMetadata["phase"], uploadId: string | null, signal: AbortSignal) {
    this.guard(signal); const before = lease.snapshot(); this.guard(signal); lease.advance(before, { phase, uploadId }); return this.attempt(lease, signal);
  }
  private async financeClear(signal: AbortSignal, transition: (guard: () => void) => undefined = guard => { guard(); return undefined; }) {
    this.guard(signal);
    await this.wait(this.barrier.runLocalTransition(this.controller, guard => { this.guard(signal); guard(); const result = transition(guard); this.guard(signal); guard(); return result; }), signal, 30_000); this.guard(signal);
  }
  private async hash(file: File, signal: AbortSignal): Promise<GoalImageUploadMetadata["selection"]> {
    this.guard(signal); const name = nomeSeguroArquivo(file.name);
    if (!Number.isInteger(file.size) || file.size < 1 || file.size > 8 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) throw new GoalImageUploadError("INVALID");
    const buffer = await this.wait(file.arrayBuffer(), signal, 15_000); this.guard(signal); if (buffer.byteLength !== file.size) throw new GoalImageUploadError("INVALID");
    const bytes = new Uint8Array(buffer.slice(0)), digest = this.options.digest ?? (async (input: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(input).buffer)));
    this.guard(signal); const hashed = await this.wait(digest(bytes), signal, 15_000); this.guard(signal);
    if (!(hashed instanceof Uint8Array) || hashed.byteLength !== 32) throw new GoalImageUploadError("INVALID");
    const sha256 = [...hashed].map(value => value.toString(16).padStart(2, "0")).join("");
    const checked = decodeGoalImageUploadMetadata({ version: 1, purpose: "finance_goal_image", scope: this.scope, selection: { generation: 1, name, size: file.size, mime: file.type, sha256 }, uploadClientId: "00000000-0000-4000-8000-000000000000", uploadId: null, phase: "prepared" });
    return checked.selection;
  }
  async select(file: File, generation: number): Promise<GoalImageUploadJournalSnapshot> {
    return this.operation(async signal => {
      if (!Number.isInteger(generation) || generation < 1 || generation > 2147483647) throw new GoalImageUploadError("INVALID");
      if (!this.targetCurrent()) throw new GoalImageUploadError("STALE");
      const selected = await this.hash(file, signal); this.guard(signal); if (!this.targetCurrent()) throw new GoalImageUploadError("STALE");
      return this.journal.exclusive(async lease => {
        this.guard(signal); if (lease.snapshot().state !== "empty") throw new GoalImageUploadError("PENDING");
        // Human selection only. Store this complete identity before any remote IO.
        if (this.prepared && (this.prepared.selection.generation !== generation || this.prepared.selection.name !== selected.name || this.prepared.selection.size !== selected.size || this.prepared.selection.mime !== selected.mime || this.prepared.selection.sha256 !== selected.sha256)) throw new GoalImageUploadError("PENDING");
        const prepared = this.prepared ?? decodeGoalImageUploadMetadata({ version: 1, purpose: "finance_goal_image", scope: this.scope, selection: { ...selected, generation }, uploadClientId: (this.options.createId ?? (() => crypto.randomUUID()))(), uploadId: null, phase: "prepared" });
        this.guard(signal); this.prepared = structuredClone(prepared); this.uploadIdentity = identity(prepared);
        await this.financeClear(signal, guard => { guard(); this.guard(signal); lease.stage(prepared); return undefined; }); this.guard(signal);
        this.sourceFile = file; this.sourceIdentity = identity(prepared); return lease.snapshot();
      });
    });
  }
  async reselect(file: File): Promise<GoalImageUploadJournalSnapshot> {
    return this.operation(async signal => {
      const selected = await this.hash(file, signal); this.guard(signal);
      return this.journal.exclusive(async lease => {
        this.guard(signal); const retained = this.attempt(lease, signal), expected = retained.selection;
        if (selected.name !== expected.name || selected.size !== expected.size || selected.mime !== expected.mime || selected.sha256 !== expected.sha256) throw new GoalImageUploadError("INVALID");
        this.guard(signal); this.sourceFile = file; this.sourceIdentity = identity(retained); return lease.snapshot();
      });
    });
  }
  private async beforeNonJournal(signal: AbortSignal) {
    const app = this.app(); this.guard(signal); await this.wait(app.initializeJournal(), signal, 25_000); this.guard(signal);
    if (["pending", "journal-error", "session-changed"].includes(this.app().getCommandSnapshot().status)) throw new GoalImageUploadError("PENDING");
    await this.financeClear(signal); this.guard(signal);
  }
  private async finalize(lease: GoalImageUploadLease, signal: AbortSignal): Promise<GoalImageReadyReply> {
    this.guard(signal); let retained = this.attempt(lease, signal); if (!retained.uploadId) throw new GoalImageUploadError("INVALID");
    if (retained.phase === "reserved") retained = this.advance(lease, "put-uncertain", retained.uploadId, signal);
    if (retained.phase !== "ready-unbound" && retained.phase !== "finalizing") retained = this.advance(lease, "finalizing", retained.uploadId, signal);
    const original = structuredClone(retained), input = { upload_id: original.uploadId, client_id: original.uploadClientId };
    if (!input.upload_id) throw new GoalImageUploadError("INVALID");
    // The only receiver. Neither raw observation nor externally supplied DTOs
    // can call this mint path. The global journal still owns this exact finalize.
    const app = this.app(); this.guard(signal);
    const value = await this.wait(app.executeDomainCommand("file.upload.finalize", structuredClone(input)), signal, 25_000); this.guard(signal);
    const closed = goalImageUploadRecord(value, fileFields), file = observedImageFile(closed, this.ownerId, input.upload_id, "finance_goal_image");
    const current = this.attempt(lease, signal); if (identity(current) !== identity(original) || current.uploadId !== original.uploadId) throw new GoalImageUploadError("PENDING");
    if (current.phase !== "ready-unbound") this.advance(lease, "ready-unbound", current.uploadId, signal);
    this.guard(signal); if (!this.targetCurrent()) return { kind: "stale" }; this.guard(signal);
    if (this.issuedProof) proofs.delete(this.issuedProof);
    const proof: GoalImageReadyProof = Object.freeze({ [READY]: true as const }); proofs.set(proof, { instance: this, identity: identity(original), uploadId: file.id }); this.issuedProof = proof;
    return { kind: "ready", proof };
  }
  async resume(): Promise<GoalImageReadyReply> {
    return this.operation<GoalImageReadyReply>(signal => this.journal.exclusive<GoalImageReadyReply>(async lease => {
      this.guard(signal); let retained = this.attempt(lease, signal);
      // Never reserve/observe/PUT in front of a pending finalize, even after reload.
      if (retained.phase === "finalizing" || retained.phase === "ready-unbound") return this.finalize(lease, signal);
      if (retained.phase === "prepared" && (!this.sourceFile || this.sourceIdentity !== identity(retained))) return { kind: "need-file", selection: structuredClone(retained.selection) };
      await this.beforeNonJournal(signal); this.guard(signal); retained = this.attempt(lease, signal);
      let capability: GoalImageStorageCapability | null = null;
      if (!retained.uploadId) {
        if (!this.targetCurrent()) return { kind: "stale" };
        retained = this.advance(lease, "reserving", null, signal); this.guard(signal);
        const reserved = await this.wait(this.transport.reserve(structuredClone(retained), null, signal), signal, 20_000); this.guard(signal);
        retained = this.advance(lease, "reserved", reserved.uploadId, signal); capability = reserved.capability;
      }
      if (retained.phase === "put-uncertain" || retained.phase === "put-confirmed" || !this.sourceFile || !this.targetCurrent()) {
        this.guard(signal);
        const observed = await this.wait(this.transport.observe(structuredClone(retained), signal), signal, 20_000); this.guard(signal);
        if (observed.state === "final" || observed.state === "staging") return this.finalize(lease, signal);
        if (observed.state === "indeterminate") return { kind: "held" };
        if (retained.phase === "put-confirmed") return { kind: "held" }; // Do not undo a positive PUT phase from point-in-time absence.
      }
      if (!this.targetCurrent()) return { kind: "stale" };
      const file = this.sourceFile;
      if (!file || this.sourceIdentity !== identity(retained)) return { kind: "need-file", selection: structuredClone(retained.selection) };
      if (!capability) {
        this.guard(signal);
        const reserved = await this.wait(this.transport.reserve(structuredClone(retained), retained.uploadId, signal), signal, 20_000); this.guard(signal);
        if (reserved.uploadId !== retained.uploadId) throw new GoalImageUploadError("INVALID"); capability = reserved.capability;
      }
      retained = this.advance(lease, "put-uncertain", retained.uploadId, signal); this.guard(signal);
      await this.wait(this.transport.put(capability, structuredClone(retained), file, signal), signal, 65_000); this.guard(signal);
      retained = this.advance(lease, "put-confirmed", retained.uploadId, signal); return this.finalize(lease, signal);
    }));
  }
  private retirementState(lease: GoalImageUploadLease, signal: AbortSignal): GoalImageUploadJournalSnapshot {
    this.guard(signal); const state = lease.snapshot(); this.guard(signal);
    if (!state.attempt || state.state === "empty") throw new GoalImageUploadError("PENDING");
    if (identity(state.attempt) !== this.uploadIdentity) throw new GoalImageUploadError("STALE");
    if (state.attempt.uploadId === null || !["finalizing", "ready-unbound"].includes(state.attempt.phase)) throw new GoalImageUploadError("PENDING");
    return state;
  }
  private async retireObserved(lease: GoalImageUploadLease, before: GoalImageUploadJournalSnapshot, signal: AbortSignal, consume: () => void): Promise<GoalImageUploadJournalSnapshot> {
    let retired: GoalImageUploadJournalSnapshot | null = null;
    await this.financeClear(signal, guard => {
      this.guard(signal); guard(); const current = this.retirementState(lease, signal);
      if (serializeGoalImageUploadJournalState(current) !== serializeGoalImageUploadJournalState(before)) throw new GoalImageUploadError("STALE");
      consume(); this.guard(signal); guard(); retired = lease.retire(current); this.guard(signal); guard(); return undefined;
    });
    this.guard(signal);
    const current = this.retirementState(lease, signal);
    if (!retired || current.state !== "retirement-review" || serializeGoalImageUploadJournalState(current) !== serializeGoalImageUploadJournalState(retired)) throw new GoalImageUploadError("PENDING");
    if (this.issuedProof) proofs.delete(this.issuedProof); this.issuedProof = null;
    this.replacement = { state: structuredClone(current), fence: this.journal.captureFence(), used: false };
    return current;
  }
  /** Only a proof issued by this SAME concrete financial client can take this path. */
  async retireLinked(proof: GoalImageLinkedProof): Promise<GoalImageUploadJournalSnapshot> {
    this.replacement = null;
    try {
      return await this.operation(signal => this.journal.exclusive(async lease => {
        this.guard(signal); const before = this.retirementState(lease, signal), original = before.attempt;
        if (!original) throw new GoalImageUploadError("PENDING");
        const linked = inspectGoalImageLinkedProof(proof, this.finance); this.guard(signal);
        if (linked.imageFileId !== original.uploadId || linked.sourceGoalId !== original.scope.goalId || linked.sourceGoalRevision !== original.scope.goalRevision ||
          (original.scope.goalId !== null && linked.goalId !== original.scope.goalId) ||
          linked.goalRevision !== (original.scope.goalRevision === null ? "0" : (BigInt(original.scope.goalRevision) + 1n).toString())) throw new GoalImageUploadError("STALE");
        return this.retireObserved(lease, before, signal, () => { consumeGoalImageLinkedProof(proof, this.finance); });
      }));
    } catch (error) { this.replacement = null; throw error; }
  }
  /** Fresh ORIGINAL finalize only, including retirement-review or a stale editor.
   * Its result never issues editor-ready proof for B. */
  async discardFinalized(): Promise<GoalImageUploadJournalSnapshot> {
    this.replacement = null;
    try {
      return await this.operation(signal => this.journal.exclusive(async lease => {
        this.guard(signal); const before = this.retirementState(lease, signal), original = before.attempt;
        if (!original?.uploadId) throw new GoalImageUploadError("PENDING");
        const input = { upload_id: original.uploadId, client_id: original.uploadClientId }, app = this.app(); this.guard(signal);
        const raw = await this.wait(app.executeDomainCommand("file.upload.finalize", structuredClone(input)), signal, 25_000); this.guard(signal);
        observedImageFile(goalImageUploadRecord(raw, fileFields), this.ownerId, input.upload_id, "finance_goal_image"); this.guard(signal);
        let unused = true;
        return this.retireObserved(lease, before, signal, () => { if (!unused) throw new GoalImageUploadError("PENDING"); unused = false; });
      }));
    } catch (error) { this.replacement = null; throw error; }
  }
  /** Explicit B admission. Success closes this A handle; open a NEW handle scoped to B. */
  async replaceRetired(file: File, generation: number, nextScope: GoalImageUploadScope): Promise<GoalImageUploadJournalSnapshot> {
    const result = await this.operation(async signal => {
      const grant = this.replacement, scope = decodeGoalImageUploadScope(nextScope);
      if (!grant || grant.used) throw new GoalImageUploadError("PENDING");
      grant.fence(); this.guard(signal);
      if (scope.ownerId !== this.ownerId || scope.epoch !== this.epoch) throw new GoalImageUploadError("SESSION_CHANGED");
      if (!Number.isInteger(generation) || generation < 1 || generation > 2147483647 || scopeKey(this.options.currentScope()) !== scopeKey(scope)) throw new GoalImageUploadError("STALE");
      const selected = await this.hash(file, signal); this.guard(signal); grant.fence();
      if (scopeKey(this.options.currentScope()) !== scopeKey(scope)) throw new GoalImageUploadError("STALE");
      return this.journal.exclusive(async lease => {
        this.guard(signal); grant.fence();
        if (this.replacement !== grant || grant.used || serializeGoalImageUploadJournalState(lease.snapshot()) !== serializeGoalImageUploadJournalState(grant.state)) throw new GoalImageUploadError("STALE");
        const source = grant.state.attempt; if (!source) throw new GoalImageUploadError("PENDING");
        const cached = this.replacementPrepared;
        if (cached && (cached.source !== identity(source) || scopeKey(cached.value.scope) !== scopeKey(scope) || cached.value.selection.generation !== generation || cached.value.selection.name !== selected.name || cached.value.selection.size !== selected.size || cached.value.selection.mime !== selected.mime || cached.value.selection.sha256 !== selected.sha256)) throw new GoalImageUploadError("PENDING");
        const prepared = cached?.value ?? decodeGoalImageUploadMetadata({ version: 1, purpose: "finance_goal_image", scope, selection: { ...selected, generation }, uploadClientId: (this.options.createId ?? (() => crypto.randomUUID()))(), uploadId: null, phase: "prepared" });
        if (prepared.uploadClientId === source.uploadClientId) throw new GoalImageUploadError("INVALID");
        this.guard(signal); this.replacementPrepared = { source: identity(source), value: structuredClone(prepared) };
        let changed: GoalImageUploadJournalSnapshot | null = null;
        await this.financeClear(signal, guard => {
          this.guard(signal); guard(); grant.fence();
          if (this.replacement !== grant || grant.used || serializeGoalImageUploadJournalState(lease.snapshot()) !== serializeGoalImageUploadJournalState(grant.state)) throw new GoalImageUploadError("STALE");
          grant.used = true; this.replacement = null; this.guard(signal); guard();
          changed = lease.replaceRetired(grant.state, prepared); this.guard(signal); guard(); return undefined;
        });
        this.guard(signal); const current = lease.snapshot();
        if (!changed || current.state !== "active" || !current.attempt || identity(current.attempt) !== identity(prepared) || serializeGoalImageUploadJournalState(current) !== serializeGoalImageUploadJournalState(changed)) throw new GoalImageUploadError("PENDING");
        return current;
      });
    });
    this.guard(); this.dispose(); return result;
  }
  inspectReady(proof: GoalImageReadyProof, expectedScope: GoalImageUploadScope): GoalImageReadyView {
    this.guard(); if (!this.targetCurrent() || scopeKey(expectedScope) !== scopeKey(this.scope)) throw new GoalImageUploadError("STALE");
    const received = proofs.get(proof), snapshot = this.view(), current = snapshot.attempt;
    if (!received || received.instance !== this || snapshot.state !== "active" || !current || current.phase !== "ready-unbound" || received.identity !== identity(current) || received.uploadId !== current.uploadId) throw new GoalImageUploadError("INVALID");
    return { imageFileId: received.uploadId, scope: structuredClone(this.scope), generation: current.selection.generation };
  }
  dispose() { this.active = false; this.sourceFile = null; this.sourceIdentity = null; this.prepared = null; this.replacement = null; this.replacementPrepared = null; if (this.issuedProof) proofs.delete(this.issuedProof); this.issuedProof = null; for (const controller of this.controllers) controller.abort(); this.controllers.clear(); }
  revokeIdentity() { this.dispose(); return this.journal.revokeIdentity(); }
}
