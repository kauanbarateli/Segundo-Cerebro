#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const GOOGLE_CRON_PROJECT = "rishenjoikgmfubmnfiu";
export const GOOGLE_CRON_ORIGIN = "https://segundo-cerebro-of.vercel.app";
export const GOOGLE_CRON_ENDPOINT = GOOGLE_CRON_ORIGIN + "/api/cron/google-calendar";
export const GOOGLE_CRON_RESPONSE_BYTES = 1024;
const ENVIRONMENT_FIELDS = ["SC_GOOGLE_CRON_ALLOW_RUN", "APP_URL", "GOOGLE_CALENDAR_CRON_SECRET", "CRON_SECRET", "SC_GOOGLE_CRON_TIMEOUT_MS"];

class OperatorError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function fail(code) { throw new OperatorError(code); }
function object(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value, fields) { return object(value) && Object.keys(value).sort().join(",") === [...fields].sort().join(","); }
function count(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 200; }
function result(outcome, code, httpStatus = null, complete = null, failed = null) {
  return { ok: outcome === "complete", operation: "google_calendar_cron", outcome, code, http_status: httpStatus, complete, failed };
}

/** Configuration is supplied by the operator. Importing this module reads no environment or files. */
export function googleCronConfiguration(environment) {
  if (!object(environment)) fail("CONFIGURATION_INVALID");
  if (typeof environment.APP_URL !== "string") fail("CONFIGURATION_INVALID");
  let origin;
  try { origin = new URL(environment.APP_URL); } catch { fail("CONFIGURATION_INVALID"); }
  if (origin.origin !== GOOGLE_CRON_ORIGIN || origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) fail("CONFIGURATION_INVALID");
  const secret = environment.GOOGLE_CALENDAR_CRON_SECRET;
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32 || ("Bearer " + secret).length > 1024 || /[\u0000-\u001f\u007f]/.test(secret)) fail("CONFIGURATION_INVALID");
  let headers;
  try { headers = new Headers({ Authorization: "Bearer " + secret, Accept: "application/json" }); } catch { fail("CONFIGURATION_INVALID"); }
  if (headers.get("authorization") !== "Bearer " + secret) fail("CONFIGURATION_INVALID");
  if (typeof environment.CRON_SECRET === "string" && secret === environment.CRON_SECRET) fail("CRON_SECRET_MUST_BE_INDEPENDENT");
  const duration = environment.SC_GOOGLE_CRON_TIMEOUT_MS ?? "30000";
  if (typeof duration !== "string" || !/^[1-9][0-9]{0,4}$/.test(duration) || Number(duration) > 30000) fail("CONFIGURATION_INVALID");
  return { endpoint: GOOGLE_CRON_ENDPOINT, headers, timeoutMs: Number(duration) };
}

/** These are the exact closed responses of the existing Google cron route. */
export function googleCronResponse(status, value) {
  if (exact(value, ["ok", "complete", "failed"]) && count(value.complete) && count(value.failed) && value.complete + value.failed <= 200) {
    if (status === 200 && value.ok === true && value.failed === 0) return result("complete", "OK", status, value.complete, value.failed);
    if (status === 503 && value.ok === false && value.failed > 0) return result("reported_failure", "SYNC_FAILED", status, value.complete, value.failed);
  }
  if (exact(value, ["ok", "code"]) && value.ok === false) {
    if (status === 403 && value.code === "FORBIDDEN") return result("denied", "FORBIDDEN", status);
    if (status === 503 && value.code === "UNAVAILABLE") return result("uncertain", "UNAVAILABLE", status);
  }
  fail("REMOTE_RESULT_UNKNOWN");
}

/** One request only. A client deadline never proves that the remote execution stopped. */
export async function executeGoogleCron(environment, dependencies = {}) {
  let config;
  try {
    if (environment?.SC_GOOGLE_CRON_ALLOW_RUN !== GOOGLE_CRON_PROJECT) fail("REMOTE_RUN_NOT_OPTED_IN");
    config = googleCronConfiguration(environment);
  } catch (error) { return result("not_started", error instanceof OperatorError ? error.code : "CONFIGURATION_INVALID"); }

  const controller = new AbortController();
  let reader, timer, status = null;
  function cancelReader() {
    try { const cancelled = reader?.cancel(); cancelled?.catch(() => undefined); } catch { /* No provider details or unbounded cleanup wait. */ }
  }
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); cancelReader(); reject(new OperatorError("REMOTE_RESULT_UNKNOWN")); }, config.timeoutMs);
  });
  async function request() {
    const transport = dependencies.fetch ?? globalThis.fetch;
    const response = await transport(config.endpoint, { method: "GET", headers: config.headers, redirect: "error", cache: "no-store", signal: controller.signal });
    if (controller.signal.aborted) fail("REMOTE_RESULT_UNKNOWN");
    if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) status = response.status;
    reader = response.body?.getReader();
    if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") fail("REMOTE_RESULT_UNKNOWN");
    const declared = response.headers.get("content-length");
    if (declared !== null && (!/^[0-9]{1,10}$/.test(declared) || Number(declared) > GOOGLE_CRON_RESPONSE_BYTES)) fail("REMOTE_RESULT_UNKNOWN");
    if (!reader) fail("REMOTE_RESULT_UNKNOWN");
    const chunks = []; let bytes = 0;
    while (true) {
      if (controller.signal.aborted) fail("REMOTE_RESULT_UNKNOWN");
      const next = await reader.read();
      if (controller.signal.aborted) fail("REMOTE_RESULT_UNKNOWN");
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > GOOGLE_CRON_RESPONSE_BYTES) fail("REMOTE_RESULT_UNKNOWN");
      chunks.push(next.value);
    }
    let value;
    try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); } catch { fail("REMOTE_RESULT_UNKNOWN"); }
    return googleCronResponse(status, value);
  }
  try { return await Promise.race([request(), deadline]); }
  catch { controller.abort(); cancelReader(); return result("uncertain", "REMOTE_RESULT_UNKNOWN", status); }
  finally {
    clearTimeout(timer);
    try { reader?.releaseLock(); } catch { /* A timed-out reader may already be closing. */ }
  }
}

export async function runGoogleCronCli(argv, environment, output, dependencies = {}) {
  const emit = output ?? (value => process.stdout.write(JSON.stringify(value) + "\n"));
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--help")) {
    emit({ tool: "google-calendar-cron-operator", commands: ["check", "run"], default: "no network", required_environment: ENVIRONMENT_FIELDS.filter(field => field !== "CRON_SECRET" && field !== "SC_GOOGLE_CRON_TIMEOUT_MS"), optional_environment: ["CRON_SECRET", "SC_GOOGLE_CRON_TIMEOUT_MS"], secrets: "environment only; never argv, URL, body or output", retry: "none; uncertain remote execution requires operator review" });
    return 0;
  }
  if (argv.length !== 1 || !["check", "run"].includes(argv[0])) { emit(result("not_started", "INVALID_ARGUMENTS")); return 1; }
  if (argv[0] === "check") {
    try { const config = googleCronConfiguration(environment); emit({ ok: true, operation: "google_calendar_cron_check", network: false, timeout_ms: config.timeoutMs, run_opt_in: environment.SC_GOOGLE_CRON_ALLOW_RUN === GOOGLE_CRON_PROJECT }); return 0; }
    catch (error) { emit(result("not_started", error instanceof OperatorError ? error.code : "CONFIGURATION_INVALID")); return 1; }
  }
  const report = await executeGoogleCron(environment, dependencies);
  emit(report);
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const environment = {};
  if (argv.length === 1 && ["check", "run"].includes(argv[0])) for (const field of ENVIRONMENT_FIELDS) if (process.env[field] !== undefined) environment[field] = process.env[field];
  process.exitCode = await runGoogleCronCli(argv, environment);
}
