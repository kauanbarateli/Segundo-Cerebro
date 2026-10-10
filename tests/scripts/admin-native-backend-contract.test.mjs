import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_NATIVE_MANIFEST, ADMIN_NATIVE_CASES, ADMIN_NATIVE_STAGES, ADMIN_NATIVE_CHECKS,
  ADMIN_NATIVE_PASS_COUNTS, ADMIN_NATIVE_CLEANUP_STAGES, ADMIN_NATIVE_CLEANUP_COUNTS,
  validateAdminNativeReport, validateAdminNativeCleanup, assembleAdminNativePacket, validateAdminNativePacket,
} from "../e2e-auth-local/admin-native-backend-contract.mjs";

const sha = "a".repeat(40);
// Synthetic metadata demonstrates only the closed protocol validator. None of
// these objects assert a native service, namespace, account or browser result.
const sources = () => ADMIN_NATIVE_MANIFEST.map(path => ({ path, sha256: "b".repeat(64), bytes: 128 }));
function passed(kind) {
  return { schemaVersion: 1, scenario: "admin-native-backend", provenance: "protocol-only", case: kind, sourceSha: sha, sourceHashes: sources(), status: "passed", code: "PASSED", failurePoint: null, stages: ADMIN_NATIVE_STAGES[kind].map(name => ({ name, passed: true })), counts: { ...ADMIN_NATIVE_PASS_COUNTS[kind] }, checks: Object.fromEntries(ADMIN_NATIVE_CHECKS[kind].map(key => [key, true])), terminalKnown: true, writeOutcomeUncertain: false };
}
function cleaned(kind) {
  return { schemaVersion: 1, scenario: "admin-native-backend-cleanup", provenance: "protocol-only", case: kind, sourceSha: sha, status: "passed", code: "PASSED", failurePoint: null, stages: ADMIN_NATIVE_CLEANUP_STAGES[kind].map(name => ({ name, passed: true })), counts: { ...ADMIN_NATIVE_CLEANUP_COUNTS[kind] }, terminalKnown: true, exactInventory: true, accountsAbsent: true, receiptsAbsent: true, retainedAdminMetadataExact: true, writeOutcomeUncertain: false };
}
function entries() { return ADMIN_NATIVE_CASES.map(kind => ({ case: kind, report: passed(kind), cleanup: cleaned(kind), namespaceCleanup: "confirmed" })); }
function zero(kind) { return Object.fromEntries(Object.keys(ADMIN_NATIVE_PASS_COUNTS[kind]).map(key => [key, 0])); }
function prereq(kind, unknown = false) {
  return { ...passed(kind), status: "failed", code: unknown ? "WRITE_OUTCOME_UNCERTAIN" : "SETUP_REFUSED", failurePoint: "PREREQUISITE", stages: [], counts: zero(kind), checks: Object.fromEntries(ADMIN_NATIVE_CHECKS[kind].map(key => [key, false])), terminalKnown: false, writeOutcomeUncertain: unknown };
}
const refused = callback => assert.throws(callback, { message: "ADMIN_NATIVE_PACKET_REFUSED" });

test("three distinct protocol case projections retain their exact derived budgets and immutable eight-file inventory", () => {
  for (const kind of ADMIN_NATIVE_CASES) {
    const value = validateAdminNativeReport(passed(kind)); assert.equal(value.provenance, "protocol-only"); assert.equal(value.sourceHashes.length, 8); assert.ok(Object.isFrozen(value) && Object.isFrozen(value.counts) && Object.isFrozen(value.sourceHashes[0]));
    assert.equal(value.counts.requests, value.counts.adminRpcRequests + value.counts.otherRpcRequests + value.counts.authReadRequests + value.counts.authMutationRequests + value.counts.authLoginRequests + value.counts.publicRequests);
  }
  assert.deepEqual(ADMIN_NATIVE_CASES.map(kind => ADMIN_NATIVE_PASS_COUNTS[kind].requests), [24, 16, 28]);
  assert.deepEqual(ADMIN_NATIVE_CASES.map(kind => ADMIN_NATIVE_CLEANUP_COUNTS[kind].requests), [7, 8, 12]);
});

test("source inventory refuses foreign, duplicated, empty, reordered, oversized and non-string hashes", () => {
  for (const change of [v => v.sourceHashes.reverse(), v => v.sourceHashes.pop(), v => { v.sourceHashes[0] = v.sourceHashes[1]; }, v => { v.sourceHashes[0].path = "node_modules/server-only/empty.js"; }, v => { v.sourceHashes[0].bytes = 0; }, v => { v.sourceHashes[0].bytes = 1048577; }, v => { v.sourceHashes[0].sha256 = { toString: () => "b".repeat(64) }; }, v => { v.sourceSha = { toString: () => sha }; }]) { const v = passed("BLOCK_OLD_JWT"); change(v); refused(() => validateAdminNativeReport(v)); }
});

test("unfinished prefix is serial and cannot assert checks, terminality or independent final metadata", () => {
  const value = prereq("BLOCK_OLD_JWT"); assert.equal(validateAdminNativeReport(value).terminalKnown, false);
  for (const change of [v => { v.checks.fenceBeforeAuth = true; }, v => { v.terminalKnown = true; }, v => { v.counts.operations = 1; }, v => { v.stages = [{ name: "FENCE", passed: false }]; v.failurePoint = "FENCE"; }, v => { v.stages = [{ name: "BASELINE", passed: false }, { name: "FENCE", passed: false }]; v.failurePoint = "FENCE"; }]) { const v = structuredClone(value); change(v); refused(() => validateAdminNativeReport(v)); }
});

test("a completed stage needs its observed request/core/SQL lower bounds; PASS cannot drift one counter", () => {
  const failed = prereq("BLOCK_OLD_JWT"); Object.assign(failed, { code: "SQL_REFUSED", failurePoint: "FENCE", stages: [{ name: "BASELINE", passed: true }, { name: "FENCE", passed: false }] }); failed.checks.identitiesBound = true;
  Object.assign(failed.counts, { requests: 5, otherRpcRequests: 3, authReadRequests: 2, sqlInspections: 1 }); assert.equal(validateAdminNativeReport(failed).status, "failed");
  failed.counts.sqlInspections = 0; refused(() => validateAdminNativeReport(failed));
  for (const kind of ADMIN_NATIVE_CASES) for (const key of Object.keys(ADMIN_NATIVE_PASS_COUNTS[kind])) { const v = passed(kind); v.counts[key]++; refused(() => validateAdminNativeReport(v)); }
});

test("known terminality and sticky unknown are separate and neither may be promoted to PASS", () => {
  const kind = "CREATE_FORCED"; let v = passed(kind); v.terminalKnown = false; refused(() => validateAdminNativeReport(v)); v = passed(kind); v.writeOutcomeUncertain = true; refused(() => validateAdminNativeReport(v));
  v = prereq(kind, true); assert.equal(validateAdminNativeReport(v).writeOutcomeUncertain, true); v.writeOutcomeUncertain = false; refused(() => validateAdminNativeReport(v));
});

test("a failed mutating RPC report can preserve unknown without fabricating final audit/event/receipt counts", () => {
  const v = prereq("BLOCK_OLD_JWT", true); Object.assign(v, { failurePoint: "FENCE", stages: [{ name: "BASELINE", passed: true }, { name: "FENCE", passed: false }] }); v.checks.identitiesBound = true; Object.assign(v.counts, { requests: 7, otherRpcRequests: 3, authReadRequests: 2, adminRpcRequests: 2, coreCommands: 1, sqlInspections: 1 });
  assert.equal(validateAdminNativeReport(v).writeOutcomeUncertain, true); v.counts.receipts = 1; refused(() => validateAdminNativeReport(v));
});

test("identity proof cannot compensate missing Auth reads or access RPCs with unrelated HTTP classes", () => {
  const v = prereq("BLOCK_OLD_JWT"); Object.assign(v, { code: "SQL_REFUSED", failurePoint: "FENCE", stages: [{ name: "BASELINE", passed: true }, { name: "FENCE", passed: false }] }); v.checks.identitiesBound = true;
  Object.assign(v.counts, { requests: 5, publicRequests: 5, sqlInspections: 1 }); refused(() => validateAdminNativeReport(v));
  Object.assign(v.counts, { publicRequests: 2, otherRpcRequests: 3 }); refused(() => validateAdminNativeReport(v));
  Object.assign(v.counts, { publicRequests: 3, otherRpcRequests: 0, authReadRequests: 2 }); refused(() => validateAdminNativeReport(v));
});

test("Auth deletion ACK does not count an absent user until its independent404 stage", () => {
  const v = cleaned("BLOCK_OLD_JWT"); Object.assign(v, { status: "failed", code: "CLEANUP_NOT_PROVEN", failurePoint: "ABSENT_A", stages: ADMIN_NATIVE_CLEANUP_STAGES.BLOCK_OLD_JWT.slice(0, 4).map((name, index) => ({ name, passed: index !== 3 })), exactInventory: false, accountsAbsent: false, receiptsAbsent: false, retainedAdminMetadataExact: false });
  Object.assign(v.counts, { requests: 5, authReadRequests: 2, revokeRequests: 1, deleteRequests: 1, absenceReads: 1, removedUsers: 0, sqlInspections: 2, retainedOperations: 0, retainedAuditEntries: 0 }); assert.equal(validateAdminNativeCleanup(v).counts.removedUsers, 0);
  v.counts.removedUsers = 1; refused(() => validateAdminNativeCleanup(v));
});

test("cleanup preserves terminal append-only operations/audits but requires receipts cascade to zero", () => {
  for (const kind of ADMIN_NATIVE_CASES) { const v = cleaned(kind); assert.equal(validateAdminNativeCleanup(v).receiptsAbsent, true); v.counts.receiptsRemaining = 1; refused(() => validateAdminNativeCleanup(v)); }
  const v = cleaned("CREATE_FORCED"); v.counts.retainedAuditEntries = 0; refused(() => validateAdminNativeCleanup(v));
});

test("unknown or unconfirmed saga cannot cross the revoke/delete cleanup boundary", () => {
  for (const patch of [{ writeOutcomeUncertain: true }, { terminalKnown: false }]) { const v = { ...cleaned("SELF_AND_LAST_MASTER"), ...patch }; refused(() => validateAdminNativeCleanup(v)); }
  const e = entries(); e[0].report = prereq(e[0].case, true); e[1].report = null; e[1].cleanup = null; e[1].namespaceCleanup = "not-run"; e[2].report = null; e[2].cleanup = null; e[2].namespaceCleanup = "not-run"; refused(() => assembleAdminNativePacket({ sourceSha: sha, cases: e, writeOutcomeUncertain: true }));
});

test("unknown first arising in logout or DELETE retains the truthful failed cleanup prefix", () => {
  for (const failurePoint of ["REVOKE", "DELETE_A"]) {
    const names = ADMIN_NATIVE_CLEANUP_STAGES.BLOCK_OLD_JWT, end = names.indexOf(failurePoint), v = cleaned("BLOCK_OLD_JWT");
    Object.assign(v, { status: "failed", code: "WRITE_OUTCOME_UNCERTAIN", failurePoint, stages: names.slice(0, end + 1).map((name, index) => ({ name, passed: index !== end })), exactInventory: false, accountsAbsent: false, receiptsAbsent: false, retainedAdminMetadataExact: false, writeOutcomeUncertain: true });
    Object.assign(v.counts, { requests: end === 1 ? 3 : 4, authReadRequests: 2, revokeRequests: 1, deleteRequests: end === 1 ? 0 : 1, absenceReads: 0, removedUsers: 0, sqlInspections: end === 1 ? 1 : 2, retainedOperations: 0, retainedAuditEntries: 0 });
    const clean = validateAdminNativeCleanup(v); assert.equal(clean.writeOutcomeUncertain, true); assert.equal(clean.counts.removedUsers, 0);
    const e = entries(); e[0].cleanup = clean; for (let index = 1; index < e.length; index++) { e[index].report = null; e[index].cleanup = null; e[index].namespaceCleanup = "not-run"; }
    const packet = assembleAdminNativePacket({ sourceSha: sha, cases: e, writeOutcomeUncertain: false }); assert.equal(packet.code, "CLEANUP_FAILED"); assert.equal(packet.writeOutcomeUncertain, true); assert.equal(packet.cases[0].cleanup.stages.at(-1).passed, false);
    v.writeOutcomeUncertain = false; refused(() => validateAdminNativeCleanup(v));
  }
});

test("cleanup cannot mutate before inventory or delete before revocation is proven", () => {
  const v = cleaned("BLOCK_OLD_JWT"); Object.assign(v, { status: "failed", code: "WRITE_OUTCOME_UNCERTAIN", failurePoint: "INVENTORY", stages: [{ name: "INVENTORY", passed: false }], terminalKnown: true, exactInventory: false, accountsAbsent: false, receiptsAbsent: false, retainedAdminMetadataExact: false, writeOutcomeUncertain: true });
  Object.assign(v.counts, { requests: 3, authReadRequests: 2, revokeRequests: 0, deleteRequests: 1, absenceReads: 0, removedUsers: 0, sqlInspections: 1, retainedOperations: 0, retainedAuditEntries: 0 }); refused(() => validateAdminNativeCleanup(v));
  v.failurePoint = "REVOKE"; v.stages = [{ name: "INVENTORY", passed: true }, { name: "REVOKE", passed: false }]; Object.assign(v.counts, { requests: 4, revokeRequests: 1 }); refused(() => validateAdminNativeCleanup(v));
});

test("dedicated packet is protocol-only and requires three independently completed namespaces", () => {
  const packet = assembleAdminNativePacket({ sourceSha: sha, cases: entries(), writeOutcomeUncertain: false }); assert.equal(packet.status, "passed"); assert.deepEqual(validateAdminNativePacket(packet), packet); assert.equal(packet.provenance, "protocol-only"); assert.equal("nativeVerified" in packet, false);
  const invalid = { ...packet, nativeVerified: true }; refused(() => validateAdminNativePacket(invalid));
});

test("sequential packet refuses later cases after an earlier incomplete outcome", () => {
  const e = entries(); e[0].namespaceCleanup = "failed"; refused(() => assembleAdminNativePacket({ sourceSha: sha, cases: e, writeOutcomeUncertain: false }));
  for (let index = 1; index < e.length; index++) { e[index].report = null; e[index].cleanup = null; e[index].namespaceCleanup = "not-run"; }
  const packet = assembleAdminNativePacket({ sourceSha: sha, cases: e, writeOutcomeUncertain: false }); assert.equal(packet.status, "failed"); assert.equal(packet.code, "NAMESPACE_FAILED"); assert.equal(packet.cases[0].cleanup.status, "passed");
});

test("a later namespace unknown remains sticky while earlier factual SDK cleanup is retained", () => {
  const e = entries(); e[1].report = prereq(e[1].case, true); e[1].cleanup = null; e[1].namespaceCleanup = "confirmed"; e[2].report = null; e[2].cleanup = null; e[2].namespaceCleanup = "not-run";
  const packet = assembleAdminNativePacket({ sourceSha: sha, cases: e, writeOutcomeUncertain: false }); assert.equal(packet.status, "failed"); assert.equal(packet.writeOutcomeUncertain, true); assert.equal(packet.cases[0].cleanup.status, "passed"); assert.equal(packet.cases[1].cleanup, null); assert.equal(packet.cases[1].namespaceCleanup, "confirmed");
});

test("outer latch suppresses PASS and each case keeps the same SHA/manifest/case binding", () => {
  assert.equal(assembleAdminNativePacket({ sourceSha: sha, cases: entries(), writeOutcomeUncertain: true }).code, "WRITE_OUTCOME_UNCERTAIN");
  for (const change of [e => { e[0].report.sourceSha = "c".repeat(40); }, e => { e[0].cleanup.case = "CREATE_FORCED"; }, e => { e[2].report.sourceHashes[1].sha256 = "d".repeat(64); }, e => { e.reverse(); }]) { const e = entries(); change(e); refused(() => assembleAdminNativePacket({ sourceSha: sha, cases: e, writeOutcomeUncertain: false })); }
});

test("getters, proxy traps, sparse arrays and hidden additional data are refused without projection", () => {
  let accessed = 0; const getter = passed("BLOCK_OLD_JWT"); Object.defineProperty(getter, "sourceSha", { enumerable: true, get() { accessed++; return sha; } }); refused(() => validateAdminNativeReport(getter)); assert.equal(accessed, 0);
  refused(() => validateAdminNativeReport(new Proxy({}, { getPrototypeOf() { throw Error("trap"); } })));
  const sparse = passed("BLOCK_OLD_JWT"); delete sparse.sourceHashes[2]; refused(() => validateAdminNativeReport(sparse));
  const hidden = passed("BLOCK_OLD_JWT"); Object.defineProperty(hidden, "password", { value: "synthetic", enumerable: false }); refused(() => validateAdminNativeReport(hidden));
});

test("one descriptor snapshot prevents stateful Proxy get traps from leaking changed fields", () => {
  let reads = 0; const value = passed("BLOCK_OLD_JWT"), proxy = new Proxy(value, { get(target, key) { if (key === "sourceSha") return ++reads < 3 ? sha : "synthetic-private-provider-error"; return Reflect.get(target, key); } });
  const report = validateAdminNativeReport(proxy); assert.equal(report.sourceSha, sha); assert.equal(reads, 0); assert.equal(JSON.stringify(report).includes("synthetic-private-provider-error"), false);
  let nestedReads = 0; const nested = passed("CREATE_FORCED"); nested.sourceHashes[0] = new Proxy(nested.sourceHashes[0], { get(target, key) { if (key === "sha256") { nestedReads++; return "synthetic-private-provider-error"; } return Reflect.get(target, key); } });
  assert.equal(validateAdminNativeReport(nested).sourceHashes[0].sha256, "b".repeat(64)); assert.equal(nestedReads, 0);
});

test("a Proxy cannot conceal invalid descriptor values in source rows, counters or packet binding", () => {
  let reads = 0; const v = passed("BLOCK_OLD_JWT"); v.sourceSha = "invalid"; refused(() => validateAdminNativeReport(new Proxy(v, { get(target, key) { if (key === "sourceSha") { reads++; return sha; } return Reflect.get(target, key); } }))); assert.equal(reads, 0);
  const nested = passed("CREATE_FORCED"); nested.sourceHashes[0].sha256 = "invalid"; nested.sourceHashes[0] = new Proxy(nested.sourceHashes[0], { get(target, key) { if (key === "sha256") { reads++; return "b".repeat(64); } return Reflect.get(target, key); } }); refused(() => validateAdminNativeReport(nested)); assert.equal(reads, 0);
  const bad = passed("SELF_AND_LAST_MASTER"); bad.counts.authReadRequests = 0; bad.counts = new Proxy(bad.counts, { get(target, key) { if (key === "authReadRequests") { reads++; return 2; } return Reflect.get(target, key); } }); refused(() => validateAdminNativeReport(bad)); assert.equal(reads, 0);
  const packet = assembleAdminNativePacket({ sourceSha: sha, cases: entries(), writeOutcomeUncertain: false }); const forged = { ...packet, sourceSha: "invalid" }; refused(() => validateAdminNativePacket(new Proxy(forged, { get(target, key) { if (key === "sourceSha") { reads++; return sha; } return Reflect.get(target, key); } }))); assert.equal(reads, 0);
});
