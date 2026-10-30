/** Pure planner/guard tests plus source-only workflow reads. No live OS policy, process, network, SQL or SDK. Root passed the original 17; integrated workflow awaits final Root run. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planAdminPortReservation, checkAdminPortReservationReadback, checkAdminPortReservationBeforeApply, checkAdminPortReservationAfterApply, adminPortPolicyDiagnostic, validateAdminPortPolicyContext, main } from "../../scripts/verification/admin-port-reservation-plan.mjs";
const input = overrides => ({ runnerEnvironment: "github-hosted", runnerOs: "Linux", jobContainerId: "",
  serviceContainerCount: 0, rangeText: "32768\t60999\n", reservedText: "\n", ...overrides });
const refused = work => assert.throws(work, { code: "ADMIN_PORT_RESERVATION_PLAN_REFUSED" });
const readback = plan => ({ reservedImmediatelyBeforeWrite: plan.reservedBefore + "\n",
  reservedAfterWrite: plan.reservedAfter + "\n", rangeAfterWrite: plan.localPortRange.join(" ") + "\n" });
function bits(text) {
  const result = new Uint8Array(65536);
  for (const term of text.split(",").filter(Boolean)) {
    const [start, end = start] = term.split("-").map(Number); for (let p = start; p <= end; p++) result[p] = 1;
  }
  return result;
}
test("default-range model reserves only the three fixed ports and grants no authority", () => {
  const plan = planAdminPortReservation(input());
  assert.equal(plan.reservedBefore, ""); assert.equal(plan.reservedAfter, "54320-54322");
  assert.deepEqual(plan.targetPorts, [54320, 54321, 54322]); assert.equal(plan.ephemeralAvailableBefore, 28232);
  assert.equal(plan.ephemeralAvailableAfter, 28229); assert.equal(plan.targetPortsInsideRange, 3);
  assert.equal(plan.requiresWrite, true); assert.equal(plan.planningOnly, true); assert.equal(plan.authority, false);
  assert.equal(Object.isFrozen(plan), true); assert.equal(Object.isFrozen(plan.targetPorts), true);
});
test("union preserves every previously reserved port and changes nothing beyond the fixed three", () => {
  for (const reservedText of ["80,443,40000-40100", "54319,54321,54323", "0,1,65535", "54320-54322", "2-4,3-5", "60000,80,60000"]) {
    const plan = planAdminPortReservation(input({ reservedText })), before = bits(reservedText), after = bits(plan.reservedAfter);
    for (let p = 0; p < 65536; p++) assert.equal(after[p], before[p] || Number([54320, 54321, 54322].includes(p)), String(p));
  }
});
test("already reserved targets are an idempotent no-write plan with existing ranges retained", () => {
  const plan = planAdminPortReservation(input({ reservedText: "80,54319-54324,65535\n" }));
  assert.equal(plan.requiresWrite, false); assert.equal(plan.reservedAfter, "80,54319-54324,65535");
});
test("ranges outside the actual ephemeral range remain reserved without changing that range", () => {
  const plan = planAdminPortReservation(input({ rangeText: "10000 10010\n", reservedText: "10000,10010" }));
  assert.deepEqual(plan.localPortRange, [10000, 10010]); assert.equal(plan.targetPortsInsideRange, 0);
  assert.equal(plan.ephemeralAvailableBefore, 9); assert.equal(plan.ephemeralAvailableAfter, 9);
  assert.equal(plan.reservedAfter, "10000,10010,54320-54322");
});
test("a plan refuses an exhausted ephemeral range instead of silently disabling outbound allocation", () => {
  for (const data of [input({ rangeText: "54320 54322" }), input({ reservedText: "32768-60999" })]) refused(() => planAdminPortReservation(data));
});
test("only the disposable GitHub-hosted Linux host scope can be modeled", () => {
  for (const change of [{ runnerEnvironment: "self-hosted" }, { runnerEnvironment: "" }, { runnerOs: "Windows" },
    { runnerOs: "macOS" }, { jobContainerId: "container" }, { serviceContainerCount: 1 }, { serviceContainerCount: "0" }]) {
    refused(() => planAdminPortReservation(input(change)));
  }
});
test("range parsing rejects malformed, coercing and unsupported kernel snapshots", () => {
  for (const rangeText of ["", "32768", "0 60999", "60999 32768", "32768 65536", "032768 60999", "32768 60999\n\n", "32768 60999\r\n", "32768 60999\u2028", null, 27]) {
    refused(() => planAdminPortReservation(input({ rangeText })));
  }
});
test("reservation parsing refuses malformed tokens without clearing existing reservations", () => {
  for (const reservedText of [",", "80,", "-1", "5-2", "1-2-3", "65536", " 80", "01", "80;443", "80\n443", "80\r\n", "80\u2029", null, 27]) {
    refused(() => planAdminPortReservation(input({ reservedText })));
  }
});
test("snapshot records reject extra fields and accessors without evaluating getter data", () => {
  refused(() => planAdminPortReservation(input({ applied: true }))); let reads = 0;
  const getter = input(); Object.defineProperty(getter, "reservedText", { enumerable: true, get() { reads++; throw Error("PRIVATE"); } });
  refused(() => planAdminPortReservation(getter)); assert.equal(reads, 0);
});
test("readback accepts equivalent range notation but remains a pure unauthorised model", () => {
  const data = input({ reservedText: "80,54321" }), plan = planAdminPortReservation(data), observed = readback(plan);
  observed.reservedAfterWrite = "80,54320,54321,54322\n";
  const result = checkAdminPortReservationReadback(data, observed);
  assert.equal(result.reservationSetMatches, true); assert.equal(result.planningOnly, true); assert.equal(result.authority, false);
});
test("readback refuses loss, additional reservations, drift before write and range changes", () => {
  const data = input({ reservedText: "80,443" }), plan = planAdminPortReservation(data), good = readback(plan);
  for (const change of [{ reservedImmediatelyBeforeWrite: "80,443,8080" }, { reservedAfterWrite: "54320-54322" },
    { reservedAfterWrite: "80,443,54320-54323" }, { reservedAfterWrite: "80,443,54320-54321" },
    { rangeAfterWrite: "32768 61000" }, { extra: true }]) refused(() => checkAdminPortReservationReadback(data, { ...good, ...change }));
});

test("before-apply and after-apply comparisons are distinct and cannot certify the other stage", () => {
  const data = input({ reservedText: "80,443" }), plan = planAdminPortReservation(data);
  const before = { reservedText: "443,80", rangeText: "32768 60999" };
  const after = { reservedText: "80,443,54320-54322", rangeText: "32768 60999" };
  assert.equal(checkAdminPortReservationBeforeApply(data, before).snapshotMatches, true);
  assert.equal(checkAdminPortReservationAfterApply(data, after).reservationSetMatches, true);
  refused(() => checkAdminPortReservationBeforeApply(data, after)); refused(() => checkAdminPortReservationAfterApply(data, before));
  refused(() => checkAdminPortReservationBeforeApply(data, { ...before, rangeText: "32768 61000" }));
  refused(() => checkAdminPortReservationAfterApply(data, { ...after, reservedText: plan.reservedAfter + ",8080" }));
});
test("diagnostics expose only closed finite metadata and never original ownership or native acceptance", () => {
  for (const stage of ["planned", "readback-confirmed"]) {
    const result = adminPortPolicyDiagnostic(input({ reservedText: "80,443" }), stage, "a".repeat(40));
    assert.deepEqual(Object.keys(result).sort(), ["schemaVersion", "scenario", "stage", "eventSourceSha", "rangeStart", "rangeEnd",
      "reservedBeforeCount", "plannedReservedCount", "reservedBeforeSha256", "plannedReservedSha256", "targetReservedBeforeCount",
      "targetReservedAfterCount", "ephemeralAvailableBefore", "ephemeralAvailableAfter", "requiresWrite", "kernelReadbackConfirmed",
      "originalCauseKnown", "nativeCasesCertified"].sort());
    assert.equal(result.originalCauseKnown, false); assert.equal(result.nativeCasesCertified, false);
    assert.equal(result.reservedBeforeCount, 2); assert.equal(result.plannedReservedCount, 5);
    assert.match(result.reservedBeforeSha256, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(result).includes("80,443"), false);
  }
  refused(() => adminPortPolicyDiagnostic(input(), "PASSED", "a".repeat(40)));
  refused(() => adminPortPolicyDiagnostic(input(), "planned", "private"));
});
const context = overrides => ({ CI: "true", GITHUB_ACTIONS: "true", SC_ADMIN_PORT_POLICY_RUN: "1",
  SC_POLICY_RUNNER_ENVIRONMENT: "github-hosted", SC_POLICY_RUNNER_OS: "Linux", SC_POLICY_JOB_CONTAINER_ID: "",
  SC_POLICY_JOB_SERVICES_JSON: "{}", GITHUB_SHA: "a".repeat(40), RUNNER_TEMP: "/tmp/runner", ...overrides });
test("CLI context guard refuses foreign scope or opt-out before any IO", () => {
  assert.equal(validateAdminPortPolicyContext(context(), "linux").eventSourceSha, "a".repeat(40));
  assert.equal(validateAdminPortPolicyContext(context({ SC_POLICY_JOB_SERVICES_JSON: '\"\"' }), "linux").eventSourceSha, "a".repeat(40));
  assert.equal(validateAdminPortPolicyContext(context({ SC_POLICY_JOB_SERVICES_JSON: "null" }), "linux").eventSourceSha, "a".repeat(40));
  for (const data of [context({ CI: "false" }), context({ GITHUB_ACTIONS: "false" }), context({ SC_ADMIN_PORT_POLICY_RUN: "0" }),
    context({ SC_POLICY_RUNNER_ENVIRONMENT: "self-hosted" }), context({ SC_POLICY_RUNNER_OS: "Windows" }),
    context({ SC_POLICY_JOB_CONTAINER_ID: "container" }), context({ GITHUB_SHA: "invalid" })]) {
    refused(() => validateAdminPortPolicyContext(data, "linux"));
  }
  for (const SC_POLICY_JOB_SERVICES_JSON of ['{"redis":{}}', "[]", "0", "false", "invalid"]) {
    refused(() => validateAdminPortPolicyContext(context({ SC_POLICY_JOB_SERVICES_JSON }), "linux"));
  }
  refused(() => validateAdminPortPolicyContext(context(), "win32"));
});
test("help and invalid argument paths perform no runtime policy operation", async () => {
  const values = []; assert.equal(await main([], {}, v => values.push(v)), 0);
  assert.deepEqual(values, [{ schemaVersion: 1, scenario: "admin-fixed-port-policy", code: "NO_POLICY_APPLIED" }]);
  assert.equal(await main(["--apply", "/not-opened"], {}, v => values.push(v)), 1);
  assert.equal(values.at(-1).code, "POLICY_REFUSED");
});
test("declarative workflow fixes one key, verifies readback and leaves the native port guard intact", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/admin-native-backend-local-ci.yml", import.meta.url), "utf8");
  const helper = await readFile(new URL("../../scripts/verification/admin-port-reservation-plan.mjs", import.meta.url), "utf8");
  const start = workflow.indexOf("      - name: Reservar portas fixas apenas no runner descartável");
  const end = workflow.indexOf("      - name: Dependências existentes", start);
  assert.ok(start > workflow.indexOf("node-version-file: .nvmrc") && end > start);
  const step = workflow.slice(start, end);
  assert.equal(step.split("sudo -n sysctl -q -w").length, 2);
  assert.ok(step.includes('"net.ipv4.ip_local_reserved_ports=$reserved_value"'));
  assert.ok(step.indexOf("--check-scope") < step.indexOf("mktemp"));
  assert.ok(step.indexOf("--snapshot") < step.indexOf("--check-before-apply"));
  assert.ok(step.indexOf("--check-before-apply") < step.indexOf("sudo -n sysctl"));
  assert.ok(step.indexOf("sudo -n sysctl") < step.indexOf("--check-readback"));
  assert.ok(step.includes("${{ runner.environment }}") && step.includes("${{ runner.os }}") && step.includes("${{ job.container.id }}") && step.includes("${{ toJSON(job.services) }}"));
  assert.doesNotMatch(step, /continue-on-error|\bretry\b|\bsleep\b|kill|sysctl -p|ip_local_port_range=/);
  assert.doesNotMatch(workflow, /^    (container|services):/m);
  assert.doesNotMatch(helper, /node:child_process|spawn\(|execFile\(|writeFile\(KERNEL/);
  assert.ok(workflow.includes('node scripts/verification/admin-native-backend-local-ci.mjs --execute'));
});

test("oversized canonical sysctl arguments are refused before an operational write can be planned", () => {
  const reservedText = Array.from({ length: 32768 }, (_, index) => String(index * 2 + 1)).join(",");
  assert.ok(reservedText.length > 65536);
  refused(() => planAdminPortReservation(input({ reservedText })));
});
