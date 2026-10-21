// Hermetic RAM ports only. No runner execute, native process, HTTP or database.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { SOURCE_PINS, NEXT_STOP_INVENTORY_ABSENT, qualifyReadOnlySources, qualifyNextStaticRuntime, isCanonicalStaticGet, createStaticRequestQualification, createWorkerStopEmitter, nextStopEnvironment, prepareWorkerNextStop, createRunnerNextStopRelay, createNextStopReporter } from "../e2e-auth-local/next-stop-relay.mjs";
import NextStopReporter from "../e2e-auth-local/next-stop-reporter.mjs";
import { runBoundedProcess } from "../../scripts/verification/auth-local-ci.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const rows = await Promise.all(SOURCE_PINS.map(async pin => ({ path: pin.path, bytes: await readFile(resolve(root, pin.path)) })));
const qualified = qualifyReadOnlySources(rows);
assert.ok(qualified);
const selection = { nonce: "0123456789abcdef0123456789abcdef", caseName: "RECOVERY", sourceSha: "a".repeat(40) };
const env = { SC_NEXT_STOP_NONCE: selection.nonce, SC_NEXT_STOP_CASE: selection.caseName, GITHUB_SHA: selection.sourceSha };
const healthy = () => ({ stagePassed: true, ui: 0, sdk: 0, sql: 0, nonRead: 0, unknown: false });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const frame = (command = "STOP_NEXT_STATIC_GET", selected = selection) => Buffer.from(`SC_NEXT_STOP_V1:${selected.nonce}:${selected.caseName}:${command}\n`, "ascii");
const dependencies = extra => ({
  lstat: async path => { const pin = SOURCE_PINS.find(pin => resolve(root, pin.path) === path); if (!pin) throw Object.assign(new Error("ABSENT"), { code: "ENOENT" }); return { isFile: () => true, isSymbolicLink: () => false, size: pin.bytes }; },
  realpath: async path => path,
  readFile: async path => { const row = rows.find(row => resolve(root, row.path) === path); assert.ok(row); return row.bytes; },
  ...extra,
});
function ownerFixture(callback) {
  const stop = deferred(); let calls = 0, metadata = { closed: false, failed: false, groupConfirmed: false, signal: "SIGTERM" };
  const owner = { stop(...args) { assert.equal(this, owner); assert.deepEqual(args, []); calls++; return callback ? callback(stop) : stop.promise; }, metadata(...args) { assert.equal(this, owner); assert.deepEqual(args, []); return metadata; } };
  return { owner, stop, calls: () => calls, finish: async () => { metadata = { closed: true, failed: false, groupConfirmed: true, signal: "SIGTERM" }; stop.resolve(true); await tick(); }, metadata: value => { metadata = value; } };
}
function childFixture() { const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.pid = 123456; return child; }
async function chain({ gate = healthy(), callback, selected = selection } = {}) {
  const f = ownerFixture(callback), child = childFixture(), runner = createRunnerNextStopRelay(selected, f.owner, {});
  assert.equal(runner.observer.start(child), true);
  const stdout = { write: chunk => runner.observer.data(chunk, child.stdout) };
  const reporter = createNextStopReporter({ ...env, SC_NEXT_STOP_CASE: selected.caseName, SC_NEXT_STOP_NONCE: selected.nonce, GITHUB_SHA: selected.sourceSha }, stdout);
  const testCase = { title: selected.caseName === "RECOVERY" ? "EMAIL_RECOVERY_SAME_BROWSER_PKCE" : selected.caseName }, result = { workerIndex: 0, retry: 0 };
  reporter.onBegin({ workers: 1, fullyParallel: false }, { allTests: () => [testCase] }); reporter.onTestBegin(testCase, result);
  const request = {}, row = {}, pending = new Map([[request, row]]), writes = [];
  let at = 100;
  const worker = await prepareWorkerNextStop({ env: { ...env, SC_NEXT_STOP_CASE: selected.caseName, SC_NEXT_STOP_NONCE: selected.nonce, GITHUB_SHA: selected.sourceSha }, caseName: selected.caseName, testInfo: { workerIndex: 0, retry: 0 }, pending, readGate: () => gate, dependencies: dependencies({ now: () => at, stdout: { write: chunk => { writes.push(chunk); reporter.onStdOut(chunk, testCase, result); return true; } } }) });
  worker.capture(request, row, { method: "GET", url: "http://127.0.0.1:3117/_next/static/chunks/app.js?v=1760355426000" });
  return { ...f, child, runner, reporter, worker, testCase, result, pending, request, row, writes, gate, at: value => { at = value; } };
}

test("runtime pins are complete, immutable and qualification reads only the named public inventory", async () => {
  const visited = [];
  assert.ok(await qualifyNextStaticRuntime(dependencies({ lstat: async path => { visited.push(path); return dependencies().lstat(path); } })));
  assert.deepEqual(visited, [...NEXT_STOP_INVENTORY_ABSENT, ...SOURCE_PINS.map(pin => pin.path)].map(path => resolve(root, path)));
  assert.equal(qualifyReadOnlySources(rows.slice(1)), null);
  const altered = rows.map(row => ({ ...row, bytes: Buffer.from(row.bytes) })); altered[0].bytes[0] ^= 1;
  assert.equal(qualifyReadOnlySources(altered), null);
  let reads = 0; const accessor = { path: rows[0].path, get bytes() { reads++; return rows[0].bytes; } };
  assert.equal(qualifyReadOnlySources([accessor, ...rows.slice(1)]), null); assert.equal(reads, 0);
  assert.throws(() => createStaticRequestQualification({ readonlyStatic: true }), /SOURCE_REFUSED/);
});
test("checked-out public runtime qualifies with native bounded file reads and preserves static exclusion", async () => {
  // This default port reads only SOURCE_PINS and the named absent inventory.
  // It starts no service and does not grant any request terminal observation.
  assert.ok(await qualifyNextStaticRuntime());
  const middleware = rows.find(row => row.path === "src/middleware.ts").bytes.toString("utf8");
  assert.ok(middleware.includes('matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|splash/|sw.js|swe-worker|manifest.webmanifest).*)"],'));
  assert.equal(isCanonicalStaticGet("http://127.0.0.1:3117/_next/static/chunks/legal.js", "GET"), true);
  for (const path of ["/privacidade", "/termos-de-servico", "/auth/callback", "/api/admin"]) assert.equal(isCanonicalStaticGet("http://127.0.0.1:3117" + path, "GET"), false);
});

test("Pages, instrumentation, symlink, missing pin, wrong size, realpath and config drift refuse before emission", async () => {
  for (const path of NEXT_STOP_INVENTORY_ABSENT) await assert.rejects(qualifyNextStaticRuntime(dependencies({ lstat: async input => input === resolve(root, path) ? {} : dependencies().lstat(input) })), /SOURCE_REFUSED/);
  for (const details of [{ isFile: () => false, isSymbolicLink: () => false, size: SOURCE_PINS[0].bytes }, { isFile: () => true, isSymbolicLink: () => true, size: SOURCE_PINS[0].bytes }, { isFile: () => true, isSymbolicLink: () => false, size: 1 }]) await assert.rejects(qualifyNextStaticRuntime(dependencies({ lstat: async path => path === resolve(root, SOURCE_PINS[0].path) ? details : dependencies().lstat(path) })), /SOURCE_REFUSED/);
  await assert.rejects(qualifyNextStaticRuntime(dependencies({ realpath: async path => path + "-foreign" })), /SOURCE_REFUSED/);
  await assert.rejects(qualifyNextStaticRuntime(dependencies({ readFile: async path => path === resolve(root, "next.config.ts") ? Buffer.alloc(1830) : dependencies().readFile(path) })), /SOURCE_REFUSED/);
});
test("canonical authority excludes HMR, Auth, API, foreign origin, non-GET, query fields and traversal", () => {
  assert.equal(isCanonicalStaticGet("http://127.0.0.1:3117/_next/static/x.js", "GET"), true);
  for (const url of ["http://127.0.0.1:3117/_next/webpack-hmr", "http://127.0.0.1:3117/entrar", "http://127.0.0.1:3117/api/settings", "http://localhost:3117/_next/static/x.js", "http://127.0.0.1:3117/_next/static/x.js?_rsc=a", "http://127.0.0.1:3117/_next/static/x.js?owner=a", "http://127.0.0.1:3117/_next/static/%2e%2e/x.js", "http://127.0.0.1:3117/_next/static/x%2fy.js", "http://127.0.0.1:3117/_next/static/x%5cy.js", "http://127.0.0.1:3117/_next/static/x%00.js", "http://127.0.0.1:3117/_next/static/x.js#x"]) assert.equal(isCanonicalStaticGet(url, "GET"), false);
  assert.equal(isCanonicalStaticGet("http://127.0.0.1:3117/_next/static/x.js", "POST"), false);
});
test("worker original row identity remains required after a response observation", async () => {
  const f = await chain(), clone = { responseSeen: true }; f.pending.set(f.request, clone);
  assert.equal(f.worker.request(15100, 100), "INELIGIBLE"); assert.equal(f.calls(), 0); assert.equal(f.pending.size, 1);
  const g = await chain(); g.pending.set(g.request, clone); assert.equal(g.worker.replace(g.request, g.row, clone), true);
  assert.equal(g.worker.request(15100, 100), "EMITTED"); assert.equal(g.calls(), 1); assert.equal(g.pending.get(g.request), clone); await g.finish();
});
test("replacement cannot grant authority to an uncaptured request or an absent previous row", () => {
  const ledger = createStaticRequestQualification(qualified), request = {}, row = {}, nextRow = {}, foreign = {};
  const pending = new Map([[request, nextRow]]);
  assert.equal(ledger.replace(request, undefined, nextRow), false);
  assert.equal(ledger.replace(request, row, nextRow), false);
  assert.equal(ledger.eligible(pending), false); assert.equal(pending.get(request), nextRow);
  assert.equal(ledger.capture(request, row, { method: "GET", url: "http://127.0.0.1:3117/_next/static/x.js" }), true);
  assert.equal(ledger.replace(request, undefined, nextRow), false);
  assert.equal(ledger.replace(request, {}, nextRow), false);
  assert.equal(ledger.replace(foreign, row, nextRow), false);
  assert.equal(ledger.eligible(pending), false);
  pending.set(request, row); assert.equal(ledger.eligible(pending), true);
  assert.equal(ledger.replace(request, row, nextRow), true);
  assert.equal(ledger.eligible(pending), false);
  pending.set(request, nextRow); assert.equal(ledger.eligible(pending), true);
  assert.equal(ledger.replace(request, row, {}), false);
  assert.equal(pending.get(request), nextRow); assert.equal(pending.size, 1);
});
test("unknown and every existing effect barrier forbid stop without changing the registry", async () => {
  for (const change of [{ unknown: true }, { stagePassed: false }, { ui: 1 }, { sdk: 1 }, { sql: 1 }, { nonRead: 1 }]) {
    const f = await chain({ gate: { ...healthy(), ...change }, selected: { ...selection, caseName: "FIRST_FORCED_BROWSER" } });
    assert.equal(f.worker.request(15100, 100), "INELIGIBLE"); assert.equal(f.calls(), 0); assert.equal(f.pending.size, 1); assert.deepEqual(f.gate, { ...healthy(), ...change });
  }
});
test("one non-static or foreign row vetoes the entire pending set", async () => { const f = await chain(); f.pending.set({}, {}); assert.equal(f.worker.request(15100, 100), "INELIGIBLE"); assert.equal(f.calls(), 0); });
test("deadline remains absolute and clock rollback or crossing during the gate cannot emit", async () => {
  for (const at of [99, 15100, Infinity, NaN]) { const f = await chain(); f.at(at); assert.equal(f.worker.request(15100, 100), "INELIGIBLE"); assert.equal(f.calls(), 0); }
  const pending = new Map(), ledger = createStaticRequestQualification(qualified), request = {}, row = {}; pending.set(request, row); ledger.capture(request, row, { method: "GET", url: "http://127.0.0.1:3117/_next/static/x.js" });
  const binding = { ...selection, run: {}, worker: {}, test: {}, result: {}, stdout: {} }; let at = 100, writes = 0;
  const emitter = createWorkerStopEmitter({ binding, qualification: ledger, pending, readGate: () => { at = 15100; return healthy(); }, now: () => at, startedAt: 100, deadlineMs: 15100, write: () => { writes++; return true; } });
  assert.equal(emitter.request(binding), "INELIGIBLE"); assert.equal(writes, 0);
  assert.throws(() => createWorkerStopEmitter({ binding, qualification: ledger, pending, readGate: healthy, now: () => 100, startedAt: 100, deadlineMs: 15101, write: () => true }), /BINDING_REFUSED/);
});
test("worker, minimal reporter and parent relay invoke the same owned stop at most once", async () => {
  const f = await chain(); assert.equal(f.worker.request(15100, 100), "EMITTED"); assert.equal(f.calls(), 1); assert.equal(f.pending.size, 1);
  assert.equal(f.runner.stopOnce(), f.stop.promise); assert.equal(f.runner.stopOnce(), f.stop.promise); assert.equal(f.worker.request(15100, 100), "REFUSED");
  assert.equal(f.runner.snapshot().stopPending, true); await f.finish(); assert.equal(f.calls(), 1); assert.equal(f.runner.snapshot().firstFailure, null); assert.equal(f.pending.size, 1);
});
test("every frame chunk boundary retains one original worker/stdout binding", async () => {
  for (let split = 1; split < frame().length; split++) { const f = ownerFixture(), child = childFixture(), runner = createRunnerNextStopRelay(selection, f.owner, {}); runner.observer.start(child); assert.equal(runner.observer.data(frame().subarray(0, split), child.stdout), true); assert.equal(f.calls(), 0); assert.equal(runner.observer.data(frame().subarray(split), child.stdout), true); assert.equal(f.calls(), 1); assert.equal(runner.observer.end(child.stdout), true); await f.finish(); }
});
test("normal/private output and embedded marker are discarded by the actual reporter", async () => {
  const f = await chain(); f.reporter.onStdOut(Buffer.from("PRIVATE_CANARY SC_NEXT_STOP_V1:ignored\n"), f.testCase, f.result); f.reporter.onStdErr("PRIVATE_CANARY");
  assert.equal(f.calls(), 0); assert.equal(f.writes.length, 0); assert.equal(f.reporter.onEnd(), undefined);
});
test("foreign nonce/case, duplicate, malformed, incomplete and spurious COMPLETION fail closed", async () => {
  for (const bytes of [frame("COMPLETION"), frame("STOP_NEXT_STATIC_GET", { ...selection, nonce: "f".repeat(32) }), frame("STOP_NEXT_STATIC_GET", { ...selection, caseName: "BLOCK_LIVE_BROWSER" }), Buffer.from(frame().toString().replace("\n", "\r\n")), Buffer.from("SC_NEXT_STOP_V1:" + "x".repeat(200) + "\n"), frame().subarray(0, -1)]) {
    const f = ownerFixture(), child = childFixture(), runner = createRunnerNextStopRelay(selection, f.owner, {}); runner.observer.start(child); runner.observer.data(bytes, child.stdout); runner.observer.end(child.stdout); assert.equal(f.calls(), 0); assert.equal(runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED"); assert.equal(runner.stopOnce(), f.stop.promise); assert.equal(f.calls(), 1); await f.finish(); assert.equal(runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED");
  }
  const f = await chain(); f.worker.request(15100, 100); f.reporter.onStdOut(frame(), f.testCase, f.result); assert.equal(f.calls(), 1); assert.equal(f.runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED"); await f.finish();
});
test("foreign TestCase, TestResult, worker, retry, suite and stdout cannot request stop", async () => {
  for (const kind of ["test", "result", "worker", "retry", "suite", "stdout"]) { const f = await chain(); if (kind === "suite") f.reporter.onBegin({ workers: 2, fullyParallel: false }, { allTests: () => [f.testCase] }); else if (kind === "stdout") f.runner.observer.data(frame(), {}); else { if (kind === "worker") f.result.workerIndex = 1; if (kind === "retry") f.result.retry = 1; f.reporter.onStdOut(frame(), kind === "test" ? {} : f.testCase, kind === "result" ? { workerIndex: 0, retry: 0 } : f.result); } assert.equal(f.calls(), 0); assert.equal(f.runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED"); }
});
test("callback false, rejection, throw, non-Promise, kill ACK and metadata getter never certify quiet", async () => {
  for (const callback of [() => Promise.resolve(false), () => Promise.reject(new Error("PRIVATE_CANARY")), () => { throw new Error("PRIVATE_CANARY"); }, () => true]) { const f = await chain({ callback }); f.worker.request(15100, 100); await tick(); assert.equal(f.runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED"); assert.equal(f.calls(), 1); assert.equal(f.pending.size, 1); f.runner.stopOnce(); assert.equal(f.calls(), 1); }
  const f = await chain(); f.worker.request(15100, 100); f.stop.resolve(true); await tick(); assert.equal(f.runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED");
  const g = await chain(); let reads = 0; g.metadata({ get closed() { reads++; return true; }, failed: false, groupConfirmed: true, signal: "SIGTERM" }); g.worker.request(15100, 100); g.stop.resolve(true); await tick(); assert.equal(g.runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED"); assert.equal(reads, 0);
});
test("no terminal retains the registry even after actual parent metadata confirms stop", async () => { const f = await chain(); f.worker.request(15100, 100); await f.finish(); assert.equal(f.pending.size, 1); assert.equal(f.runner.snapshot().firstFailure, null); });
test("a terminal must refer to the original request; unknown and prior failure are never healed", async () => {
  const f = await chain(), events = new EventEmitter(); events.on("requestfailed", request => f.pending.delete(request)); f.worker.request(15100, 100); events.emit("requestfailed", {}); assert.equal(f.pending.size, 1); events.emit("requestfailed", f.request); assert.equal(f.pending.size, 0); await f.finish(); assert.equal(f.runner.snapshot().firstFailure, null);
  f.runner.observer.data(frame("COMPLETION"), f.child.stdout); assert.equal(f.runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED"); events.emit("requestfailed", f.request); assert.equal(f.runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED");
});
test("actual bounded process owns observer stream, original args/env and discarded stdout", async () => {
  const f = ownerFixture(), runner = createRunnerNextStopRelay(selection, f.owner, {}), child = childFixture(), args = ["literal"], environment = { ONLY: "synthetic" }; let spawnArgs;
  const running = runBoundedProcess("SYNTHETIC_ONLY", args, { cwd: root, env: environment, timeoutMs: 1000, maxBytes: 1024, capture: false, stdoutObserver: runner.observer }, { spawnProcess(...values) { spawnArgs = values; return child; }, terminateGroup: async owned => { assert.equal(owned, child); return true; } });
  child.stdout.write("PRIVATE_CANARY\n"); child.stdout.write(frame()); assert.equal(f.calls(), 1); assert.equal(runner.stopOnce(), f.stop.promise);
  child.stdout.end(); child.emit("close", 0); const output = await running; assert.deepEqual(output, { stdout: "", groupConfirmed: true }); assert.equal(spawnArgs[1], args); assert.equal(spawnArgs[2].env, environment); assert.equal(spawnArgs[2].shell, false); assert.equal(spawnArgs[2].detached, true); await f.finish(); assert.equal(runner.snapshot().firstFailure, null);
});
test("bounded process failure/timeout/output cap and stream completion cannot accept a late stop", async () => {
  for (const kind of ["timeout", "cap", "malformed", "ended"]) {
    const f = ownerFixture(), runner = createRunnerNextStopRelay(selection, f.owner, {}), child = childFixture();
    const running = runBoundedProcess("SYNTHETIC_ONLY", [], { env: {}, timeoutMs: kind === "timeout" ? 5 : 1000, maxBytes: 100, capture: false, stdoutObserver: runner.observer }, { spawnProcess: () => child, terminateGroup: async () => { queueMicrotask(() => { child.stdout.emit("data", frame()); child.emit("close", 0); }); return true; } });
    const failed = assert.rejects(running, error => error.code === (kind === "cap" ? "COMMAND_OUTPUT_LIMIT" : kind === "timeout" ? "COMMAND_TIMEOUT" : "COMMAND_FAILED"));
    if (kind === "cap") child.stdout.write("x".repeat(101)); if (kind === "malformed") child.stdout.write(frame("COMPLETION")); if (kind === "ended") { child.stdout.emit("end"); child.stdout.emit("data", frame()); child.emit("close", 0); }
    await failed; assert.equal(f.calls(), 0); assert.equal(runner.snapshot().firstFailure, "PROCESS_UNCONFIRMED");
  }
});
test("observer descriptors/capture refuse before spawn and reporter class remains import inert", async () => {
  let spawns = 0, reads = 0;
  for (const stdoutObserver of [{ get start() { reads++; return () => true; }, data: () => true, end: () => true }, { start: () => true, data: () => true, end: () => true, raw: "PRIVATE_CANARY" }]) await assert.rejects(runBoundedProcess("SYNTHETIC_ONLY", [], { capture: false, stdoutObserver, timeoutMs: 10, maxBytes: 100 }, { spawnProcess: () => { spawns++; return childFixture(); } }), /PROCESS_OPTIONS_REFUSED/);
  assert.equal(reads, 0); assert.equal(spawns, 0); assert.equal(typeof NextStopReporter, "function");
  const previous = globalThis.fetch; globalThis.fetch = () => { throw new Error("FORBIDDEN_NETWORK"); };
  try { const url = new URL("../e2e-auth-local/next-stop-relay.mjs", import.meta.url); url.search = "?inert"; const imported = await import(url.href); assert.equal(imported.SOURCE_PINS.length, 12); } finally { globalThis.fetch = previous; }
});

test("worker diagnostic snapshots never reread a clock, gate or writer and retain the first original attempt", async () => {
  const ledger=createStaticRequestQualification(qualified),request={},row={},pending=new Map([[request,row]]),binding={...selection,run:{},worker:{},test:{},result:{},stdout:{}};
  ledger.capture(request,row,{method:"GET",url:"http://127.0.0.1:3117/_next/static/x.js"});
  let clocks=0,gates=0,writes=0;
  const emitter=createWorkerStopEmitter({binding,qualification:ledger,pending,readGate:()=>{gates++;return healthy();},now:()=>{clocks++;return 100;},startedAt:100,deadlineMs:15100,write:()=>{writes++;return true;}});
  assert.deepEqual(emitter.snapshot(),{outcome:"NOT_ATTEMPTED",reason:"NOT_CALLED"});assert.deepEqual([clocks,gates,writes],[0,0,0]);
  assert.equal(emitter.request(binding),"EMITTED");const original=emitter.snapshot();
  assert.deepEqual(original,{outcome:"EMITTED",reason:"NONE"});assert.equal(Object.isFrozen(original),true);
  assert.equal(emitter.request(binding),"REFUSED");assert.equal(emitter.snapshot(),original);assert.deepEqual([clocks,gates,writes],[2,1,1]);
  for(let i=0;i<10;i++)assert.equal(emitter.snapshot(),original);assert.deepEqual([clocks,gates,writes],[2,1,1]);assert.equal(pending.get(request),row);
  let gate= new Proxy({}, {ownKeys(){throw Error("PRIVATE_CANARY");}});
  const thrown=createWorkerStopEmitter({binding,qualification:ledger,pending,readGate:()=>gate,now:()=>100,startedAt:100,deadlineMs:15100,write:()=>true});
  assert.throws(()=>thrown.request(binding),/PRIVATE_CANARY/);assert.equal(thrown.snapshot(),null);gate=healthy();assert.equal(thrown.request(binding),"EMITTED");assert.equal(thrown.snapshot(),null);
  const f=await chain();assert.throws(()=>f.worker.request(15100,15100),/BINDING_REFUSED/);assert.equal(f.worker.snapshot(),null);assert.equal(f.calls(),0);
  const empty=await chain();empty.pending.clear();assert.equal(empty.worker.request(15100,100),"NOT_NEEDED");assert.deepEqual(empty.worker.snapshot(),{outcome:"NOT_NEEDED",reason:"EMPTY_PENDING"});assert.equal(empty.calls(),0);
});

test("worker diagnostics distinguish every original effect veto, missing static authority and changed row without granting permission",async()=>{
  for(const [change,reason]of[[{stagePassed:false},"STAGE_NOT_PASSED"],[{unknown:true},"OUTCOME_UNKNOWN"],[{ui:1},"UI_PENDING"],[{sdk:1},"SDK_PENDING"],[{sql:1},"SQL_PENDING"],[{nonRead:1},"NON_READ_PENDING"]]){
    const f=await chain({gate:{...healthy(),...change}});assert.equal(f.worker.request(15100,100),"INELIGIBLE");assert.deepEqual(f.worker.snapshot(),{outcome:"INELIGIBLE",reason});assert.equal(f.calls(),0);assert.equal(f.pending.get(f.request),f.row);
  }
  const changed=await chain();changed.pending.set(changed.request,{});assert.equal(changed.worker.request(15100,100),"INELIGIBLE");assert.equal(changed.worker.snapshot().reason,"ORIGINAL_ROW_MISMATCH");assert.equal(changed.calls(),0);
  const missing=await chain();missing.pending.set({},{});assert.equal(missing.worker.request(15100,100),"INELIGIBLE");assert.equal(missing.worker.snapshot().reason,"STATIC_AUTHORITY_MISSING");assert.equal(missing.calls(),0);assert.equal(missing.pending.size,2);
});

test("clock, gate, identity, dispatch and writer reasons come only from the same original evaluation",()=>{
  const setup=({clock=()=>100,gate=healthy,writer=()=>true,identity,prepare=()=>{}}={})=>{
    const ledger=createStaticRequestQualification(qualified),request={},row={},pending=new Map([[request,row]]),binding={...selection,run:{},worker:{},test:{},result:{},stdout:{}};
    ledger.capture(request,row,{method:"GET",url:"http://127.0.0.1:3117/_next/static/x.js"});prepare(pending);
    const emitter=createWorkerStopEmitter({binding,qualification:ledger,pending,readGate:gate,now:clock,startedAt:100,deadlineMs:15100,write:writer});
    const result=emitter.request(identity??binding);return{result,diagnostic:emitter.snapshot(),pending};
  };
  const cases=[
    [{clock:()=>{throw Error("PRIVATE_CANARY");}},"INELIGIBLE","CLOCK_READ_FAILED"],
    [{gate:()=>{throw Error("PRIVATE_CANARY");}},"INELIGIBLE","GATE_READ_FAILED"],
    [{clock:()=>NaN},"INELIGIBLE","CLOCK_INVALID"],[{clock:()=>99},"INELIGIBLE","CLOCK_ROLLBACK"],[{clock:()=>15100},"INELIGIBLE","DEADLINE_REACHED"],
    [{identity:{}},"INELIGIBLE","IDENTITY_MISMATCH"],[{gate:()=>({...healthy(),extra:true})},"INELIGIBLE","GATE_SHAPE_INVALID"],
    [{prepare:pending=>pending.clear()},"INELIGIBLE","PENDING_EMPTY"],[{prepare:pending=>pending.set(1,{})},"INELIGIBLE","PENDING_ENTRY_INVALID"],
    [{prepare:pending=>{for(let i=0;i<4096;i++)pending.set({},{});}},"INELIGIBLE","PENDING_LIMIT"],
    [{writer:()=>false},"REFUSED","WRITE_RETURNED_FALSE"],[{writer:()=>{throw Error("PRIVATE_CANARY");}},"REFUSED","WRITE_THROWN"],
  ];
  for(const [options,outcome,reason]of cases){const observed=setup(options);assert.equal(observed.result,outcome);assert.deepEqual(observed.diagnostic,{outcome,reason});assert.equal(JSON.stringify(observed.diagnostic).includes("PRIVATE_CANARY"),false);}
  for(const [value,reason]of[[NaN,"DISPATCH_CLOCK_INVALID"],[99,"DISPATCH_CLOCK_ROLLBACK"],[15100,"DISPATCH_DEADLINE_REACHED"],["throw","DISPATCH_CLOCK_READ_FAILED"]]){
    let calls=0;const observed=setup({clock:()=>{if(++calls===1)return 100;if(value==="throw")throw Error("PRIVATE_CANARY");return value;}});assert.deepEqual(observed.diagnostic,{outcome:"INELIGIBLE",reason});assert.equal(calls,2);
  }
});

test("parent diagnostic observes only its original stop Promise and never metadata, EOF or finally",async()=>{
  const child=childFixture(),stop=deferred();let calls=0,metadataReads=0;
  const runner=createRunnerNextStopRelay(selection,{stop(){calls++;return stop.promise;},metadata(){metadataReads++;throw Error("PRIVATE_CANARY");}},{});
  assert.equal(runner.diagnostic(),null);runner.observer.start(child);
  assert.deepEqual(runner.diagnostic(),{requested:false,settled:false,resolvedTrue:null});assert.deepEqual([calls,metadataReads],[0,0]);
  runner.observer.data(frame(),child.stdout);assert.deepEqual(runner.diagnostic(),{requested:true,settled:false,resolvedTrue:null});assert.equal(calls,1);
  const before=runner.diagnostic();stop.resolve(true);await tick();assert.deepEqual(before,{requested:true,settled:false,resolvedTrue:null});assert.deepEqual(runner.diagnostic(),{requested:true,settled:true,resolvedTrue:true});assert.equal(metadataReads,0);
  assert.equal(runner.stopOnce(),stop.promise);assert.equal(calls,1);assert.equal(metadataReads,0);
});
test("run source binding uses the actual candidate SHA and rejects incomplete case/nonce metadata", () => {
  assert.deepEqual(nextStopEnvironment({ ...env, GITHUB_SHA: "b".repeat(40) }, "RECOVERY"), { ...selection, sourceSha: "b".repeat(40) });
  for (const input of [{ ...env, GITHUB_SHA: "" }, { ...env, SC_NEXT_STOP_NONCE: "short" }, { ...env, SC_NEXT_STOP_CASE: "HMR" }]) assert.throws(() => nextStopEnvironment(input), /ENVIRONMENT_REFUSED/);
});
