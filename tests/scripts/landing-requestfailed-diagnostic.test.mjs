import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { captureHealthAfter, firstCaptureDiagnostic } from "../../scripts/landing/capture-policy.mjs";
import { createPageErrorDiagnosticReader } from "../../scripts/landing/capture-pageerror-diagnostic.mjs";
import {
  captureRequestFailedDiagnostic, captureSdkRequestFailedDiagnostic, requestFailedDiagnosticForReport,
  requestFailedDiagnosticLine, validateRequestFailedDiagnostic,
} from "../../scripts/landing/capture-requestfailed-diagnostic.mjs";

const base = "http://127.0.0.1:3110", prefix = "CAPTURE_REQUEST_FAILED_DETAIL ";
const canary = "SYNTHETIC_PRIVATE_CANARY";
const input = (change = {}) => ({ failureText: "net::ERR_ABORTED", method: "GET", url: base + "/projetos?project=synthetic&_rsc=synthetic", rsc: undefined, routerPrefetch: undefined, secPurpose: undefined, ...change });
const expected = { version: 1, transport: "ABORTED", scope: "ALLOWED_GET", target: "PROJECT_PATH", rsc: "NO", routerPrefetch: "NO", purposePrefetch: "NO" };
const project = change => captureRequestFailedDiagnostic(input(change), base);
const unknown = { version: 1, transport: "UNKNOWN", scope: "UNVERIFIED", target: "UNVERIFIED", rsc: "UNKNOWN", routerPrefetch: "UNKNOWN", purposePrefetch: "UNKNOWN" };
function reader(wire, accept = true) {
  const value = createPageErrorDiagnosticReader(accept); value.write(wire); value.end(); return value;
}
function fakeRequest(change = {}) {
  const calls = { failure: 0, method: 0, url: 0, headers: 0, forbidden: 0 };
  const request = {
    failure() { calls.failure++; return { errorText: "net::ERR_ABORTED" }; },
    method() { calls.method++; return "GET"; },
    url() { calls.url++; return base + "/projetos?project=synthetic"; },
    headers() { calls.headers++; return { rsc: "1", "next-router-prefetch": "1", "sec-purpose": "prefetch" }; },
    ...change,
  };
  for (const key of ["allHeaders", "headerValue", "postData", "postDataBuffer", "frame", "message", "stack", "cause"]) {
    Object.defineProperty(request, key, { get() { calls.forbidden++; throw Error(canary); } });
  }
  return { request, calls };
}

test("exact transport enums never parse or reflect arbitrary failure text", () => {
  assert.deepEqual(project({}), expected);
  assert.equal(project({ failureText: "net::ERR_CONNECTION_REFUSED" }).transport, "CONNECTION_REFUSED");
  for (const failureText of ["net::ERR_FAILED", canary, "x net::ERR_ABORTED", "net::ERR_ABORTED "]) {
    assert.equal(project({ failureText }).transport, "OTHER");
    assert.equal(JSON.stringify(project({ failureText })).includes(failureText), false);
  }
  for (const failureText of [undefined, null, "", {}, [], 1, "\nnet::ERR_ABORTED", "x".repeat(65)]) {
    assert.equal(project({ failureText }).transport, "UNKNOWN");
  }
});

test("target only classifies exact canonical pathname and never validates project query", () => {
  for (const suffix of ["/projetos", "/projetos?project=another", "/projetos?secret="+canary, "/projetos?_rsc=synthetic"]) {
    const value = project({ url: base + suffix });
    assert.equal(value.target, "PROJECT_PATH"); assert.equal(JSON.stringify(value).includes(canary), false);
  }
  for (const suffix of ["/tarefas", "/projetos/", "/Projetos", "/%70rojetos", "/capturar/", "/Capturar", "/%63apturar", "/_next/static/chunks/1-0123456789abcdef.js"]) {
    assert.equal(project({ url: base + suffix }).target, "OTHER_ALLOWED");
  }
});

test("Home and Capture targets are exact finite path enums after the same admission, without exposing query values", () => {
  for (const [path, target] of [["/", "HOME_PATH"], ["/capturar", "CAPTURE_PATH"]]) {
    for (const query of ["", "?_rsc=synthetic", "?private=" + canary]) {
      const value = project({ url: base + path + query, rsc: "1" });
      assert.deepEqual(value, { ...expected, target, rsc: "YES" });
      assert.equal(JSON.stringify(value).includes(canary), false);
      assert.equal(JSON.stringify(value).includes(base), false);
    }
    for (const change of [{ method: "POST" }, { url: "https://private.invalid" + path }, { url: base + path + "#private" }, { url: base + "/other/.." + path }]) {
      const value = project({ url: base + path, rsc: "1", ...change });
      assert.equal(value.target, "UNVERIFIED"); assert.equal(value.scope, "UNVERIFIED"); assert.equal(value.rsc, "UNKNOWN");
    }
  }
});

test("method origin path and optimizer guards remain mandatory for header signals", () => {
  const cases = [
    { method: "POST" }, { method: "get" }, { method: {} }, { url: "/projetos" },
    { url: "http://localhost:3110/projetos" }, { url: "http://127.0.0.1:3111/projetos" },
    { url: "https://127.0.0.1:3110/projetos" }, { url: "http://user@127.0.0.1:3110/projetos" },
    { url: base + "/api/x" }, { url: base + "/%61pi/x" }, { url: base + "/x/../api/x" },
    { url: base + "/_next/image?url=https%3A%2F%2Fprivate.invalid%2Fx" },
    { url: base + "/_next/image?url=%2Fapi%2Fx" }, { url: base + "/projetos#private" },
    { url: base + "/x/../projetos" }, { url: base + "/" + "x".repeat(8192) },
  ];
  for (const change of cases) {
    const value = project({ rsc: "1", routerPrefetch: "1", secPurpose: "prefetch", ...change });
    assert.equal(value.scope, "UNVERIFIED"); assert.equal(value.target, "UNVERIFIED");
    assert.equal(value.rsc, "UNKNOWN"); assert.equal(value.routerPrefetch, "UNKNOWN"); assert.equal(value.purposePrefetch, "UNKNOWN");
  }
  assert.deepEqual(captureRequestFailedDiagnostic(input(), "http://127.0.0.1:3110/"), { ...expected, scope: "UNVERIFIED", target: "UNVERIFIED", rsc: "UNKNOWN", routerPrefetch: "UNKNOWN", purposePrefetch: "UNKNOWN" });
});

test("three positive header signals are exact independent observations", () => {
  assert.deepEqual(project({ rsc: "1", routerPrefetch: "1", secPurpose: "prefetch" }), { ...expected, rsc: "YES", routerPrefetch: "YES", purposePrefetch: "YES" });
  assert.deepEqual(project({ rsc: "1" }), { ...expected, rsc: "YES" });
  assert.deepEqual(project({ routerPrefetch: "1" }), { ...expected, routerPrefetch: "YES" });
  assert.deepEqual(project({ secPurpose: "prefetch" }), { ...expected, purposePrefetch: "YES" });
});

test("missing is distinct from unsupported and oversized header values", () => {
  for (const [key, output] of [["rsc", "rsc"], ["routerPrefetch", "routerPrefetch"], ["secPurpose", "purposePrefetch"]]) {
    assert.equal(project({ [key]: undefined })[output], "NO");
    for (const value of [null, "0", "", " 1", "1 ", "1,1", "PREFETCH", "prefetch;prerender", "\nprefetch", "x".repeat(33), {}, [], 1]) {
      assert.equal(project({ [key]: value })[output], "UNKNOWN");
    }
  }
});

test("pure input is own data only and never invokes accessors or coercion", () => {
  let reads = 0;
  for (const key of Object.keys(input())) {
    const value = input(); Object.defineProperty(value, key, { get() { reads++; throw Error(canary); } });
    assert.deepEqual(captureRequestFailedDiagnostic(value, base), unknown);
  }
  const inherited = Object.create(input());
  assert.deepEqual(captureRequestFailedDiagnostic(inherited, base), unknown);
  assert.deepEqual(captureRequestFailedDiagnostic({ ...input(), extra: canary }, base), unknown);
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  assert.deepEqual(captureRequestFailedDiagnostic(revoked.proxy, base), unknown);
  const throwing = new Proxy({}, { ownKeys() { throw Error(canary); } });
  assert.deepEqual(captureRequestFailedDiagnostic(throwing, base), unknown);
  assert.equal(reads, 0);
});

test("SDK boundary calls synchronous methods once and never reads unrelated data", () => {
  const fixture = fakeRequest();
  const headers = { rsc: "1", "next-router-prefetch": "1", "sec-purpose": "prefetch" };
  for (const key of ["cookie", "authorization", canary]) Object.defineProperty(headers, key, { get() { fixture.calls.forbidden++; throw Error(canary); } });
  fixture.request.headers = () => { fixture.calls.headers++; return headers; };
  const value = captureSdkRequestFailedDiagnostic(fixture.request, base);
  assert.deepEqual(value, { ...expected, rsc: "YES", routerPrefetch: "YES", purposePrefetch: "YES" });
  assert.deepEqual(fixture.calls, { failure: 1, method: 1, url: 1, headers: 1, forbidden: 0 });
  assert.equal(JSON.stringify(value).includes(canary), false);
});

test("SDK refuses header reads when GET/origin/path admission is unverified", () => {
  for (const kind of ["method", "url"]) {
    const fixture = fakeRequest();
    fixture.request[kind] = () => { fixture.calls[kind]++; return kind === "method" ? "POST" : "https://private.invalid/"+canary; };
    const value = captureSdkRequestFailedDiagnostic(fixture.request, base);
    assert.equal(value.target, "UNVERIFIED"); assert.equal(fixture.calls.headers, 0); assert.equal(fixture.calls.forbidden, 0);
  }
});

test("SDK read failure is bounded and never replaces the original fatal state", () => {
  for (const key of ["failure", "method", "url", "headers"]) {
    const fixture = fakeRequest();
    fixture.request[key] = () => { fixture.calls[key]++; throw Error(canary); };
    const value = captureSdkRequestFailedDiagnostic(fixture.request, base);
    assert.equal(fixture.calls[key], 1); assert.equal(fixture.calls.forbidden, 0);
    assert.equal(JSON.stringify(value).includes(canary), false);
    if (key === "failure") assert.equal(value.transport, "UNKNOWN");
    if (key === "headers") assert.equal(value.rsc, "UNKNOWN");
    if (key === "method" || key === "url") assert.equal(value.scope, "UNVERIFIED");
  }
});

test("SDK strange failure and header shapes close unknown without getters", () => {
  let reads = 0;
  const fixture = fakeRequest({
    failure() { return { errorText: "net::ERR_ABORTED", extra: canary }; },
    headers() { const value = {}; Object.defineProperty(value, "rsc", { get() { reads++; return "1"; } }); return value; },
  });
  const value = captureSdkRequestFailedDiagnostic(fixture.request, base);
  assert.equal(value.transport, "UNKNOWN"); assert.equal(value.rsc, "UNKNOWN"); assert.equal(reads, 0);
  for (const headers of [null, [], "prefetch", Object.create({ rsc: "1" })]) {
    assert.equal(captureSdkRequestFailedDiagnostic(fakeRequest({ headers() { return headers; } }).request, base).rsc, "UNKNOWN");
  }
});

test("projection and wire validators reject extra keys and inconsistent enums", () => {
  assert.deepEqual(validateRequestFailedDiagnostic(expected), expected);
  for (const change of [{ version: 2 }, { transport: canary }, { scope: "UNVERIFIED" }, { target: "UNVERIFIED" }, { rsc: true }, { extra: canary }]) {
    assert.equal(validateRequestFailedDiagnostic({ ...expected, ...change }), null);
  }
  const accessor = { ...expected }; Object.defineProperty(accessor, "transport", { get() { throw Error(canary); } });
  assert.equal(validateRequestFailedDiagnostic(accessor), null);
  const wire = requestFailedDiagnosticLine({ ...expected, transport: "CONNECTION_REFUSED", target: "OTHER_ALLOWED", rsc: "UNKNOWN", routerPrefetch: "UNKNOWN", purposePrefetch: "UNKNOWN" });
  assert.ok(wire.length <= 256); assert.equal(wire.includes(canary), false);
  assert.equal(requestFailedDiagnosticLine({ raw: canary }).includes(canary), false);
});

test("requestfailed wire survives every chunk split without polluting legacy codes", () => {
  const wire = requestFailedDiagnosticLine(expected) + "\n";
  for (let at = 0; at <= wire.length; at++) {
    const value = createPageErrorDiagnosticReader(true);
    value.write(wire.slice(0, at)); value.write(wire.slice(at)); value.end();
    assert.deepEqual(value.requestFailedSnapshot(), { status: "accepted", diagnostic: expected });
    assert.deepEqual(value.codes(), []);
  }
  const value = reader("CAPTURE_REQUEST_FAILED\nCAPTURE_PHASE_READINESS\nCAPTURE_RESOURCE_FETCH\n"+wire);
  assert.deepEqual(value.codes(), ["CAPTURE_REQUEST_FAILED", "CAPTURE_PHASE_READINESS", "CAPTURE_RESOURCE_FETCH"]);
});

test("Home and Capture enums survive closed readers and reports while every aborted RSC remains fatal", () => {
  for (const target of ["HOME_PATH", "CAPTURE_PATH"]) {
    const diagnostic = { ...expected, target, rsc: "YES" }, line = requestFailedDiagnosticLine(diagnostic), wire = line + "\n";
    assert.deepEqual(validateRequestFailedDiagnostic(diagnostic), diagnostic);
    assert.ok(line.length <= 256);
    for (let at = 0; at <= wire.length; at++) {
      const value = createPageErrorDiagnosticReader(true);
      value.write(wire.slice(0, at)); value.write(wire.slice(at)); value.end();
      assert.deepEqual(value.requestFailedSnapshot(), { status: "accepted", diagnostic });
      assert.deepEqual(value.codes(), []);
      assert.deepEqual(requestFailedDiagnosticForReport("capture", "CAPTURE_REQUEST_FAILED", value.requestFailedSnapshot()), { status: "accepted", diagnostic });
    }
    assert.equal(captureHealthAfter(0, { kind: "requestfailed", resourceType: "fetch", detail: diagnostic }), 1);
    const first = firstCaptureDiagnostic(null, { kind: "requestfailed", resourceType: "fetch" }, "readiness");
    assert.deepEqual(first, ["CAPTURE_REQUEST_FAILED", "CAPTURE_PHASE_READINESS", "CAPTURE_RESOURCE_FETCH"]);
    assert.deepEqual(firstCaptureDiagnostic(first, { kind: "pageerror" }, "closing"), first);
    assert.equal(requestFailedDiagnosticForReport("next", "CAPTURE_REQUEST_FAILED", { status: "accepted", diagnostic }), null);
    assert.equal(requestFailedDiagnosticForReport("capture", "CAPTURE_PAGE_ERROR", { status: "accepted", diagnostic }), null);
    assert.equal(validateRequestFailedDiagnostic({ ...diagnostic, target: target + "_OTHER" }), null);
    assert.equal(validateRequestFailedDiagnostic({ ...diagnostic, target: "UNVERIFIED" }), null);
  }
});

test("malformed oversized partial and noncanonical wire is sticky refused", () => {
  const valid = requestFailedDiagnosticLine(expected) + "\n";
  for (const malformed of [
    prefix+"{}\n", "x "+valid, prefix+" "+JSON.stringify(expected)+"\n",
    prefix+JSON.stringify({ ...expected, raw: canary })+"\n", prefix+"x".repeat(300)+"\n",
    prefix+JSON.stringify({ ...expected, transport: "CAPTURE_PAGE_CRASH" })+"\n", valid.trimEnd(),
  ]) {
    const value = reader(malformed.endsWith("\n") ? malformed + valid : malformed);
    assert.deepEqual(value.requestFailedSnapshot(), { status: "refused", diagnostic: null });
    assert.deepEqual(value.codes(), []);
    assert.deepEqual(value.requestFailedSnapshot(), { status: "refused", diagnostic: null });
  }
});

test("first protocol observation wins and streams or protocol families never concatenate", () => {
  const valid = requestFailedDiagnosticLine(expected) + "\n";
  const accepted = reader(valid + requestFailedDiagnosticLine({ ...expected, transport: "OTHER" })+"\n");
  assert.deepEqual(accepted.requestFailedSnapshot().diagnostic, expected);
  const a = reader(valid.slice(0, 50)), b = reader(valid.slice(50));
  assert.notEqual(a.requestFailedSnapshot().status, "accepted"); assert.notEqual(b.requestFailedSnapshot().status, "accepted");
  const crossed = reader(prefix+'{"x":"CAPTURE_PAGE_ERROR_DETAIL"}\n');
  assert.equal(crossed.requestFailedSnapshot().status, "refused"); assert.equal(crossed.snapshot().status, "refused"); assert.deepEqual(crossed.codes(), []);
  const ignored = reader(valid, false);
  assert.deepEqual(ignored.requestFailedSnapshot(), { status: "missing", diagnostic: null }); assert.deepEqual(ignored.codes(), []);
});

test("report only accepts capture first-requestfailed and revalidates the state", () => {
  const state = { status: "accepted", diagnostic: expected };
  assert.deepEqual(requestFailedDiagnosticForReport("capture", "CAPTURE_REQUEST_FAILED", state), state);
  for (const role of ["next", "server", canary]) assert.equal(requestFailedDiagnosticForReport(role, "CAPTURE_REQUEST_FAILED", state), null);
  for (const code of ["CAPTURE_PAGE_ERROR", "CAPTURE_HTTP_NOT_FOUND", "CAPTURE_REQUEST_API", canary]) assert.equal(requestFailedDiagnosticForReport("capture", code, state), null);
  for (const status of ["missing", "refused"]) assert.deepEqual(requestFailedDiagnosticForReport("capture", "CAPTURE_REQUEST_FAILED", { status, diagnostic: null }), { status, diagnostic: null });
  assert.deepEqual(requestFailedDiagnosticForReport("capture", "CAPTURE_REQUEST_FAILED", { status: "accepted", diagnostic: { raw: canary } }), { status: "refused", diagnostic: null });
});

test("ABORTED RSC and prefetch remain fatal and cannot change first-failure codes", () => {
  const first = firstCaptureDiagnostic(null, { kind: "requestfailed", resourceType: "fetch" }, "readiness");
  assert.deepEqual(first, ["CAPTURE_REQUEST_FAILED", "CAPTURE_PHASE_READINESS", "CAPTURE_RESOURCE_FETCH"]);
  for (const detail of [expected, project({ rsc: "1", routerPrefetch: "1", secPurpose: "prefetch" }), unknown]) {
    assert.equal(captureHealthAfter(0, { kind: "requestfailed", resourceType: "fetch", detail }), 1);
    assert.deepEqual(firstCaptureDiagnostic(first, { kind: "pageerror" }, "closing"), first);
    assert.deepEqual(firstCaptureDiagnostic(first, { kind: "popupClose" }, "closing"), first);
  }
});

test("source wiring records fatal first and guards both independent diagnostic module hashes", async () => {
  const cli = await readFile(new URL("../../scripts/landing/capturar-telas.mjs", import.meta.url), "utf8");
  const supervisor = await readFile(new URL("../../scripts/landing/capture-project-ci.mjs", import.meta.url), "utf8");
  const start = cli.indexOf('context.on("requestfailed"'), end = cli.indexOf('context.on("response"', start);
  const handler = cli.slice(start, end);
  assert.ok(handler.indexOf("observeCaptureHealth(") < handler.indexOf("captureSdkRequestFailedDiagnostic("));
  assert.match(handler, /if \(first\) console\.error\(requestFailedDiagnosticLine\(captureSdkRequestFailedDiagnostic\(request, base\)\)\)/u);
  assert.equal((cli.match(/capture-requestfailed-diagnostic\.mjs/gu) ?? []).length, 3);
  assert.match(supervisor, /const sourceKeys = \["sha", "tree", "generatorSha256", "policySha256"\]/u);
  assert.match(supervisor, /requestFailedModuleSha256 = hash\(await canonical\(codeFiles\[3\], 32 \* 1024\)\)/u);
  assert.match(supervisor, /hash\(await canonical\(codeFiles\[3\], 32 \* 1024\)\) === requestFailedModuleSha256/u);
  assert.match(supervisor, /state\.bytes > 512 \* 1024/u);
});
