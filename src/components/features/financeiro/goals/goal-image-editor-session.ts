import type { GoalCommand } from "@/core/financeiro/goals/goal-types";
import { nomeSeguroArquivo } from "@/core/drive/rules";
import { goalRevision, goalUuid } from "@/core/financeiro/goals/goal-validation";
import type { GoalImageLinkedProof } from "@/lib/finance-goals-client";
import { GoalImageUploadError, type GoalImageNoNewImageBasis, type GoalImageNoNewImageChoice, type GoalImageUploadCoordinator } from "@/lib/files/goal-image-upload";
import { decodeGoalImageUploadScope, type GoalImageUploadJournalSnapshot, type GoalImageUploadScope } from "@/lib/files/goal-image-upload-contract";
import { chooseGoalImageCandidate, createGoalImageDraft, goalImageDecision, type GoalImageDraft } from "./goal-image-picker-model";
import { goalFields, goalIntent, type GoalEditorDraft } from "./goals-ui-model";
import type { GoalImagePicker } from "./goal-image-picker";

/** Optional local capability, separate from the financial client port. The host
 * binds open to the SAME durable journal, finance barrier and controller. */
export interface GoalImageEditorCapability {
  readonly scope: Readonly<GoalImageUploadScope>;
  /** Explicit presenter injection keeps the absent path's CSS closure intact. */
  readonly Picker: typeof GoalImagePicker;
  isCurrent(): boolean;
  open(scope: GoalImageUploadScope): Promise<GoalImageEditorCoordinator>;
  linked(): GoalImageLinkedProof | null;
}
export type GoalImageEditorCoordinator = Pick<GoalImageUploadCoordinator, "view" | "select" | "reselect" | "resume" | "inspectReady" | "retireLinked" | "discardFinalized" | "replaceRetired" | "authorizeNoNewImage" | "claimNoNewImage" | "dispose">;
export type GoalImageEditorStatus = "idle" | "working" | "pending" | "need-file" | "reviewed" | "stale" | "unavailable";
export interface GoalImageEditorView {
  status: GoalImageEditorStatus;
  upload: GoalImageUploadJournalSnapshot | null;
  generationFloor: number;
  /** Set only by the explicit no-new-image action, never by upload failure. */
  noNewImageChoice: GoalImageNoNewImageChoice | null;
  /** Metadata only. It never asserts that a selected/ready File is authorized. */
  selectionLocked: boolean;
}
export class GoalImageEditorError extends Error {
  constructor(readonly code: "BUSY" | "INVALID" | "UNAVAILABLE" | "PENDING" | "SESSION_CHANGED" | "STALE" | "NEED_FILE") { super(code); this.name = "GoalImageEditorError"; }
}
const key = (scope: GoalImageUploadScope) => JSON.stringify(decodeGoalImageUploadScope(scope));

/** One editor identity. No mount-time IO, timers, retries, financial dispatch or
 * local proof issuer. A disposed editor leaves both durable journals intact. */
export class GoalImageEditorSession {
  readonly scope: GoalImageUploadScope;
  private alive = true;
  private working = false;
  private version = 0;
  private selected: GoalImageDraft;
  private file: File | null = null;
  private handle: GoalImageEditorCoordinator | null = null;
  private upload: GoalImageUploadJournalSnapshot | null = null;
  private status: GoalImageEditorStatus = "idle";
  private intent: GoalCommand | null = null;
  private intentBasis: string | null = null;
  private noNewImageChoice: GoalImageNoNewImageChoice | null = null;
  private readonly openHandle: GoalImageEditorCapability["open"];
  private readonly linked: GoalImageEditorCapability["linked"];
  private readonly isCurrent: GoalImageEditorCapability["isCurrent"];
  constructor(private readonly capability: GoalImageEditorCapability, private readonly current: () => boolean) {
    this.scope = Object.freeze(decodeGoalImageUploadScope(capability.scope));
    this.selected = createGoalImageDraft(this.scope);
    this.openHandle = capability.open;
    this.linked = capability.linked;
    this.isCurrent = capability.isCurrent;
  }
  private guard() {
    if (!this.alive || !this.current() || this.capability.isCurrent !== this.isCurrent || !this.isCurrent.call(this.capability) || this.capability.open !== this.openHandle || this.capability.linked !== this.linked || key(this.capability.scope) !== key(this.scope)) throw new GoalImageEditorError("SESSION_CHANGED");
  }
  view(): GoalImageEditorView {
    this.guard();
    return { status: this.status, upload: this.upload ? structuredClone(this.upload) : null, generationFloor: this.upload?.attempt && key(this.upload.attempt.scope) === key(this.scope) ? this.upload.attempt.selection.generation : 0, noNewImageChoice: this.noNewImageChoice, selectionLocked: this.working || this.intent !== null };
  }
  /** File is private RAM, never included in the view, callbacks or either journal. */
  choose(draft: GoalImageDraft, file: File | null) {
    this.guard(); if (this.working || this.intent) throw new GoalImageEditorError("PENDING");
    if (goalImageDecision(draft, this.scope).kind === "stale") throw new GoalImageEditorError("INVALID");
    if (draft.choice.kind === "selected" && (!file || file.size !== draft.choice.candidate.size || file.type !== draft.choice.candidate.mime || nomeSeguroArquivo(file.name) !== draft.choice.candidate.name)) throw new GoalImageEditorError("INVALID");
    this.selected = structuredClone(draft); this.file = draft.choice.kind === "selected" ? file : null; this.version++;
  }
  private saveView(handle: GoalImageEditorCoordinator) {
    this.guard(); const snapshot = handle.view();
    if (snapshot.ownerId !== this.scope.ownerId || snapshot.epoch !== this.scope.epoch) throw new GoalImageEditorError("SESSION_CHANGED");
    this.upload = structuredClone(snapshot); return snapshot;
  }
  private async coordinator(fence: () => void, fresh = false) {
    fence();
    if (fresh && this.handle) { this.handle.dispose(); this.handle = null; }
    if (this.handle) { this.saveView(this.handle); return this.handle; }
    const handle = await this.openHandle.call(this.capability, structuredClone(this.scope));
    try { fence(); this.saveView(handle); this.handle = handle; return handle; } catch (error) { handle.dispose(); throw error; }
  }
  private async action<T>(work: (fence: () => void) => Promise<T>): Promise<T> {
    this.guard(); if (this.working) throw new GoalImageEditorError("BUSY");
    const version = this.version, fence = () => { this.guard(); if (this.version !== version) throw new GoalImageEditorError("STALE"); };
    this.working = true; this.status = "working";
    try { const result = await work(fence); fence(); return result; }
    catch (error) {
      // Never publish a stale A result in a replacement owner/service/editor.
      this.guard();
      const code = error instanceof GoalImageEditorError || error instanceof GoalImageUploadError ? error.code : "UNAVAILABLE";
      this.status = code === "STALE" || code === "SESSION_CHANGED" ? "stale" : code === "NEED_FILE" ? "need-file" : code === "PENDING" ? "pending" : "unavailable";
      throw error instanceof GoalImageEditorError ? error : new GoalImageEditorError(code === "PENDING" || code === "STALE" || code === "SESSION_CHANGED" || code === "INVALID" || code === "BUSY" ? code : "UNAVAILABLE");
    } finally { this.working = false; }
  }
  /** Human action: local durable read only. A readback-lost B is reopened, never
   * replaced again or interpreted as absent. No UUID is allocated here. */
  inspect(): Promise<GoalImageEditorView> {
    return this.action(async fence => {
      const handle = await this.coordinator(fence, true); fence(); const snapshot = this.saveView(handle);
      // Explicit inspection may recover A's metadata choice, never a File or a
      // ready proof. Do not overwrite a human removal/undo/new selection.
      if (!this.intent && this.selected.choice.kind === "preserve" && this.selected.lastGeneration === 0 && snapshot.state === "active" && snapshot.attempt && key(snapshot.attempt.scope) === key(this.scope)) {
        const candidate = snapshot.attempt.selection;
        this.selected = chooseGoalImageCandidate(this.selected, this.scope, { generation: candidate.generation, name: candidate.name, size: candidate.size, mime: candidate.mime });
      }
      this.status = snapshot.state === "empty" ? "idle" : "pending"; return this.view();
    });
  }
  review(input: { draft: GoalEditorDraft; financeRevision: string; createId(): string; stillCurrent(): boolean; prepare(intent: GoalCommand): Promise<void> }): Promise<void> {
    // Synchronous validation/capture precedes open, hashing and upload. Invalid
    // form values cannot reserve storage, mint a financial UUID or call prepare.
    const fields = goalFields(structuredClone(input.draft)), revision = input.financeRevision;
    goalRevision(revision);
    const createId = input.createId, prepare = input.prepare, stillCurrent = input.stillCurrent;
    const choice = structuredClone(this.selected), decision = goalImageDecision(choice, this.scope), file = this.file;
    if (decision.kind === "stale" || choice.error) return Promise.reject(new GoalImageEditorError("INVALID"));
    const basis = JSON.stringify({ fields, revision, choice });
    return this.action(async ownFence => {
      const fence = () => { ownFence(); if (!stillCurrent()) throw new GoalImageEditorError("STALE"); };
      fence();
      if (this.intent) {
        if (this.intentBasis !== basis) throw new GoalImageEditorError("PENDING");
        // Only a read-only review of the captured SAME intention; never execute.
        await prepare(structuredClone(this.intent)); fence(); this.status = "reviewed"; return;
      }
      const handle = await this.coordinator(fence); fence(); let snapshot = this.saveView(handle);
      let image: string | null | undefined = decision.kind === "remove" || decision.kind === "unchanged" && decision.persistence === "default-null" ? null : undefined;
      if (decision.kind === "needs-upload") {
        if (snapshot.state === "empty") { if (!file) throw new GoalImageEditorError("NEED_FILE"); await handle.select(file, decision.candidate.generation); fence(); snapshot = this.saveView(handle); }
        else {
          if (snapshot.state !== "active" || !snapshot.attempt || key(snapshot.attempt.scope) !== key(this.scope)) throw new GoalImageEditorError("PENDING");
          if (file) { await handle.reselect(file); fence(); snapshot = this.saveView(handle); }
        }
        const ready = await handle.resume(); fence(); this.saveView(handle);
        if (ready.kind !== "ready") throw new GoalImageEditorError(ready.kind === "need-file" ? "NEED_FILE" : ready.kind === "stale" ? "STALE" : "PENDING");
        const observed = handle.inspectReady(ready.proof, structuredClone(this.scope)); fence();
        if (key(observed.scope) !== key(this.scope) || observed.generation !== snapshot.attempt?.selection.generation) throw new GoalImageEditorError("INVALID");
        // The concrete receiver is nominal; the optional structural seam must
        // still refuse a malformed internal return before allocating an intent.
        const finalizedImageId: unknown = observed.imageFileId;
        try { goalUuid(finalizedImageId); } catch { throw new GoalImageEditorError("INVALID"); }
        image = finalizedImageId; // No selected -> null/omission fallback.
      } else if (snapshot.state !== "empty") throw new GoalImageEditorError("PENDING");
      fence();
      if (decision.kind === "needs-upload" && typeof image !== "string") throw new GoalImageEditorError("INVALID");
      const common = { client_id: createId(), expected_finance_revision: revision };
      const intent = this.scope.goalId === null
        ? goalIntent("finance.goal.create", { ...common, ...fields, image_file_id: image })
        : goalIntent("finance.goal.update", { ...common, goal_id: this.scope.goalId, expected_revision: this.scope.goalRevision, patch: { ...fields, ...(image === undefined ? {} : { image_file_id: image }) } });
      this.intent = structuredClone(intent); this.intentBasis = basis;
      fence(); await prepare(structuredClone(intent)); fence(); this.status = "reviewed";
    });
  }
  /** Human decision separate from review(selected). It does not complete,
   * retire, clear or replace A, and never treats metadata as a ready File. */
  reviewWithoutNewImage(choice: GoalImageNoNewImageChoice, input: { draft: GoalEditorDraft; financeRevision: string; createId(): string; stillCurrent(): boolean; prepare(intent: GoalCommand): Promise<void>; onChoiceClaimed?(): void }): Promise<void> {
    this.guard();
    const fields = goalFields(structuredClone(input.draft)), revision = input.financeRevision;
    goalRevision(revision);
    if (choice !== "create-null" && choice !== "update-omit" && choice !== "update-remove" || (this.scope.goalId === null ? choice !== "create-null" : choice === "create-null")) return Promise.reject(new GoalImageEditorError("INVALID"));
    const selection = structuredClone(this.selected), basis: GoalImageNoNewImageBasis = { scope: structuredClone(this.scope), financeRevision: revision, fields: structuredClone(fields), choice };
    const intentBasis = JSON.stringify({ fields, revision, selection, noNewImageChoice: choice });
    const prepare = input.prepare, createId = input.createId, stillCurrent = input.stillCurrent, onChoiceClaimed = input.onChoiceClaimed;
    return this.action(async ownFence => {
      const fence = () => { ownFence(); if (!stillCurrent() || JSON.stringify(this.selected) !== JSON.stringify(selection)) throw new GoalImageEditorError("STALE"); };
      fence();
      if (this.intent) {
        if (this.intentBasis !== intentBasis || this.noNewImageChoice !== choice) throw new GoalImageEditorError("PENDING");
        await prepare(structuredClone(this.intent)); fence(); this.status = "reviewed"; return;
      }
      const handle = await this.coordinator(fence); fence(); const original = this.saveView(handle);
      if (original.state === "empty" || !original.attempt) throw new GoalImageEditorError("PENDING");
      const proof = await handle.authorizeNoNewImage(structuredClone(basis)); fence();
      await handle.claimNoNewImage(proof, structuredClone(basis)); fence();
      if (JSON.stringify(this.saveView(handle)) !== JSON.stringify(original)) throw new GoalImageEditorError("STALE");
      // Only this explicit, claimed action excludes the local preview. Keep A
      // and its metadata choice intact; no File read, new upload UUID or clear.
      this.noNewImageChoice = choice; this.file = null; onChoiceClaimed?.(); fence();
      const common = { client_id: createId(), expected_finance_revision: revision };
      const intent = choice === "create-null"
        ? goalIntent("finance.goal.create", { ...common, ...fields, image_file_id: null })
        : goalIntent("finance.goal.update", { ...common, goal_id: this.scope.goalId, expected_revision: this.scope.goalRevision, patch: { ...fields, ...(choice === "update-remove" ? { image_file_id: null } : {}) } });
      this.intent = structuredClone(intent); this.intentBasis = intentBasis;
      fence(); await prepare(structuredClone(intent)); fence(); this.status = "reviewed";
    });
  }
  /** Neither action accepts a free DTO/boolean as authority. R validates the
   * private receiver and financial barrier; its returned state remains binding. */
  recover(kind: "linked" | "discard"): Promise<GoalImageEditorView> {
    return this.action(async fence => {
      const handle = await this.coordinator(fence); fence();
      if (kind === "linked") {
        const proof = this.linked.call(this.capability); fence(); if (!proof) throw new GoalImageEditorError("PENDING");
        await handle.retireLinked(proof); fence();
      } else { await handle.discardFinalized(); fence(); }
      const snapshot = this.saveView(handle); this.status = snapshot.state === "empty" ? "idle" : "pending";
      // Do not reset a financial intention merely because a local upload changed.
      return this.view();
    });
  }
  replace(): Promise<GoalImageEditorView> {
    const choice = structuredClone(this.selected), file = this.file;
    return this.action(async fence => {
      if (this.intent || choice.choice.kind !== "selected" || !file) throw new GoalImageEditorError("PENDING");
      const handle = await this.coordinator(fence); fence();
      if (this.saveView(handle).state !== "retirement-review") throw new GoalImageEditorError("PENDING");
      await handle.replaceRetired(file, choice.choice.candidate.generation, structuredClone(this.scope)); fence();
      // A is closed by R. Only a new factory-bound B handle can resume B.
      this.handle = null; const replacement = await this.coordinator(fence); fence();
      const snapshot = this.saveView(replacement);
      if (snapshot.state !== "active" || !snapshot.attempt || key(snapshot.attempt.scope) !== key(this.scope) || snapshot.attempt.selection.generation !== choice.choice.candidate.generation) throw new GoalImageEditorError("PENDING");
      this.status = "pending"; return this.view();
    });
  }
  dispose() { this.alive = false; this.file = null; this.handle?.dispose(); this.handle = null; this.intent = null; this.intentBasis = null; this.noNewImageChoice = null; }
}
