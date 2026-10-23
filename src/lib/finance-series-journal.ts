import { assinatura } from "../core/contracts/base";
import type { FinanceSeriesCommand } from "../core/financeiro/series/series-types";
import { decodeFinanceSeriesCommand } from "../core/financeiro/series/series-validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export type SeriesJournalCode = "UNAVAILABLE" | "CORRUPT" | "PENDING" | "RECONFIRM" | "SESSION_CHANGED" | "UNCERTAIN" | "CLOSED";
export class SeriesJournalError extends Error {
  constructor(readonly code: SeriesJournalCode) { super(code === "PENDING" || code === "UNCERTAIN" ? "Confira a tentativa pendente antes de preparar outra." : code === "RECONFIRM" ? "Confira seus dados atuais antes de preparar outra tentativa." : code === "SESSION_CHANGED" ? "A sessão mudou. Recarregue para continuar na sua conta." : "O registro local da tentativa não está disponível. Nenhum novo envio deve ser iniciado."); this.name = "SeriesJournalError"; }
}
export interface SeriesJournalStorage { keys(): readonly string[]; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface SeriesJournalEnvironment {
  storage: SeriesJournalStorage; uuid(): string;
  exclusive<T>(name: string, work: () => Promise<T>): Promise<T>;
  subscribe?(listener: () => void): () => void;
}
interface Epoch { version: 2; ownerId: string; epoch: string; reconfirmRequired: boolean; originFence: string }
export interface SeriesJournalEntry { version: 2; ownerId: string; epoch: string; request: FinanceSeriesCommand; status: "prepared" | "unknown" }
export interface SeriesJournalSnapshot { reconfirmRequired: boolean; pending: SeriesJournalEntry | null }
export interface SeriesJournalLease {
  snapshot(): SeriesJournalSnapshot;
  stage(request: FinanceSeriesCommand): { entry: SeriesJournalEntry; created: boolean };
  unknown(request: FinanceSeriesCommand): void;
  confirmed(request: FinanceSeriesCommand): void;
  rejected(request: FinanceSeriesCommand): void;
  acknowledgeReconfirmation(): void;
}
const clone = <T>(value: T): T => structuredClone(value);
const sameRequest = (a: FinanceSeriesCommand, b: FinanceSeriesCommand) => assinatura(a) === assinatura(b);

/** One durable intention per owner. Restoring a journal never sends a command. */
export class FinanceSeriesJournal {
  private readonly prefix: string;
  private epoch: string | null = null;
  private revoked = false;
  constructor(readonly ownerId: string, private readonly environment: SeriesJournalEnvironment) {
    if (!UUID.test(ownerId)) throw new SeriesJournalError("UNAVAILABLE"); this.prefix = `segundo-cerebro:finance-series:v2:${ownerId}:`;
  }
  private raw(key: string): string | null { try { return this.environment.storage.getItem(this.prefix + key); } catch { throw new SeriesJournalError("UNAVAILABLE"); } }
  private put(key: string, value: unknown): void {
    const text = JSON.stringify(value);
    try { this.environment.storage.setItem(this.prefix + key, text); if (this.environment.storage.getItem(this.prefix + key) !== text) throw new Error("READBACK"); } catch { throw new SeriesJournalError("UNAVAILABLE"); }
  }
  private remove(key: string): void { try { this.environment.storage.removeItem(this.prefix + key); if (this.environment.storage.getItem(this.prefix + key) !== null) throw new Error("READBACK"); } catch { throw new SeriesJournalError("UNAVAILABLE"); } }
  private mark(key: string): void { try { this.environment.storage.setItem(this.prefix + key, "1"); if (this.environment.storage.getItem(this.prefix + key) !== "1") throw new Error("READBACK"); } catch { throw new SeriesJournalError("UNAVAILABLE"); } }
  private marked(key: string): boolean { const value = this.raw(key); if (value !== null && value !== "1") throw new SeriesJournalError("CORRUPT"); return value === "1"; }
  private storageKeys(): readonly string[] { try { const keys = this.environment.storage.keys(); if (keys.length > 10000) throw new Error("QUOTA"); return keys; } catch { throw new SeriesJournalError("UNAVAILABLE"); } }
  private emptyFence(): string {
    const keys = this.storageKeys().filter(key => key.startsWith(this.prefix + "empty-revoked:")), ids = keys.map(key => key.slice((this.prefix + "empty-revoked:").length)).sort();
    if (ids.length > 128 || ids.some(id => !UUID.test(id) || !this.marked("empty-revoked:" + id))) throw new SeriesJournalError("CORRUPT"); return ids.join(",");
  }
  private parseEpoch(raw: string): Epoch {
    try { const value: unknown = JSON.parse(raw); if (!object(value) || !exact(value, ["version", "ownerId", "epoch", "reconfirmRequired", "originFence"]) || value.version !== 2 || value.ownerId !== this.ownerId || typeof value.epoch !== "string" || !UUID.test(value.epoch) || typeof value.reconfirmRequired !== "boolean" || typeof value.originFence !== "string") throw new Error("SHAPE");
      const parts = value.originFence === "" ? [] : value.originFence.split(","); if (parts.length > 128 || parts.some(id => !UUID.test(id)) || [...new Set(parts)].sort().join(",") !== value.originFence) throw new Error("SHAPE"); return value as unknown as Epoch;
    } catch { throw new SeriesJournalError("CORRUPT"); }
  }
  private hasOrphanBody() { return this.storageKeys().some(key => key === this.prefix + "pending" || key.startsWith(this.prefix + "pending:")); }
  private needsReconfirmation(meta: Epoch) { return this.marked("uncertain:" + meta.epoch) || meta.reconfirmRequired && !this.marked("ack:" + meta.epoch); }
  private metadata(create: boolean): Epoch {
    const raw = this.raw("epoch");
    if (raw === null) {
      if (!create) throw new SeriesJournalError("SESSION_CHANGED");
      if (this.hasOrphanBody()) throw new SeriesJournalError("CORRUPT");
      const epoch = this.environment.uuid(); if (!UUID.test(epoch)) throw new SeriesJournalError("UNAVAILABLE"); const value: Epoch = { version: 2, ownerId: this.ownerId, epoch, reconfirmRequired: false, originFence: this.emptyFence() };
      // A removable validity sentinel must be durable BEFORE publishing the
      // pointer. Logout can invalidate it even when quota forbids all SETs.
      this.mark("alive:" + epoch); this.put("epoch", value); return this.metadata(false);
    }
    const meta = this.parseEpoch(raw);
    const live = this.marked("alive:" + meta.epoch);
    if (live && !this.marked("revoked:" + meta.epoch) && meta.originFence === this.emptyFence()) return meta;
    if (!create) throw new SeriesJournalError("SESSION_CHANGED");
    // This pointer is written only while holding the owner's Web Lock. A
    // synchronous logout writes an immutable per-epoch tombstone, never here.
    const epoch = this.environment.uuid(); if (!UUID.test(epoch)) throw new SeriesJournalError("UNAVAILABLE");
    const value: Epoch = { version: 2, ownerId: this.ownerId, epoch, reconfirmRequired: !live || this.needsReconfirmation(meta) || this.raw("pending:" + meta.epoch) !== null, originFence: this.emptyFence() };
    this.remove("pending:" + meta.epoch); this.mark("alive:" + epoch); this.put("epoch", value); return this.metadata(false);
  }
  private current(): Epoch {
    if (this.revoked || this.epoch === null) throw new SeriesJournalError("SESSION_CHANGED"); const value = this.metadata(false); if (value.epoch !== this.epoch) throw new SeriesJournalError("SESSION_CHANGED"); return value;
  }
  private entry(meta: Epoch): SeriesJournalEntry | null {
    const raw = this.raw("pending:" + meta.epoch); if (raw === null) return null;
    try {
      if (new TextEncoder().encode(raw).length > 66 * 1024) throw new Error("QUOTA"); const value: unknown = JSON.parse(raw);
      if (!object(value) || !exact(value, ["version", "ownerId", "epoch", "request", "status"]) || value.version !== 2 || value.ownerId !== this.ownerId || value.epoch !== meta.epoch || value.status !== "prepared" && value.status !== "unknown") throw new Error("SHAPE");
      const request = decodeFinanceSeriesCommand(value.request); if (new TextEncoder().encode(JSON.stringify(request)).length > 64 * 1024) throw new Error("QUOTA"); return { version: 2, ownerId: this.ownerId, epoch: meta.epoch, request, status: value.status };
    } catch { throw new SeriesJournalError("CORRUPT"); }
  }
  private writeEntry(entry: SeriesJournalEntry): void {
    this.current();
    try { this.put("pending:" + entry.epoch, entry); this.current(); }
    catch (error) {
      try { this.current(); } catch (changed) {
      // A confirmed logout can race another tab's synchronous storage write.
      // The key itself is bound to this epoch, so cleanup cannot delete e2.
        try { this.remove("pending:" + entry.epoch); } catch { /* Epoch rejection still prevents dispatch. */ }
        throw changed;
      }
      throw error;
    }
  }
  async exclusive<T>(work: (lease: SeriesJournalLease) => Promise<T>): Promise<T> {
    if (this.revoked) throw new SeriesJournalError("SESSION_CHANGED");
    return this.environment.exclusive(this.prefix + "lock", async () => {
      if (this.revoked) throw new SeriesJournalError("SESSION_CHANGED"); const meta = this.metadata(this.epoch === null); this.epoch ??= meta.epoch; this.current(); this.entry(meta);
      let active = true, newlyPrepared: string | null = null;
      const guard = () => { if (!active) throw new SeriesJournalError("CLOSED"); this.current(); };
      const pending = (request: FinanceSeriesCommand) => { guard(); const entry = this.entry(this.current()); if (!entry || !sameRequest(entry.request, request)) throw new SeriesJournalError("PENDING"); return entry; };
      const lease: SeriesJournalLease = {
        snapshot: () => { guard(); const value = this.current(); return clone({ reconfirmRequired: this.needsReconfirmation(value), pending: this.entry(value) }); },
        stage: request => {
          guard(); const decoded = decodeFinanceSeriesCommand(request), value = this.current(); if (new TextEncoder().encode(JSON.stringify(decoded)).length > 64 * 1024) throw new SeriesJournalError("UNAVAILABLE"); if (this.needsReconfirmation(value)) throw new SeriesJournalError("RECONFIRM");
          const existing = this.entry(value); if (existing) { if (!sameRequest(existing.request, decoded)) throw new SeriesJournalError("PENDING"); return { entry: clone(existing), created: false }; }
          const entry: SeriesJournalEntry = { version: 2, ownerId: this.ownerId, epoch: value.epoch, request: decoded, status: "prepared" }; this.writeEntry(entry); newlyPrepared = assinatura(decoded); return { entry: clone(entry), created: true };
        },
        unknown: request => { const entry = pending(request); this.writeEntry({ ...entry, status: "unknown" }); newlyPrepared = null; },
        confirmed: request => { const entry = pending(request); this.remove("pending:" + entry.epoch); guard(); newlyPrepared = null; },
        rejected: request => { const entry = pending(request); if (entry.status === "unknown" || newlyPrepared !== assinatura(request)) throw new SeriesJournalError("UNCERTAIN"); this.remove("pending:" + entry.epoch); guard(); newlyPrepared = null; },
        acknowledgeReconfirmation: () => { guard(); const value = this.current(); if (this.entry(value) !== null) throw new SeriesJournalError("PENDING"); this.mark("ack:" + value.epoch); guard(); },
      };
      try { return await work(lease); } finally { active = false; }
    });
  }
  subscribe(listener: () => void): () => void { return this.environment.subscribe?.(listener) ?? (() => undefined); }
  assertSession(): void { this.current(); }
  snapshot(): SeriesJournalSnapshot { const meta = this.current(), pending = this.entry(meta); this.current(); return clone({ reconfirmRequired: this.needsReconfirmation(meta), pending }); }
  /** Public reads require an explicitly opened, durable epoch. No preview or
   * availability read creates journal state as an implicit side effect. */
  captureFence(): () => void {
    if (this.revoked) throw new SeriesJournalError("SESSION_CHANGED");
    const meta = this.metadata(false); this.epoch ??= meta.epoch; if (this.epoch !== meta.epoch) throw new SeriesJournalError("SESSION_CHANGED");
    return () => { if (this.revoked || this.metadata(false).epoch !== meta.epoch) throw new SeriesJournalError("SESSION_CHANGED"); };
  }
  /** A preview may inspect a prior intention without creating an epoch or write. */
  inspect(): SeriesJournalSnapshot {
    if (this.revoked) throw new SeriesJournalError("SESSION_CHANGED");
    const meta = this.metadata(false); if (this.epoch !== null && this.epoch !== meta.epoch) throw new SeriesJournalError("SESSION_CHANGED");
    const pending = this.entry(meta); if (this.metadata(false).epoch !== meta.epoch) throw new SeriesJournalError("SESSION_CHANGED"); return clone({ reconfirmRequired: this.needsReconfirmation(meta), pending });
  }
  /** Explicit logout/confirmed owner change only; never call for 403/503/off. */
  revoke(): { hadPending: boolean } {
    if (this.revoked && this.epoch === null) return { hadPending: false };
    this.revoked = true;
    // A fresh explicit logout handle observes the current epoch; a bound old
    // handle can redact only its own epoch. Neither rewrites the active pointer.
    let epoch = this.epoch, inherited = false;
    if (epoch === null) {
      let raw = this.raw("epoch");
      if (raw === null) {
        if (this.hasOrphanBody()) throw new SeriesJournalError("CORRUPT");
        // Fence an opening between sentinel and pointer, including quota errors
        // while writing the empty-logout marker. These keys predate this logout.
        const opening = this.storageKeys().filter(key => key.startsWith(this.prefix + "alive:")).map(key => key.slice((this.prefix + "alive:").length));
        if (opening.some(id => !UUID.test(id))) throw new SeriesJournalError("CORRUPT"); for (const id of opening) this.remove("alive:" + id);
        const nonce = this.environment.uuid(); if (!UUID.test(nonce)) throw new SeriesJournalError("UNAVAILABLE"); this.mark("empty-revoked:" + nonce);
        // A first opening may have raced the absent read. Redact only an epoch
        // born before this immutable marker, never a subsequent fresh session.
        raw = this.raw("epoch"); if (raw === null) return { hadPending: false }; const born = this.parseEpoch(raw); if (born.originFence === this.emptyFence()) return { hadPending: false };
      }
      const parsed = this.parseEpoch(raw);
      epoch = parsed.epoch; this.epoch = epoch; inherited = parsed.reconfirmRequired && !this.marked("ack:" + epoch);
    } else { const raw = this.raw("epoch"); try { const parsed: unknown = raw === null ? null : JSON.parse(raw); inherited = object(parsed) && parsed.epoch === epoch && parsed.reconfirmRequired === true && !this.marked("ack:" + epoch); } catch { inherited = true; } }
    let hadPending = true; try { hadPending = this.raw("pending:" + epoch) !== null; } catch { /* Cannot certify absence. */ }
    // Delete FIRST. If this fails, preserve the pending body and fail closed;
    // erasing the only durable warning while the epoch remained valid would
    // allow another tab to stage a fresh UUID. Never delete another epoch.
    this.remove("alive:" + epoch);
    try { if (hadPending || inherited) this.mark("uncertain:" + epoch); this.mark("revoked:" + epoch); }
    finally { this.remove("pending:" + epoch); }
    return { hadPending };
  }
}
export function browserFinanceSeriesJournal(ownerId: string): FinanceSeriesJournal {
  if (typeof window === "undefined" || !navigator.locks?.request) throw new SeriesJournalError("UNAVAILABLE");
  let storage: Storage; try { storage = window.localStorage; } catch { throw new SeriesJournalError("UNAVAILABLE"); }
  const prefix = `segundo-cerebro:finance-series:v2:${ownerId}:`;
  return new FinanceSeriesJournal(ownerId, {
    storage: { keys: () => { const keys: string[] = []; for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key !== null) keys.push(key); } return keys; }, getItem: key => storage.getItem(key), setItem: (key, value) => storage.setItem(key, value), removeItem: key => storage.removeItem(key) }, uuid: () => crypto.randomUUID(), exclusive: async (name, work) => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000); let entered = false;
      try { return await navigator.locks.request(name, { mode: "exclusive", signal: controller.signal }, () => { entered = true; return work(); }); }
      catch (error) { if (error instanceof SeriesJournalError || entered) throw error; throw new SeriesJournalError("UNAVAILABLE"); }
      finally { clearTimeout(timer); }
    },
    subscribe: listener => { const changed = (event: StorageEvent) => { if (event.storageArea === storage && (event.key === null || event.key.startsWith(prefix))) listener(); }; window.addEventListener("storage", changed); return () => window.removeEventListener("storage", changed); },
  });
}
