import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { inspect } from "node:util";
import { fileURLToPath } from "node:url";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { INSPECTION_LIMITS } from "../../scripts/operations/restore-managed-inspect.mjs";
import { planManagedRestore, managedRestoreRequirements, authorizeManagedRestore } from "../../scripts/operations/restore-managed-plan.mjs";
import { runManagedRestore } from "../../scripts/operations/restore-managed-stream.mjs";
import * as capability from "../../scripts/operations/restore-managed-snapshot-capability.mjs";

const { MANAGED_SNAPSHOT_LIMITS, MANAGED_SNAPSHOT_ERROR_CODES, mintManagedSnapshot, checkManagedSnapshot, claimManagedSnapshot, discardManagedSnapshot } = capability;
// Artificial RAM only: a synthetic PGDMP-prefixed buffer, a synthetic PG18
// verbose TOC and fake process seams. No archive, profile, key, pg_restore,
// psql, filesystem write, HTTP or hosted database is used by these controls.
const hash = value => createHash("sha256").update(value).digest("hex"), canary = "PRIVATE_CANARY_NEVER_REPORT";
const database = Buffer.from("PGDMP_SYNTHETIC_SNAPSHOT_" + canary), plaintextHex = database.toString("hex");
const rows = [[1, "TABLE", "auth", "users", "auth_owner", []], [2, "TABLE", "storage", "objects", "storage_owner", []], [3, "TABLE", "storage", "buckets", "storage_owner", []], [4, "TABLE DATA", "auth", "users", "auth_owner", [1]], [5, "TRIGGER", "auth", "users second_brain_identity_created", "postgres", [1]], [6, "TRIGGER", "auth", "users second_brain_admin_creation_final", "postgres", [1]], [7, "POLICY", "storage", "objects second_brain_private_objects", "storage_owner", [2]], [8, "POLICY", "storage", "buckets second_brain_private_buckets", "storage_owner", [3]]];
const toc = ";     TOC Entries: 8\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n" + rows.map(([id, type, schema, tag, owner, dependencies]) => `${id}; 0 0 ${type} ${schema} ${tag} ${owner}\n` + (dependencies.length ? ";\tdepends on: " + dependencies.join(" ") + "\n" : "")).join("");
const plan = (bytes = database) => planManagedRestore(toc, { archiveSha256: "a".repeat(64), databaseSha256: hash(bytes), databaseBytes: bytes.length });
const source = overrides => ({ database, sourceProjectRef: PERSONAL_REF, keyId: "fixture-v1", createdAt: "2026-10-13T00:00:00Z", lifetimeMs: 60000, ...overrides });
const minted = (overrides = {}) => { const selected = plan(overrides.database); return { plan: selected, snapshot: mintManagedSnapshot(selected, source(overrides)) }; };
const zero = bytes => bytes.every(byte => byte === 0);
const clock = performance.now.bind(performance), spin = milliseconds => { const until = clock() + milliseconds; while (clock() < until) { /* real monotonic time, no timer */ } };
const closedRefusal = (error, code) => {
  assert.equal(error instanceof BackupError, true); assert.equal(Object.getOwnPropertyDescriptor(error, "code")?.value, code); assert.equal(error.message, code);
  assert.equal(MANAGED_SNAPSHOT_ERROR_CODES.includes(code), true); assert.equal(Object.hasOwn(error, "cause"), false);
  for (const text of [error.stack, JSON.stringify(error), inspect(error)]) { assert.equal(text.includes(canary), false); assert.equal(text.includes(plaintextHex), false); }
  return true;
};
const refusal = (fn, code) => assert.throws(fn, error => closedRefusal(error, code));
const rejection = (promise, code) => assert.rejects(promise, error => closedRefusal(error, code));
const counting = target => { const counter = { traps: 0 }; const trap = name => (...args) => { counter.traps++; return Reflect[name](...args); }; counter.proxy = new Proxy(target, Object.fromEntries(["get", "has", "ownKeys", "getOwnPropertyDescriptor", "getPrototypeOf", "defineProperty", "set", "apply"].map(name => [name, trap(name)]))); return counter; };
const originalFetch = globalThis.fetch; let networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw new Error("EXTERNAL_NETWORK_FORBIDDEN"); };
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });

test("import and the whole mint/check/claim/consume/discard lifecycle start no process, filesystem, network, timer or handle", () => {
  const url = name => new URL("../../scripts/operations/" + name, import.meta.url).href;
  // Async fs/process/network entry points are refused BEFORE import; sync fs is
  // refused only after import because the ESM loader itself reads the sources.
  const script = `import cp from "node:child_process"; import fs from "node:fs"; import fsp from "node:fs/promises"; import net from "node:net"; import tls from "node:tls"; import http from "node:http"; import https from "node:https"; import dns from "node:dns"; import { createHash } from "node:crypto"; import { syncBuiltinESMExports } from "node:module";
let calls = 0; const refuse = () => { calls++; throw Error("FORBIDDEN"); };
const patch = (target, filter) => { for (const name of Object.keys(target)) { const descriptor = Object.getOwnPropertyDescriptor(target, name); if (descriptor?.writable && typeof descriptor.value === "function" && !/^[A-Z]/.test(name) && filter(name)) target[name] = refuse; } };
patch(cp, () => true); patch(fsp, () => true); patch(fs, name => !name.endsWith("Sync")); patch(net, () => true); patch(tls, () => true); patch(http, () => true); patch(https, () => true); patch(dns, () => true); syncBuiltinESMExports(); globalThis.fetch = refuse;
const resources = () => process.getActiveResourcesInfo().sort().join(","), before = resources();
const capability = await import(${JSON.stringify(url("restore-managed-snapshot-capability.mjs"))}); const { planManagedRestore } = await import(${JSON.stringify(url("restore-managed-plan.mjs"))});
patch(fs, () => true); for (const name of ["setTimeout", "setInterval", "setImmediate", "queueMicrotask"]) globalThis[name] = refuse; syncBuiltinESMExports();
const database = Buffer.from("PGDMP_INERT"), plan = planManagedRestore(${JSON.stringify(toc)}, { archiveSha256: "a".repeat(64), databaseSha256: createHash("sha256").update(database).digest("hex"), databaseBytes: database.length });
const snapshot = capability.mintManagedSnapshot(plan, { database, sourceProjectRef: ${JSON.stringify(PERSONAL_REF)}, keyId: "fixture-v1", createdAt: "2026-10-13T00:00:00Z", lifetimeMs: 60000 });
capability.checkManagedSnapshot(plan, snapshot); let chunks = 0; for await (const chunk of capability.claimManagedSnapshot(plan, snapshot)) chunks += chunk.length; capability.discardManagedSnapshot(snapshot);
if (calls !== 0 || chunks !== database.length || resources() !== before) throw Error("ACTIVE"); process.stdout.write("INERT");`;
  const probe = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { SystemRoot: process.env.SystemRoot }, shell: false, windowsHide: true, encoding: "utf8", timeout: 10000 });
  assert.equal(probe.status, 0); assert.equal(probe.stdout, "INERT"); assert.equal(probe.stderr, "");
});
test("after import, replacing captured primitives cannot forge A1 local state, re-mint, extend its lifetime or skip its wipe; the planner registry remains a separate boundary", () => {
  const url = name => JSON.stringify(new URL("../../scripts/operations/" + name, import.meta.url).href);
  const script = `import crypto from "node:crypto"; import util from "node:util"; import { syncBuiltinESMExports } from "node:module";
const capability = await import(${url("restore-managed-snapshot-capability.mjs")}), { planManagedRestore } = await import(${url("restore-managed-plan.mjs")});
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex"), clock = performance.now.bind(performance), spin = ms => { const until = clock() + ms; while (clock() < until); };
const database = Buffer.from("PGDMP_TAMPER"), wrong = Buffer.from("PGDMP_WRONG!"), shared = new Uint8Array(new SharedArrayBuffer(database.length)); shared.set(database);
const plan = () => planManagedRestore(${JSON.stringify(toc)}, { archiveSha256: "a".repeat(64), databaseSha256: sha(database), databaseBytes: database.length }), plans = Array.from({ length: 8 }, plan), expected = sha(database);
const source = overrides => ({ database, sourceProjectRef: ${JSON.stringify(PERSONAL_REF)}, keyId: "fixture-v1", createdAt: "2026-10-13T00:00:00Z", lifetimeMs: 60000, ...overrides });
const code = fn => { try { fn(); return "ACCEPTED"; } catch (error) { return Object.getOwnPropertyDescriptor(error, "code")?.value ?? "RAW"; } };
const typed = Object.getPrototypeOf(Uint8Array.prototype), realApply = Reflect.apply, forged = { plan: plans[0], owned: new Uint8Array(4), length: 4, deadline: Infinity, facts: {}, claimed: false, end: null };
Reflect.apply = (fn, self, args) => fn === typed.fill ? self : realApply(fn, self, args); typed.fill = function () { return this; }; typed.set = function () {};
for (const name of ["byteLength", "buffer"]) Object.defineProperty(typed, name, { configurable: true, get() { return undefined; } });
const realGet = WeakMap.prototype.get; WeakMap.prototype.get = function (key) { return key?.forged ? forged : realApply(realGet, this, [key]); }; WeakMap.prototype.set = function () { return this; }; WeakSet.prototype.has = () => false; WeakSet.prototype.add = function () { return this; };
const hashPrototype = Object.getPrototypeOf(crypto.createHash("sha256")); hashPrototype.update = function () { return this; }; hashPrototype.digest = () => expected;
crypto.createHash = () => ({ update() { return this; }, digest: () => expected }); util.types.isProxy = () => false; util.types.isSharedArrayBuffer = () => false; syncBuiltinESMExports();
Promise.reject = () => Promise.resolve({ value: undefined, done: true }); Number.isSafeInteger = () => true; performance.now = () => 0;
const results = [code(() => capability.checkManagedSnapshot(plans[0], { forged: true })), String(capability.discardManagedSnapshot({ forged: true }))];
const once = plans[1]; capability.mintManagedSnapshot(once, source()); results.push(code(() => capability.mintManagedSnapshot(once, source())));
results.push(code(() => capability.mintManagedSnapshot(plans[2], source({ database: wrong }))), code(() => capability.mintManagedSnapshot(plans[3], source({ database: shared }))), code(() => capability.mintManagedSnapshot(plans[4], source({ lifetimeMs: 1.5 }))));
const consumed = capability.mintManagedSnapshot(plans[5], source()); let retained; for await (const chunk of capability.claimManagedSnapshot(plans[5], consumed)) retained = chunk;
results.push(retained.every(byte => byte === 0) ? "WIPED" : "LEAKED");
const expiring = capability.mintManagedSnapshot(plans[6], source({ lifetimeMs: 300 })), iterator = capability.claimManagedSnapshot(plans[6], expiring)[Symbol.asyncIterator](), held = (await iterator.next()).value; spin(350);
results.push(await iterator.next().then(() => "TRUNCATED_DONE", error => error.code), held.every(byte => byte === 0) ? "WIPED" : "LEAKED");
const live = capability.mintManagedSnapshot(plans[7], source()), views = capability.claimManagedSnapshot(plans[7], live)[Symbol.asyncIterator](), view = (await views.next()).value;
results.push(String(capability.discardManagedSnapshot(live)), view.every(byte => byte === 0) ? "WIPED" : "LEAKED");
process.stdout.write(JSON.stringify(results));`;
  const probe = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { SystemRoot: process.env.SystemRoot }, shell: false, windowsHide: true, encoding: "utf8", timeout: 10000 });
  assert.equal(probe.stderr, ""); assert.equal(probe.status, 0);
  assert.deepEqual(JSON.parse(probe.stdout), ["RESTORE_MANAGED_SNAPSHOT_REQUIRED", "false", "RESTORE_MANAGED_SNAPSHOT_REUSED", "RESTORE_MANAGED_DATABASE_INVALID", "RESTORE_MANAGED_SNAPSHOT_INVALID", "RESTORE_MANAGED_SNAPSHOT_INVALID", "WIPED", "RESTORE_MANAGED_SNAPSHOT_EXPIRED", "WIPED", "true", "WIPED"]);
});
test("exports, limits and closed codes are frozen and pinned to the existing inspection bounds", () => {
  assert.deepEqual(Object.keys(capability).sort(), ["MANAGED_SNAPSHOT_ERROR_CODES", "MANAGED_SNAPSHOT_LIMITS", "checkManagedSnapshot", "claimManagedSnapshot", "discardManagedSnapshot", "mintManagedSnapshot"]);
  assert.equal(Object.isFrozen(MANAGED_SNAPSHOT_LIMITS), true); assert.deepEqual(Object.keys(MANAGED_SNAPSHOT_LIMITS), ["databaseBytes", "maxLifetimeMs"]);
  assert.equal(MANAGED_SNAPSHOT_LIMITS.databaseBytes, INSPECTION_LIMITS.databaseBytes); assert.equal(MANAGED_SNAPSHOT_LIMITS.maxLifetimeMs, 4 * INSPECTION_LIMITS.timeoutMs);
  assert.equal(Object.isFrozen(MANAGED_SNAPSHOT_ERROR_CODES), true);
  assert.deepEqual([...MANAGED_SNAPSHOT_ERROR_CODES].sort(), ["BACKUP_IDENTITY_MISMATCH", "RESTORE_MANAGED_DATABASE_INVALID", "RESTORE_MANAGED_PLAN_REQUIRED", "RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID", "RESTORE_MANAGED_SNAPSHOT_DISCARDED", "RESTORE_MANAGED_SNAPSHOT_EXPIRED", "RESTORE_MANAGED_SNAPSHOT_INVALID", "RESTORE_MANAGED_SNAPSHOT_REQUIRED", "RESTORE_MANAGED_SNAPSHOT_REUSED"]);
});
test("source guard: inert allowlisted imports, no timer/process/dynamic code, and only the reviewed inspector may mint", async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url)), modulePath = join(root, "scripts", "operations", "restore-managed-snapshot-capability.mjs");
  const text = await readFile(modulePath, "utf8");
  const specifiers = [...text.matchAll(/\bimport\s+[^"'`;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bexport\s+[^"'`;]*?\bfrom\s*["']([^"']+)["']/g)].map(match => match[1] ?? match[2] ?? match[3]);
  assert.deepEqual(specifiers, ["node:crypto", "node:perf_hooks", "node:util", "./backup-format.mjs", "./backup-config.mjs", "./restore-managed-plan.mjs"]);
  assert.equal(/process|require\s*\(|setTimeout|setInterval|setImmediate|\beval\b|Function\s*\(|import\s*\(|fetch|globalThis|node:(?:fs|net|tls|http|https|http2|dns|dgram|cluster|worker_threads|vm|inspector)\b/.test(text), false);
  // Every runtime JS/TS/PowerShell source outside tests/ (tests may mint
  // synthetic snapshots). Root extends nothing here when wiring the single mint
  // into the inspector. Tripwire for literal or accidental use: a namespace,
  // re-export, dynamic or require import could hide a computed mint name.
  const mintSites = [], opaqueImports = [], pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { if (!entry.name.startsWith(".") && !(directory === root && ["node_modules", "tests", "work", "test-results", "playwright-report", "coverage", "skills", "public"].includes(entry.name))) pending.push(path); continue; }
      if (!entry.isFile() || !/\.(?:[cm]?js|[cm]?ts|jsx|tsx|ps1)$/.test(entry.name)) continue;
      const source = await readFile(path, "utf8"), name = relative(root, path).replaceAll("\\", "/");
      if (source.includes("mintManagedSnapshot")) mintSites.push(name);
      if (/import\s*\*\s*as\s+\w+\s+from\s*["'][^"']*restore-managed-snapshot-capability|export\s*\*\s*(?:as\s+\w+\s+)?from\s*["'][^"']*restore-managed-snapshot-capability|(?:import|require)\s*\([^)]*restore-managed-snapshot-capability/.test(source)) opaqueImports.push(name);
    }
  }
  assert.equal(mintSites.includes("scripts/operations/restore-managed-snapshot-capability.mjs"), true);
  assert.deepEqual(mintSites.filter(path => !["scripts/operations/restore-managed-snapshot-capability.mjs", "scripts/operations/restore-managed-inspect.mjs"].includes(path)), []);
  assert.deepEqual(opaqueImports, []);
});
test("a minted capability is opaque and check returns only the same frozen private binding facts", () => {
  const { plan: selected, snapshot } = minted(), requirements = managedRestoreRequirements(selected);
  assert.equal(Object.isFrozen(snapshot), true); assert.deepEqual(Reflect.ownKeys(snapshot), []); assert.equal(JSON.stringify(snapshot), "{}"); assert.equal(inspect(snapshot), "{}");
  const facts = checkManagedSnapshot(selected, snapshot);
  assert.equal(Object.isFrozen(facts), true); assert.equal(Object.getPrototypeOf(facts), null); assert.equal(checkManagedSnapshot(selected, snapshot), facts);
  assert.deepEqual({ ...facts }, { archiveSha256: requirements.archiveSha256, databaseSha256: requirements.databaseSha256, databaseBytes: requirements.databaseBytes, tocSha256: requirements.tocSha256, sourceProjectRef: PERSONAL_REF, keyId: "fixture-v1", createdAt: "2026-10-13T00:00:00Z" });
  assert.equal(Object.values(facts).some(value => typeof value === "boolean"), false); assert.equal(JSON.stringify(facts).includes(canary), false);
  refusal(() => checkManagedSnapshot(selected, facts), "RESTORE_MANAGED_SNAPSHOT_REQUIRED"); assert.equal(discardManagedSnapshot(snapshot), true);
});
test("claim yields the bound bytes once from an owned dedicated copy and zero-fills them after consumption", async () => {
  const caller = Buffer.from(database), { plan: selected, snapshot } = minted({ database: caller });
  caller.fill(0xff); assert.equal(caller.every(byte => byte === 0xff), true); caller.fill(0); // caller keeps its own buffer and its finally fill(0)
  const iterator = claimManagedSnapshot(selected, snapshot)[Symbol.asyncIterator](), first = await iterator.next();
  assert.equal(first.done, false); assert.equal(first.value instanceof Uint8Array, true); assert.equal(first.value.buffer.byteLength, database.length); assert.equal(hash(first.value), hash(database));
  assert.deepEqual(await iterator.next(), { value: undefined, done: true }); assert.equal(zero(first.value), true);
  assert.deepEqual(await iterator.next(), { value: undefined, done: true });
  assert.deepEqual(await iterator.return(), { value: undefined, done: true }); assert.deepEqual(await iterator.next(), { value: undefined, done: true }); // consumed stays consumed
  assert.equal(discardManagedSnapshot(snapshot), false); refusal(() => checkManagedSnapshot(selected, snapshot), "RESTORE_MANAGED_SNAPSHOT_REUSED");
  const pooled = Buffer.from("PGDMP_POOLED"), small = plan(pooled), plain = plan(new Uint8Array(database));
  for (const [chosen, bytes] of [[small, pooled], [plain, new Uint8Array(database)]]) {
    const chunks = []; for await (const chunk of claimManagedSnapshot(chosen, mintManagedSnapshot(chosen, source({ database: bytes })))) chunks.push(Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(chunks), Buffer.from(bytes));
  }
});
test("only a genuine registered plan can mint, and every plan admits exactly one mint attempt", () => {
  const genuine = plan(), probe = counting(genuine), revoked = Proxy.revocable(genuine, {}); revoked.revoke();
  for (const foreign of [revoked.proxy, undefined, null, {}, Object.freeze({ version: 1, selectedEntries: 5, preservedEntries: 3, segments: 5 }), { ...genuine }, structuredClone(genuine), Object.create(genuine), probe.proxy]) refusal(() => mintManagedSnapshot(foreign, source()), "RESTORE_MANAGED_PLAN_REQUIRED");
  assert.equal(probe.traps, 0);
  const once = plan(); mintManagedSnapshot(once, source()); refusal(() => mintManagedSnapshot(once, source()), "RESTORE_MANAGED_SNAPSHOT_REUSED");
  const discarded = minted(); discardManagedSnapshot(discarded.snapshot); refusal(() => mintManagedSnapshot(discarded.plan, source()), "RESTORE_MANAGED_SNAPSHOT_REUSED");
  const refused = plan(); refusal(() => mintManagedSnapshot(refused, source({ lifetimeMs: 0 })), "RESTORE_MANAGED_SNAPSHOT_INVALID"); refusal(() => mintManagedSnapshot(refused, source()), "RESTORE_MANAGED_SNAPSHOT_REUSED");
  const twin = plan(); assert.equal(checkManagedSnapshot(twin, mintManagedSnapshot(twin, source())).tocSha256, managedRestoreRequirements(once).tocSha256);
});
test("mint input is a closed data descriptor: getters, proxies, extras and booleans never grant a snapshot", () => {
  let getters = 0; const denied = value => refusal(() => mintManagedSnapshot(plan(), value), "RESTORE_MANAGED_SNAPSHOT_INVALID");
  for (const value of [null, undefined, "source", [], [database], Object.create(source()), { ...source(), [Symbol("private")]: canary }, { ...source(), toJSON() { return source(); } }]) denied(value);
  for (const extra of [{ authenticated: true }, { archiveAuthenticated: true }, { archiveSha256: "a".repeat(64) }, { secret: canary }]) denied({ ...source(), ...extra });
  for (const field of Object.keys(source())) {
    const accessor = source(); Object.defineProperty(accessor, field, { enumerable: true, get() { getters++; throw new Error(canary); } }); denied(accessor);
    const hidden = source(); Object.defineProperty(hidden, field, { enumerable: false, value: hidden[field] }); denied(hidden);
    const missing = source(); delete missing[field]; denied(missing);
  }
  const probe = counting(source()); denied(probe.proxy); assert.equal(probe.traps, 0);
  const revoked = Proxy.revocable(source(), {}); revoked.revoke(); denied(revoked.proxy); // refused, never a raw TypeError
  denied(new Proxy({}, { ownKeys() { getters++; throw new Error(canary); } })); assert.equal(getters, 0);
});
test("the database must be a genuine non-shared Uint8Array judged and copied by its internal slots", () => {
  const view = bytes => new Uint8Array(bytes), shared = new Uint8Array(new SharedArrayBuffer(database.length)); shared.set(database);
  const buffer = counting(Buffer.from(database));
  for (const value of [database.toString("latin1"), [...database], view(database).buffer, new DataView(view(database).buffer), new Uint8ClampedArray(database), new Uint16Array(view(Buffer.concat([database, database])).buffer), shared, buffer.proxy, { length: database.length }, Object.setPrototypeOf(new Uint8ClampedArray(database), Uint8Array.prototype), Object.setPrototypeOf(new Int8Array(database), Uint8Array.prototype), Object.create(Uint8Array.prototype), { [Symbol.toStringTag]: "Uint8Array", length: database.length }]) refusal(() => mintManagedSnapshot(plan(), source({ database: value })), "RESTORE_MANAGED_SNAPSHOT_INVALID");
  assert.equal(buffer.traps, 0);
  const revoked = Proxy.revocable(Buffer.from(database), {}); revoked.revoke(); refusal(() => mintManagedSnapshot(plan(), source({ database: revoked.proxy })), "RESTORE_MANAGED_SNAPSHOT_INVALID");
  let overrides = 0;
  class Disguised extends Uint8Array { subarray() { overrides++; throw new Error(canary); } fill() { overrides++; throw new Error(canary); } toString() { overrides++; throw new Error(canary); } set() { overrides++; throw new Error(canary); } }
  const disguised = new Disguised(database); Object.defineProperty(disguised, "byteLength", { get() { overrides++; return 1; } }); Object.defineProperty(disguised, "length", { value: 1 });
  const selected = plan(); checkManagedSnapshot(selected, mintManagedSnapshot(selected, source({ database: disguised }))); assert.equal(overrides, 0);
});
test("bytes, PGDMP prefix and size must equal the plan binding; oversize plans refuse before allocation", () => {
  const flipped = Buffer.from(database); flipped[flipped.length - 1] ^= 1;
  const detached = new Uint8Array(database); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const value of [database.subarray(1), Buffer.concat([database, Buffer.from([0])]), flipped, detached]) refusal(() => mintManagedSnapshot(plan(), source({ database: value })), "RESTORE_MANAGED_DATABASE_INVALID");
  for (let index = 0; index < 5; index++) { const notDump = Buffer.from(database); notDump[index] ^= 0x20; refusal(() => mintManagedSnapshot(plan(notDump), source({ database: notDump })), "RESTORE_MANAGED_DATABASE_INVALID"); } // each plan is bound to its own bytes
  const oversized = planManagedRestore(toc, { archiveSha256: "a".repeat(64), databaseSha256: hash(database), databaseBytes: MANAGED_SNAPSHOT_LIMITS.databaseBytes + 1 });
  refusal(() => mintManagedSnapshot(oversized, source()), "RESTORE_MANAGED_SNAPSHOT_INVALID");
});
test("header identity and lifetime grammar are explicit, closed and bounded without defaults", () => {
  for (const sourceProjectRef of ["abcdefghijklmnopqrst", PERSONAL_REF.toUpperCase(), undefined, 1]) refusal(() => mintManagedSnapshot(plan(), source({ sourceProjectRef })), "BACKUP_IDENTITY_MISMATCH");
  for (const keyId of ["", "k".repeat(51), "a b", "key/1", 1, null]) refusal(() => mintManagedSnapshot(plan(), source({ keyId })), "RESTORE_MANAGED_SNAPSHOT_INVALID");
  for (const createdAt of ["2026-10-13T00:00:00", "2026-13-40T00:00:00Z", "2026-10-13 00:00:00Z", 1, null]) refusal(() => mintManagedSnapshot(plan(), source({ createdAt })), "RESTORE_MANAGED_SNAPSHOT_INVALID");
  for (const lifetimeMs of [undefined, 0, -1, 1.5, NaN, Infinity, "1000", MANAGED_SNAPSHOT_LIMITS.maxLifetimeMs + 1]) refusal(() => mintManagedSnapshot(plan(), source({ lifetimeMs })), "RESTORE_MANAGED_SNAPSHOT_INVALID");
  const longest = plan(), kept = mintManagedSnapshot(longest, source({ lifetimeMs: MANAGED_SNAPSHOT_LIMITS.maxLifetimeMs })); checkManagedSnapshot(longest, kept); discardManagedSnapshot(kept);
});
test("the lifetime counts from the START of mint, so a copy/hash longer than it expires inside mint and wipes", () => {
  const large = new Uint8Array(16 * 1024 * 1024); large.set(Buffer.from("PGDMP")); large.fill(7, 5);
  // 1 ms is a valid lifetime; copy + SHA-256 of 16 MiB always outlasts it.
  refusal(() => mintManagedSnapshot(plan(large), source({ database: large, lifetimeMs: 1 })), "RESTORE_MANAGED_SNAPSHOT_EXPIRED");
  const anchored = plan(large), started = clock(), snapshot = mintManagedSnapshot(anchored, source({ database: large, lifetimeMs: 1000 })), elapsed = clock() - started;
  spin(started + 1000 + elapsed / 2 - clock()); refusal(() => checkManagedSnapshot(anchored, snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); large.fill(0);
});
test("a swapped plan or capability is refused and burns the bound plaintext instead of keeping it live", async () => {
  const first = minted(), second = minted();
  refusal(() => checkManagedSnapshot(second.plan, first.snapshot), "RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID");
  refusal(() => checkManagedSnapshot(first.plan, first.snapshot), "RESTORE_MANAGED_SNAPSHOT_DISCARDED"); assert.equal(discardManagedSnapshot(first.snapshot), false);
  refusal(() => claimManagedSnapshot(first.plan, second.snapshot), "RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID"); refusal(() => claimManagedSnapshot(second.plan, second.snapshot), "RESTORE_MANAGED_SNAPSHOT_DISCARDED");
  const third = minted(), probe = counting(third.plan);
  refusal(() => checkManagedSnapshot(probe.proxy, third.snapshot), "RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID"); assert.equal(probe.traps, 0);
  const fourth = minted(); refusal(() => claimManagedSnapshot({ ...fourth.plan }, fourth.snapshot), "RESTORE_MANAGED_SNAPSHOT_BINDING_INVALID"); assert.equal(discardManagedSnapshot(fourth.snapshot), false);
  const stale = minted({ lifetimeMs: 20 }); spin(30); refusal(() => checkManagedSnapshot(plan(), stale.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); // precedence: expiry before swap
  const gone = minted(); discardManagedSnapshot(gone.snapshot); refusal(() => checkManagedSnapshot(plan(), gone.snapshot), "RESTORE_MANAGED_SNAPSHOT_DISCARDED"); // earlier discard before swap
});
test("foreign and look-alike capabilities are refused by identity, and discard is a total no-op for them", () => {
  const { plan: selected, snapshot } = minted(), probe = counting(snapshot), facts = checkManagedSnapshot(selected, snapshot), revoked = Proxy.revocable(snapshot, {}); revoked.revoke();
  for (const foreign of [revoked.proxy, undefined, null, 1, "snapshot", {}, Object.freeze({}), structuredClone(snapshot), JSON.parse(JSON.stringify(snapshot)), { ...snapshot }, Object.create(snapshot), facts, () => snapshot, new (class Snapshot {})(), probe.proxy]) {
    refusal(() => checkManagedSnapshot(selected, foreign), "RESTORE_MANAGED_SNAPSHOT_REQUIRED"); refusal(() => claimManagedSnapshot(selected, foreign), "RESTORE_MANAGED_SNAPSHOT_REQUIRED");
    assert.equal(discardManagedSnapshot(foreign), false);
  }
  assert.equal(probe.traps, 0); assert.equal(checkManagedSnapshot(selected, snapshot), facts); assert.equal(discardManagedSnapshot(snapshot), true);
});
test("single use: same-tick claims, a second iterator and any later check are refused as reuse", async () => {
  const { plan: selected, snapshot } = minted(), claimed = claimManagedSnapshot(selected, snapshot);
  refusal(() => claimManagedSnapshot(selected, snapshot), "RESTORE_MANAGED_SNAPSHOT_REUSED"); refusal(() => checkManagedSnapshot(selected, snapshot), "RESTORE_MANAGED_SNAPSHOT_REUSED");
  assert.equal(Object.isFrozen(claimed), true); const iterator = claimed[Symbol.asyncIterator]();
  refusal(() => claimed[Symbol.asyncIterator](), "RESTORE_MANAGED_SNAPSHOT_REUSED"); assert.equal(Object.isFrozen(iterator), true);
  const { next } = iterator, chunk = (await next()).value; assert.equal(hash(chunk), hash(database)); // methods do not depend on `this`
  assert.equal((await next()).done, true); assert.equal(zero(chunk), true);
});
test("after a claim, lazy expiry and a swapped plan still wipe the in-flight bytes while reporting reuse", async () => {
  let selected = minted({ lifetimeMs: 300 }), iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator](), chunk = (await iterator.next()).value;
  spin(350); refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_REUSED"); assert.equal(zero(chunk), true);
  await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); assert.equal(discardManagedSnapshot(selected.snapshot), false);
  selected = minted(); iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator](); chunk = (await iterator.next()).value;
  refusal(() => claimManagedSnapshot(plan(), selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_REUSED"); assert.equal(zero(chunk), true);
  await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_DISCARDED"); assert.equal(discardManagedSnapshot(selected.snapshot), false);
});
test("early termination, a throwing consumer and return before next all wipe without masking the consumer error", async () => {
  let selected = minted(), retained;
  for await (const chunk of claimManagedSnapshot(selected.plan, selected.snapshot)) { retained = chunk; break; }
  assert.equal(zero(retained), true); assert.equal(discardManagedSnapshot(selected.snapshot), false);
  selected = minted();
  await assert.rejects((async () => { for await (const chunk of claimManagedSnapshot(selected.plan, selected.snapshot)) { retained = chunk; throw new Error("CONSUMER_FAILURE"); } })(), { message: "CONSUMER_FAILURE" });
  assert.equal(zero(retained), true); assert.equal(discardManagedSnapshot(selected.snapshot), false);
  selected = minted(); const iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator]();
  assert.deepEqual(await iterator.return(), { value: undefined, done: true }); assert.deepEqual(await iterator.return(), { value: undefined, done: true });
  await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_DISCARDED"); assert.equal(discardManagedSnapshot(selected.snapshot), false);
});
test("discard is idempotent, reaches claimed and in-flight bytes, and never replaces a first failure in finally", async () => {
  let selected = minted(); assert.equal(discardManagedSnapshot(selected.snapshot), true); assert.equal(discardManagedSnapshot(selected.snapshot), false);
  refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_DISCARDED"); refusal(() => claimManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_DISCARDED");
  selected = minted(); let iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator]();
  assert.equal(discardManagedSnapshot(selected.snapshot), true); await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_DISCARDED");
  selected = minted(); iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator](); const chunk = (await iterator.next()).value;
  assert.equal(discardManagedSnapshot(selected.snapshot), true); assert.equal(zero(chunk), true); await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_DISCARDED");
  const consumed = minted(); for await (const value of claimManagedSnapshot(consumed.plan, consumed.snapshot)) Buffer.from(value);
  const expired = minted({ lifetimeMs: 20 }); spin(30); refusal(() => checkManagedSnapshot(expired.plan, expired.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED");
  const claimed = minted(); claimManagedSnapshot(claimed.plan, claimed.snapshot);
  for (const value of [undefined, null, {}, new Proxy({}, { get() { throw new Error(canary); } }), minted().snapshot, claimed.snapshot, consumed.snapshot, expired.snapshot, selected.snapshot]) {
    assert.throws(() => { try { throw new BackupError("FIRST_FAILURE"); } finally { discardManagedSnapshot(value); } }, { code: "FIRST_FAILURE" });
  }
});
test("a consumer cannot defeat the wipe by shadowing fill, replacing the prototype or detaching the store", async () => {
  let selected = minted(), iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator](), chunk = (await iterator.next()).value;
  const backing = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  Object.defineProperty(chunk, "fill", { value() { throw new Error(canary); } }); Object.setPrototypeOf(chunk, null);
  assert.equal((await iterator.next()).done, true); assert.equal(zero(backing), true);
  selected = minted(); iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator](); chunk = (await iterator.next()).value;
  const taken = new Uint8Array(chunk.buffer.transfer()); assert.equal(hash(taken), hash(database)); taken.fill(0);
  await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_DISCARDED"); assert.equal(discardManagedSnapshot(selected.snapshot), false); assert.deepEqual(await iterator.return(), { value: undefined, done: true });
  selected = minted(); iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator](); chunk = (await iterator.next()).value;
  chunk.buffer.transfer(); assert.equal(discardManagedSnapshot(selected.snapshot), false); await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_DISCARDED");
});
test("lazy expiry uses the import-time monotonic clock: no timer, no clock seam, sticky refusals, never a truncated done", async () => {
  const resources = process.getActiveResourcesInfo().filter(name => name === "Timeout").length;
  let selected = minted({ lifetimeMs: 20 }); assert.equal(process.getActiveResourcesInfo().filter(name => name === "Timeout").length, resources);
  spin(30); refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED");
  refusal(() => claimManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); assert.equal(discardManagedSnapshot(selected.snapshot), false);
  refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); // first terminal reason is sticky
  selected = minted({ lifetimeMs: 400 }); spin(150); checkManagedSnapshot(selected.plan, selected.snapshot); spin(300); // a live check never renews
  refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED");
  const own = Object.getOwnPropertyDescriptor(performance, "now");
  try {
    selected = minted({ lifetimeMs: 20 }); performance.now = () => 0; // a later clock replacement cannot extend the lifetime
    spin(40); refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_EXPIRED");
  } finally { if (own) Object.defineProperty(performance, "now", own); else delete performance.now; }
  selected = minted({ lifetimeMs: 200 }); let iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator]();
  spin(250); await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_EXPIRED");
  selected = minted({ lifetimeMs: 200 }); iterator = claimManagedSnapshot(selected.plan, selected.snapshot)[Symbol.asyncIterator](); const chunk = (await iterator.next()).value;
  spin(250); await rejection(iterator.next(), "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); assert.equal(zero(chunk), true); assert.equal(discardManagedSnapshot(selected.snapshot), false);
});
test("runManagedRestore claims the bound snapshot after authorization precheck; expired or discarded snapshots fail before any list or child", async () => {
  const ref = "abcdefghijklmnopqrst", env = { SC_RESTORE_PROJECT_REF: ref, SC_RESTORE_CONFIRM_PROJECT: ref, SC_RESTORE_ISOLATED: "YES", SC_RESTORE_SUPABASE_URL: "https://" + ref + ".supabase.co", SC_RESTORE_SUPABASE_KEY: "sb_secret_" + canary, SC_RESTORE_PG_RESTORE: resolve("fake-pg_restore"), SC_RESTORE_PSQL: resolve("fake-psql"), SC_RESTORE_PGHOST: "db." + ref + ".supabase.co", SC_RESTORE_PGUSER: "postgres", SC_RESTORE_PGDATABASE: "postgres", SC_RESTORE_PGPASSWORD: canary, SC_RESTORE_PGSSLMODE: "require" };
  const roles = Object.fromEntries([["identityTrigger", "auth", "users", "CREATE TRIGGER"], ["adminTrigger", "auth", "users", "CREATE CONSTRAINT TRIGGER"], ["objectsPolicy", "storage", "objects", "CREATE POLICY"], ["bucketsPolicy", "storage", "buckets", "CREATE POLICY"]].map(([key, schema, table, operation]) => [key, { mode: "currentActor", actor: "postgres", schema, table, operation, canCreate: true }]));
  const binding = selected => { const value = managedRestoreRequirements(selected); return { archiveSha256: value.archiveSha256, databaseSha256: value.databaseSha256, databaseBytes: value.databaseBytes, tocSha256: value.tocSha256 }; };
  // Synthetic facts qualify only the plan; the streaming entry point now
  // requires the original A1 snapshot instead of an authentication boolean.
  const authorization = selected => authorizeManagedRestore(selected, { ...binding(selected), nativeSqlControlQualified: true, actor: "postgres", sameActor: true, allTargetsEmpty: true, baselineMatchesArchive: true, baselineOwnerAclMatchesArchive: true, appOwnerAclCanBeRestored: true, dataCopyCanUseOperator: true, replicaCanUseOperator: { actor: "postgres", setLocalObserved: true, readback: "replica", rollbackObserved: true }, referencesCanBeVerified: true, managedMigrationHistories: { archive: { auth: [], storage: [] }, target: { auth: [], storage: [] } }, customRoles: roles });
  const run = async (selected, snapshot) => {
    const counts = { spawns: 0, lists: 0, removed: 0 };
    const report = await runManagedRestore({ plan: selected, authorization: authorization(selected), env, snapshot }, { timeoutMs: 2000, spawn() { counts.spawns++; throw new BackupError("RESTORE_MANAGED_CONSUMER_FAILED"); }, materializeList: async () => { counts.lists++; return { path: resolve("RAM_ONLY_LIST"), sha256: "b".repeat(64), private: true }; }, checkBeforeCommit: async () => false, removeLists: async () => { counts.removed++; } });
    assert.equal(JSON.stringify(report).includes(canary), false); assert.equal(report.restoreAccepted, false); assert.equal(report.remoteOutcome, "not_started"); assert.equal(counts.spawns, 0); assert.equal(counts.removed, 1);
    return { report, counts };
  };
  let selected = minted(), result = await run(selected.plan, selected.snapshot);
  assert.equal(result.report.error, "RESTORE_MANAGED_LIST_INVALID"); assert.equal(result.counts.lists, 1); // length/PGDMP/sha256 gate passed first
  assert.equal(discardManagedSnapshot(selected.snapshot), false); refusal(() => checkManagedSnapshot(selected.plan, selected.snapshot), "RESTORE_MANAGED_SNAPSHOT_REUSED");
  selected = minted({ lifetimeMs: 300 }); spin(350);
  result = await run(selected.plan, selected.snapshot); assert.equal(result.report.error, "RESTORE_MANAGED_SNAPSHOT_EXPIRED"); assert.equal(result.counts.lists, 0);
  selected = minted(); discardManagedSnapshot(selected.snapshot);
  result = await run(selected.plan, selected.snapshot); assert.equal(result.report.error, "RESTORE_MANAGED_SNAPSHOT_DISCARDED"); assert.equal(result.counts.lists, 0);
});
