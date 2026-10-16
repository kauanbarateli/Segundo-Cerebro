import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";
import { PERSONAL_REF } from "./backup-config.mjs";
import { managedRestoreRequirements } from "./restore-managed-plan.mjs";

// Same database bound as INSPECTION_LIMITS; 180 s = 4 x the 45 s absolute
// inspection/stream budget. No default lifetime: the single reviewed mint site
// chooses it explicitly. Tests pin both values to the inspector constants.
export const MANAGED_SNAPSHOT_LIMITS = Object.freeze({ databaseBytes: 64 * 1024 * 1024, maxLifetimeMs: 180000 });
export const MANAGED_SNAPSHOT_ERROR_CODES = Object.freeze(["RESTORE_MANAGED_SNAPSHOT_INVALID", "RESTORE_MANAGED_SNAPSHOT_REQUIRED", "RESTORE_MANAGED_SNAPSHOT_REUSED", "RESTORE_MANAGED_SNAPSHOT_EXPIRED", "RESTORE_MANAGED_SNAPSHOT_DISCARDED", "RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID", "RESTORE_MANAGED_PLAN_REQUIRED", "RESTORE_MANAGED_DATABASE_INVALID", "BACKUP_IDENTITY_MISMATCH"]);
const INVALID = "RESTORE_MANAGED_SNAPSHOT_INVALID", REQUIRED = "RESTORE_MANAGED_SNAPSHOT_REQUIRED", REUSED = "RESTORE_MANAGED_SNAPSHOT_REUSED", EXPIRED = "RESTORE_MANAGED_SNAPSHOT_EXPIRED", DISCARDED = "RESTORE_MANAGED_SNAPSHOT_DISCARDED", SWAPPED = "RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID", DATABASE_INVALID = "RESTORE_MANAGED_DATABASE_INVALID";
const SOURCE_FIELDS = ["database", "sourceProjectRef", "keyId", "createdAt", "lifetimeMs"];
// Captured at import: the call primitive, the typed-array intrinsics that
// measure/copy/wipe, the WeakMap/WeakSet identity methods, the hash, the
// Proxy/SAB checks, the promise outcomes and the monotonic clock. Later
// replacement of these, or own/subclass overrides on caller objects, cannot
// change identity, binding, wipe or lifetime. Same-realm code that runs BEFORE
// this import, or that tampers other built-ins, is outside this guarantee,
// as for every other module in the same runtime. No timer is ever created.
const apply = Reflect.apply, uncurry = fn => (self, ...args) => apply(fn, self, args);
const Bytes = Uint8Array, Store = ArrayBuffer, typedArray = Object.getPrototypeOf(Uint8Array.prototype), getter = name => uncurry(Object.getOwnPropertyDescriptor(typedArray, name).get);
const tagOf = getter(Symbol.toStringTag), byteLengthOf = getter("byteLength"), bufferOf = getter("buffer"), copyInto = uncurry(typedArray.set), fillWith = uncurry(typedArray.fill);
const mapGet = uncurry(WeakMap.prototype.get), mapSet = uncurry(WeakMap.prototype.set), setHas = uncurry(WeakSet.prototype.has), setAdd = uncurry(WeakSet.prototype.add);
const newHash = createHash, hashPrototype = Object.getPrototypeOf(createHash("sha256")), hashUpdate = uncurry(hashPrototype.update), hashDigest = uncurry(hashPrototype.digest);
const { isProxy, isSharedArrayBuffer } = types, isSafeInteger = Number.isSafeInteger, now = performance.now.bind(performance);
const resolved = Promise.resolve.bind(Promise), rejected = Promise.reject.bind(Promise), freeze = Object.freeze;
const snapshots = new WeakMap(), attemptedPlans = new WeakSet();
const fail = code => { throw new BackupError(code); };
const refused = code => rejected(new BackupError(code));
const finished = () => resolved({ value: undefined, done: true });
const digest = bytes => hashDigest(hashUpdate(newHash("sha256"), bytes), "hex");

function wipe(bytes) {
  try { fillWith(bytes, 0); } catch { /* A consumer-detached store has no readable bytes left here. */ }
}
// First terminal reason is sticky. True only when owned plaintext was wiped
// here; a store the consumer already transferred out reports false.
function release(record, reason) {
  record.end ??= reason;
  if (!record.owned) return false;
  const intact = byteLengthOf(record.owned) === record.length;
  wipe(record.owned); record.owned = null;
  return intact;
}
function closedSource(value) {
  // isProxy first: a revoked Proxy must refuse, not throw from Array.isArray.
  if (isProxy(value) || !value || typeof value !== "object") fail(INVALID);
  const data = Object.create(null);
  try {
    if (Array.isArray(value)) fail(INVALID);
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.length !== SOURCE_FIELDS.length || keys.some(key => !SOURCE_FIELDS.includes(key))) fail(INVALID);
    for (const field of SOURCE_FIELDS) {
      const descriptor = descriptors[field];
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) fail(INVALID);
      data[field] = descriptor.value;
    }
  } catch { fail(INVALID); }
  return data;
}
// Identity only. Lazy expiry and a swapped plan wipe in ANY state, including
// a claimed in-flight view; the code then follows: reuse, expiry, an earlier
// discard, swap. A swapped plan is evidence of misuse, so plaintext is wiped.
function usable(plan, snapshot) {
  const record = mapGet(snapshots, snapshot);
  if (!record) fail(REQUIRED);
  const previous = record.end, swapped = record.plan !== plan;
  if (!previous && now() >= record.deadline) release(record, "expired");
  if (swapped) release(record, "discarded");
  if (record.claimed) fail(REUSED);
  if (record.end === "expired") fail(EXPIRED);
  if (previous) fail(DISCARDED);
  if (swapped) fail(SWAPPED);
  return record;
}

/**
 * Binds ONE owned RAM copy of the database entry to the ORIGINAL plan object,
 * its archive/database/TOC hashes, the header identity and a bounded lifetime.
 * Every hash comes from the plan itself; booleans or JSON reports never mint.
 * This does NOT prove AEAD/footer/manifest authentication: the reviewed
 * inspector must be the only caller, after full authentication and planning.
 * The caller's buffer is never kept, detached or modified.
 */
export function mintManagedSnapshot(plan, source) {
  const requirements = managedRestoreRequirements(plan);
  // Every attempt spends the plan, so a refused mint is never retried.
  if (setHas(attemptedPlans, plan)) fail(REUSED);
  setAdd(attemptedPlans, plan);
  const start = now(), data = closedSource(source);
  if (!isSafeInteger(data.lifetimeMs) || data.lifetimeMs < 1 || data.lifetimeMs > MANAGED_SNAPSHOT_LIMITS.maxLifetimeMs) fail(INVALID);
  if (data.sourceProjectRef !== PERSONAL_REF) fail("BACKUP_IDENTITY_MISMATCH");
  if (typeof data.keyId !== "string" || !/^[A-Za-z0-9_-]{1,50}$/.test(data.keyId)) fail(INVALID);
  if (typeof data.createdAt !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:[.][0-9]{1,6})?Z$/.test(data.createdAt) || !Number.isFinite(Date.parse(data.createdAt))) fail(INVALID);
  const length = requirements.databaseBytes, database = data.database;
  if (length > MANAGED_SNAPSHOT_LIMITS.databaseBytes || isProxy(database) || tagOf(database) !== "Uint8Array" || isSharedArrayBuffer(bufferOf(database))) fail(INVALID);
  if (byteLengthOf(database) !== length) fail(DATABASE_INVALID);
  let owned;
  try {
    // Dedicated store, never the Buffer pool. Copy FIRST, then verify the copy.
    owned = new Bytes(new Store(length)); copyInto(owned, database);
  } catch { if (owned) wipe(owned); fail(DATABASE_INVALID); }
  if (owned[0] !== 0x50 || owned[1] !== 0x47 || owned[2] !== 0x44 || owned[3] !== 0x4d || owned[4] !== 0x50 || digest(owned) !== requirements.databaseSha256) { wipe(owned); fail(DATABASE_INVALID); }
  if (now() >= start + data.lifetimeMs) { wipe(owned); fail(EXPIRED); }
  const facts = freeze(Object.assign(Object.create(null), { archiveSha256: requirements.archiveSha256, databaseSha256: requirements.databaseSha256, databaseBytes: length, tocSha256: requirements.tocSha256, sourceProjectRef: data.sourceProjectRef, keyId: data.keyId, createdAt: data.createdAt }));
  const snapshot = freeze({});
  mapSet(snapshots, snapshot, { plan, owned, length, deadline: start + data.lifetimeMs, facts, claimed: false, end: null });
  return snapshot;
}

/** Non-consuming binding check for authorization/qualification. Returns the
 * SAME frozen private facts (never a public report, never accepted back as
 * authority); it neither renews the lifetime nor exposes plaintext. */
export function checkManagedSnapshot(plan, snapshot) {
  return usable(plan, snapshot).facts;
}

/**
 * Single use. Returns a one-shot async iterable compatible with the current
 * runManagedRestore databaseSource: one view over the owned store, then the
 * owned bytes are wiped on the following pull or on return(). Expiry/discard
 * reject every pull and never report a truncated stream as complete. The
 * consumer must copy the chunk before pulling again, as the stream does.
 * There is no non-consuming byte reader: archive-side qualification facts
 * must be derived inside the inspector BEFORE mint.
 */
export function claimManagedSnapshot(plan, snapshot) {
  const record = usable(plan, snapshot);
  record.claimed = true;
  let opened = false, yielded = false;
  const next = () => {
    if (!record.end && now() >= record.deadline) release(record, "expired");
    if (record.end === "expired") return refused(EXPIRED);
    if (record.end === "discarded") return refused(DISCARDED);
    if (record.end === "consumed") return finished();
    if (!yielded) { yielded = true; return resolved({ value: new Bytes(bufferOf(record.owned), 0, record.length), done: false }); }
    // A detached store means the consumer took the bytes out of this lifetime.
    if (byteLengthOf(record.owned) !== record.length) { release(record, "discarded"); return refused(DISCARDED); }
    release(record, "consumed");
    return finished();
  };
  // return() never rejects, so it cannot mask the consumer's own failure.
  const iterator = freeze({ next, return() { release(record, "discarded"); return finished(); } });
  return freeze({ [Symbol.asyncIterator]() { if (opened) fail(REUSED); opened = true; return iterator; } });
}

/** Total and idempotent; safe in any finally. Foreign values return false
 * without throwing or touching them. True only when plaintext was wiped. */
export function discardManagedSnapshot(snapshot) {
  const record = mapGet(snapshots, snapshot);
  return record ? release(record, "discarded") : false;
}
