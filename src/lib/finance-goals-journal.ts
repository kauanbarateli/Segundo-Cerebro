import { assinatura } from "../core/contracts/base";
import type { GoalCommand } from "../core/financeiro/goals/goal-types";
import { decodeGoalCommand } from "../core/financeiro/goals/goal-validation";
import type { GoalJournalView, GoalPending } from "./finance-goals-client-contract";
import { consumeGoalTerminalProof, inspectGoalTerminalProof, type GoalTerminalProof } from "./finance-goals-terminal-browser";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const bytes = (text: string) => new TextEncoder().encode(text).length;
export type GoalsJournalCode = "UNAVAILABLE" | "CORRUPT" | "PENDING" | "RECONFIRM" | "SESSION_CHANGED" | "CLOSED";
export class GoalsJournalError extends Error {
  constructor(readonly code: GoalsJournalCode) { super(code); this.name = "GoalsJournalError"; }
}
export interface GoalsJournalStorage { keys(): readonly string[]; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface GoalsJournalEnvironment {
  storage: GoalsJournalStorage; uuid(): string;
  exclusive<T>(name: string, work: () => Promise<T>): Promise<T>;
  subscribe?(listener: () => void): () => void;
}
interface Epoch { version: 1; ownerId: string; epoch: string; reconfirmRequired: boolean; originFence: string }
interface Entry extends GoalPending { version: 1; ownerId: string; epoch: string }
export interface GoalsJournalLease {
  snapshot(): GoalJournalView;
  stage(intent: GoalCommand): void;
  uncertain(intent: GoalCommand): void;
  confirmed(intent: GoalCommand): void;
  recognizeTerminal(proof: GoalTerminalProof, original: GoalCommand): void;
  acknowledgeReview(): void;
}
const same = (a: GoalCommand, b: GoalCommand) => assinatura(a) === assinatura(b);

/** Durable owner-scoped intention. No restore/open operation dispatches HTTP. */
export class FinanceGoalsJournal {
  private readonly prefix: string;
  private boundEpoch: string | null = null;
  private revoked = false;
  constructor(readonly ownerId: string, private readonly environment: GoalsJournalEnvironment) {
    if (!UUID.test(ownerId)) throw new GoalsJournalError("UNAVAILABLE");
    this.prefix = `segundo-cerebro:finance-goals:v1:${ownerId}:`;
  }
  private raw(key: string): string | null { try { return this.environment.storage.getItem(this.prefix + key); } catch { throw new GoalsJournalError("UNAVAILABLE"); } }
  private put(key: string, value: unknown) {
    const text = JSON.stringify(value);
    try { this.environment.storage.setItem(this.prefix + key, text); if (this.environment.storage.getItem(this.prefix + key) !== text) throw Error("READBACK"); } catch { throw new GoalsJournalError("UNAVAILABLE"); }
  }
  private remove(key: string) { try { this.environment.storage.removeItem(this.prefix + key); if (this.environment.storage.getItem(this.prefix + key) !== null) throw Error("READBACK"); } catch { throw new GoalsJournalError("UNAVAILABLE"); } }
  private mark(key: string) { try { this.environment.storage.setItem(this.prefix + key, "1"); if (this.environment.storage.getItem(this.prefix + key) !== "1") throw Error("READBACK"); } catch { throw new GoalsJournalError("UNAVAILABLE"); } }
  private marked(key: string) { const value = this.raw(key); if (value !== null && value !== "1") throw new GoalsJournalError("CORRUPT"); return value === "1"; }
  private keys(): readonly string[] { try { const result = this.environment.storage.keys(); if (result.length > 10_000) throw Error("QUOTA"); return result; } catch { throw new GoalsJournalError("UNAVAILABLE"); } }
  private originFence() {
    const suffix = this.prefix + "empty-revoked:", ids = this.keys().filter(key => key.startsWith(suffix)).map(key => key.slice(suffix.length)).sort();
    if (ids.length > 128 || ids.some(id => !UUID.test(id) || !this.marked("empty-revoked:" + id))) throw new GoalsJournalError("CORRUPT");
    return ids.join(",");
  }
  private parseEpoch(raw: string): Epoch {
    try {
      if (bytes(raw) > 16 * 1024) throw Error("QUOTA"); const value: unknown = JSON.parse(raw);
      if (!record(value) || !exact(value, ["version", "ownerId", "epoch", "reconfirmRequired", "originFence"]) || value.version !== 1 || value.ownerId !== this.ownerId || typeof value.epoch !== "string" || !UUID.test(value.epoch) || typeof value.reconfirmRequired !== "boolean" || typeof value.originFence !== "string") throw Error("SHAPE");
      const ids = value.originFence === "" ? [] : value.originFence.split(",");
      if (ids.length > 128 || ids.some(id => !UUID.test(id)) || [...new Set(ids)].sort().join(",") !== value.originFence) throw Error("FENCE");
      return { version: 1, ownerId: this.ownerId, epoch: value.epoch, reconfirmRequired: value.reconfirmRequired, originFence: value.originFence };
    } catch { throw new GoalsJournalError("CORRUPT"); }
  }
  private orphan() { return this.keys().some(key => key === this.prefix + "pending" || key.startsWith(this.prefix + "pending:")); }
  private reconfirm(meta: Epoch) { return this.marked("uncertain:" + meta.epoch) || meta.reconfirmRequired && !this.marked("ack:" + meta.epoch); }
  private metadata(create: boolean): Epoch {
    const raw = this.raw("epoch");
    if (raw === null) {
      if (!create) throw new GoalsJournalError("SESSION_CHANGED"); if (this.orphan()) throw new GoalsJournalError("CORRUPT");
      const epoch = this.environment.uuid(); if (!UUID.test(epoch)) throw new GoalsJournalError("UNAVAILABLE");
      this.mark("alive:" + epoch); this.put("epoch", { version: 1, ownerId: this.ownerId, epoch, reconfirmRequired: false, originFence: this.originFence() });
      return this.metadata(false);
    }
    const meta = this.parseEpoch(raw), alive = this.marked("alive:" + meta.epoch);
    if (alive && !this.marked("revoked:" + meta.epoch) && meta.originFence === this.originFence()) return meta;
    if (!create) throw new GoalsJournalError("SESSION_CHANGED");
    const epoch = this.environment.uuid(); if (!UUID.test(epoch)) throw new GoalsJournalError("UNAVAILABLE");
    const next: Epoch = { version: 1, ownerId: this.ownerId, epoch, reconfirmRequired: !alive || this.reconfirm(meta) || this.raw("pending:" + meta.epoch) !== null, originFence: this.originFence() };
    this.remove("pending:" + meta.epoch); this.mark("alive:" + epoch); this.put("epoch", next); return this.metadata(false);
  }
  private current(): Epoch {
    if (this.revoked || this.boundEpoch === null) throw new GoalsJournalError("SESSION_CHANGED");
    const value = this.metadata(false); if (value.epoch !== this.boundEpoch) throw new GoalsJournalError("SESSION_CHANGED"); return value;
  }
  private entry(meta: Epoch): Entry | null {
    const raw = this.raw("pending:" + meta.epoch); if (raw === null) return null;
    try {
      if (bytes(raw) > 66 * 1024) throw Error("QUOTA"); const value: unknown = JSON.parse(raw);
      if (!record(value) || !exact(value, ["version", "ownerId", "epoch", "intent", "phase"]) || value.version !== 1 || value.ownerId !== this.ownerId || value.epoch !== meta.epoch || value.phase !== "staged" && value.phase !== "uncertain") throw Error("SHAPE");
      const intent = decodeGoalCommand(value.intent); if (bytes(JSON.stringify(intent)) > 64 * 1024) throw Error("QUOTA");
      return { version: 1, ownerId: this.ownerId, epoch: meta.epoch, intent, phase: value.phase };
    } catch { throw new GoalsJournalError("CORRUPT"); }
  }
  private write(entry: Entry) {
    this.current();
    try { this.put("pending:" + entry.epoch, entry); this.current(); }
    catch (error) {
      try { this.current(); } catch (changed) { try { this.remove("pending:" + entry.epoch); } catch { /* Old epoch remains rejected; never touch e2. */ } throw changed; }
      throw error;
    }
  }
  get epoch(): string { return this.current().epoch; }
  assertSession() { this.current(); }
  captureFence(): () => void { const epoch = this.current().epoch; return () => { if (this.current().epoch !== epoch) throw new GoalsJournalError("SESSION_CHANGED"); }; }
  snapshot(): GoalJournalView {
    const meta = this.current(), entry = this.entry(meta); this.current();
    return structuredClone({ ownerId: this.ownerId, epoch: meta.epoch, reconfirmRequired: this.reconfirm(meta), pending: entry === null ? null : { intent: entry.intent, phase: entry.phase } });
  }
  subscribe(listener: () => void): () => void { return this.environment.subscribe?.(listener) ?? (() => undefined); }
  async open(): Promise<GoalJournalView> { return this.exclusive(async lease => lease.snapshot()); }
  async exclusive<T>(work: (lease: GoalsJournalLease) => Promise<T>): Promise<T> {
    if (this.revoked) throw new GoalsJournalError("SESSION_CHANGED");
    return this.environment.exclusive(this.prefix + "lock", async () => {
      if (this.revoked) throw new GoalsJournalError("SESSION_CHANGED"); const meta = this.metadata(this.boundEpoch === null); this.boundEpoch ??= meta.epoch; this.current(); this.entry(meta);
      let active = true;
      const guard = () => { if (!active) throw new GoalsJournalError("CLOSED"); this.current(); };
      const pending = (intent: GoalCommand) => { guard(); const entry = this.entry(this.current()); if (!entry || !same(entry.intent, intent)) throw new GoalsJournalError("PENDING"); return entry; };
      const lease: GoalsJournalLease = {
        snapshot: () => { guard(); return this.snapshot(); },
        stage: input => {
          guard(); const intent = decodeGoalCommand(input), value = this.current(); if (bytes(JSON.stringify(intent)) > 64 * 1024) throw new GoalsJournalError("UNAVAILABLE");
          if (this.reconfirm(value)) throw new GoalsJournalError("RECONFIRM"); const existing = this.entry(value);
          if (existing) { if (!same(existing.intent, intent)) throw new GoalsJournalError("PENDING"); return; }
          this.write({ version: 1, ownerId: this.ownerId, epoch: value.epoch, intent, phase: "staged" });
        },
        uncertain: intent => { const entry = pending(intent); this.write({ ...entry, phase: "uncertain" }); },
        confirmed: intent => {
          const entry = pending(intent), value = this.current();
          // Persist the need for a fresh human review BEFORE deleting the body.
          // Invalidate old acknowledgements first; absence/readback failure is
          // never allowed to erase the only durable warning after DELETE.
          this.remove("ack:" + entry.epoch); this.put("epoch", { ...value, reconfirmRequired: true }); guard();
          this.remove("pending:" + entry.epoch); guard();
        },
        recognizeTerminal: (proof, original) => {
          guard(); const intent = decodeGoalCommand(original), value = this.current(), existing = this.entry(value);
          // Refuse B BEFORE acknowledgement invalidation or any metadata/body mutation.
          if (existing && !same(existing.intent, intent)) throw new GoalsJournalError("PENDING");
          inspectGoalTerminalProof(proof, this.ownerId, value.epoch, intent);
          consumeGoalTerminalProof(proof, this.ownerId, value.epoch, intent); guard();
          this.remove("ack:" + value.epoch); this.put("epoch", { ...value, reconfirmRequired: true }); guard();
          // A previous positive A may have removed the body before its readback failed.
          // Only a NEW positive proof reaches this branch; physical null alone never does.
          const remaining = this.entry(this.current());
          if (remaining && !same(remaining.intent, intent)) throw new GoalsJournalError("PENDING");
          if (remaining) this.remove("pending:" + value.epoch);
          guard(); const final = this.snapshot();
          if (final.pending !== null || !final.reconfirmRequired) throw new GoalsJournalError("UNAVAILABLE");
        },
        acknowledgeReview: () => { guard(); const value = this.current(); if (this.entry(value) !== null) throw new GoalsJournalError("PENDING"); this.mark("ack:" + value.epoch); guard(); },
      };
      try { return await work(lease); } finally { active = false; }
    });
  }
  /** Explicit logout/confirmed identity change only. An old handle only redacts its epoch. */
  revoke(): { hadPending: boolean } {
    if (this.revoked && this.boundEpoch === null) return { hadPending: false }; this.revoked = true;
    let epoch = this.boundEpoch, inherited = false;
    if (epoch === null) {
      let raw = this.raw("epoch");
      if (raw === null) {
        if (this.orphan()) throw new GoalsJournalError("CORRUPT");
        const suffix = this.prefix + "alive:", opening = this.keys().filter(key => key.startsWith(suffix)).map(key => key.slice(suffix.length));
        if (opening.some(id => !UUID.test(id))) throw new GoalsJournalError("CORRUPT"); for (const id of opening) this.remove("alive:" + id);
        const nonce = this.environment.uuid(); if (!UUID.test(nonce)) throw new GoalsJournalError("UNAVAILABLE"); this.mark("empty-revoked:" + nonce);
        raw = this.raw("epoch"); if (raw === null) return { hadPending: false }; if (this.parseEpoch(raw).originFence === this.originFence()) return { hadPending: false };
      }
      const value = this.parseEpoch(raw); epoch = value.epoch; this.boundEpoch = epoch; inherited = value.reconfirmRequired && !this.marked("ack:" + epoch);
    } else {
      const raw = this.raw("epoch"); try { const value: unknown = raw === null ? null : JSON.parse(raw); inherited = record(value) && value.epoch === epoch && value.reconfirmRequired === true && !this.marked("ack:" + epoch); } catch { inherited = true; }
    }
    let hadPending = true; try { hadPending = this.raw("pending:" + epoch) !== null; } catch { /* Cannot certify absence. */ }
    // DELETE first: quota must not leave a valid epoch after redacting its warning.
    this.remove("alive:" + epoch);
    try { if (hadPending || inherited) this.mark("uncertain:" + epoch); this.mark("revoked:" + epoch); }
    finally { this.remove("pending:" + epoch); }
    return { hadPending };
  }
}
export function browserFinanceGoalsJournal(ownerId: string): FinanceGoalsJournal {
  if (typeof window === "undefined" || !navigator.locks?.request) throw new GoalsJournalError("UNAVAILABLE");
  let storage: Storage; try { storage = window.localStorage; } catch { throw new GoalsJournalError("UNAVAILABLE"); }
  const prefix = `segundo-cerebro:finance-goals:v1:${ownerId}:`;
  return new FinanceGoalsJournal(ownerId, {
    storage: { keys: () => { const keys: string[] = []; for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key !== null) keys.push(key); } return keys; }, getItem: key => storage.getItem(key), setItem: (key, value) => storage.setItem(key, value), removeItem: key => storage.removeItem(key) },
    uuid: () => crypto.randomUUID(),
    exclusive: async (name, work) => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000); let entered = false;
      try { return await navigator.locks.request(name, { mode: "exclusive", signal: controller.signal }, () => { entered = true; return work(); }); }
      catch (error) { if (entered || error instanceof GoalsJournalError) throw error; throw new GoalsJournalError("UNAVAILABLE"); }
      finally { clearTimeout(timer); }
    },
    subscribe: listener => { const changed = (event: StorageEvent) => { if (event.storageArea === storage && (event.key === null || event.key.startsWith(prefix))) listener(); }; window.addEventListener("storage", changed); return () => window.removeEventListener("storage", changed); },
  });
}
