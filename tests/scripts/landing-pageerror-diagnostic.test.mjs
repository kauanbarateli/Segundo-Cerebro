import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { captureHealthAfter, firstCaptureDiagnostic } from "../../scripts/landing/capture-policy.mjs";
import {
  capturePageErrorDiagnostic, captureSdkPageErrorDiagnostic, createPageErrorDiagnosticReader, pageErrorDiagnosticForReport,
  pageErrorDiagnosticLine, publicNextChunk,
} from "../../scripts/landing/capture-pageerror-diagnostic.mjs";

const base = "http://127.0.0.1:3110";
const chunk = "4bd1b696-c023c6e3521b1417.js", path = "/_next/static/chunks/" + chunk;
const url = base + path, prefix = "CAPTURE_PAGE_ERROR_DETAIL ";
const expected = { version: 1, errorClass: "TypeError", frame: { chunk, line: 1, column: 2468 } };
const stack = (target = url, row = 1, column = 2468) => `TypeError: SYNTHETIC_PRIVATE_CANARY\n    at x (${target}:${row}:${column})`;
const synthetic = (value = stack()) => ({ name: "TypeError", stack: value });
const project = error => capturePageErrorDiagnostic(error, base, [path]);
const read = (wire, accept = true) => { const reader = createPageErrorDiagnosticReader(accept); reader.write(wire); reader.end(); return reader; };
const wire = pageErrorDiagnosticLine(expected) + "\n";

test("real and cross-realm standard errors use only the exact name enum", () => {
  for (const Kind of [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, AggregateError]) {
    const error = Kind === AggregateError ? new AggregateError([], "SYNTHETIC_PRIVATE_CANARY") : new Kind("SYNTHETIC_PRIVATE_CANARY");
    assert.equal(project(error).errorClass, Kind.name);
  }
  assert.equal(project(runInNewContext('new TypeError("SYNTHETIC_PRIVATE_CANARY")')).errorClass, "TypeError");
  for (const value of [null, undefined, "TypeError: SYNTHETIC_PRIVATE_CANARY", 4, { name: "TypeError private" }, { name: "constructor" }]) assert.equal(project(value).errorClass, "Unknown");
});

test("Playwright-shaped native Error crosses the SDK boundary as inert bounded metadata", () => {
  const error = new Error("SYNTHETIC_PRIVATE_CANARY");
  error.name = "TypeError"; error.stack = stack();
  // Mirrors SDK reception on Node24: stack can remain a native accessor after assignment.
  assert.deepEqual(captureSdkPageErrorDiagnostic(error, base, [path]), expected);
  const materialized = new Error("SYNTHETIC_PRIVATE_CANARY");
  Object.defineProperty(materialized, "name", { value: "TypeError" });
  Object.defineProperty(materialized, "stack", { value: stack() });
  assert.deepEqual(project(materialized), expected);
  const appPath = "/_next/static/chunks/app/(workspace)/projetos/page-0123456789abcdef.js";
  assert.deepEqual(capturePageErrorDiagnostic(synthetic(stack(base + appPath)), base, [appPath]).frame, { chunk: "page-0123456789abcdef.js", line: 1, column: 2468 });
});


test("SDK boundary reads name/stack once, bounds primitives and fails closed before the pure helper", () => {
  let names = 0, stacks = 0, messages = 0;
  const error = Object.create(null);
  Object.defineProperties(error, {
    name: { get() { names++; return "TypeError"; } },
    stack: { get() { stacks++; return stack(); } },
    message: { get() { messages++; throw new Error("SYNTHETIC_PRIVATE_CANARY"); } },
  });
  assert.deepEqual(captureSdkPageErrorDiagnostic(error, base, [path]), expected); assert.deepEqual([names, stacks, messages], [1, 1, 0]);
  const denied = { name: "TypeError", get stack() { throw new Error("SYNTHETIC_PRIVATE_CANARY"); } };
  assert.deepEqual(captureSdkPageErrorDiagnostic(denied, base, [path]), { version: 1, errorClass: "Unknown", frame: null });
  assert.deepEqual(captureSdkPageErrorDiagnostic({ name: "x".repeat(33), stack: "x".repeat(16_385) }, base, [path]), { version: 1, errorClass: "Unknown", frame: null });
});
test("message, accessor properties and coercion methods are never invoked", () => {
  let reads = 0;
  const error = Object.create(null);
  for (const key of ["name", "message", "stack", "toString", Symbol.toPrimitive]) Object.defineProperty(error, key, { get() { reads++; throw new Error("SYNTHETIC_PRIVATE_CANARY"); } });
  assert.deepEqual(project(error), { version: 1, errorClass: "Unknown", frame: null });
  assert.equal(reads, 0);
  const known = { name: "TypeError", stack: stack() };
  Object.defineProperty(known, "message", { get() { reads++; throw new Error("SYNTHETIC_PRIVATE_CANARY"); } });
  assert.deepEqual(project(known), expected); assert.equal(reads, 0);
  for (const message of ["Minified React error #418", "TypeError", url, { token: "SYNTHETIC_PRIVATE_CANARY" }]) assert.deepEqual(project({ name: "Error", message }), { version: 1, errorClass: "Error", frame: null });
});

test("hostile reflection and revoked proxies fall back without replacing the error", () => {
  for (const handler of [{ getOwnPropertyDescriptor() { throw new Error("SYNTHETIC_PRIVATE_CANARY"); } }, { getPrototypeOf() { throw new Error("SYNTHETIC_PRIVATE_CANARY"); } }]) assert.doesNotThrow(() => project(new Proxy({}, handler)));
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  assert.deepEqual(project(revoked.proxy), { version: 1, errorClass: "Unknown", frame: null });
  let probes = 0; const loop = new Proxy({}, { getPrototypeOf() { probes++; return loop; } });
  assert.deepEqual(project(loop), { version: 1, errorClass: "Unknown", frame: null }); assert.ok(probes <= 5);
});

test("inventory admits only canonical exact-origin public Next hashed chunks", () => {
  assert.deepEqual(publicNextChunk(url, base), { path, chunk });
  for (const target of [
    url.replace("127.0.0.1", "localhost"), url.replace(":3110", ":3111"), url.replace("http:", "https:"),
    url.replace("127.0.0.1", "127.1"), url.replace("127.0.0.1", "2130706433"), url.replace("127.0.0.1", "127.0.0.1.invalid"),
    url.replace("http://", "http://user:private@"), url + "?token=SYNTHETIC_PRIVATE_CANARY", url + "#private", url + "?", url + "#",
    url.replace("/_next/", "/%5fnext/"), url.replace("/_next/", "/%255fnext/"), url.replace("chunks/", "chunks/../chunks/"),
    url.replace("chunks/", "chunks//"), url.replace("chunks/", "chunks/private/"), url.replace("chunks/", "chunks\\"),
    url.replace(".js", ".map"), url.replace(chunk, "private-name.js"), url.replace(chunk, "0123456789abcdef.js/private"),
    url + "\n", url.replace(chunk, "0123456789abcdeF.js"), url.replace(chunk, "0123456789abcde%66.js"),
  ]) assert.equal(publicNextChunk(target, base), null);
  for (const invalidBase of [base + "/", base + "?private", "https://127.0.0.1:3110", {}, null]) assert.equal(publicNextChunk(url, invalidBase), null);
});

test("frames require an observed exact path and never reflect header or private frames", () => {
  assert.equal(capturePageErrorDiagnostic(synthetic(), base, []).frame, null);
  assert.equal(capturePageErrorDiagnostic(synthetic(), base, [path + "?private"]).frame, null);
  assert.equal(project(synthetic(url + ":1:2468")).frame, null); // A URL in the header is not a frame.
  const privateStack = "Error: SYNTHETIC_PRIVATE_CANARY\n    at secret (file:///private/user.js:1:2)\n    at x (https://private.invalid/a.js:1:2)\n    at x (" + url + ":1:2468)";
  assert.deepEqual(project(synthetic(privateStack)).frame, expected.frame);
  for (const [row, column] of [[0, 1], [1, 0], [-1, 2], [1, "01"], [10_000_000, 2], [1, 10_000_000], ["1.1", 1]]) assert.equal(project(synthetic(stack(url, row, column))).frame, null);
  assert.equal(project(synthetic(stack(url + "?private"))).frame, null);
});

test("stack, frame count, inventory and output sizes remain bounded", () => {
  assert.equal(project(synthetic("x".repeat(16_385) + "\n    at x (" + url + ":1:2)")).frame, null);
  assert.equal(project(synthetic("Error\n" + "    at native\n".repeat(40) + "    at x (" + url + ":1:2)")).frame, null);
  assert.equal(capturePageErrorDiagnostic(synthetic(), base, Array(257).fill(path)).frame, null);
  assert.ok(wire.length < 256); assert.equal(wire.includes("SYNTHETIC_PRIVATE_CANARY"), false);
  assert.ok(Object.isFrozen(project(synthetic()))); assert.ok(Object.isFrozen(project(synthetic()).frame));
});

test("wire survives every split boundary and emits only the validated projection", () => {
  for (let split = 0; split <= wire.length; split++) {
    const reader = createPageErrorDiagnosticReader(true);
    reader.write(wire.slice(0, split)); reader.write(wire.slice(split));
    assert.deepEqual(reader.end(), { status: "accepted", diagnostic: expected });
    assert.deepEqual(reader.codes(), []);
  }
  const reader = createPageErrorDiagnosticReader(true);
  for (const character of wire) reader.write(character);
  assert.deepEqual(reader.end(), { status: "accepted", diagnostic: expected });
});

test("only capture stderr enables detail; protocol cannot inject legacy codes", () => {
  const malformed = prefix + '{"token":"CAPTURE_SYNTHETIC_PRIVATE_CANARY"}\n';
  for (const enabled of [false, true]) {
    const reader = read("CAPTURE_PAGE_ERROR\nCAPTURE_PHASE_READINESS\n" + malformed, enabled);
    assert.deepEqual(reader.codes(), ["CAPTURE_PAGE_ERROR", "CAPTURE_PHASE_READINESS"]);
    assert.equal(reader.snapshot().status, enabled ? "refused" : "missing");
  }
  const stdout = read(wire, false), stderr = read("CAPTURE_PAGE_ERROR\n", true);
  assert.equal(stdout.snapshot().status, "missing"); assert.equal(stderr.snapshot().status, "missing");
  assert.equal(pageErrorDiagnosticForReport("next", "CAPTURE_PAGE_ERROR", read(wire).snapshot()), null);
  assert.equal(pageErrorDiagnosticForReport("capture", "CAPTURE_HTTP_NOT_FOUND", read(wire).snapshot()), null);
  assert.deepEqual(pageErrorDiagnosticForReport("capture", "CAPTURE_PAGE_ERROR", read(wire).snapshot()), { status: "accepted", diagnostic: expected });
});

test("first protocol line is sticky; malformed, oversize and partial EOF cannot recover", () => {
  const invalid = prefix + '{"private":"SYNTHETIC_PRIVATE_CANARY"}\n';
  for (const candidate of [invalid, prefix + "x".repeat(300) + "\n", " " + wire, wire.replace("\n", "\r\n")]) {
    const reader = read(candidate + wire);
    assert.deepEqual(reader.snapshot(), { status: "refused", diagnostic: null });
    assert.deepEqual(reader.codes(), []);
  }
  assert.deepEqual(read(wire.slice(0, -1)).snapshot(), { status: "refused", diagnostic: null });
  const reader = read(wire + invalid); assert.deepEqual(reader.snapshot(), { status: "accepted", diagnostic: expected });
  reader.write(invalid); assert.deepEqual(reader.end(), { status: "accepted", diagnostic: expected });
});

test("strict shape and canonical JSON reject escapes, duplicate keys and arbitrary fields", () => {
  const bodies = [
    '{}', 'null', '[]', '{"version":1,"errorClass":"Error","frame":null,"message":"SYNTHETIC_PRIVATE_CANARY"}',
    '{"version":1,"errorClass":"Error","errorClass":"TypeError","frame":null}',
    '{"version":1,"errorClass":"\\u0045rror","frame":null}',
    '{"version":1,"errorClass":"Error private","frame":null}',
    '{"version":1,"errorClass":"Error","frame":{"chunk":"private.js","line":1,"column":2}}',
    '{"version":1,"errorClass":"Error","frame":{"chunk":"' + chunk + '","line":"1","column":2}}',
    '{"version":1,"errorClass":"Error","frame":null} ',
  ];
  for (const body of bodies) {
    const reader = read(prefix + body + "\n");
    assert.deepEqual(reader.snapshot(), { status: "refused", diagnostic: null }); assert.deepEqual(reader.codes(), []);
    assert.equal(JSON.stringify(reader.snapshot()).includes("SYNTHETIC_PRIVATE_CANARY"), false);
  }
});

test("arbitrary byte chunks and long noise are not forwarded or mixed across streams", () => {
  const noise = Buffer.from("SYNTHETIC_PRIVATE_CANARY é🙂\n", "utf8"), reader = createPageErrorDiagnosticReader(true);
  for (let index = 0; index < noise.length; index++) reader.write(noise.subarray(index, index + 1).toString("utf8"));
  reader.write("x".repeat(100_000) + "CAPTURE_SYNTHETIC_PRIVATE_CANARY\n" + wire);
  assert.deepEqual(reader.end(), { status: "accepted", diagnostic: expected }); assert.deepEqual(reader.codes(), []);
  const left = createPageErrorDiagnosticReader(true), right = createPageErrorDiagnosticReader(true);
  left.write(wire.slice(0, 40)); right.write(wire.slice(40));
  assert.equal(left.end().status, "refused"); assert.equal(right.end().status, "missing");
});

test("detail is supplemental and cannot recover fatal health or overwrite the first reason", () => {
  const fatal = firstCaptureDiagnostic(null, { kind: "pageerror" }, "readiness");
  assert.deepEqual(fatal, ["CAPTURE_PAGE_ERROR", "CAPTURE_PHASE_READINESS"]);
  const health = captureHealthAfter(0, { kind: "pageerror" });
  for (const state of [read(wire).snapshot(), read(prefix + "invalid\n").snapshot(), read("").snapshot()]) {
    assert.ok(pageErrorDiagnosticForReport("capture", fatal[0], state));
    assert.equal(captureHealthAfter(health, { kind: "http", status: 200 }), 1);
    assert.deepEqual(firstCaptureDiagnostic(fatal, { kind: "http", status: 500 }, "closing"), fatal);
  }
});
