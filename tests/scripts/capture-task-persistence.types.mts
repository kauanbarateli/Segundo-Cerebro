// Compile-only controls. Do not execute: no runtime test, RPC or fixture here.
import {
  CAPTURE_NATIVE_API, CAPTURE_NATIVE_APP, createCaptureTaskNativeAcceptance,
  CAPTURE_NATIVE_COUNT_LIMITS, CAPTURE_NATIVE_PASS_COUNTS, CAPTURE_NATIVE_CHECKS,
  type CaptureNativeAcceptance, type CaptureNativeContext, type CaptureNativeOptions,
  type CaptureNativeReport, type CaptureNativeTransport, type CaptureNativeActualCore,
} from "../e2e-auth-local/capture-task-persistence-support.mjs";
declare const actor: CaptureNativeContext["a"];
declare const transport: CaptureNativeTransport;
declare const subject: CaptureNativeAcceptance;
declare const report: CaptureNativeReport;
declare const core: CaptureNativeActualCore;
const context: CaptureNativeContext = { runtime: { ci: true, githubActions: true, localAuthRun: true, appUrl: CAPTURE_NATIVE_APP, supabaseUrl: CAPTURE_NATIVE_API }, a: actor, b: actor, publishableKey: "fixture", serverSecretKey: "fixture" };
const options: CaptureNativeOptions = { transport, timeoutMs: 15_000 };
const accepted: Promise<CaptureNativeAcceptance> = createCaptureTaskNativeAcceptance(context, options);
void accepted;
const pass: boolean = subject.metadata().passed;
const scenario: "capture-task-persistence" = report.scenario;
void pass; void scenario;
// @ts-expect-error Protocol report cannot invent native provenance.
void report.nativeVerified;
const exactRequests: 45 = CAPTURE_NATIVE_PASS_COUNTS.requests;
const maximumRequests: 64 = CAPTURE_NATIVE_COUNT_LIMITS.requests;
void exactRequests; void maximumRequests;
// @ts-expect-error Frozen count contracts are immutable.
CAPTURE_NATIVE_COUNT_LIMITS.requests = 65;
// @ts-expect-error Frozen check names cannot be appended.
CAPTURE_NATIVE_CHECKS.push("anything");
if (report.status === "passed") { const code: "PASSED" = report.code; const point: null = report.failurePoint; const uncertain: false = report.writeOutcomeUncertain; void code; void point; void uncertain; }
// @ts-expect-error No foreign or configurable origin.
const foreign: CaptureNativeContext = { ...context, runtime: { ...context.runtime, supabaseUrl: "https://foreign.invalid" } };
// @ts-expect-error Explicit mandatory transport.
createCaptureTaskNativeAcceptance(context, {});
// @ts-expect-error No default SDK authority argument.
createCaptureTaskNativeAcceptance(context, { transport, sql: "anything" });
// @ts-expect-error Runtime context is immutable.
context.runtime.ci = false;
// @ts-expect-error Report counters are immutable.
report.counts.commitAttempts = 0;
// @ts-expect-error Rows/credentials cannot be added to metadata.
void subject.metadata().accessToken;
// @ts-expect-error DELETE cannot be supplied as a native capture transport method.
transport(CAPTURE_NATIVE_API, { method: "DELETE", headers: { apikey: "", Authorization: "", Accept: "application/json" }, redirect: "error", cache: "no-store", signal: new AbortController().signal });
const gateway = core.createCaptureTaskGateway("fixture", "fixture", "capture.convert", async () => ({ data: null, error: { code: "42501" } }));
const store = core.createCaptureTaskStore(gateway, { maxAttempts: 1 }); void store;
void foreign;
