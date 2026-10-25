import test from "node:test";
import assert from "node:assert/strict";
import * as projection from "../../scripts/operations/restore-source-toc-failure-projection.mjs";

// Wire-only public synthetic DTOs. No child, archive, profile, FS, environment,
// native inspector, SQL, provider, timer or network participates in this QA.
const { parseSourceTocFailure } = projection;
const REFUSED = "SOURCE_TOC_FAILURE_REFUSED", CANARY = "PROJECTION_PRIVATE_CANARY";
const EVENTS = ["spawnRequested", "spawn", "spawnThrow", "stdinEndRequested", "stdinCallback", "stdinFinish", "stdinError", "stdinEndThrow", "childError", "stdoutError", "stderrError", "stdoutEOF", "stdoutClose", "stderrEOF", "stderrClose", "exit", "close", "stdinDestroyRequested", "stdoutDestroyRequested", "stderrDestroyRequested", "killRequested", "unrefRequested"];
const CODES = ["INSPECTION_NATIVE_UNAVAILABLE", "INSPECTION_NATIVE_FAILED", "INSPECTION_INPUT_FAILED", "INSPECTION_TIMEOUT", "INSPECTION_LIMIT", "INSPECTION_TOC_INVALID", "INSPECTION_UNAVAILABLE"];
const wire = value => Buffer.from(JSON.stringify(value) + "\n", "utf8");
function fixture() {
  const events = Object.fromEntries(EVENTS.map(name => [name, null]));
  events.spawnRequested = { sequence: 1 }; events.stdinEndRequested = { sequence: 2 }; events.spawn = { sequence: 3 };
  events.stdinCallback = { sequence: 4, outcome: "error", code: "other" };
  const first = { sequence: 4, overflow: false, firstError: { origin: "stdinCallback", code: "other", sequence: 4 }, lastError: { origin: "stdinCallback", code: "other", sequence: 4 }, events };
  const final = structuredClone(first); final.sequence = 9;
  for (const [index, name] of ["stdinDestroyRequested", "stdoutDestroyRequested", "stderrDestroyRequested", "killRequested", "unrefRequested"].entries()) final.events[name] = { sequence: index + 5 };
  return { ok: false, operation: "managed_restore_combined_baseline_inspect", error: "INSPECTION_INPUT_FAILED", stage: "source",
    sourceDiagnostic: { stage: "native_toc", authComplete: true, listStarted: true, tocDiagnostic: null, tocPlanDiagnostic: null, inventory: null, nativeHistoryDiagnostic: null },
    targetDiagnostic: null, nativeHistoryDiagnostic: null,
    sourceTocDiagnostic: { version: 1, observer: "source_toc_original", firstRefusal: { code: "INSPECTION_INPUT_FAILED", state: first }, finalCleanup: final },
    comparisonCompleted: false, inspectionOnly: true, baselineQualified: false, baselineCompared: false, remoteMutation: false, restoreAccepted: false };
}
function rejected(input) {
  assert.throws(() => parseSourceTocFailure(input), error => {
    assert.equal(error.code, REFUSED); assert.equal(error.message, REFUSED);
    assert.equal(error.message.includes(CANARY), false); assert.equal(Object.hasOwn(error, "cause"), false);
    return true;
  });
}
function changed(change) { const value = fixture(); change(value); rejected(wire(value)); }
function frozen(value) { if (value && typeof value === "object") { assert.equal(Object.isFrozen(value), true); Object.values(value).forEach(frozen); } }
function gapFixture() {
  const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state;
  first.sequence = 8; first.events.stdinCallback.code = "EPIPE";
  first.events.stdinError = { sequence: 5, code: "EPIPE" };
  first.firstError = { origin: "stdinCallback", code: "EPIPE", sequence: 4 };
  first.lastError = { origin: "stdinError", code: "EPIPE", sequence: 5 };
  value.error = "INSPECTION_TIMEOUT"; value.sourceTocDiagnostic.firstRefusal.code = "INSPECTION_TIMEOUT";
  // Repeated notifications occupy counter positions without replacing slots.
  // These wire controls assert order consistency, never native provenance.
  value.sourceTocDiagnostic.finalCleanup = structuredClone(first); value.sourceTocDiagnostic.finalCleanup.sequence = 9;
  return value;
}

test("public surface is only the inert wire parser; valid DTO is detached and recursively frozen", () => {
  assert.deepEqual(Object.keys(projection), ["parseSourceTocFailure"]);
  const input = fixture(), bytes = wire(input), original = Buffer.from(bytes), result = parseSourceTocFailure(bytes);
  assert.deepEqual(result, input); assert.notEqual(result, input); frozen(result); assert.deepEqual(bytes, original);
  input.sourceTocDiagnostic.firstRefusal.state.events.stdinCallback.code = CANARY;
  bytes.fill(0); assert.equal(result.sourceTocDiagnostic.firstRefusal.state.events.stdinCallback.code, "other");
  for (const flag of ["comparisonCompleted", "baselineQualified", "baselineCompared", "remoteMutation", "restoreAccepted"]) assert.equal(result[flag], false);
  assert.equal(Object.hasOwn(result, "nativeOrigin"), false); assert.equal(Object.hasOwn(result, "cleanupConfirmed"), false);
});
test("missing EOF/exit/callback/finish stay absent; local requests supply no native terminal", () => {
  const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state, final = value.sourceTocDiagnostic.finalCleanup;
  for (const state of [first, final]) { state.events.stdinCallback = null; state.firstError = null; state.lastError = null; }
  value.error = "INSPECTION_TIMEOUT"; value.sourceTocDiagnostic.firstRefusal.code = "INSPECTION_TIMEOUT";
  const result = parseSourceTocFailure(wire(value));
  for (const name of ["stdinCallback", "stdinFinish", "stdoutEOF", "stderrEOF", "exit", "close"]) assert.equal(result.sourceTocDiagnostic.finalCleanup.events[name], null);
  assert.ok(result.sourceTocDiagnostic.finalCleanup.events.killRequested); assert.equal(result.restoreAccepted, false);
});
test("later spawn and a different external closed code are preserved without asserting causal identity", () => {
  const value = fixture(); value.error = "INSPECTION_NATIVE_FAILED"; value.sourceDiagnostic.listStarted = false;
  value.sourceTocDiagnostic.firstRefusal.state.events.spawn = null;
  value.sourceTocDiagnostic.finalCleanup.events.spawn.sequence = 10; value.sourceTocDiagnostic.finalCleanup.sequence = 10;
  const result = parseSourceTocFailure(wire(value));
  assert.equal(result.sourceDiagnostic.listStarted, false); assert.ok(result.sourceTocDiagnostic.finalCleanup.events.spawn);
  assert.equal(result.error, "INSPECTION_NATIVE_FAILED"); assert.equal(result.sourceTocDiagnostic.firstRefusal.code, "INSPECTION_INPUT_FAILED");
});
test("spawn throw before child creation keeps all child terminals and cancellation requests absent", () => {
  const value = fixture(), events = Object.fromEntries(EVENTS.map(name => [name, null]));
  events.spawnRequested = { sequence: 1 }; events.spawnThrow = { sequence: 2, code: "unavailable" };
  const state = { sequence: 2, overflow: false, firstError: { origin: "spawnThrow", code: "unavailable", sequence: 2 }, lastError: { origin: "spawnThrow", code: "unavailable", sequence: 2 }, events };
  value.error = "INSPECTION_NATIVE_UNAVAILABLE"; value.sourceDiagnostic.listStarted = false;
  value.sourceTocDiagnostic.firstRefusal = { code: "INSPECTION_NATIVE_UNAVAILABLE", state }; value.sourceTocDiagnostic.finalCleanup = structuredClone(state);
  const result = parseSourceTocFailure(wire(value));
  for (const name of ["spawn", "stdinEndRequested", "exit", "close", "killRequested"]) assert.equal(result.sourceTocDiagnostic.finalCleanup.events[name], null);
});
test("closed external/refusal codes remain finite and do not accept prefixes or native code as authority", () => {
  for (const code of CODES) { const value = fixture(); value.error = code; value.sourceTocDiagnostic.firstRefusal.code = code; assert.equal(parseSourceTocFailure(wire(value)).error, code); }
  for (const code of [CANARY, "EPIPE", "ERR_STREAM_DESTROYED", "EOF", "INSPECTION_NATIVE_FAILED_MORE", 1, null]) {
    changed(value => { value.error = code; }); changed(value => { value.sourceTocDiagnostic.firstRefusal.code = code; });
  }
});
test("callback/event first errors and later discordant codes remain distinct", () => {
  for (const origin of ["stdinCallback", "stdinError"]) {
    const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state, final = value.sourceTocDiagnostic.finalCleanup;
    if (origin === "stdinError") {
      first.events.stdinCallback = null; first.events.stdinError = { sequence: 4, code: "EPIPE" };
      first.firstError = { origin, code: "EPIPE", sequence: 4 }; first.lastError = structuredClone(first.firstError);
      final.events.stdinCallback = null; final.events.stdinError = structuredClone(first.events.stdinError);
      final.firstError = structuredClone(first.firstError);
    }
    final.sequence = 10; final.events.stdinEndThrow = { sequence: 10, code: "ERR_STREAM_DESTROYED" };
    final.lastError = { origin: "stdinEndThrow", code: "ERR_STREAM_DESTROYED", sequence: 10 };
    const result = parseSourceTocFailure(wire(value));
    assert.equal(result.sourceTocDiagnostic.firstRefusal.state.firstError.origin, origin);
    assert.equal(result.sourceTocDiagnostic.finalCleanup.lastError.code, "ERR_STREAM_DESTROYED");
    assert.equal(result.sourceTocDiagnostic.firstRefusal.state.events.stdinEndThrow, null);
  }
});
test("saturation permits sequence64 ties only with overflow and preserves the first photograph", () => {
  const value = fixture(), final = value.sourceTocDiagnostic.finalCleanup;
  final.sequence = 64; final.overflow = true;
  final.events.stdinError = { sequence: 64, code: "ERR_STREAM_DESTROYED" };
  final.events.close = { sequence: 64, code: "unavailable", signal: "SIGKILL" };
  final.lastError = { origin: "stdinError", code: "ERR_STREAM_DESTROYED", sequence: 64 };
  const result = parseSourceTocFailure(wire(value));
  assert.equal(result.sourceTocDiagnostic.firstRefusal.state.sequence, 4); assert.equal(result.sourceTocDiagnostic.finalCleanup.overflow, true);
  for (const patch of [state => { state.overflow = false; }, state => { state.sequence = 63; }, state => { state.events.close.sequence = 4; }]) {
    const invalid = structuredClone(value); patch(invalid.sourceTocDiagnostic.finalCleanup); rejected(wire(invalid));
  }
});
test("null is required at nullable fields and is never interchangeable with an absent field", () => {
  for (const key of ["targetDiagnostic", "nativeHistoryDiagnostic"]) changed(value => { delete value[key]; });
  for (const key of ["tocDiagnostic", "tocPlanDiagnostic", "inventory", "nativeHistoryDiagnostic"]) {
    changed(value => { delete value.sourceDiagnostic[key]; }); changed(value => { value.sourceDiagnostic[key] = {}; });
  }
  for (const key of ["firstError", "lastError"]) changed(value => { delete value.sourceTocDiagnostic.firstRefusal.state[key]; });
  changed(value => { delete value.sourceTocDiagnostic.finalCleanup.events.exit; });
  for (const change of [value => { value.sourceTocDiagnostic = null; }, value => { value.sourceTocDiagnostic.firstRefusal = null; }, value => { value.sourceTocDiagnostic.finalCleanup = null; }, value => { delete value.sourceTocDiagnostic.finalCleanup; }]) changed(change);
});
test("this Source/native_toc slice refuses success, operator failures and other diagnostic phases", () => {
  for (const change of [value => { value.ok = true; }, value => { value.stage = "target"; }, value => { value.sourceDiagnostic.stage = "plan"; }, value => { value.sourceDiagnostic.authComplete = false; }, value => { value.sourceDiagnostic.listStarted = "true"; }, value => { value.targetDiagnostic = {}; }, value => { value.nativeHistoryDiagnostic = {}; }]) changed(change);
  rejected(wire({ ok: false, operation: "operator", error: "OPERATOR_SETUP_FAILED" }));
});
test("all authority flags are exact booleans and inspectionOnly must remain true", () => {
  for (const key of ["ok", "comparisonCompleted", "baselineQualified", "baselineCompared", "remoteMutation", "restoreAccepted"]) for (const incorrect of [true, "false", 0, null]) changed(value => { value[key] = incorrect; });
  for (const incorrect of [false, "true", 1, null]) changed(value => { value.inspectionOnly = incorrect; });
});
test("unknown/private fields are refused rather than silently removed from the projected copy", () => {
  for (const select of [value => value, value => value.sourceDiagnostic, value => value.sourceTocDiagnostic, value => value.sourceTocDiagnostic.firstRefusal, value => value.sourceTocDiagnostic.firstRefusal.state, value => value.sourceTocDiagnostic.finalCleanup.events, value => value.sourceTocDiagnostic.finalCleanup.events.stdinCallback, value => value.sourceTocDiagnostic.finalCleanup.firstError]) changed(value => { select(value).private = CANARY; });
  const base = JSON.stringify(fixture());
  rejected(Buffer.from(base.replace('{"ok":', '{"__proto__":{"polluted":true},"ok":')));
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
});
test("duplicate keys including escaped equivalent names are rejected before JSON.parse can collapse them", () => {
  const text = JSON.stringify(fixture());
  for (const duplicated of [
    text.replace('"ok":false', '"ok":false,"ok":false'),
    text.replace('"ok":false', '"ok":false,"o\\u006b":false'),
    text.replace('"authComplete":true', '"authComplete":true,"auth\\u0043omplete":true'),
    text.replace('"sourceTocDiagnostic":', '"sourceTocDiagnostic":null,"sourceTocDiagnostic":'),
    text.replace('"observer":"source_toc_original"', '"observer":"source_toc_original","obser\\u0076er":"source_toc_original"'),
    text.replace('"outcome":"error"', '"outcome":"error","outcome":"error"'),
    text.replace('"origin":"stdinCallback"', '"origin":"stdinCallback","origin":"stdinCallback"'),
  ]) rejected(Buffer.from(duplicated));
});
test("malformed JSON, invalid UTF8, BOM, multiple documents and provider banners cannot pass", () => {
  const valid = wire(fixture());
  for (const text of ["", " ", "null", "[]", "{}", "true", '{"ok":false,}', '{"ok":NaN}', '{"ok":false', JSON.stringify(fixture()) + "{}", CANARY + JSON.stringify(fixture()), JSON.stringify(fixture()) + CANARY]) rejected(Buffer.from(text));
  rejected(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), valid]));
  rejected(Buffer.concat([valid, Buffer.from([0xc0, 0xaf])]));
  rejected(Buffer.from('{"x":"\\uZZZZ"}'));
  rejected(Buffer.from('"' + "\u0000" + '"'));
});
test("64KiB is a byte bound and the parser does not modify caller-owned bytes", () => {
  const valid = wire(fixture()), boundary = Buffer.concat([valid, Buffer.alloc(65536 - valid.length, 32)]), original = Buffer.from(boundary);
  assert.equal(parseSourceTocFailure(boundary).error, "INSPECTION_INPUT_FAILED"); assert.deepEqual(boundary, original);
  rejected(Buffer.concat([boundary, Buffer.from(" ")]));
  rejected(new Uint8Array(0));
  rejected(Buffer.from('{"x":' + "[".repeat(20) + "0" + "]".repeat(20) + "}"));
});
test("only real non-shared byte views are accepted; object conversion, Proxy and accessors are never invoked", () => {
  let calls = 0; const input = wire(fixture());
  const object = { get byteLength() { calls++; throw Error(CANARY); }, get buffer() { calls++; throw Error(CANARY); }, toString() { calls++; throw Error(CANARY); }, valueOf() { calls++; throw Error(CANARY); }, [Symbol.iterator]() { calls++; throw Error(CANARY); } };
  const proxy = new Proxy(input, { get() { calls++; throw Error(CANARY); }, getOwnPropertyDescriptor() { calls++; throw Error(CANARY); }, getPrototypeOf() { calls++; throw Error(CANARY); } });
  const revoked = Proxy.revocable(input, {}); revoked.revoke();
  for (const invalid of [null, undefined, "{}", object, proxy, revoked.proxy, Object.create(Uint8Array.prototype), new DataView(new ArrayBuffer(8)), new Uint16Array(4), new Uint8Array(new SharedArrayBuffer(8))]) rejected(invalid);
  assert.equal(calls, 0);
});
test("intrinsic byte copying accepts legitimate Buffer/subclass views without consulting poisoned properties", () => {
  let calls = 0;
  class HostileProperties extends Uint8Array {
    get buffer() { calls++; throw Error(CANARY); } get byteLength() { calls++; throw Error(CANARY); } get byteOffset() { calls++; throw Error(CANARY); } get length() { calls++; throw Error(CANARY); }
    subarray() { calls++; throw Error(CANARY); } set() { calls++; throw Error(CANARY); } [Symbol.iterator]() { calls++; throw Error(CANARY); }
  }
  const raw = wire(fixture()), bytes = new HostileProperties(raw.length); Uint8Array.prototype.set.call(bytes, raw);
  assert.equal(parseSourceTocFailure(bytes).restoreAccepted, false); assert.equal(calls, 0);
  assert.equal(Uint8Array.prototype.every.call(bytes, (value, index) => value === raw[index]), true);
  const containing = Buffer.concat([Buffer.from([0]), raw, Buffer.from([0])]);
  assert.equal(parseSourceTocFailure(containing.subarray(1, 1 + raw.length)).error, "INSPECTION_INPUT_FAILED");
});
test("detached and resizable out-of-bounds views fail without invoking caller getters", () => {
  let reads = 0;
  const detached = new Uint8Array(new ArrayBuffer(16)), original = detached.buffer; structuredClone(original, { transfer: [original] });
  const buffer = new ArrayBuffer(16, { maxByteLength: 32 }), view = new Uint8Array(buffer, 8, 8); buffer.resize(4);
  const shared = new Uint8Array(new SharedArrayBuffer(8));
  for (const invalid of [detached, view, shared]) {
    Object.defineProperty(invalid, "buffer", { get() { reads++; throw Error(CANARY); } });
    Object.defineProperty(invalid, "byteLength", { get() { reads++; throw Error(CANARY); } }); rejected(invalid);
  }
  assert.equal(reads, 0);
});
test("closed event variants are preserved, while impossible scalar shapes and enum expansion are refused", () => {
  for (const [name, event] of [["stdinFinish", { sequence: 10 }], ["stdinError", { sequence: 10, code: "EPIPE" }], ["exit", { sequence: 10, code: "nonzero", signal: "SIGTERM" }], ["close", { sequence: 10, code: "zero", signal: "other" }]]) {
    const value = fixture(), final = value.sourceTocDiagnostic.finalCleanup; final.sequence = 10; final.events[name] = event;
    if (name === "stdinError") final.lastError = { origin: name, code: "EPIPE", sequence: 10 };
    assert.deepEqual(parseSourceTocFailure(wire(value)).sourceTocDiagnostic.finalCleanup.events[name], event);
  }
  for (const change of [state => { state.sequence = 65; }, state => { state.sequence = 4.5; }, state => { state.sequence = -1; }, state => { state.overflow = "false"; }, state => { state.overflow = true; }, state => { state.events.spawnRequested = null; }, state => { state.events.stdinCallback.code = "none"; }, state => { state.events.stdinCallback.outcome = "pending"; }, state => { state.events.stdinCallback.sequence = 0; }, state => { state.events.stdinCallback.sequence = 99; }, state => { state.events.stdinCallback.code = CANARY; }, state => { state.events.exit = { sequence: 10, code: 0, signal: null }; }, state => { state.firstError.origin = "targetError"; }, state => { state.lastError = null; }, state => { state.firstError = null; state.lastError = null; }]) changed(value => { change(value.sourceTocDiagnostic.finalCleanup); });
});
test("retrospective changes and earlier final sequence cannot rewrite the first refusal photograph", () => {
  for (const change of [value => { value.sourceTocDiagnostic.finalCleanup.sequence = 3; }, value => { value.sourceTocDiagnostic.finalCleanup.events.stdinCallback = null; }, value => { value.sourceTocDiagnostic.finalCleanup.events.stdinCallback.code = "EPIPE"; }, value => { value.sourceTocDiagnostic.finalCleanup.firstError.code = "EPIPE"; }, value => { value.sourceTocDiagnostic.version = 2; }, value => { value.sourceTocDiagnostic.observer = "target_toc_original"; }]) changed(change);
});
test("same unsaturated event sequence cannot claim a conflicting error code or successful callback", () => {
  changed(value => { for (const state of [value.sourceTocDiagnostic.firstRefusal.state, value.sourceTocDiagnostic.finalCleanup]) { state.firstError.code = "EPIPE"; state.lastError.code = "EPIPE"; } });
  changed(value => { for (const state of [value.sourceTocDiagnostic.firstRefusal.state, value.sourceTocDiagnostic.finalCleanup]) { state.events.stdinCallback.outcome = "ok"; state.events.stdinCallback.code = "none"; } });
});
test("firstError cannot follow an already erroneous callback or stream slot", () => {
  for (const origin of ["stdinCallback", "stdinError"]) {
    const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state;
    first.sequence = 6;
    if (origin === "stdinError") { first.events.stdinCallback = null; first.events.stdinError = { sequence: 4, code: "other" }; }
    first.firstError = { origin, code: "other", sequence: 6 }; first.lastError = structuredClone(first.firstError);
    value.sourceTocDiagnostic.finalCleanup = structuredClone(first); rejected(wire(value));
  }
});
test("lastError must cover every already erroneous slot, including a newly observed stream error", () => {
  const value = fixture(), final = value.sourceTocDiagnostic.finalCleanup;
  final.sequence = 10; final.events.stdinError = { sequence: 10, code: "EPIPE" };
  rejected(wire(value));
  final.lastError = { origin: "stdinError", code: "EPIPE", sequence: 10 };
  const result = parseSourceTocFailure(wire(value));
  assert.equal(result.sourceTocDiagnostic.finalCleanup.lastError.sequence, 10);
  assert.equal(result.sourceTocDiagnostic.firstRefusal.state.lastError.sequence, 4);
});
test("a slot absent in the first photograph cannot appear retrospectively at or below its counter", () => {
  for (const sequence of [6, 8]) {
    const value = gapFixture(); value.sourceTocDiagnostic.finalCleanup.events.stdinFinish = { sequence }; rejected(wire(value));
  }
  const value = gapFixture(); value.sourceTocDiagnostic.finalCleanup.events.stdinFinish = { sequence: 9 };
  assert.equal(parseSourceTocFailure(wire(value)).sourceTocDiagnostic.finalCleanup.events.stdinFinish.sequence, 9);
});
test("a newly reported firstError cannot be backdated into the first photograph", () => {
  const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state;
  first.sequence = 8; first.events.stdinCallback = { sequence: 4, outcome: "ok", code: "none" }; first.firstError = null; first.lastError = null;
  value.error = "INSPECTION_TIMEOUT"; value.sourceTocDiagnostic.firstRefusal.code = "INSPECTION_TIMEOUT";
  const final = structuredClone(first); final.sequence = 9; value.sourceTocDiagnostic.finalCleanup = final;
  final.firstError = { origin: "stdinCallback", code: "other", sequence: 6 }; final.lastError = structuredClone(final.firstError);
  rejected(wire(value));
  final.firstError.sequence = 9; final.lastError.sequence = 9;
  assert.equal(parseSourceTocFailure(wire(value)).sourceTocDiagnostic.finalCleanup.firstError.sequence, 9);
});
test("changed lastError must follow the first photograph counter, not merely its earlier lastError", () => {
  const value = gapFixture(), final = value.sourceTocDiagnostic.finalCleanup;
  final.lastError = { origin: "stdinError", code: "other", sequence: 6 }; rejected(wire(value));
  final.lastError.sequence = 8; rejected(wire(value));
  final.lastError.sequence = 9;
  assert.equal(parseSourceTocFailure(wire(value)).sourceTocDiagnostic.finalCleanup.lastError.sequence, 9);
});
test("an originally successful callback may report a later error without rewriting its first slot", () => {
  const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state, final = value.sourceTocDiagnostic.finalCleanup;
  for (const state of [first, final]) { state.events.stdinCallback = { sequence: 4, outcome: "ok", code: "none" }; state.firstError = null; state.lastError = null; }
  value.error = "INSPECTION_TIMEOUT"; value.sourceTocDiagnostic.firstRefusal.code = "INSPECTION_TIMEOUT";
  final.sequence = 10; final.firstError = { origin: "stdinCallback", code: "ERR_STREAM_DESTROYED", sequence: 10 }; final.lastError = structuredClone(final.firstError);
  const result = parseSourceTocFailure(wire(value));
  assert.equal(result.sourceTocDiagnostic.firstRefusal.state.firstError, null);
  assert.equal(result.sourceTocDiagnostic.finalCleanup.events.stdinCallback.outcome, "ok");
  assert.equal(result.sourceTocDiagnostic.finalCleanup.firstError.sequence, 10); assert.equal(result.restoreAccepted, false);
});
test("later repetitions may update lastError while preserving the first erroneous stream slot", () => {
  const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state, final = value.sourceTocDiagnostic.finalCleanup;
  for (const state of [first, final]) {
    state.events.stdinCallback = null; state.events.stdinError = { sequence: 4, code: "other" };
    state.firstError = { origin: "stdinError", code: "other", sequence: 4 }; state.lastError = structuredClone(state.firstError);
  }
  final.sequence = 10; final.lastError = { origin: "stdinError", code: "EPIPE", sequence: 10 };
  const result = parseSourceTocFailure(wire(value));
  assert.equal(result.sourceTocDiagnostic.finalCleanup.events.stdinError.sequence, 4);
  assert.equal(result.sourceTocDiagnostic.finalCleanup.lastError.sequence, 10);
  assert.equal(result.sourceTocDiagnostic.firstRefusal.state.lastError.code, "other");
});
test("new slots and error markers may tie64 only after final overflow, including an unsaturated first photograph", () => {
  for (const hadError of [false, true]) {
    const value = fixture(), first = value.sourceTocDiagnostic.firstRefusal.state;
    first.sequence = 64; first.overflow = false;
    if (hadError) {
      first.events.stdinCallback = null; first.events.stdinError = { sequence: 4, code: "EPIPE" };
      first.firstError = { origin: "stdinError", code: "EPIPE", sequence: 4 };
      first.lastError = { origin: "stdinError", code: "ERR_STREAM_DESTROYED", sequence: 64 };
    } else {
      first.events.stdinCallback = { sequence: 4, outcome: "ok", code: "none" }; first.firstError = null; first.lastError = null;
      value.error = "INSPECTION_TIMEOUT"; value.sourceTocDiagnostic.firstRefusal.code = "INSPECTION_TIMEOUT";
    }
    const final = structuredClone(first); final.overflow = true; value.sourceTocDiagnostic.finalCleanup = final;
    const origin = hadError ? "childError" : "stdinError";
    final.events[origin] = { sequence: 64, code: "other" };
    final.lastError = { origin, code: "other", sequence: 64 }; final.firstError ??= structuredClone(final.lastError);
    const result = parseSourceTocFailure(wire(value));
    assert.equal(result.sourceTocDiagnostic.firstRefusal.state.overflow, false); assert.equal(result.sourceTocDiagnostic.finalCleanup.overflow, true);
    assert.equal(result.sourceTocDiagnostic.finalCleanup.lastError.sequence, 64);
    final.overflow = false; rejected(wire(value));
  }
});

test("literal EOF is passive SourceTOC metadata, never an external refusal or native terminal", () => {
  const value = fixture();
  for (const state of [value.sourceTocDiagnostic.firstRefusal.state, value.sourceTocDiagnostic.finalCleanup]) {
    state.events.stdinCallback.code = "EOF"; state.firstError.code = "EOF"; state.lastError.code = "EOF";
  }
  const out = parseSourceTocFailure(wire(value));
  assert.deepEqual(out, value); frozen(out);
  assert.equal(out.error, "INSPECTION_INPUT_FAILED"); assert.equal(out.sourceTocDiagnostic.firstRefusal.code, "INSPECTION_INPUT_FAILED");
  for (const state of [out.sourceTocDiagnostic.firstRefusal.state, out.sourceTocDiagnostic.finalCleanup]) {
    assert.equal(state.events.stdoutEOF, null); assert.equal(state.events.stderrEOF, null);
    assert.equal(state.events.exit, null); assert.equal(state.events.close, null);
  }
  for (const code of ["UV_EOF", "EOF_MORE", "eof", CANARY]) changed(input => {
    for (const state of [input.sourceTocDiagnostic.firstRefusal.state, input.sourceTocDiagnostic.finalCleanup]) {
      state.events.stdinCallback.code = code; state.firstError.code = code; state.lastError.code = code;
    }
  });
});
