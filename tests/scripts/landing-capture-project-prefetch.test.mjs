import assert from "node:assert/strict";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import { readFile } from "node:fs/promises";
import {
  captureHealthAfter, firstCaptureDiagnostic, initializeCaptureServiceWorkerPolicy,
  initializeProjectPrefetchPolicy, projectPrefetchPolicyAbsent,
} from "../../scripts/landing/capture-policy.mjs";

const base = "http://127.0.0.1:3110";
const code = fn => "(" + fn.toString() + ")";
const context = (setup = "", origin = base) => {
  const ctx = createContext({ location: { origin } }); runInContext(setup, ctx, { timeout: 1000 }); return ctx;
};
const initialize = (ctx, origin = base) => runInContext(code(initializeProjectPrefetchPolicy) + "(" + JSON.stringify({ expectedOrigin: origin }) + ")", ctx, { timeout: 1000 });
const absent = ctx => runInContext(code(projectPrefetchPolicyAbsent) + "()", ctx, { timeout: 1000 });
const inspect = (ctx, expression) => JSON.parse(runInContext("JSON.stringify(" + expression + ")", ctx, { timeout: 1000 }));
const denied = error => error?.message === "CAPTURE_PROJECT_PREFETCH_POLICY";
const normal = '({direct:typeof globalThis.IntersectionObserver,unqualified:typeof IntersectionObserver,exposed:"IntersectionObserver" in globalThis,reads:globalThis.getterReads??0,keep:globalThis.keep})';

test("serialized actual initializer removes own exposure in global and unqualified lookups", () => {
  const ctx = context('globalThis.keep="KEEP";Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,value:function(){}})');
  initialize(ctx);
  assert.deepEqual(inspect(ctx, normal), { direct: "undefined", unqualified: "undefined", exposed: false, reads: 0, keep: "KEEP" });
  assert.equal(absent(ctx), true);
});

test("own and inherited configurable getters are removed without invocation", () => {
  const ctx = context('globalThis.getterReads=0;const parent={};Object.defineProperty(parent,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}});Object.setPrototypeOf(globalThis,parent);Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}})');
  initialize(ctx);
  assert.equal(absent(ctx), true);
  assert.deepEqual(inspect(ctx, normal), { direct: "undefined", unqualified: "undefined", exposed: false, reads: 0 });
});

test("undefined own shadow and inherited constructor are both removed; absent is idempotent", () => {
  const ctx = context('const parent={IntersectionObserver:function(){}};Object.setPrototypeOf(globalThis,parent);Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,value:undefined})');
  initialize(ctx); initialize(ctx);
  assert.equal(absent(ctx), true);
  assert.deepEqual(inspect(ctx, normal), { direct: "undefined", unqualified: "undefined", exposed: false, reads: 0 });
  const empty = context(); initialize(empty); initialize(empty); assert.equal(absent(empty), true);
});

test("opaque and foreign contexts preserve their exposure and never read its getter", () => {
  for (const origin of ["null", "http://localhost:3110", "http://127.0.0.1:3111", "https://127.0.0.1:3110"]) {
    const ctx = context('globalThis.getterReads=0;Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}})', origin);
    initialize(ctx);
    assert.equal(runInContext('globalThis.getterReads', ctx), 0);
    assert.equal(runInContext('Object.getOwnPropertyDescriptor(globalThis,"IntersectionObserver")!==undefined', ctx), true);
    assert.equal(absent(ctx), false);
    assert.equal(runInContext('globalThis.getterReads', ctx), 0);
  }
});

test("invalid matching origin refuses before touching IntersectionObserver", () => {
  for (const origin of ["https://private.invalid", "http://127.0.0.1:99999", "http://127.0.0.1:0", "http://user@127.0.0.1:3110", base + "/"]) {
    const ctx = context('globalThis.getterReads=0;Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}})', origin);
    assert.throws(() => initialize(ctx, origin), denied);
    assert.equal(runInContext('globalThis.getterReads', ctx), 0);
    assert.equal(runInContext('Object.getOwnPropertyDescriptor(globalThis,"IntersectionObserver")!==undefined', ctx), true);
  }
});

test("nonconfigurable parent fails complete preflight before deleting a configurable own slot", () => {
  const ctx = context('globalThis.getterReads=0;const parent={};Object.defineProperty(parent,"IntersectionObserver",{configurable:false,get(){globalThis.getterReads++;return function(){};}});Object.setPrototypeOf(globalThis,parent);Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,value:function(){}})');
  assert.throws(() => initialize(ctx), denied);
  assert.equal(runInContext('Object.getOwnPropertyDescriptor(globalThis,"IntersectionObserver")!==undefined', ctx), true);
  assert.equal(runInContext('globalThis.getterReads', ctx), 0);
});

test("eight-object chain succeeds and ninth refuses without deleting any slot", () => {
  const fixture = depth => 'let chain=null;for(let i=1;i<' + depth + ';i++)chain=Object.create(chain);Object.setPrototypeOf(globalThis,chain);Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,value:function(){}})';
  const allowed = context(fixture(8)); initialize(allowed); assert.equal(absent(allowed), true);
  const refused = context(fixture(9)); assert.throws(() => initialize(refused), denied);
  assert.equal(runInContext('Object.getOwnPropertyDescriptor(globalThis,"IntersectionObserver")!==undefined', refused), true);
});

test("cyclic or throwing reflection fails closed and does not inspect getter values", () => {
  for (const setup of [
    'const proxy=new Proxy({}, {getPrototypeOf(){return proxy;}});Object.setPrototypeOf(globalThis,proxy);',
    'const proxy=new Proxy({}, {getOwnPropertyDescriptor(){throw Error("SYNTHETIC");}});Object.setPrototypeOf(globalThis,proxy);',
    'const proxy=new Proxy({}, {getPrototypeOf(){throw Error("SYNTHETIC");}});Object.setPrototypeOf(globalThis,proxy);',
  ]) {
    const ctx = context('globalThis.getterReads=0;Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;return function(){};}});' + setup);
    assert.throws(() => initialize(ctx), denied);
    assert.equal(runInContext('globalThis.getterReads', ctx), 0);
    assert.equal(runInContext('Object.getOwnPropertyDescriptor(globalThis,"IntersectionObserver")!==undefined', ctx), true);
  }
});

test("delete false or remaining exposure refuses instead of synthesizing an observer", () => {
  for (const behavior of ["false", "true"]) {
    const ctx = context('globalThis.getterReads=0;Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}});Reflect.deleteProperty=()=>'+behavior);
    assert.throws(() => initialize(ctx), denied);
    assert.equal(runInContext('globalThis.getterReads', ctx), 0);
  }
});

test("observable predicate rejects reintroduced or lexical exposure without calling a getter", () => {
  const ctx = context(); initialize(ctx); assert.equal(absent(ctx), true);
  runInContext('globalThis.getterReads=0;Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}})', ctx);
  assert.equal(absent(ctx), false); assert.equal(runInContext("globalThis.getterReads", ctx), 0);
  const lexical = context('const IntersectionObserver=function(){}');
  assert.equal(absent(lexical), false); assert.throws(() => initialize(lexical), denied);
});

test("service-worker and project initializers are independent in either order", () => {
  for (const order of [[initializeCaptureServiceWorkerPolicy, initializeProjectPrefetchPolicy], [initializeProjectPrefetchPolicy, initializeCaptureServiceWorkerPolicy]]) {
    const ctx = context('globalThis.getterReads=0;globalThis.navigator={};Object.defineProperty(navigator,"serviceWorker",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}});Object.defineProperty(globalThis,"IntersectionObserver",{configurable:true,get(){globalThis.getterReads++;throw Error("SYNTHETIC");}})');
    for (const initializer of order) runInContext(code(initializer) + "(" + JSON.stringify({ expectedOrigin: base }) + ")", ctx, { timeout: 1000 });
    assert.equal(absent(ctx), true); assert.equal(runInContext('"serviceWorker" in navigator', ctx), false);
    assert.equal(runInContext("globalThis.getterReads", ctx), 0);
  }
});

test("policy failure and aborted request remain fatal with first diagnostics preserved", () => {
  assert.deepEqual(firstCaptureDiagnostic(null, { kind: "operation", code: "CAPTURE_PROJECT_PREFETCH_POLICY" }, "navigation"), ["CAPTURE_PROJECT_PREFETCH_POLICY", "CAPTURE_PHASE_NAVIGATION"]);
  const first = firstCaptureDiagnostic(null, { kind: "requestfailed", resourceType: "fetch" }, "readiness");
  assert.equal(captureHealthAfter(0, { kind: "requestfailed" }), 1);
  assert.deepEqual(firstCaptureDiagnostic(first, { kind: "operation", code: "CAPTURE_PROJECT_PREFETCH_POLICY" }, "closing"), first);
});

test("Source wiring is Project-only before newPage and checks without waiting before readiness and pixels", async () => {
  const cli = await readFile(new URL("../../scripts/landing/capturar-telas.mjs", import.meta.url), "utf8");
  assert.match(cli, /if \(options\.mode === "projeto"\) await context\.addInitScript\(initializeProjectPrefetchPolicy, \{ expectedOrigin: base \}\)/u);
  assert.equal((cli.match(/addInitScript\(initializeProjectPrefetchPolicy/gu) ?? []).length, 1);
  const guard = cli.slice(cli.indexOf("async function guardContext"), cli.indexOf("async function capturePage"));
  assert.match(guard, /addInitScript\(initializeCaptureServiceWorkerPolicy/u);
  assert.equal(guard.includes("newPage("), false);
  for (const name of ["readyProject", "assertProjectReadyNow"]) {
    const start = cli.indexOf("async function " + name + "("), end = cli.indexOf("\n}", start);
    const body = cli.slice(start, end), check = body.indexOf("page.evaluate(projectPrefetchPolicyAbsent)");
    assert.ok(check > body.indexOf("assertProjectTarget("));
    assert.match(body, /options\.mode === "projeto" && !await page\.evaluate\(projectPrefetchPolicyAbsent\)/u);
    if (name === "readyProject") assert.ok(check < body.indexOf("await ready(page)"));
    else assert.ok(check < body.indexOf("page.evaluate(projectReadyInPage)"));
    assert.equal(body.includes("waitForTimeout"), false);
  }
  assert.match(cli, /claims: \{ hostedValidated: false, productionValidated: false \}, requestPolicy, records/u);
  assert.match(cli, /if \(first\) console\.error\(requestFailedDiagnosticLine\(captureSdkRequestFailedDiagnostic\(request, base\)\)\)/u);
});
