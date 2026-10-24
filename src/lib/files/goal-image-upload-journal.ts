import { parseGoalJson } from "../finance-goals-json";
import { decodeGoalImageUploadJournalState, decodeGoalImageUploadMetadata, GOAL_IMAGE_UPLOAD_METADATA_BYTES, goalImageUploadRecord, goalImageUploadUuid, mayAdvanceGoalImageUpload, serializeGoalImageUploadJournalState, serializeGoalImageUploadMetadata, type GoalImageUploadJournalSnapshot, type GoalImageUploadMetadata } from "./goal-image-upload-contract";

export type GoalImageUploadJournalCode = "UNAVAILABLE" | "CORRUPT" | "PENDING" | "STALE" | "INVALID" | "SESSION_CHANGED" | "CLOSED";
export class GoalImageUploadJournalError extends Error { constructor(readonly code: GoalImageUploadJournalCode) { super(code); this.name = "GoalImageUploadJournalError"; } }
export interface GoalImageUploadStorage { keys(): readonly string[]; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface GoalImageUploadEnvironment {
  storage: GoalImageUploadStorage; isCurrent(): boolean;
  exclusive<T>(name: string, work: () => Promise<T>): Promise<T>;
}
export interface GoalImageUploadLease {
  snapshot(): GoalImageUploadJournalSnapshot;
  stage(value: unknown): GoalImageUploadJournalSnapshot;
  advance(expected: unknown, change: unknown): GoalImageUploadJournalSnapshot;
}
interface Pointer { version: 1; ownerId: string; epoch: string }
const byteLength = (value: string) => new TextEncoder().encode(value).length;
const same = (left: GoalImageUploadMetadata, right: GoalImageUploadMetadata) => serializeGoalImageUploadMetadata(left) === serializeGoalImageUploadMetadata(right);

/** One durable operational attempt, written as one canonical record before IO.
 * No HTTP, financial journal, retirement authority or automatic clear/rotation.
 * Missing state is never empty; V1 multipart residues stay quarantined. */
export class GoalImageUploadJournal {
  readonly ownerId: string; readonly epoch: string;
  private readonly prefix: string; private opened = false; private closed = false; private revoked = false;
  private heldPrepared: GoalImageUploadMetadata | null = null;
  constructor(ownerId: string, epoch: string, private readonly environment: GoalImageUploadEnvironment) {
    this.ownerId = goalImageUploadUuid(ownerId); this.epoch = goalImageUploadUuid(epoch);
    this.prefix = `segundo-cerebro:goal-image-upload:v1:${this.ownerId}:`;
  }
  private host() { let current = false; try { current = this.environment.isCurrent(); } catch { /* No identity fallback. */ } if (this.closed) throw new GoalImageUploadJournalError("CLOSED"); if (this.revoked || !current) throw new GoalImageUploadJournalError("SESSION_CHANGED"); }
  private raw(key: string): string | null { try { return this.environment.storage.getItem(this.prefix + key); } catch { throw new GoalImageUploadJournalError("UNAVAILABLE"); } }
  private put(key: string, text: string) { try { this.environment.storage.setItem(this.prefix + key, text); if (this.raw(key) !== text) throw Error("READBACK"); } catch { throw new GoalImageUploadJournalError("UNAVAILABLE"); } }
  private remove(key: string) { try { this.environment.storage.removeItem(this.prefix + key); if (this.raw(key) !== null) throw Error("READBACK"); } catch { throw new GoalImageUploadJournalError("UNAVAILABLE"); } }
  private marker(key: string) { const value = this.raw(key); if (value !== null && value !== "1") throw new GoalImageUploadJournalError("CORRUPT"); return value === "1"; }
  private keys(): readonly string[] {
    try { const keys = this.environment.storage.keys(); if (keys.length > 10_000) throw Error("QUOTA"); return keys; }
    catch { throw new GoalImageUploadJournalError("UNAVAILABLE"); }
  }
  private rejectLegacy(keys: readonly string[]) {
    if (keys.some(key => key.startsWith(this.prefix + "admission:") || key.startsWith(this.prefix + "slot:") || key.startsWith(this.prefix + "attempt:"))) throw new GoalImageUploadJournalError("CORRUPT");
  }
  private pointer(): Pointer | null {
    const raw = this.raw("pointer"); if (raw === null) return null;
    try {
      if (byteLength(raw) > 512) throw Error("QUOTA"); const value = goalImageUploadRecord(parseGoalJson(raw, { maxDepth: 1, maxProperties: 3 }), ["version", "ownerId", "epoch"]);
      if (value.version !== 1 || value.ownerId !== this.ownerId || goalImageUploadUuid(value.epoch) !== value.epoch) throw Error("SCOPE");
      return { version: 1, ownerId: this.ownerId, epoch: value.epoch as string };
    } catch { throw new GoalImageUploadJournalError("CORRUPT"); }
  }
  private current() {
    this.host(); const pointer = this.pointer();
    if (!this.opened || pointer?.epoch !== this.epoch || !this.marker("seen:" + this.epoch) || !this.marker("alive:" + this.epoch)) throw new GoalImageUploadJournalError("SESSION_CHANGED");
  }
  assertSession() { this.current(); }
  captureFence(): () => void { this.current(); return () => this.current(); }
  private readState(): GoalImageUploadJournalSnapshot {
    if (["admission:", "slot:", "attempt:"].some(key => this.raw(key + this.epoch) !== null)) throw new GoalImageUploadJournalError("CORRUPT");
    const raw = this.raw("state:" + this.epoch); if (raw === null) throw new GoalImageUploadJournalError("CORRUPT");
    try {
      if (byteLength(raw) > GOAL_IMAGE_UPLOAD_METADATA_BYTES) throw Error("QUOTA");
      const value = decodeGoalImageUploadJournalState(parseGoalJson(raw, { maxDepth: 3, maxProperties: 32 }));
      if (value.ownerId !== this.ownerId || value.epoch !== this.epoch) throw Error("SCOPE");
      return value;
    } catch { throw new GoalImageUploadJournalError("CORRUPT"); }
  }
  snapshot(): GoalImageUploadJournalSnapshot { this.current(); const value = this.readState(); this.current(); return structuredClone(value); }
  private initialize() {
    this.host(); const keys = this.keys(); this.rejectLegacy(keys);
    const pointer = this.pointer(), seen = this.marker("seen:" + this.epoch);
    if (seen) { this.opened = true; this.current(); this.readState(); return; }
    if (pointer?.epoch === this.epoch) throw new GoalImageUploadJournalError("CORRUPT");
    if (pointer !== null) {
      if (this.marker("alive:" + pointer.epoch) || this.raw("state:" + pointer.epoch) !== null) throw new GoalImageUploadJournalError("SESSION_CHANGED");
    } else {
      if (keys.some(key => key.startsWith(this.prefix))) throw new GoalImageUploadJournalError("CORRUPT");
    }
    // Seen is never automatically removed. A missing alive after quota/revoke
    // cannot be silently recreated by another instance of this same epoch.
    this.put("seen:" + this.epoch, "1"); this.host(); this.put("alive:" + this.epoch, "1"); this.host();
    this.put("state:" + this.epoch, serializeGoalImageUploadJournalState({ version: 2, ownerId: this.ownerId, epoch: this.epoch, revision: "0", state: "empty", attempt: null })); this.host();
    this.put("pointer", JSON.stringify({ version: 1, ownerId: this.ownerId, epoch: this.epoch }));
    this.opened = true; this.current(); this.readState();
  }
  async open(): Promise<GoalImageUploadJournalSnapshot> {
    this.host(); const result = await this.environment.exclusive(this.prefix + "lock", async () => { this.host(); this.initialize(); return this.snapshot(); });
    this.current(); return result;
  }
  private decoded(value: unknown): GoalImageUploadMetadata {
    let decoded: GoalImageUploadMetadata; try { decoded = decodeGoalImageUploadMetadata(value); } catch { throw new GoalImageUploadJournalError("INVALID"); }
    if (decoded.scope.ownerId !== this.ownerId || decoded.scope.epoch !== this.epoch) throw new GoalImageUploadJournalError("SESSION_CHANGED");
    return decoded;
  }
  private decodedState(value: unknown): GoalImageUploadJournalSnapshot {
    let decoded: GoalImageUploadJournalSnapshot; try { decoded = decodeGoalImageUploadJournalState(value); } catch { throw new GoalImageUploadJournalError("INVALID"); }
    if (decoded.ownerId !== this.ownerId || decoded.epoch !== this.epoch) throw new GoalImageUploadJournalError("SESSION_CHANGED");
    return decoded;
  }
  private nextRevision(value: string): string { if (value === "9223372036854775807") throw new GoalImageUploadJournalError("INVALID"); return (BigInt(value) + 1n).toString(); }
  private writeState(value: GoalImageUploadJournalSnapshot) {
    this.current();
    try { this.put("state:" + this.epoch, serializeGoalImageUploadJournalState(value)); this.current(); }
    catch (error) {
      // If logout actually retired this epoch during a storage operation, only
      // redact its own body. Dispose/host unmount alone preserves the record.
      try { if (!this.marker("alive:" + this.epoch) || this.pointer()?.epoch !== this.epoch) this.remove("state:" + this.epoch); } catch { /* Cannot certify redaction; never touch another epoch. */ }
      throw error;
    }
  }
  async exclusive<T>(work: (lease: GoalImageUploadLease) => Promise<T>): Promise<T> {
    this.current(); const result = await this.environment.exclusive(this.prefix + "lock", async () => {
      this.current(); this.readState(); let active = true;
      const guard = () => { if (!active) throw new GoalImageUploadJournalError("CLOSED"); this.current(); };
      const lease: GoalImageUploadLease = {
        snapshot: () => { guard(); return this.snapshot(); },
        stage: value => {
          guard(); const prepared = this.decoded(value); if (prepared.phase !== "prepared" || prepared.uploadId !== null) throw new GoalImageUploadJournalError("INVALID");
          const before = this.readState();
          if (this.heldPrepared && !same(this.heldPrepared, prepared)) throw new GoalImageUploadJournalError("PENDING");
          if (before.state === "retirement-review") throw new GoalImageUploadJournalError("PENDING");
          if (before.attempt) {
            if (!same({ ...before.attempt, phase: "prepared", uploadId: null }, prepared)) throw new GoalImageUploadJournalError("PENDING");
            return this.snapshot();
          }
          // A is complete in the single atomic SET BEFORE any caller receives
          // permission to perform IO. No DELETE can lose its identity here.
          this.heldPrepared = structuredClone(prepared);
          this.writeState({ ...before, revision: this.nextRevision(before.revision), state: "active", attempt: prepared }); guard(); return this.snapshot();
        },
        advance: (expected, change) => {
          guard(); const before = this.decodedState(expected), current = this.readState();
          if (serializeGoalImageUploadJournalState(before) !== serializeGoalImageUploadJournalState(current)) throw new GoalImageUploadJournalError("STALE");
          if (current.state !== "active" || !current.attempt) throw new GoalImageUploadJournalError("PENDING");
          let next: GoalImageUploadMetadata;
          try {
            const patch = goalImageUploadRecord(change, ["phase", "uploadId"]);
            next = this.decoded({ ...current.attempt, phase: patch.phase, uploadId: patch.uploadId });
          } catch { throw new GoalImageUploadJournalError("INVALID"); }
          if (!mayAdvanceGoalImageUpload(current.attempt.phase, next.phase) || (current.attempt.uploadId !== null && next.uploadId !== current.attempt.uploadId)) throw new GoalImageUploadJournalError("INVALID");
          this.writeState({ ...current, revision: this.nextRevision(current.revision), attempt: next }); guard(); return this.snapshot();
        },
      };
      try { const result = await work(lease); guard(); return result; } finally { active = false; }
    });
    this.current(); return result;
  }
  dispose() { this.closed = true; this.heldPrepared = null; }
  /** Explicit logout/confirmed identity change only. No SET is needed to revoke:
   * removing alive invalidates all handles even when quota rejects every SET. */
  revokeIdentity(): { hadProtectedAttempt: boolean } {
    this.revoked = true; this.heldPrepared = null; let hadProtectedAttempt = true;
    try { hadProtectedAttempt = this.readState().attempt !== null; } catch { /* Absence is not certified. */ }
    this.remove("alive:" + this.epoch); this.remove("state:" + this.epoch);
    return { hadProtectedAttempt };
  }
}

/** Concrete localStorage + native Web Locks only; opening performs zero HTTP.
 * The host supplies the confirmed owner/financial-epoch guard and owns logout. */
export async function browserGoalImageUploadJournal(ownerId: string, epoch: string, isCurrent: () => boolean): Promise<GoalImageUploadJournal> {
  if (typeof window === "undefined" || !navigator.locks?.request) throw new GoalImageUploadJournalError("UNAVAILABLE");
  let storage: Storage; try { storage = window.localStorage; } catch { throw new GoalImageUploadJournalError("UNAVAILABLE"); }
  const journal = new GoalImageUploadJournal(ownerId, epoch, {
    isCurrent, storage: { keys: () => { const keys: string[] = []; for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key !== null) keys.push(key); if (keys.length > 10_000) throw new GoalImageUploadJournalError("UNAVAILABLE"); } return keys; }, getItem: key => storage.getItem(key), setItem: (key, text) => storage.setItem(key, text), removeItem: key => storage.removeItem(key) },
    exclusive: async (name, work) => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000); let entered = false;
      try { return await navigator.locks.request(name, { mode: "exclusive", signal: controller.signal }, () => { entered = true; return work(); }); }
      catch (error) { if (entered || error instanceof GoalImageUploadJournalError) throw error; throw new GoalImageUploadJournalError("UNAVAILABLE"); }
      finally { clearTimeout(timer); }
    },
  });
  await journal.open(); journal.assertSession(); return journal;
}
