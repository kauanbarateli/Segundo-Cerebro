import { createCaptureImageStorageAcceptance, type CaptureImageOptions, type CaptureImageReport, type CaptureImageSqlIds, type CaptureImageRequest } from "../e2e-auth-local/capture-image-storage-support.mjs";
import { assembleCaptureImageStoragePacket, validateCaptureImageStorageReport } from "../e2e-auth-local/capture-image-storage-contract.mjs";
import type { CaptureNativeContext } from "../e2e-auth-local/capture-task-persistence-support.mjs";
declare const context: CaptureNativeContext;
declare const options: CaptureImageOptions;
declare const request: CaptureImageRequest;
declare const ids: CaptureImageSqlIds;
declare const report: CaptureImageReport;
void createCaptureImageStorageAcceptance(context, options);
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
