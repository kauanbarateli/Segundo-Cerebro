import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceCapturePageGate, assertCaptureSource, assertProjectRecords, assertProjectTarget, captureFile,
  captureHealthAfter, captureOrigin, decideCaptureRequest, firstCaptureDiagnostic, parseCaptureOptions, projectFiles, projectRoute,
} from "../../scripts/landing/capture-policy.mjs";

const base = "http://127.0.0.1:3110";
const request = (url, method = "GET") => decideCaptureRequest({ url, method }, base).allowed;

test("CLI keeps the full and OG modes and closes the project-only scope", () => {
  assert.deepEqual(parseCaptureOptions([]), { mode: "all", base });
  assert.deepEqual(parseCaptureOptions(["--only", "projeto", "--base", `${base}/`]), { mode: "projeto", base });
  assert.deepEqual(parseCaptureOptions(["--og"]), { mode: "og", base });
  for (const args of [
    ["--only", "projetos"], ["--only", "projeto-celular"], ["--only", "../projeto"],
    ["--only"], ["--base"], ["--og", "--only", "projeto"],
    ["--base", base, "--base", base], ["--og", "--og"],
    ["--output", "somewhere"], ["--only", "projeto", "extra"], ["--base", "--og"],
  ]) assert.throws(() => parseCaptureOptions(args));
});

test("base is a root HTTP loopback URL, with no credentials or alternate IP spelling", () => {
  assert.equal(captureOrigin("http://localhost:3110/"), "http://localhost:3110");
  assert.equal(captureOrigin("http://127.0.0.1"), "http://127.0.0.1");
  for (const value of [
    "https://127.0.0.1:3110", "http://example.com:3110", "http://127.0.0.1.example.com",
    "http://localhost.example.com", "http://user:password@127.0.0.1:3110",
    `${base}/projetos`, `${base}/?mode=demo`, `${base}/#demo`, `${base}\n`,
    "http://127.1:3110", "http://2130706433:3110", "http://[::1]:3110",
    "http://127.0.0.1:0", "http://127.0.0.1:65536", "http://127.0.0.1:00000",
    "http://127.0.0.1:3110\\", "http://LOCALHOST:3110",
  ]) assert.throws(() => captureOrigin(value));
});

test("capture accepts only exact GET, rejecting actions and external connections", () => {
  assert.equal(request(`${base}/projetos?project=project-sc-v2`), true);
  assert.equal(request(`${base}/_next/static/chunks/app.js`), true);
  assert.equal(request(`${base}/fonts/geist.woff2`), true);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "get", ""]) {
    assert.equal(request(`${base}/projetos`, method), false, method);
  }
  for (const value of [
    "https://example.com/image.png", "http://localhost:3110/projetos", "http://127.0.0.1:3111/",
    "https://127.0.0.1:3110/", "http://person:secret@127.0.0.1:3110/",
    "ws://127.0.0.1:3110/", "data:text/plain,test", "file:///tmp/test",
    `${base}/x#fragment`, `${base}/x\n`, `${base}/\\api`,
  ]) assert.equal(request(value), false, value);
});

test("API routes cannot be hidden with case, percent encoding or dot segments", () => {
  for (const pathname of [
    "/api", "/api/calendar", "/API/calendar", "/%61pi/calendar", "/api%2fcalendar",
    "/%2561pi/calendar", "/%252561pi/calendar", "/x/%2e%2e/api/secret",
    "/x/%252e%252e/%2561pi/secret", "//api/calendar", "/api//calendar",
    "/api%5ccalendar", "/%", "/%ZZ", "/%2500", "/%25252525252561pi/calendar",
  ]) assert.equal(request(base + pathname), false, pathname);
  assert.equal(request(`${base}/apiary.svg`), true);
});

test("the same-origin image optimizer cannot proxy external or API targets", () => {
  const image = (target) => `${base}/_next/image?url=${encodeURIComponent(target)}&w=640&q=75`;
  assert.equal(request(image("/images/demo.webp")), true);
  assert.equal(request(image(`${base}/images/demo.webp`)), true);
  for (const target of [
    "https://example.com/demo.webp", "//example.com/demo.webp", "/api/files/image",
    "/%2561pi/image", "/_next/image?url=%2Fimages%2Fdemo.webp", "data:image/png,test",
  ]) assert.equal(request(image(target)), false, target);
  assert.equal(request(`${base}/_next/image?w=640`), false);
  assert.equal(request(`${base}/_next/image?url=/a.webp&url=/b.webp`), false);
  assert.equal(request(`${base}/%5fnext/image?url=https%3A%2F%2Fexample.com%2Fx`), false);
});

test("project capture refuses another project, duplicate ID, extra query or destination", () => {
  assert.equal(assertProjectTarget(base + projectRoute, base), projectRoute);
  for (const pathname of [
    "/projetos?project=another", "/projetos?project=project-sc-v2&project=project-sc-v2",
    "/projetos?project=project-sc-v2&trash=1", "/projetos?project=project-sc-v2#edit",
    "/projetos", "/projetos/?project=project-sc-v2", "/tarefas?project=project-sc-v2",
  ]) assert.throws(() => assertProjectTarget(base + pathname, base));
  assert.throws(() => assertProjectTarget("https://example.com" + projectRoute, base));
  assert.throws(() => assertProjectTarget("http://user:secret@127.0.0.1:3110" + projectRoute, base));
});

test("four outputs are fixed; project-only cannot touch the other 26 assets", () => {
  assert.deepEqual(projectFiles(), [
    "src/components/features/conheca/telas/projeto.webp",
    "src/components/features/conheca/telas/projeto-celular.webp",
    "src/components/features/conheca/telas/projeto-escuro.webp",
    "src/components/features/conheca/telas/projeto-celular-escuro.webp",
  ]);
  for (const name of ["inicio", "capturar", "projetos", "../projeto", "/projeto", "projeto.webp", "cofre"]) {
    assert.throws(() => captureFile("projeto", name, "light"));
  }
  assert.equal(captureFile("all", "inicio", "dark"), "src/components/features/conheca/telas/inicio-escuro.webp");
  assert.throws(() => captureFile("projeto", "projeto", "automatic"));
  assert.throws(() => captureFile("og", "projeto", "light"));
  assert.throws(() => captureFile("unknown", "projeto", "light"));
});

test("source must be a clean demo checkout bound to the exact workflow SHA", () => {
  const source = { sha: "1".repeat(40), tree: "2".repeat(40), expectedSha: "1".repeat(40), clean: true, mode: "demo" };
  assert.deepEqual(assertCaptureSource(source), { sha: source.sha, tree: source.tree });
  for (const change of [
    { clean: false }, { clean: "true" }, { mode: "supabase" }, { mode: undefined },
    { sha: "1".repeat(39) }, { tree: "2".repeat(41) }, { expectedSha: "3".repeat(40) },
    { sha: "1".repeat(40) + "\n" }, { expectedSha: "" },
  ]) assert.throws(() => assertCaptureSource({ ...source, ...change }));
});

test("receipt cannot pass with a missing, reordered, duplicated or foreign asset", () => {
  const records = projectFiles().map((file) => ({ file, sidecar: `${file}.json`, sha256: "1".repeat(64), sidecarSha256: "2".repeat(64) }));
  assert.doesNotThrow(() => assertProjectRecords(records));
  assert.throws(() => assertProjectRecords(records.slice(0, 3)));
  assert.throws(() => assertProjectRecords([...records, records[0]]));
  assert.throws(() => assertProjectRecords([records[1], records[0], ...records.slice(2)]));
  for (const change of [
    { file: "src/components/features/conheca/telas/inicio.webp" },
    { sidecar: "../outside.json" }, { sha256: "missing" }, { sidecarSha256: "2".repeat(63) },
  ]) assert.throws(() => assertProjectRecords([{ ...records[0], ...change }, ...records.slice(1)]));
});

test("transport, HTTP and page faults remain sticky after later successful responses", () => {
  for (const observation of [
    { kind: "requestfailed" }, { kind: "pageerror" }, { kind: "crash" }, { kind: "unexpectedPage" }, { kind: "popupClose" },
    { kind: "http", status: 400 }, { kind: "http", status: 404 }, { kind: "http", status: 500 },
    { kind: "http", status: 599 },
  ]) {
    const failures = captureHealthAfter(0, observation);
    assert.equal(failures, 1);
    assert.equal(captureHealthAfter(failures, { kind: "http", status: 200 }), 1);
    assert.equal(captureHealthAfter(failures, { kind: "http", status: 304 }), 1);
    assert.equal(captureHealthAfter(failures, { kind: "pageerror" }), 2);
  }
  for (const status of [100, 200, 204, 301, 304, 399]) assert.equal(captureHealthAfter(0, { kind: "http", status }), 0);
  for (const observation of [{ kind: "reset" }, { kind: "http", status: 0 }, { kind: "http", status: 600 }, { kind: "http", status: "200" }]) {
    assert.throws(() => captureHealthAfter(1, observation));
  }
  for (const previous of [-1, 0.5, NaN, Number.MAX_SAFE_INTEGER]) assert.throws(() => captureHealthAfter(previous, { kind: "pageerror" }));
});

test("a fresh context admits only the page explicitly requested, never an extra page", () => {
  assert.deepEqual(advanceCapturePageGate("unused", "page"), { state: "unused", allowed: false });
  const requested = advanceCapturePageGate("unused", "request");
  assert.deepEqual(requested, { state: "opening", allowed: true });
  assert.throws(() => advanceCapturePageGate(requested.state, "request"));
  const claimed = advanceCapturePageGate(requested.state, "page");
  assert.deepEqual(claimed, { state: "claimed", allowed: true });
  assert.deepEqual(advanceCapturePageGate(claimed.state, "page"), { state: "claimed", allowed: false });
  assert.throws(() => advanceCapturePageGate(claimed.state, "request"));
  assert.throws(() => advanceCapturePageGate("unused", "reset"));
  assert.throws(() => advanceCapturePageGate("foreign", "page"));
});

test("denied requests expose only the closed policy category, never request content", () => {
  for (const [url, method, expected] of [
    [`${base}/api/private?token=not-for-output`, "GET", "CAPTURE_REQUEST_API"],
    ["https://private.example.invalid/person?token=not-for-output", "GET", "CAPTURE_REQUEST_ORIGIN"],
    [`${base}/projetos`, "POST", "CAPTURE_REQUEST_METHOD"],
    [`${base}/%ZZ`, "GET", "CAPTURE_REQUEST_PATH"],
    [`${base}/_next/image?url=`, "GET", "CAPTURE_IMAGE_TARGET"],
  ]) {
    const decision = decideCaptureRequest({ url, method }, base);
    assert.deepEqual(decision, { allowed: false, code: expected });
    assert.deepEqual(firstCaptureDiagnostic(null, { kind: "policy", code: decision.code }, "opening"), [expected, "CAPTURE_PHASE_OPENING"]);
    assert.equal(JSON.stringify(decision).includes("not-for-output"), false);
  }
  assert.deepEqual(firstCaptureDiagnostic(null, { kind: "policy", code: "CAPTURE_REQUEST_API https://private.invalid/secret" }, "opening"), ["CAPTURE_REQUEST_POLICY", "CAPTURE_PHASE_OPENING"]);
});

test("HTTP diagnostics distinguish common errors and bounded status classes without digits", () => {
  for (const [status, code] of [
    [400, "CAPTURE_HTTP_CLIENT_ERROR"], [401, "CAPTURE_HTTP_UNAUTHORIZED"], [403, "CAPTURE_HTTP_FORBIDDEN"],
    [404, "CAPTURE_HTTP_NOT_FOUND"], [408, "CAPTURE_HTTP_REQUEST_TIMEOUT"], [429, "CAPTURE_HTTP_RATE_LIMIT"],
    [499, "CAPTURE_HTTP_CLIENT_ERROR"], [500, "CAPTURE_HTTP_INTERNAL_ERROR"], [502, "CAPTURE_HTTP_BAD_GATEWAY"],
    [503, "CAPTURE_HTTP_UNAVAILABLE"], [504, "CAPTURE_HTTP_GATEWAY_TIMEOUT"], [599, "CAPTURE_HTTP_SERVER_ERROR"],
  ]) {
    const codes = firstCaptureDiagnostic(null, { kind: "http", status }, "readiness");
    assert.deepEqual(codes, [code, "CAPTURE_PHASE_READINESS"]);
    assert.ok(codes.every((value) => /^CAPTURE_[A-Z_]{1,60}$/u.test(value)));
  }
  for (const status of [0, 200, 600, "404", NaN, "404 secret"]) {
    assert.deepEqual(firstCaptureDiagnostic(null, { kind: "http", status }, "readiness"), ["CAPTURE_HTTP_STATUS_INVALID", "CAPTURE_PHASE_READINESS"]);
  }
});

test("first fatal reason, phase and closed resource type survive later cleanup failures", () => {
  const first = firstCaptureDiagnostic(null, { kind: "requestfailed", resourceType: "font" }, "readiness");
  assert.deepEqual(first, ["CAPTURE_REQUEST_FAILED", "CAPTURE_PHASE_READINESS", "CAPTURE_RESOURCE_FONT"]);
  assert.deepEqual(firstCaptureDiagnostic(first, { kind: "http", status: 500 }, "closing"), first);
  assert.deepEqual(firstCaptureDiagnostic(first, { kind: "popupClose" }, "closing"), first);
  assert.ok(Object.isFrozen(first));
  assert.throws(() => { first[0] = "private-value"; });
  for (const resourceType of [undefined, "font?private", "constructor", "https://private.invalid/x", { token: "private-value" }]) {
    assert.deepEqual(firstCaptureDiagnostic(null, { kind: "requestfailed", resourceType }, "mobile"), ["CAPTURE_REQUEST_FAILED", "CAPTURE_PHASE_MOBILE", "CAPTURE_RESOURCE_OTHER"]);
  }
  assert.throws(() => firstCaptureDiagnostic(["https://private.invalid", "CAPTURE_PHASE_OPENING"], {}, "opening"), /CAPTURE_DIAGNOSTIC_STATE/u);
  assert.throws(() => firstCaptureDiagnostic(["CAPTURE_HTTP_NOT_FOUND", "CAPTURE_PHASE_OPENING", "CAPTURE_RESOURCE_FONT"], {}, "opening"), /CAPTURE_DIAGNOSTIC_STATE/u);
});

test("fatal diagnostics use literal categories and never parse arbitrary provider messages", () => {
  for (const [kind, code] of [
    ["pageerror", "CAPTURE_PAGE_ERROR"], ["crash", "CAPTURE_PAGE_CRASH"], ["unexpectedPage", "CAPTURE_POPUP"],
    ["popupClose", "CAPTURE_POPUP_CLOSE"], ["download", "CAPTURE_DOWNLOAD"], ["websocket", "CAPTURE_WEBSOCKET"],
    ["interrupted", "CAPTURE_INTERRUPTED"],
  ]) assert.deepEqual(firstCaptureDiagnostic(null, { kind, message: "private-text" }, "pixels"), [code, "CAPTURE_PHASE_PIXELS"]);
  assert.deepEqual(firstCaptureDiagnostic(null, { kind: "operation", code: "CAPTURE_PROJECT_NOT_READY" }, "readiness"), ["CAPTURE_PROJECT_NOT_READY", "CAPTURE_PHASE_READINESS"]);
  for (const code of ["Error: CAPTURE_PROJECT_NOT_READY private-value", "<html>private-value</html>", new Error("private-value")]) {
    assert.deepEqual(firstCaptureDiagnostic(null, { kind: "operation", code }, "readiness"), ["CAPTURE_OPERATION_FAILED", "CAPTURE_PHASE_READINESS"]);
  }
  assert.deepEqual(firstCaptureDiagnostic(null, { kind: "private-value", resourceType: "private-value" }, "private-value"), ["CAPTURE_UNKNOWN_FAILURE", "CAPTURE_PHASE_UNKNOWN"]);
});
