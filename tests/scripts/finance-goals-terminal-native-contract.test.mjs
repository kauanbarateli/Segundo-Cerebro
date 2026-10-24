/** Pure data/ticket controls; no native process or acceptance claim. */
import assert from "node:assert/strict";
import test from "node:test";
import { GOAL_NATIVE_CASES, GOAL_NATIVE_CHECKS, GOAL_NATIVE_LIMITATIONS, nativeData, newGoalNativeReport, validateGoalNativeNodeVersion, validateGoalNativeReport } from "../e2e-auth-local/finance-goals-terminal-native-contract.mjs";
import { goalNativeStatement, frameGoalNativeStatement, inspectGoalNativeStatement, goalNativeBootstrapSql } from "../e2e-auth-local/finance-goals-terminal-native-sql.mjs";
const context = { namespace: "sc-goals-terminal-native-" + "a".repeat(32), sourceSha: "b".repeat(40), systemIdentifier: "7250000000000000001" };
const owner = "79f10000-0000-4000-8000-000000000001", session = "79f10000-0000-4000-8000-000000000002";
const flags = (keys, value) => Object.fromEntries(keys.map(key => [key, value]));
function report() {
  return { version: 2, scenario: "finance-goals-terminal-native-ci", sourceSha: "b".repeat(40), sourceTree: "c".repeat(40), nodeVersion: "24.19.0", cliVersion: "2.120.0", serverVersion: 170011, status: "passed", code: "PASSED", phase: "complete", sources: [{ path: "tests/native.entry.ts", sha256: "d".repeat(64), bytes: 100 }], dependencies: [{ path: "node_modules/server-only/empty.js", sha256: "e".repeat(64), bytes: 0 }], cases: GOAL_NATIVE_CASES.map(kind => {
    const committed = kind.endsWith("_COMMIT_FIRST");
    return { case: kind, status: "passed", code: "PASSED", phase: "complete", checks: { ...flags(GOAL_NATIVE_CHECKS, true), strongReceiptGuard: kind.endsWith("_OLD_EXECUTOR") }, counts: { receipts: committed ? 1 : 0, dispositions: committed ? 0 : 1, terminalEvents: committed ? 0 : 1, financialEffects: committed ? 1 : 0, financialEvents: committed ? 1 : 0, quotaDelta: 1, sessions: 3 }, unknown: false };
  }), writeOutcomeUncertain: false, pending: { commands: 0, http: 0, backends: 0 }, cleanup: { groups: true, backends: true, stack: true, temp: true }, limitations: flags(GOAL_NATIVE_LIMITATIONS, false) };
}
test("twelve ordered cases require exclusivity, event bijection, strong old guard and complete cleanup", () => {
  const value = validateGoalNativeReport(report()); assert.equal(value.cases.length, 12); assert.equal(Object.isFrozen(value.cases[0].checks), true);
  for (const change of [v => { v.cases.reverse(); }, v => { v.cases[0].counts.dispositions = 1; }, v => { v.cases[1].counts.receipts = 1; }, v => { v.cases[1].counts.terminalEvents = 0; }, v => { v.cases[2].checks.strongReceiptGuard = false; }, v => { v.cases[2].counts.financialEffects = 1; }, v => { v.pending.backends = 1; }, v => { v.cleanup.groups = false; }, v => { v.writeOutcomeUncertain = true; }, v => { v.cases[0].unknown = true; }, v => { v.limitations.restoreAccepted = true; }, v => { v.serverVersion = 180003; }]) { const v = report(); change(v); assert.throws(() => validateGoalNativeReport(v)); }
});
test("early environment refusal has no fabricated source or PostgreSQL observations", () => {
  const initial = newGoalNativeReport(); initial.code = "ENVIRONMENT_REFUSED";
  const v = validateGoalNativeReport(initial); assert.equal(v.sourceSha, null); assert.equal(v.serverVersion, null); assert.equal(v.cases.every(c => c.status === "not-run"), true);
  initial.status = "passed"; initial.code = "PASSED"; initial.phase = "complete"; assert.throws(() => validateGoalNativeReport(initial));
});
test("report v2 requires the full stable Node24 observation; v1 and missing evidence do not pass", () => {
  const observed = validateGoalNativeReport(report()); assert.equal(observed.version, 2); assert.equal(observed.nodeVersion, "24.19.0");
  for (const nodeVersion of [null, "24", "24.019.0", "24.19.00", "24.19.0-rc.1", "24.19.0+meta", "24.19.0\n", "24.19.0\u2028", "25.0.0", 24, { major: 24 }]) {
    const value = report(); value.nodeVersion = nodeVersion; assert.throws(() => validateGoalNativeReport(value));
  }
  const old = report(); old.version = 1; assert.throws(() => validateGoalNativeReport(old));
  const missing = report(); delete missing.nodeVersion; assert.throws(() => validateGoalNativeReport(missing));
  const early = newGoalNativeReport(); early.code = "ENVIRONMENT_REFUSED";
  assert.throws(() => { early.nodeVersion = validateGoalNativeNodeVersion("24", "22.19.0"); });
  assert.equal(early.nodeVersion, null); assert.equal(validateGoalNativeReport(early).nodeVersion, null);
  early.nodeVersion = validateGoalNativeNodeVersion("24\n", "24.19.0");
  assert.equal(validateGoalNativeReport(early).nodeVersion, "24.19.0");
});
test("failed prefix cannot hide unfinished work, invent a later case or promote not-run to passed", () => {
  const v = report(); v.status = "failed"; v.phase = "blocked"; v.code = "BARRIER_REFUSED";
  v.cases[0].status = "failed"; v.cases[0].phase = "blocked"; v.cases[0].code = "BARRIER_REFUSED";
  for (const c of v.cases.slice(1)) Object.assign(c, { status: "not-run", phase: "not-run", code: "NOT_RUN", checks: flags(GOAL_NATIVE_CHECKS, false), counts: flags(Object.keys(c.counts), 0) });
  assert.equal(validateGoalNativeReport(v).status, "failed");
  v.cases[5] = report().cases[5]; assert.throws(() => validateGoalNativeReport(v));
});
test("descriptors, array accessors and JSON hooks are refused without reading a canary", () => {
  let reads = 0; const read = () => { reads++; throw new Error("SYNTHETIC_CANARY"); };
  const getter = report(); Object.defineProperty(getter, "status", { get: read, enumerable: true }); assert.throws(() => validateGoalNativeReport(getter));
  const array = [1]; Object.defineProperty(array, "0", { get: read, enumerable: true }); assert.throws(() => nativeData(array));
  assert.throws(() => nativeData({ toJSON: read })); assert.throws(() => nativeData(new Proxy({}, { get: read, ownKeys: read })));
  assert.equal(reads, 0);
  for (const mutate of [v => { v.secret = "SYNTHETIC_CANARY"; }, v => { v.sources[0].path = "../private"; }, v => { v.sources[0].bytes = -1; }, v => { v.cases[0].checks.barrierObserved = 1; }]) { const v = report(); mutate(v); assert.throws(() => validateGoalNativeReport(v)); }
});
test("nominal SQL tickets reject shape clones, foreign scope and caller SQL before framing", () => {
  const ticket = goalNativeStatement(context, "IDENTITY");
  assert.match(frameGoalNativeStatement(ticket, context, "f".repeat(32), 1).input, /pg_control_system/);
  assert.throws(() => inspectGoalNativeStatement({ ...ticket }, context));
  assert.throws(() => inspectGoalNativeStatement(ticket, { ...context, sourceSha: "c".repeat(40) }));
  assert.throws(() => goalNativeStatement(context, "SELECT", { sql: "delete private" }));
  assert.throws(() => goalNativeStatement(context, "BLOCKING", { waiter: 20, winner: 20 }));
});
test("RPC data is captured without hooks and cannot escape into psql or a different RPC", () => {
  const request = { command: "finance.goal.create", input: { name: "O'Brien; \\! private\nNUL\u0000", client_id: owner } };
  const data = { rpc: "finance_goals_commit", owner, session, operation: request.command, request };
  const ticket = goalNativeStatement(context, "RPC", data); request.input.name = "changed";
  const framed = frameGoalNativeStatement(ticket, context, "f".repeat(32), 1);
  assert.match(framed.input, /convert_from\(decode\('[a-f0-9]+','hex'\),'UTF8'\)::jsonb/);
  assert.doesNotMatch(framed.input, /O'Brien|\\! private|changed/); assert.equal(framed.writing, true);
  assert.throws(() => goalNativeStatement(context, "RPC", { ...data, rpc: "__proto__" }));
  assert.throws(() => frameGoalNativeStatement(ticket, context, "f".repeat(32), 513));
});
test("fake primitives cannot run toString/replaceAll/Symbol.toPrimitive in SQL identity or framing", () => {
  let calls = 0; const hook = () => { calls++; return owner; }, fake = { toString: hook, replaceAll: hook, [Symbol.toPrimitive]: hook };
  const data = { rpc: "finance_goals_commit", owner, session, operation: "finance.goal.create", request: {} };
  for (const key of ["owner", "session", "operation", "rpc"]) assert.throws(() => goalNativeStatement(context, "RPC", { ...data, [key]: fake }));
  for (const key of ["namespace", "sourceSha", "systemIdentifier"]) assert.throws(() => goalNativeStatement({ ...context, [key]: fake }, "IDENTITY"));
  const ticket = goalNativeStatement(context, "IDENTITY"); assert.throws(() => frameGoalNativeStatement(ticket, context, fake, 1)); assert.equal(calls, 0);
});
test("bootstrap and material/absence are finite scoped templates, never caller SQL or another owner", () => {
  assert.match(goalNativeBootstrapSql(context.namespace,context.sourceSha),/^begin read only;/);
  assert.throws(()=>goalNativeBootstrapSql("select private",context.sourceSha));
  let calls=0;const fake={toString(){calls++;return owner;},replaceAll(){calls++;return owner;}};
  assert.throws(()=>goalNativeBootstrapSql(fake,context.sourceSha));
  for(const action of ["MATERIAL","ABSENCE"]){assert.throws(()=>goalNativeStatement(context,action,{a:fake,b:session}));assert.throws(()=>goalNativeStatement(context,action,{a:owner,b:session,sql:"select private"}));const rendered=frameGoalNativeStatement(goalNativeStatement(context,action,{a:owner,b:session}),context,"f".repeat(32),1);assert.ok(rendered.input.includes(owner)&&rendered.input.includes(session));assert.equal(rendered.writing,false);}
  assert.equal(calls,0);assert.throws(()=>goalNativeStatement(context,"MATERIAL",{a:owner,b:owner}));
});
