// Supplemental first-requestfailed detail. Never log a provider object or raw value.
import { captureOrigin, decideCaptureRequest } from "./capture-policy.mjs";

export const REQUEST_FAILED_MARKER = "CAPTURE_REQUEST_FAILED_DETAIL";
export const REQUEST_FAILED_PREFIX = REQUEST_FAILED_MARKER + " ";
const MAX_WIRE = 256, MAX_URL = 8192, MAX_METHOD = 8, MAX_FAILURE = 64, MAX_HEADER = 32;
const INVALID = Symbol("invalid");
const transports = new Set(["ABORTED", "CONNECTION_REFUSED", "OTHER", "UNKNOWN"]);
const scopes = new Set(["ALLOWED_GET", "UNVERIFIED"]);
const targets = new Set(["PROJECT_PATH", "OTHER_ALLOWED", "UNVERIFIED"]);
const signals = new Set(["YES", "NO", "UNKNOWN"]);
const outputKeys = ["version", "transport", "scope", "target", "rsc", "routerPrefetch", "purposePrefetch"];
const inputKeys = ["failureText", "method", "url", "rsc", "routerPrefetch", "secPurpose"];
const controls = /[\u0000-\u001f\u007f]/u;
const fallback = () => Object.freeze({ version: 1, transport: "UNKNOWN", scope: "UNVERIFIED", target: "UNVERIFIED", rsc: "UNKNOWN", routerPrefetch: "UNKNOWN", purposePrefetch: "UNKNOWN" });

function ownData(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor === undefined ? undefined : Object.hasOwn(descriptor, "value") ? descriptor.value : INVALID;
}
function record(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && own.every(key => typeof key === "string" && keys.includes(key))
    && keys.every(key => ownData(value, key) !== INVALID);
}
function boundedText(value, maximum) {
  return typeof value === "string" && value.length <= maximum && !controls.test(value);
}
function admission(method, raw, base) {
  try {
    if (!boundedText(method, MAX_METHOD) || method !== "GET" || !boundedText(raw, MAX_URL)
      || typeof base !== "string" || captureOrigin(base) !== base
      || !decideCaptureRequest({ method, url: raw }, base).allowed) return null;
    const url = new URL(raw);
    // Request.url() is absolute. Avoid turning a normalized/relative path into a claim.
    if (url.origin !== base || url.href !== raw) return null;
    return url.pathname === "/projetos" ? "PROJECT_PATH" : "OTHER_ALLOWED";
  } catch { return null; }
}
function transport(value) {
  if (!boundedText(value, MAX_FAILURE) || value.length === 0) return "UNKNOWN";
  if (value === "net::ERR_ABORTED") return "ABORTED";
  if (value === "net::ERR_CONNECTION_REFUSED") return "CONNECTION_REFUSED";
  return "OTHER";
}
function signal(value, positive) {
  if (value === undefined) return "NO";
  return boundedText(value, MAX_HEADER) ? value === positive ? "YES" : "UNKNOWN" : "UNKNOWN";
}

// Inert records only: own data descriptors, no getter invocation or coercion.
export function captureRequestFailedDiagnostic(snapshot, base) {
  try {
    if (!record(snapshot, inputKeys)) return fallback();
    const target = admission(ownData(snapshot, "method"), ownData(snapshot, "url"), base);
    return Object.freeze({
      version: 1, transport: transport(ownData(snapshot, "failureText")),
      scope: target ? "ALLOWED_GET" : "UNVERIFIED", target: target ?? "UNVERIFIED",
      rsc: target ? signal(ownData(snapshot, "rsc"), "1") : "UNKNOWN",
      routerPrefetch: target ? signal(ownData(snapshot, "routerPrefetch"), "1") : "UNKNOWN",
      purposePrefetch: target ? signal(ownData(snapshot, "secPurpose"), "prefetch") : "UNKNOWN",
    });
  } catch { return fallback(); }
}

// Trusted Playwright event boundary only, after fatal health was recorded.
// headers() is a synchronous provisional snapshot; no allHeaders/channel call.
export function captureSdkRequestFailedDiagnostic(request, base) {
  let failureText = null, method = null, url = null, rsc = null, routerPrefetch = null, secPurpose = null;
  try {
    const failure = request.failure();
    if (record(failure, ["errorText"])) {
      const value = ownData(failure, "errorText");
      if (boundedText(value, MAX_FAILURE)) failureText = value;
    }
  } catch { /* Preserve UNKNOWN; never replace the fatal capture fault. */ }
  try { const value = request.method(); if (boundedText(value, MAX_METHOD)) method = value; } catch { /* No retry. */ }
  try { const value = request.url(); if (boundedText(value, MAX_URL)) url = value; } catch { /* No retry. */ }
  if (admission(method, url, base)) {
    try {
      const headers = request.headers();
      if (headers && typeof headers === "object" && !Array.isArray(headers)
        && [null, Object.prototype].includes(Object.getPrototypeOf(headers))) {
        const values = ["rsc", "next-router-prefetch", "sec-purpose"].map(key => ownData(headers, key));
        [rsc, routerPrefetch, secPurpose] = values.map(value => value === undefined ? undefined : boundedText(value, MAX_HEADER) ? value : null);
      }
    } catch { /* All three remain UNKNOWN; no other header is read. */ }
  }
  return captureRequestFailedDiagnostic({ failureText, method, url, rsc, routerPrefetch, secPurpose }, base);
}

export function validateRequestFailedDiagnostic(value) {
  try {
    if (!record(value, outputKeys)) return null;
    const version = ownData(value, "version"), kind = ownData(value, "transport");
    const scope = ownData(value, "scope"), target = ownData(value, "target");
    const rsc = ownData(value, "rsc"), routerPrefetch = ownData(value, "routerPrefetch"), purposePrefetch = ownData(value, "purposePrefetch");
    if (version !== 1 || !transports.has(kind) || !scopes.has(scope) || !targets.has(target)
      || !signals.has(rsc) || !signals.has(routerPrefetch) || !signals.has(purposePrefetch)
      || (scope === "UNVERIFIED") !== (target === "UNVERIFIED")
      || (scope === "UNVERIFIED" && [rsc, routerPrefetch, purposePrefetch].some(item => item !== "UNKNOWN"))) return null;
    return Object.freeze({ version, transport: kind, scope, target, rsc, routerPrefetch, purposePrefetch });
  } catch { return null; }
}
export function requestFailedDiagnosticLine(value) {
  try {
    const wire = REQUEST_FAILED_PREFIX + JSON.stringify(validateRequestFailedDiagnostic(value) ?? fallback());
    return wire.length <= MAX_WIRE ? wire : REQUEST_FAILED_PREFIX + JSON.stringify(fallback());
  } catch { return REQUEST_FAILED_PREFIX + JSON.stringify(fallback()); }
}
export function requestFailedDiagnosticForReport(role, firstCode, state) {
  if (role !== "capture" || firstCode !== "CAPTURE_REQUEST_FAILED") return null;
  try {
    if (record(state, ["status", "diagnostic"])) {
      const status = ownData(state, "status"), diagnostic = ownData(state, "diagnostic");
      if (status === "accepted") {
        const value = validateRequestFailedDiagnostic(diagnostic);
        if (value) return Object.freeze({ status, diagnostic: value });
      } else if (["missing", "refused"].includes(status) && diagnostic === null) return Object.freeze({ status, diagnostic: null });
    }
  } catch { /* No raw state or provider text reaches the report. */ }
  return Object.freeze({ status: "refused", diagnostic: null });
}
