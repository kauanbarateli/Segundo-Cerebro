import test from "node:test";
import assert from "node:assert/strict";
import { projectCaptureImageStorageResponse } from "../e2e-auth-local/capture-image-storage-support.mjs";
import { validateNativeCaseSetup, runCaptureImageLocalCase } from "../e2e-auth-local/capture-image-storage-local-case.mjs";
import { runCaptureImageStorageLocalCi } from "../../scripts/verification/capture-image-storage-local-ci.mjs";

// Pure classifications are diagnostic, not native provider observations or
// absence certificates. No service, transport, browser or personal account.
const keys = ["stage", "operation", "ordinal", "httpStatus", "redirected", "contentKind", "decodeKind", "bodyKeysCount", "knownBodyKeysOnly", "bodyCodeKind", "bodyErrorKind", "bodyStatusKind", "messageKind", "messageSize"];
const metadata = { httpStatus: 404, redirected: false, contentType: "application/json; charset=utf-8", decodeKind: "JSON_OBJECT" };
const missing = { statusCode: "404", code: "NoSuchKey", error: "NoSuchKey", message: "SYNTHETIC_PRIVATE_MESSAGE" };
function closed(row) {
  assert.deepEqual(Object.keys(row), keys); assert.equal(Object.isFrozen(row), true);
  assert.equal(row.stage, "BASELINE"); assert.equal(row.operation, "FRESH_STAGING_GET"); assert.equal(row.ordinal, 1);
  assert.equal(Object.values(row).every(value => value === null || ["string", "number", "boolean"].includes(typeof value)), true);
  assert.equal(Object.hasOwn(row, "passed"), false); assert.equal(Object.hasOwn(row, "authDeletionAllowed"), false);
  return row;
}
test("native HTTP400 and body404 remain distinct from HTTP404, without message or identifiers", () => {
  const absent = closed(projectCaptureImageStorageResponse(metadata, missing));
  const refused = closed(projectCaptureImageStorageResponse({ ...metadata, httpStatus: 400 }, missing));
  assert.equal(absent.httpStatus, 404); assert.equal(refused.httpStatus, 400);
  assert.equal(absent.bodyCodeKind, "NO_SUCH_KEY"); assert.equal(refused.bodyStatusKind, "STRING_404");
  assert.equal(absent.bodyErrorKind, "NO_SUCH_KEY"); assert.equal(absent.messageSize, "BOUNDED"); assert.equal(absent.bodyKeysCount, 4); assert.equal(absent.knownBodyKeysOnly, true);
  const canaries = { code: "SYNTHETIC_TOKEN_SECRET", error: "https://synthetic.invalid/private/path", message: "SYNTHETIC_EMAIL@example.invalid", statusCode: "00000000-0000-4000-8000-000000000001", "SYNTHETIC_PRIVATE_KEY": "SYNTHETIC_PRIVATE_VALUE" };
  const row = closed(projectCaptureImageStorageResponse(metadata, canaries)), serialized = JSON.stringify(row);
  assert.equal(row.bodyCodeKind, "OTHER_STRING"); assert.equal(row.bodyErrorKind, "OTHER_STRING"); assert.equal(row.bodyStatusKind, "OTHER_STRING"); assert.equal(row.knownBodyKeysOnly, false);
  for (const canary of [...Object.keys(canaries), ...Object.values(canaries)].filter(value => value.startsWith("SYNTHETIC") || value.startsWith("https:") || value.includes("-"))) assert.equal(serialized.includes(canary), false);
});
test("known error categories remain separate; inherited-looking provider strings cannot escape enums", () => {
  for (const [code, expected] of [["NoSuchBucket", "NO_SUCH_BUCKET"], ["AccessDenied", "ACCESS_DENIED"], ["NotFound", "NOT_FOUND"], ["toString", "OTHER_STRING"], ["constructor", "OTHER_STRING"], ["__proto__", "OTHER_STRING"]]) {
    const row = closed(projectCaptureImageStorageResponse(metadata, { code, error: code }));
    assert.equal(row.bodyCodeKind, expected); assert.equal(row.bodyErrorKind, expected);
  }
  const object = closed(projectCaptureImageStorageResponse(metadata, { code: 404, error: { secret: "SYNTHETIC_NESTED_SECRET" }, statusCode: 404, message: false }));
  assert.equal(object.bodyCodeKind, "NON_STRING"); assert.equal(object.bodyErrorKind, "OBJECT"); assert.equal(object.bodyStatusKind, "NUMBER_404"); assert.equal(object.messageKind, "NON_STRING"); assert.equal(object.messageSize, "NONE");
});
test("scalar/array/binary/invalid/not-read classifications never traverse payloads", () => {
  for (const [body, expected] of [[null, "JSON_SCALAR"], [true, "JSON_SCALAR"], ["SYNTHETIC_RAW_BODY", "JSON_SCALAR"], [[{ secret: "SYNTHETIC_NESTED_SECRET" }], "JSON_ARRAY"]]) {
    const row = closed(projectCaptureImageStorageResponse(metadata, body)); assert.equal(row.decodeKind, expected); assert.equal(row.bodyKeysCount, null); assert.equal(row.bodyCodeKind, "MISSING"); assert.equal(JSON.stringify(row).includes("SYNTHETIC"), false);
  }
  for (const decodeKind of ["BINARY", "INVALID_JSON", "NOT_READ"]) { const row = closed(projectCaptureImageStorageResponse({ ...metadata, decodeKind }, missing)); assert.equal(row.decodeKind, decodeKind); assert.equal(row.bodyKeysCount, null); }
  for (const [contentType, expected] of [["image/jpeg", "JPEG"], ["image/png; charset=binary", "PNG"], ["text/html", "OTHER"], ["", "MISSING"], [null, "MISSING"]]) assert.equal(closed(projectCaptureImageStorageResponse({ contentType })).contentKind, expected);
});
test("bounded shape/size enums include empty and oversized messages without retaining their values", () => {
  for (const [message, expected] of [["", "EMPTY"], ["x".repeat(256), "BOUNDED"], ["x".repeat(257), "OVER_LIMIT"]]) assert.equal(closed(projectCaptureImageStorageResponse(metadata, { message })).messageSize, expected);
  assert.equal(closed(projectCaptureImageStorageResponse(metadata, {})).messageKind, "MISSING");
  const many = Object.fromEntries(Array.from({ length: 33 }, (_, index) => ["SYNTHETIC_KEY_" + index, "SYNTHETIC_VALUE"]));
  const row = closed(projectCaptureImageStorageResponse(metadata, many)); assert.equal(row.bodyKeysCount, "OVER_LIMIT"); assert.equal(row.knownBodyKeysOnly, false); assert.equal(JSON.stringify(row).includes("SYNTHETIC"), false);
  for (const [statusCode, expected] of [[400, "NUMBER_400"], ["400", "STRING_400"], [401, "OTHER_NUMBER"], ["401", "OTHER_STRING"], [false, "OTHER"]]) assert.equal(closed(projectCaptureImageStorageResponse(metadata, { statusCode })).bodyStatusKind, expected);
});
test("getter and proxy traps cannot export raw exception text or execute body getters", () => {
  let reads = 0; const body = { ...missing };
  Object.defineProperty(body, "message", { enumerable: true, get() { reads++; throw new Error("SYNTHETIC_GETTER_SECRET"); } });
  const row = closed(projectCaptureImageStorageResponse(metadata, body)); assert.equal(reads, 0); assert.equal(row.knownBodyKeysOnly, false); assert.equal(row.messageKind, "NON_STRING");
  for (const trap of ["ownKeys", "getOwnPropertyDescriptor", "getPrototypeOf"]) {
    const hostile = new Proxy({ ...missing }, { [trap]() { throw new Error("SYNTHETIC_PROXY_SECRET"); } });
    assert.equal(JSON.stringify(closed(projectCaptureImageStorageResponse(metadata, hostile))).includes("SYNTHETIC"), false);
  }
  let metadataReads = 0; const accessor = { get httpStatus() { metadataReads++; throw new Error("SYNTHETIC_METADATA_SECRET"); } };
  assert.equal(closed(projectCaptureImageStorageResponse(accessor)).httpStatus, null); assert.equal(metadataReads, 0);
  assert.equal(closed(projectCaptureImageStorageResponse(new Proxy({}, { ownKeys() { throw new Error("SYNTHETIC_METADATA_SECRET"); } }))).httpStatus, null);
});
test("status0 is diagnostic only; absent/invalid headers and no response stay closed", () => {
  assert.equal(closed(projectCaptureImageStorageResponse({ httpStatus: 0 })).httpStatus, 0);
  for (const status of [-1, 600, 404.5, "404", Infinity, NaN, null]) assert.equal(closed(projectCaptureImageStorageResponse({ httpStatus: status })).httpStatus, null);
  assert.equal(closed(projectCaptureImageStorageResponse(undefined)).redirected, null);
  assert.equal(closed(projectCaptureImageStorageResponse({ ...metadata, redirected: true })).redirected, true);
});
test("invalid explicitly present native-case sinks refuse setup before Auth or transport effects", async () => {
  const context = { ci: true, githubActions: true, localAuthRun: true, appUrl: "http://127.0.0.1:3117", supabaseUrl: "http://127.0.0.1:54321", publishableKey: "sb_publishable_" + "P".repeat(32), serverSecretKey: "sb_secret_" + "S".repeat(32) };
  let effects = 0; const options = { transport: async () => { effects++; throw new Error("SYNTHETIC_UNREACHABLE"); }, inspectSql: async () => { effects++; }, registerActors: () => { effects++; }, cleanupAllowed: () => true };
  validateNativeCaseSetup(context, options); validateNativeCaseSetup(context, { ...options, observeResponse: () => undefined });
  for (const observeResponse of [undefined, null, true, {}, "SYNTHETIC_NOT_FUNCTION"]) {
    assert.throws(() => validateNativeCaseSetup(context, { ...options, observeResponse }), /^Error: SETUP_REFUSED$/);
    await assert.rejects(() => runCaptureImageLocalCase(context, { ...options, observeResponse }), /^Error: SETUP_REFUSED$/);
  }
  await assert.rejects(() => runCaptureImageStorageLocalCi({}, "SYNTHETIC_NOT_FUNCTION"), /^Error: SETUP_REFUSED$/);
  let getterReads = 0; const accessor = { ...options, get observeResponse() { getterReads++; throw new Error("SYNTHETIC_SINK_GETTER_SECRET"); } };
  assert.throws(() => validateNativeCaseSetup(context, accessor), /^Error: SETUP_REFUSED$/);
  await assert.rejects(() => runCaptureImageLocalCase(context, accessor), /^Error: SETUP_REFUSED$/);
  assert.equal(getterReads, 0);
  assert.equal(effects, 0);
});
