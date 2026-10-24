"use client";

import { createContext, createElement, useContext, type ReactNode } from "react";
import { FinanceGoalsBrowserClient } from "@/lib/finance-goals-client";
import { GoalImageUploadCoordinator, GoalImageUploadError } from "@/lib/files/goal-image-upload";
import { browserGoalImageUploadJournal, type GoalImageUploadJournal } from "@/lib/files/goal-image-upload-journal";
import { decodeGoalImageUploadScope, goalImageUploadRecord, serializeGoalImageUploadMetadata, type GoalImageUploadMetadata, type GoalImageUploadScope } from "@/lib/files/goal-image-upload-contract";
import { createGoalImageUploadTransport, type GoalImageUploadTransport } from "@/lib/files/goal-image-upload-transport";
import { isStorageOrigin, type StorageOrigin } from "@/lib/files/storage-origin";
import type { createGoalsController } from "./goals-ui-model";
import type { GoalImageEditorCapability, GoalImageEditorCoordinator } from "./goal-image-editor-session";
import type { GoalImagePicker } from "./goal-image-picker";

const ImageAvailability = createContext(false);
/** Public presentation boolean only. Endpoints still authorize every request. */
export function GoalImagesHostProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return createElement(ImageAvailability.Provider, { value: enabled === true }, children);
}
export const useGoalImagesEnabled = () => useContext(ImageAvailability);

type Controller = ReturnType<typeof createGoalsController>;
type Application = ReturnType<Parameters<typeof GoalImageUploadCoordinator.open>[0]["application"]>;
export interface GoalImageEditorBasis { goalId: string | null; goalRevision: string | null; baselineFileId: string | null }
export interface GoalImageHostCurrent {
  ownerId: string; providerEpoch: number; client: FinanceGoalsBrowserClient;
  application: Application; storageOrigin: StorageOrigin | undefined; origin: string;
  hidden: boolean; imagesEnabled: boolean;
}
export interface GoalImageSourceView { state: "active" | "retirement-review"; phase: GoalImageUploadMetadata["phase"]; name: string; mime: string; bytes: number }
export interface GoalImageSourceHandle {
  current(): boolean; view(): GoalImageSourceView;
  reselect(file: File): Promise<void>;
  resume(): Promise<"ready" | "need-file" | "held" | "stale">;
  dispose(): void;
}
export interface GoalImageSourceCapability {
  /** A local capture, never accepted by any financial or finalization receiver. */
  describe(): GoalImageSourceView;
  open(): Promise<GoalImageSourceHandle>;
}
export interface GoalImagePreparedEditor {
  capability: GoalImageEditorCapability; source: GoalImageSourceCapability | null;
}
interface BindingOptions {
  current(): boolean; read(): GoalImageHostCurrent;
  /** Test infrastructure only; production uses localStorage/Web Locks. */
  journalFactory?: typeof browserGoalImageUploadJournal;
  loadPicker?: () => Promise<typeof GoalImagePicker>;
  transport?: GoalImageUploadTransport;
  createEditorKey?: () => string;
}
const scopeKey = (value: GoalImageUploadScope) => JSON.stringify(decodeGoalImageUploadScope(value));
const sourceKey = (value: GoalImageUploadMetadata) => serializeGoalImageUploadMetadata({ ...value, phase: "prepared", uploadId: null });
const sameTarget = (left: GoalImageUploadScope, right: GoalImageUploadScope) => left.ownerId === right.ownerId && left.epoch === right.epoch && left.goalId === right.goalId && left.goalRevision === right.goalRevision && left.baselineFileId === right.baselineFileId;

/** One live host: one concrete client, one memoized J2 and the actual channel
 * controller. Construction performs no journal, File, fetch or storage IO. */
export class GoalImageHostBinding {
  private alive = true; private generation = 0; private opening: object | null = null;
  private journal: GoalImageUploadJournal | null = null; private journalPending: Promise<GoalImageUploadJournal> | null = null;
  private readonly captured: GoalImageHostCurrent;
  private readonly clientEpoch: string;
  private readonly handles = new Set<GoalImageUploadCoordinator>();
  private editorScope: GoalImageUploadScope | null = null;
  constructor(private readonly options: BindingOptions) {
    const value = options.read();
    this.captured = { ...value, application: { ...value.application } };
    this.clientEpoch = value.client.epoch;
    if (!(value.client instanceof FinanceGoalsBrowserClient) || !Number.isSafeInteger(value.providerEpoch) || value.providerEpoch < 0) throw new GoalImageUploadError("SESSION_CHANGED");
    this.guard(false);
  }
  private guard(sensitive = true) {
    const now = this.options.read(), was = this.captured, app = now.application, old = was.application;
    if (!this.alive || !this.options.current() || now.ownerId !== was.ownerId || now.providerEpoch !== was.providerEpoch || now.client !== was.client || now.client.ownerId !== was.ownerId || now.client.epoch !== this.clientEpoch || !now.client.isCurrent() || app.userId !== now.ownerId || app.mode !== "connected" || app.closing || app.executeDomainCommand !== old.executeDomainCommand || app.initializeJournal !== old.initializeJournal || app.getCommandSnapshot !== old.getCommandSnapshot || now.storageOrigin !== was.storageOrigin || now.origin !== was.origin || sensitive && now.hidden) throw new GoalImageUploadError("SESSION_CHANGED");
    return now;
  }
  current() { try { this.guard(false); return true; } catch { return false; } }
  private enabled() { return this.guard().imagesEnabled === true; }
  private invalidate() {
    if (this.generation === Number.MAX_SAFE_INTEGER) { this.alive = false; throw new GoalImageUploadError("UNAVAILABLE"); }
    this.generation++; this.opening = null;
    for (const handle of this.handles) handle.dispose(); this.handles.clear();
    return this.generation;
  }
  /** Privacy/close redact RAM and invalidate late callbacks, never either journal. */
  conceal() { this.invalidate(); }
  private async localJournal() {
    this.guard();
    if (this.journal) { this.journal.assertSession(); return this.journal; }
    if (!this.journalPending) {
      const owner = this.captured.ownerId, epoch = this.clientEpoch;
      const factory = this.options.journalFactory ?? browserGoalImageUploadJournal;
      const pending = factory(owner, epoch, () => this.current()); this.journalPending = pending;
      void pending.catch(() => { if (this.journalPending === pending) this.journalPending = null; });
    }
    const value = await this.journalPending; this.guard(); value.assertSession();
    if (value.ownerId !== this.captured.ownerId || value.epoch !== this.clientEpoch) throw new GoalImageUploadError("SESSION_CHANGED");
    this.journal = value; return value;
  }
  private fence(generation: number, getController: () => Controller | null, controller: Controller) {
    return () => { this.guard(); if (this.generation !== generation || getController() !== controller || !controller.current() || !controller.matches(this.captured.ownerId, this.captured.client)) throw new GoalImageUploadError("SESSION_CHANGED"); };
  }
  private async coordinator(scope: GoalImageUploadScope, generation: number, getController: () => Controller | null, controller: Controller) {
    const guard = this.fence(generation, getController, controller); guard();
    const journal = await this.localJournal(); guard(); const value = this.guard();
    if (!isStorageOrigin(value.storageOrigin) || new URL(value.origin).origin !== value.origin) throw new GoalImageUploadError("UNAVAILABLE");
    const transport = this.options.transport ?? createGoalImageUploadTransport(value.ownerId, value.storageOrigin, { origin: value.origin, assertCurrent: guard });
    // Conservative until the server distinguishes replay from NEW reserve.
    const gated: GoalImageUploadTransport = {
      reserve: async (...args) => { guard(); if (!this.enabled()) throw new GoalImageUploadError("UNAVAILABLE"); const result = await transport.reserve(...args); guard(); return result; },
      observe: async (...args) => { guard(); const result = await transport.observe(...args); guard(); return result; },
      put: async (...args) => { guard(); if (!this.enabled()) throw new GoalImageUploadError("UNAVAILABLE"); await transport.put(...args); guard(); },
    };
    const handle = await GoalImageUploadCoordinator.open({ scope, journal, finance: value.client, financeBarrier: value.client.imageUploadBarrier, controller: () => { guard(); return controller; }, application: () => this.guard().application, isCurrent: () => { try { guard(); return true; } catch { return false; } }, currentScope: () => { guard(); return scope; }, origin: value.origin, storageOrigin: value.storageOrigin, transport: gated });
    try { guard(); this.handles.add(handle); return handle; } catch (error) { handle.dispose(); throw error; }
  }
  async prepareEditor(basis: GoalImageEditorBasis, getController: () => Controller | null): Promise<GoalImagePreparedEditor> {
    this.guard(); if (this.opening) throw new GoalImageUploadError("BUSY");
    const controller = getController(); if (!controller) throw new GoalImageUploadError("SESSION_CHANGED");
    const generation = this.invalidate(), token = {}; this.opening = token;
    const guard = this.fence(generation, getController, controller); guard();
    try {
      const value = this.guard(), input = goalImageUploadRecord(basis, ["goalId", "goalRevision", "baselineFileId"]);
      const base = decodeGoalImageUploadScope({ ownerId: value.ownerId, epoch: this.clientEpoch, editorKey: "local-editor", goalId: input.goalId, goalRevision: input.goalRevision, baselineFileId: input.baselineFileId });
      const journal = await this.localJournal(); guard();
      const snapshot = await journal.exclusive(async lease => { guard(); return lease.snapshot(); }); guard();
      const original = snapshot.attempt;
      const editorKey = original && sameTarget(original.scope, base) ? original.scope.editorKey : this.editorScope && sameTarget(this.editorScope, base) ? this.editorScope.editorKey : (this.options.createEditorKey ?? (() => crypto.randomUUID()))();
      const scope = Object.freeze(decodeGoalImageUploadScope({ ...base, editorKey })); this.editorScope = scope;
      const Picker = await (this.options.loadPicker ?? (async () => (await import("./goal-image-picker")).GoalImagePicker))(); guard();
      const capability: GoalImageEditorCapability = Object.freeze({ scope, Picker, newImagesEnabled: this.enabled(), isCurrent: () => { try { guard(); return true; } catch { return false; } }, linked: () => { guard(); return value.client.imageUploadLinks.current(); },
        open: async (requested: GoalImageUploadScope): Promise<GoalImageEditorCoordinator> => {
          guard(); if (scopeKey(requested) !== scopeKey(scope)) throw new GoalImageUploadError("STALE");
          const handle = await this.coordinator(scope, generation, getController, controller); guard();
          return { view: () => { guard(); return handle.view(); }, select: async (...args) => { guard(); if (!this.enabled()) throw new GoalImageUploadError("UNAVAILABLE"); const result = await handle.select(...args); guard(); return result; }, reselect: async (...args) => { guard(); const result = await handle.reselect(...args); guard(); return result; }, resume: async () => { guard(); const state = handle.view(); if (!this.enabled() && !["finalizing", "ready-unbound"].includes(state.attempt?.phase ?? "")) throw new GoalImageUploadError("UNAVAILABLE"); const result = await handle.resume(); guard(); return result; }, inspectReady: (...args) => { guard(); return handle.inspectReady(...args); }, retireLinked: async (...args) => { guard(); const result = await handle.retireLinked(...args); guard(); return result; }, discardFinalized: async () => { guard(); const result = await handle.discardFinalized(); guard(); return result; }, replaceRetired: async (...args) => { guard(); if (!this.enabled()) throw new GoalImageUploadError("UNAVAILABLE"); const result = await handle.replaceRetired(...args); guard(); return result; }, authorizeNoNewImage: async (...args) => { guard(); const result = await handle.authorizeNoNewImage(...args); guard(); return result; }, claimNoNewImage: async (...args) => { guard(); await handle.claimNoNewImage(...args); guard(); }, dispose: () => { handle.dispose(); this.handles.delete(handle); } };
        },
      });
      const source: GoalImageSourceCapability | null = original && snapshot.state === "active" && !sameTarget(original.scope, scope) ? this.sourceCapability(structuredClone(original), generation, getController, controller) : null;
      return Object.freeze({ capability, source });
    } finally { if (this.opening === token) this.opening = null; }
  }
  private sourceCapability(original: GoalImageUploadMetadata, generation: number, getController: () => Controller | null, controller: Controller): GoalImageSourceCapability {
    const originalKey = sourceKey(original), before = this.fence(generation, getController, controller);
    const project = (handle: GoalImageUploadCoordinator): GoalImageSourceView => {
      const snapshot = handle.view(), value = snapshot.attempt;
      if (!value || snapshot.state === "empty" || sourceKey(value) !== originalKey) throw new GoalImageUploadError("STALE");
      return { state: snapshot.state, phase: value.phase, name: value.selection.name, mime: value.selection.mime, bytes: value.selection.size };
    };
    return Object.freeze({ describe: (): GoalImageSourceView => { before(); return { state: "active", phase: original.phase, name: original.selection.name, mime: original.selection.mime, bytes: original.selection.size }; }, open: async (): Promise<GoalImageSourceHandle> => {
      before(); const nextGeneration = this.invalidate(), guard = this.fence(nextGeneration, getController, controller);
      const handle = await this.coordinator(Object.freeze(decodeGoalImageUploadScope(original.scope)), nextGeneration, getController, controller);
      try { guard(); project(handle); } catch (error) { handle.dispose(); this.handles.delete(handle); throw error; }
      let alive = true; const live = () => { guard(); if (!alive) throw new GoalImageUploadError("SESSION_CHANGED"); };
      return Object.freeze({ current: () => { try { live(); return true; } catch { return false; } }, view: () => { live(); return project(handle); }, reselect: async (file: File) => { live(); await handle.reselect(file); live(); project(handle); }, resume: async (): Promise<"ready" | "need-file" | "held" | "stale"> => { live(); const snapshot = handle.view(); if (!this.enabled() && !["finalizing", "ready-unbound"].includes(snapshot.attempt?.phase ?? "")) throw new GoalImageUploadError("UNAVAILABLE"); const result = await handle.resume(); live(); project(handle); if (result.kind === "ready") { handle.inspectReady(result.proof, original.scope); live(); return "ready"; } return result.kind; }, dispose: () => { alive = false; handle.dispose(); this.handles.delete(handle); } });
    } });
  }
  dispose() { this.invalidate(); this.alive = false; this.journal?.dispose(); void this.journalPending?.then(value => value.dispose(), () => undefined); this.journal = null; this.editorScope = null; }
}
