import test from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import * as header from "../../scripts/operations/restore-custom-header.mjs";

// Synthetic fixed prefixes only. No archive, private file/profile, filesystem
// materialization, child, PostgreSQL executable, fetch, SQL or hosted service.
const { observeCustomArchiveHeader, CUSTOM_HEADER_ERROR_CODES } = header;
const canary = "PRIVATE_HEADER_CANARY_NEVER_REPORT", maximum = 64 * 1024 * 1024;
const prefix = algorithm => Uint8Array.from([0x50, 0x47, 0x44, 0x4d, 0x50, 1, 16, 0, 4, 8, 1, algorithm ?? 0]);
const expected = compression => ({ archiveVersion: "1.16-0", intSize: 4, offSize: 8, format: "CUSTOM", compression });
const refuse = (value, code) => assert.throws(() => observeCustomArchiveHeader(value), error => {
  assert.equal(error instanceof BackupError, true);
  assert.equal(Object.getOwnPropertyDescriptor(error, "code")?.value, code);
  assert.equal(error.message, code); assert.equal(CUSTOM_HEADER_ERROR_CODES.includes(code), true);
  assert.equal(Object.hasOwn(error, "cause"), false);
  for (const text of [error.stack, JSON.stringify(error), inspect(error)]) assert.equal(text.includes(canary), false);
  return true;
});

test("the API and errors are closed; all four public codecs return only a frozen fixed tuple", () => {
  assert.deepEqual(Object.keys(header).sort(), ["CUSTOM_HEADER_ERROR_CODES", "observeCustomArchiveHeader"]);
  assert.deepEqual(CUSTOM_HEADER_ERROR_CODES, ["RESTORE_CUSTOM_HEADER_INPUT_INVALID", "RESTORE_CUSTOM_HEADER_LIMIT_EXCEEDED", "RESTORE_CUSTOM_HEADER_TRUNCATED", "RESTORE_CUSTOM_HEADER_UNSUPPORTED"]);
  assert.equal(Object.isFrozen(CUSTOM_HEADER_ERROR_CODES), true);
  for (const [algorithm, name] of ["NONE", "GZIP", "LZ4", "ZSTD"].entries()) {
    const bytes = prefix(algorithm), original = Uint8Array.from(bytes), result = observeCustomArchiveHeader(bytes);
    assert.deepEqual(result, expected(name)); assert.equal(Object.isFrozen(result), true);
    assert.deepEqual(bytes, original); assert.equal(JSON.stringify(result).includes(canary), false);
    assert.throws(() => { result.offSize = 1; }, TypeError);
  }
});

test("a twelve-byte prefix, genuine Buffer and offset view qualify without certifying any remaining header or TOC", () => {
  const bytes = prefix(1), store = new Uint8Array(80); store.set(bytes, 9);
  const view = new Uint8Array(store.buffer, 9, bytes.byteLength);
  assert.deepEqual(observeCustomArchiveHeader(view), expected("GZIP"));
  assert.deepEqual(observeCustomArchiveHeader(Buffer.from(bytes)), expected("GZIP"));
  const tail = Buffer.concat([Buffer.from(bytes), Buffer.from(canary + "\0not-a-date-or-string-length\nSQL;\\connect private")]);
  const original = Buffer.from(tail), result = observeCustomArchiveHeader(tail);
  assert.deepEqual(result, expected("GZIP")); assert.deepEqual(tail, original);
  assert.equal(JSON.stringify(result).includes(canary), false);
});

test("every truncated fixed prefix and every changed magic byte refuses with a fixed code", () => {
  for (let length = 0; length < 12; length++) refuse(prefix().subarray(0, length), "RESTORE_CUSTOM_HEADER_TRUNCATED");
  for (let offset = 0; offset < 5; offset++) { const bytes = prefix(); bytes[offset] ^= 0x20; refuse(bytes, "RESTORE_CUSTOM_HEADER_INPUT_INVALID"); }
});

test("every unsupported version, size, format or codec byte refuses rather than guessing a layout", () => {
  const fixed = [[5, 1], [6, 16], [7, 0], [8, 4], [9, 8], [10, 1]];
  for (const [offset, allowed] of fixed) for (let value = 0; value <= 255; value++) {
    if (value === allowed) continue;
    const bytes = prefix(); bytes[offset] = value; refuse(bytes, "RESTORE_CUSTOM_HEADER_UNSUPPORTED");
  }
  for (let value = 4; value <= 255; value++) { const bytes = prefix(value); refuse(bytes, "RESTORE_CUSTOM_HEADER_UNSUPPORTED"); }
  // Historical 1.0 has a different layout; its apparent trailing fields are
  // never accepted as the revision/int/off/compression fields of 1.16.
  const ancient = prefix(); ancient[6] = 0; ancient[7] = 4; ancient[8] = 1;
  refuse(ancient, "RESTORE_CUSTOM_HEADER_UNSUPPORTED");
});

test("type spoofs, non-Uint8Array views, proxies and revoked proxies refuse without invoking their getters or traps", () => {
  let calls = 0;
  const fake = Object.create(null);
  for (const key of ["byteLength", "buffer", Symbol.toStringTag, Symbol.iterator, "toJSON", "valueOf"]) Object.defineProperty(fake, key, { get() { calls++; throw new Error(canary); } });
  const disguised = new Uint8ClampedArray(prefix()); Object.setPrototypeOf(disguised, Uint8Array.prototype);
  const notBytes = [undefined, null, false, 12, 12n, Symbol(canary), canary, [], [...prefix()], prefix().buffer, new DataView(prefix().buffer), new Uint8ClampedArray(prefix()), new Uint16Array(12), new Int8Array(prefix()), disguised, Object.create(Uint8Array.prototype), fake];
  for (const value of notBytes) refuse(value, "RESTORE_CUSTOM_HEADER_INPUT_INVALID");
  const proxy = new Proxy(prefix(), { get() { calls++; throw new Error(canary); }, getPrototypeOf() { calls++; throw new Error(canary); }, ownKeys() { calls++; throw new Error(canary); }, getOwnPropertyDescriptor() { calls++; throw new Error(canary); } });
  const revoked = Proxy.revocable(prefix(), {}); revoked.revoke();
  refuse(proxy, "RESTORE_CUSTOM_HEADER_INPUT_INVALID"); refuse(revoked.proxy, "RESTORE_CUSTOM_HEADER_INPUT_INVALID");
  assert.equal(calls, 0);
});

test("shared and detached stores refuse; the observer never reads caller-controlled getters or species", () => {
  const shared = new Uint8Array(new SharedArrayBuffer(12)); shared.set(prefix());
  refuse(shared, "RESTORE_CUSTOM_HEADER_INPUT_INVALID"); refuse(Buffer.from(shared.buffer), "RESTORE_CUSTOM_HEADER_INPUT_INVALID");
  const detached = prefix(); structuredClone(detached, { transfer: [detached.buffer] });
  refuse(detached, "RESTORE_CUSTOM_HEADER_INPUT_INVALID");
  let calls = 0;
  class OwnedBytes extends Uint8Array {
    get byteLength() { calls++; throw new Error(canary); }
    get buffer() { calls++; throw new Error(canary); }
    get [Symbol.toStringTag]() { calls++; throw new Error(canary); }
  }
  const bytes = new OwnedBytes(12); Uint8Array.prototype.set.call(bytes, prefix());
  const store = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "buffer").get.call(bytes);
  for (const key of ["constructor", "byteLength"]) Object.defineProperty(store, key, { get() { calls++; throw new Error(canary); } });
  for (const key of ["constructor", "toJSON", "valueOf", Symbol.iterator]) Object.defineProperty(bytes, key, { get() { calls++; throw new Error(canary); } });
  assert.deepEqual(observeCustomArchiveHeader(bytes), expected("NONE")); assert.equal(calls, 0);
});

test("the 64 MiB input-view bound is inclusive and refuses the next byte before interpreting any payload", () => {
  const bytes = new Uint8Array(maximum + 1); bytes.set(prefix(3));
  assert.deepEqual(observeCustomArchiveHeader(bytes.subarray(0, maximum)), expected("ZSTD"));
  refuse(bytes, "RESTORE_CUSTOM_HEADER_LIMIT_EXCEEDED");
  // The bound applies to the supplied database view, not unrelated backing
  // bytes outside it. No allocation/copy proportional to that store occurs.
  assert.deepEqual(observeCustomArchiveHeader(bytes.subarray(0, 12)), expected("ZSTD"));
  bytes.subarray(0, 12).fill(0);
});
