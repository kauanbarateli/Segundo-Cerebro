/** Data-only preparatory controls. Passing never attests a native image race. */
import assert from "node:assert/strict";
import test from "node:test";
import { newGoalNativeReport, validateGoalNativeReport } from "../e2e-auth-local/finance-goals-terminal-native-contract.mjs";
import { GOAL_IMAGES_NATIVE_CASES, GOAL_IMAGES_NATIVE_CHECKS, GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS, GOAL_IMAGES_NATIVE_IMPLEMENTATION, newGoalImagesNativeReport, validateGoalImagesNativeReport } from "../e2e-auth-local/finance-goals-images-terminal-native-contract.mjs";
const report = () => newGoalImagesNativeReport();
function known(value = report()) {
  value.sourceSha = "a".repeat(40); value.sourceTree = "b".repeat(40); value.nodeVersion = "24.19.0"; value.serverVersion = 170011;
  value.sources = [{ path: "tests/synthetic.mjs", bytes: 1, sha256: "c".repeat(64) }];
  value.dependencies = [{ path: "node_modules/synthetic/index.mjs", bytes: 1, sha256: "d".repeat(64) }];
  return value;
}
test("the constructor is eight exact not-run groups without native provenance", () => {
  assert.equal(GOAL_IMAGES_NATIVE_IMPLEMENTATION, "EIGHT_GROUPS_CANDIDATE");
  const input = report(), checked = validateGoalImagesNativeReport(input);
  assert.equal(checked.version, 1); assert.equal(checked.status, "failed"); assert.equal(checked.code, "NOT_RUN");
  assert.deepEqual(checked.cases.map(c => c.case), GOAL_IMAGES_NATIVE_CASES);
  assert.equal(Object.values(checked.limitations).every(value => value === false), true);
  assert.equal(checked.cases.every(c => c.status === "not-run" && Object.values(c.checks).every(v => !v) && Object.values(c.counts).every(v => !v)), true);
  assert.notEqual(checked, input); assert.equal(Object.isFrozen(checked), true); assert.equal(Object.isFrozen(checked.cases), true);
});
test("N12 V2 and image V1 reports reject one another", () => {
  assert.throws(() => validateGoalImagesNativeReport(newGoalNativeReport()));
  assert.throws(() => validateGoalNativeReport(report()));
  assert.equal(validateGoalNativeReport(newGoalNativeReport()).version, 2);
});
test("I5 and I8 have no fictitious barrier field and reject an added one", () => {
  for (const kind of ["I5_HOLDERS", "I8_NEGATIVES_ROLLBACK"]) assert.equal(GOAL_IMAGES_NATIVE_CHECKS[kind].includes("barrierObserved"), false);
  const value = report(); value.cases[4].checks.barrierObserved = true; assert.throws(() => validateGoalImagesNativeReport(value));
  assert.equal(GOAL_IMAGES_NATIVE_CASES.filter(k => GOAL_IMAGES_NATIVE_CHECKS[k].includes("barrierObserved")).length, 6);
});
test("all checks true cannot replace the exact operation-window counters", () => {
  const value = known(); value.status = "passed"; value.code = "PASSED"; value.phase = "complete";
  for (const row of value.cases) { row.status = "passed"; row.code = "PASSED"; row.phase = "complete"; for (const key of Object.keys(row.checks)) row.checks[key] = true; }
  for (const key of Object.keys(value.cleanup)) value.cleanup[key] = true;
  assert.throws(() => validateGoalImagesNativeReport(value), { code: "MATERIAL_REFUSED" });
});
test("missing, duplicate and reordered groups do not become an eight-count proof", () => {
  for (const mutate of [v => v.cases.pop(), v => { v.cases[1] = structuredClone(v.cases[0]); }, v => { [v.cases[0], v.cases[1]] = [v.cases[1], v.cases[0]]; }]) { const value = report(); mutate(value); assert.throws(() => validateGoalImagesNativeReport(value)); }
});
test("known sources require full stable major24 and bounded sorted hash rows", () => {
  assert.equal(validateGoalImagesNativeReport(known()).nodeVersion, "24.19.0");
  for (const version of ["25.0.0", "24", "24.19.0-rc.1", "24.19.0\n", null]) { const value = known(); value.nodeVersion = version; assert.throws(() => validateGoalImagesNativeReport(value)); }
  for (const mutate of [v => v.sources.push({ ...v.sources[0] }), v => { v.sources[0].path = "../foreign"; }, v => { v.dependencies[0].sha256 = "e".repeat(63); }, v => { v.sources[0].bytes = 2097153; }]) { const value = known(); mutate(value); assert.throws(() => validateGoalImagesNativeReport(value)); }
});
test("unknown outcome remains sticky and pending forbids a cleanup certificate", () => {
  const value = known(); value.cases[0].status = "failed"; value.cases[0].code = "SQL_REFUSED"; value.cases[0].phase = "oracle"; value.cases[0].unknown = true;
  assert.throws(() => validateGoalImagesNativeReport(value)); value.writeOutcomeUncertain = true;
  assert.equal(validateGoalImagesNativeReport(value).writeOutcomeUncertain, true);
  value.pending.commands = 1; value.cleanup.groups = true; assert.throws(() => validateGoalImagesNativeReport(value));
});
test("not-run counters, unknown members, source coercion, getters and proxies are refused without hooks", () => {
  for (const mutate of [v => { v.cases[0].counts.receipts = 1; }, v => { v.privateBody = "SYNTHETIC"; }, v => { v.cleanup.temp = "true"; }]) { const value = report(); mutate(value); assert.throws(() => validateGoalImagesNativeReport(value)); }
  let calls = 0; const value = report(); Object.defineProperty(value, "sourceSha", { enumerable: true, get() { calls++; return null; } });
  assert.throws(() => validateGoalImagesNativeReport(value));
  const proxy = new Proxy({}, { getPrototypeOf() { calls++; return Object.prototype; }, ownKeys() { calls++; return []; } });
  assert.throws(() => validateGoalImagesNativeReport(proxy));
  const coerced = known(); coerced.sources[0].sha256 = { [Symbol.toPrimitive]() { calls++; return "c".repeat(64); } };
  assert.throws(() => validateGoalImagesNativeReport(coerced)); assert.equal(calls, 0);
});

function structurallyPassed() {
  const value=known();value.status="passed";value.code="PASSED";value.phase="complete";
  for(const row of value.cases){row.status="passed";row.code="PASSED";row.phase="complete";for(const key of Object.keys(row.checks))row.checks[key]=true;row.counts={...GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS[row.case]};}
  for(const key of Object.keys(value.cleanup))value.cleanup[key]=true;return value;
}
test("an exact synthetic image report is structurally valid but is not native origin or transferable N12 proof",()=>{
  const checked=validateGoalImagesNativeReport(structurallyPassed());assert.equal(checked.status,"passed");assert.equal(checked.cases.length,8);assert.equal(checked.cases[5].counts.receipts,2);assert.equal(checked.cases[4].counts.cleanupAcks,8);assert.equal(checked.cases[7].checks.serviceRolePositive,true);
  assert.throws(()=>validateGoalNativeReport(checked));
});
test("positive image reports require every own check/count, full cleanup and no unknown or skipped prefix",()=>{
  const mutations=[v=>{v.pending.backends=1;},v=>{v.cleanup.temp=false;},v=>{v.writeOutcomeUncertain=true;},v=>{v.cases[0].unknown=true;},v=>{v.cases[0]=report().cases[0];},v=>{v.sourceSha=null;},v=>{v.limitations.imagesAccepted=true;}];
  for(const [index,row]of structurallyPassed().cases.entries()){
    for(const key of Object.keys(row.checks))mutations.push(v=>{v.cases[index].checks[key]=false;});
    for(const key of Object.keys(row.counts))mutations.push(v=>{v.cases[index].counts[key]++;});
  }
  for(const mutate of mutations){const value=structurallyPassed();mutate(value);assert.throws(()=>validateGoalImagesNativeReport(value),{code:"MATERIAL_REFUSED"});}
  const partial=structurallyPassed();partial.status="failed";partial.code="MATERIAL_REFUSED";partial.phase="oracle";for(let i=1;i<8;i++)partial.cases[i]=report().cases[i];assert.equal(validateGoalImagesNativeReport(partial).cases[0].status,"passed");
  partial.cases[2]=structurallyPassed().cases[2];assert.throws(()=>validateGoalImagesNativeReport(partial));
});