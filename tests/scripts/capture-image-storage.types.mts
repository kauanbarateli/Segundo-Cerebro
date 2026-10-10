import { createCaptureImageStorageAcceptance, projectCaptureImageStorageResponse, type CaptureImageOptions, type CaptureImageReport, type CaptureImageSqlIds, type CaptureImageRequest, type CaptureImageResponseObservation, type CaptureImageResponseObserver } from "../e2e-auth-local/capture-image-storage-support.mjs";
import { type NativeCaseOptions } from "../e2e-auth-local/capture-image-storage-local-case.mjs";
import { assembleCaptureImageStoragePacket, validateCaptureImageStorageReport } from "../e2e-auth-local/capture-image-storage-contract.mjs";
import type { CaptureNativeContext } from "../e2e-auth-local/capture-task-persistence-support.mjs";
declare const context: CaptureNativeContext;
declare const options: CaptureImageOptions;
declare const request: CaptureImageRequest;
declare const ids: CaptureImageSqlIds;
declare const report: CaptureImageReport;
void createCaptureImageStorageAcceptance(context, options);
const observation: CaptureImageResponseObservation = projectCaptureImageStorageResponse({}, null);
const observeResponse: CaptureImageResponseObserver = row => { const ordinal: 1 = row.ordinal; void ordinal; };
void createCaptureImageStorageAcceptance(context, { ...options, observeResponse });
const nativeSink: NativeCaseOptions["observeResponse"] = observeResponse;
void nativeSink;
// @ts-expect-error The closed projection is immutable.
observation.httpStatus = 404;
// @ts-expect-error No raw provider message in a diagnostic projection.
void observation.message;
// @ts-expect-error Observation is not a PASS/cleanup certificate.
void observation.authDeletionAllowed;
// @ts-expect-error Sink must be an explicit function, never a flag.
void createCaptureImageStorageAcceptance(context, { ...options, observeResponse: true });
// @ts-expect-error The caller-owned sink is synchronous, not an async operation.
const asyncSink: CaptureImageResponseObserver = async () => undefined;
void asyncSink;
// @ts-expect-error Both HTTP and fixed read-only SQL inspection are mandatory.
void createCaptureImageStorageAcceptance(context, { transport: options.transport });
// @ts-expect-error No default IO or caller-supplied arbitrary SQL.
void createCaptureImageStorageAcceptance(context, {});
// @ts-expect-error Immutable binding.
ids.ownerId = "foreign";
// @ts-expect-error Capability requests cannot carry authenticated browser cookies.
request.credentials = "include";
// @ts-expect-error No arbitrary SQL string accepted.
void options.inspectSql("select * from auth.users");
const projected: CaptureImageReport = validateCaptureImageStorageReport(report);
if (projected.status === "passed") { const certain: false = projected.writeOutcomeUncertain; const point: null = projected.failurePoint; void certain; void point; }
const packet = assembleCaptureImageStoragePacket({ pipeline: projected, cleanup: null, writeOutcomeUncertain: false });
void packet;
// @ts-expect-error Cleanup dependency and sticky caller latch are required.
void assembleCaptureImageStoragePacket({ pipeline: projected });

// @ts-expect-error A caller-owned objects inspector is independently mandatory.
void createCaptureImageStorageAcceptance(context,{transport:options.transport,inspectSql:options.inspectSql});
// @ts-expect-error Objects inspector never takes arbitrary SQL.
void options.inspectObjects("select * from storage.objects");
// @ts-expect-error Object query names are finite and immutable.
void options.inspectObjects({query:"custom",ownerId:ids.ownerId,uploadId:ids.uploadId});
const schema:2=report.schemaVersion;void schema;
