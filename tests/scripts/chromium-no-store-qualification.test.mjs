import test from "node:test";
import assert from "node:assert/strict";
import { QUALIFICATION_CASES, observeOriginalContinue, parseQualificationArguments, timerPromise, validateQualificationReport } from "../../scripts/verification/chromium-no-store-qualification.mjs";

const HASHES = { playwrightPackage: "8bc2ddebe8d9b051b9ecb87d62c6c63877e59d08617f32c3215681ca8bb70998", corePackage: "f061c58427e47e843e26d201f0a57076c734e57c734ecbbd87d4a23b7a20db9b", coreBundle: "549070af3acabb3efcc4f55bfe6210f9f7c2fcf633cf7eaa59bfe60719969171", browsers: "545d52f8382c391e605562c330e9c1c534a16045898203037a49bb8bd769a946" };
const refused = fn => assert.throws(fn, { message: "REPORT_REFUSED" });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function full(mode = "candidate", interception = "off") {
  const version = mode === "old" ? "153.0.8010.12" : "157.0.8103.6";
  const cases = QUALIFICATION_CASES.map(kind => {
    const negative = !kind.startsWith("positive"), routing = interception === "continue";
    return { kind, bytesRead: kind === "abort" ? 6 : 11, body: negative ? kind === "abort" ? "aborted" : "incomplete" : "complete", publicStarted: 1, publicResponses: 1, publicFinished: negative ? 0 : 1, publicFailed: negative ? 1 : 0, response: "200", responseFinished: negative ? "pending" : "finished", cdpStarted: 1, cdpResponses: 1, cdpFinished: negative ? 0 : 1, cdpFailed: negative ? 1 : 0, cdpResponse: "200", serverReceived: 1, serverFinished: negative ? 0 : 1, serverPrematureClose: negative ? 1 : 0, routeStarted: routing ? 1 : 0, routeSettled: routing ? 1 : 0, routeRejected: 0, fetchContinueStarted: routing ? 1 : 0, fetchContinueResolved: routing ? 1 : 0, fetchContinueRejected: 0, requestIdentity: routing ? "exact" : "not-applicable", protocolIdentity: routing ? "exact" : "not-applicable", result: negative ? "NEGATIVE_PASSED" : "NATURAL_FINISHED" };
  });
  const phases = [["manifest", null], ["sdk", null], ["browser", null], ["document", null], ...QUALIFICATION_CASES.map(k => ["case", k]), ["cleanup", null]].map(([phase, kind], i) => ({ phase, case: kind, enteredMs: i * 10, settledMs: i * 10 + 5 }));
  return { schemaVersion: 1, mode, interception, diagnosticOnly: true, applicationAccepted: false, platform: "linux", nodeVersion: "v24.19.0", driverVersion: "1.63.0", browserVersion: version, cdpBrowserVersion: version, cdpProtocolVersion: "1.3", binding: { binarySha256: "a".repeat(64), expectedVersion: version, harnessSha256: "b".repeat(64), sdkHashes: { ...HASHES } }, status: mode === "old" ? "NOT_REPRODUCED" : "QUALIFIED", code: "OBSERVED", executionStopped: { phase: "case", case: "truncate", elapsedMs: 85 }, phases, unexpectedRequests: 0, popups: 0, downloads: 0, cases, cleanup: { server: true, context: true, browser: true, session: true, sockets: true, startup: true, operations: true, hooks: true } };
}
function fakeBridge() {
  const ack = deferred(), calls = [], tracked = [], record = { requestIdentity: "unobserved", fetchContinueStarted: 0, fetchContinueResolved: 0, fetchContinueRejected: 0 };
  const send = function (...args) { calls.push({ self: this, args }); return ack.promise; }, session = Object.create({ send });
  const serverRequest = {}, delegate = { _session: session, _interceptionId: "own-interception" }, serverRoute = { _request: serverRequest, _delegate: delegate }, serverPage = {};
  const manager = { _page: serverPage, _requestIdToRequest: new Map(), _sessions: new Map([[session, { session }]]) };
  serverPage.delegate = { _networkManager: manager };
  const entry = { request: serverRequest, _requestId: "own-network", session, _interceptionId: "own-interception", _originalRequestRoute: delegate };
  manager._requestIdToRequest.set("own-network", entry);
  const implementations = new Map(), connection = { toImpl(client) { return implementations.get(client); } };
  const page = { _connection: connection, _guid: "page" }, request = { _connection: connection, _guid: "request" }, route = { _connection: connection, _guid: "route" };
  implementations.set(page, serverPage); implementations.set(request, serverRequest); implementations.set(route, serverRoute);
  let live = true;
  return { ack, calls, tracked, record, session, send, entry, manager, route, request, page, delegate, serverRequest, arm: () => observeOriginalContinue(route, request, page, record, p => tracked.push(p), () => live), freeze: () => { live = false; } };
}

test("qualification imports without launching and accepts only the two closed CLI choices", () => {
  assert.deepEqual(parseQualificationArguments(["--help"]), { execute: false });
  assert.deepEqual(parseQualificationArguments(["old", "off"]), { execute: true, mode: "old", interception: "off" });
  assert.deepEqual(parseQualificationArguments(["candidate", "continue"]), { execute: true, mode: "candidate", interception: "continue" });
  for (const args of [[], ["old"], ["old", "on"], ["candidate", "off", "--manifest=x"], ["--help", "off"], ["other", "off"]]) assert.throws(() => parseQualificationArguments(args), { message: "ARGUMENTS_REFUSED" });
});
test("natural EOF and both real negative outcomes are required with interception off or continued", () => {
  for (const interception of ["off", "continue"]) { const input = full("candidate", interception), output = validateQualificationReport(input); assert.deepEqual(output, input); assert.notEqual(output, input); assert.notEqual(output.cases[0], input.cases[0]); }
});
test("old engine may honestly report not reproduced or exact EOF with original failed terminals", () => {
  const absent = full("old"); assert.equal(validateQualificationReport(absent).status, "NOT_REPRODUCED");
  const input = full("old", "continue"); input.status = "REPRODUCED";
  Object.assign(input.cases[0], { publicFinished: 0, publicFailed: 1, responseFinished: "pending", cdpFinished: 0, cdpFailed: 1, result: "REPRODUCED" });
  assert.equal(validateQualificationReport(input).status, "REPRODUCED");
  const forged = structuredClone(input); forged.mode = "candidate"; forged.status = "QUALIFIED"; forged.browserVersion = forged.cdpBrowserVersion = forged.binding.expectedVersion = "157.0.8103.6"; refused(() => validateQualificationReport(forged));
});
test("no 200 failed, incomplete body, missing response settlement, duplicate or substituted terminal qualifies", () => {
  const changes = [r => { r.publicFinished = 0; r.publicFailed = 1; }, r => { r.cdpFinished = 0; r.cdpFailed = 1; }, r => { r.body = "incomplete"; }, r => { r.bytesRead = 10; }, r => { r.responseFinished = "pending"; }, r => { r.publicResponses = 2; }, r => { r.cdpStarted = 2; }, r => { r.serverFinished = 0; r.serverPrematureClose = 1; }];
  for (const change of changes) { const input = full(); change(input.cases[0]); refused(() => validateQualificationReport(input)); }
  for (const kind of ["abort", "truncate"]) { const input = full(); const row = input.cases.find(r => r.kind === kind); row.body = "complete"; row.bytesRead = 11; refused(() => validateQualificationReport(input)); }
});
test("off has no route authority and continue requires every original route and Fetch ACK", () => {
  for (const key of ["routeStarted", "routeSettled", "fetchContinueStarted", "fetchContinueResolved"]) { const input = full("candidate", "continue"); input.cases[0][key] = 0; refused(() => validateQualificationReport(input)); }
  for (const change of [r => { r.routeRejected = 1; }, r => { r.fetchContinueRejected = 1; }, r => { r.protocolIdentity = "unavailable"; }, r => { r.requestIdentity = "unobserved"; }]) { const input = full("candidate", "continue"); change(input.cases[0]); refused(() => validateQualificationReport(input)); }
  const off = full(); off.cases[0].routeStarted = 1; refused(() => validateQualificationReport(off));
});
test("uncertain cleanup, SDK drift and application acceptance cannot produce success", () => {
  for (const change of [r => { r.cleanup.operations = false; }, r => { r.cleanup.hooks = false; }, r => { r.applicationAccepted = true; }, r => { r.driverVersion = null; }, r => { r.binding.sdkHashes.coreBundle = "c".repeat(64); }, r => { r.binding.harnessSha256 = null; }, r => { r.unexpectedRequests = 1; }]) { const input = full(); change(input); refused(() => validateQualificationReport(input)); }
  const failed = full(); failed.cleanup.operations = false; failed.status = "REFUSED"; failed.code = "CLEANUP_UNCONFIRMED"; assert.equal(validateQualificationReport(failed).status, "REFUSED");
});
test("closed report refuses private keys, getters, coercions, sparse arrays and unknown enums without reading them", () => {
  let reads = 0; const getter = { enumerable: true, get() { reads++; throw Error("PRIVATE_CANARY"); } };
  const changes = [r => Object.defineProperty(r, "status", getter), r => Object.defineProperty(r.cases[0], "body", getter), r => { r.url = "PRIVATE_CANARY"; }, r => { r.cases[0].networkId = "PRIVATE_CANARY"; }, r => { r.binding.binarySha256 = { toString() { reads++; throw 0; } }; }, r => { r.nodeVersion = { toString() { reads++; throw 0; } }; }, r => { delete r.cases[2]; }, r => { r.cases[0].body = "PRIVATE_CANARY"; }, r => { r.phases[0].phase = "PRIVATE_CANARY"; }];
  for (const change of changes) { const input = full(); change(input); refused(() => validateQualificationReport(input)); }
  assert.equal(reads, 0);
});
test("phase ledger cannot hide a late main resolution or a cleanup above five seconds", () => {
  const late = full(); late.executionStopped.elapsedMs = 20000; late.phases.at(-2).settledMs = 20000; late.phases.at(-1).enteredMs = 20000; late.phases.at(-1).settledMs = 20001; refused(() => validateQualificationReport(late));
  const cleanup = full(); cleanup.phases.at(-1).settledMs = cleanup.phases.at(-1).enteredMs + 5001; refused(() => validateQualificationReport(cleanup));
  const total = full(); total.executionStopped.elapsedMs = 19999; total.phases.at(-2).settledMs = 19999; total.phases.at(-1).enteredMs = 20000; total.phases.at(-1).settledMs = 25001; refused(() => validateQualificationReport(total));
});
test("original fulfillment after the absolute deadline refuses even before a delayed timer callback", async () => {
  let clock = 0, expiry, cancels = 0; const d = deferred();
  const observation = timerPromise(d.promise, 20, "DEADLINE", () => clock, fn => { expiry = fn; return 7; }, handle => { assert.equal(handle, 7); cancels++; });
  assert.equal(typeof expiry, "function"); clock = 21; d.resolve("late"); await assert.rejects(observation, { message: "DEADLINE" }); assert.equal(cancels, 1);
});
test("deadline observer preserves a timely value but expiry never manufactures original settlement", async () => {
  let clock = 0, expiry; const d = deferred(), observe = timerPromise(d.promise, 20, "DEADLINE", () => clock, fn => { expiry = fn; return 1; }, () => {});
  clock = 19; d.resolve("own"); assert.equal(await observe, "own");
  const pending = deferred(); let originalSettled = false; void pending.promise.then(() => { originalSettled = true; });
  const failure = timerPromise(pending.promise, 20, "DEADLINE", () => 0, fn => { expiry = fn; return 2; }, () => {}); expiry(); await assert.rejects(failure, { message: "DEADLINE" }); assert.equal(originalSettled, false); pending.resolve(); await pending.promise;
});
test("private original route bridge preserves exact send arguments and returned Promise", async () => {
  const f = fakeBridge(), hook = f.arm(), args = { requestId: "own-interception" };
  assert.equal(hook.networkId, "own-network"); assert.equal(f.record.requestIdentity, "exact");
  const result = f.session.send("Fetch.continueRequest", args); assert.equal(result, f.ack.promise); assert.equal(f.tracked[0], result); assert.equal(f.calls[0].self, f.session); assert.equal(f.calls[0].args[1], args); assert.equal(f.record.fetchContinueStarted, 1);
  f.ack.resolve({}); await result; assert.equal(f.record.fetchContinueResolved, 1); assert.equal(f.record.fetchContinueRejected, 0); assert.equal(hook.restore(), true); assert.equal(Object.hasOwn(f.session, "send"), false); assert.equal(f.session.send, f.send);
});
test("send rejection stays rejected and freeze forbids late ACK backfill", async () => {
  const f = fakeBridge(), hook = f.arm(), error = Error("PRIVATE_CANARY"), result = f.session.send("Fetch.continueRequest", { requestId: "own-interception" }); f.ack.reject(error); await assert.rejects(result, e => e === error); assert.equal(f.record.fetchContinueRejected, 1); assert.equal(hook.restore(), true);
  const late = fakeBridge(), lateHook = late.arm(), pending = late.session.send("Fetch.continueRequest", { requestId: "own-interception" }); late.freeze(); late.ack.resolve(); await pending; assert.equal(late.record.fetchContinueResolved, 0); assert.equal(lateHook.restore(), true);
});
test("another Fetch identifier or another receiver cannot acknowledge this original route", async () => {
  const f = fakeBridge(), hook = f.arm(), p = f.session.send("Fetch.continueRequest", { requestId: "foreign-interception" }); f.ack.resolve(); await p; assert.equal(f.record.fetchContinueStarted, 0); assert.equal(f.tracked.length, 0); assert.equal(hook.restore(), true);
  const other = fakeBridge(), otherHook = other.arm(), receiver = {}, borrowed = other.session.send.call(receiver, "Fetch.continueRequest", { requestId: "own-interception" }); other.ack.resolve(); await borrowed; assert.equal(other.calls[0].self, receiver); assert.equal(other.record.fetchContinueStarted, 0); assert.equal(otherHook.restore(), true);
});
test("bridge refuses swapped Request, session, interception, duplicate entry or accessors without URL fallback", () => {
  let reads = 0;
  for (const change of [f => { f.entry.request = {}; }, f => { f.entry.session = {}; }, f => { f.entry._interceptionId = "foreign"; }, f => { f.manager._requestIdToRequest.set("duplicate", f.entry); }, f => Object.defineProperty(f.request, "_guid", { get() { reads++; throw Error("PRIVATE_CANARY"); } })]) { const f = fakeBridge(); change(f); assert.throws(() => f.arm(), { message: "BROWSER_REFUSED" }); assert.equal(Object.hasOwn(f.session, "send"), false); }
  assert.equal(reads, 0);
});
test("restore does not overwrite a foreign descriptor and recovers the exact original own descriptor", () => {
  const f = fakeBridge(), hook = f.arm(), foreign = () => {}; Object.defineProperty(f.session, "send", { value: foreign, configurable: true }); assert.equal(hook.restore(), false); assert.equal(f.session.send, foreign);
  const own = fakeBridge(); Object.defineProperty(own.session, "send", { value: own.send, configurable: true, writable: false, enumerable: true }); const before = Object.getOwnPropertyDescriptor(own.session, "send"), ownHook = own.arm(); assert.equal(ownHook.restore(), true); assert.deepEqual(Object.getOwnPropertyDescriptor(own.session, "send"), before);
});
