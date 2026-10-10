import test from "node:test";
import assert from "node:assert/strict";
import { GOOGLE_CRON_ENDPOINT, GOOGLE_CRON_ORIGIN, GOOGLE_CRON_PROJECT, executeGoogleCron, googleCronConfiguration, googleCronResponse, runGoogleCronCli } from "../../scripts/operations/google-calendar-cron.mjs";

const canary = "PRIVATE_GOOGLE_CRON_CANARY_NEVER_PRINT";
const environment = () => ({ APP_URL: GOOGLE_CRON_ORIGIN, GOOGLE_CALENDAR_CRON_SECRET: canary, SC_GOOGLE_CRON_ALLOW_RUN: GOOGLE_CRON_PROJECT });
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
function assertClosed(value) {
  assert.deepEqual(Object.keys(value).sort(), ["code", "complete", "failed", "http_status", "ok", "operation", "outcome"]);
  assert.equal(JSON.stringify(value).includes(canary), false);
}

test("help and configuration check use explicit injected environment without network or secret output", async () => {
  const values = []; let calls = 0;
  const fetch = () => { calls++; throw new Error(canary); };
  const untouched = new Proxy({}, { get() { throw new Error("help must not read environment"); } });
  assert.equal(await runGoogleCronCli([], untouched, value => values.push(value), { fetch }), 0);
  assert.equal(await runGoogleCronCli(["--help"], untouched, value => values.push(value), { fetch }), 0);
  assert.equal(await runGoogleCronCli(["check"], environment(), value => values.push(value), { fetch }), 0);
  assert.equal(calls, 0);
  assert.deepEqual(values[2], { ok: true, operation: "google_calendar_cron_check", network: false, timeout_ms: 30000, run_opt_in: true });
  assert.equal(JSON.stringify(values).includes(canary), false);
});

test("literal personal opt-in is required before configuration or transport", async () => {
  for (const optIn of [undefined, "YES", "true", GOOGLE_CRON_PROJECT + " "]) {
    let calls = 0;
    const result = await executeGoogleCron({ SC_GOOGLE_CRON_ALLOW_RUN: optIn, get APP_URL() { throw new Error(canary); } }, { fetch() { calls++; } });
    assert.equal(result.code, "REMOTE_RUN_NOT_OPTED_IN"); assert.equal(result.outcome, "not_started"); assert.equal(calls, 0); assertClosed(result);
  }
});

test("production destination rejects other origins, schemes, credentials, paths, URL secrets or queries", () => {
  for (const url of [undefined, "http://127.0.0.1:3000", "https://foreign.invalid", "https://user:password@segundo-cerebro-of.vercel.app", GOOGLE_CRON_ORIGIN + "/other", GOOGLE_CRON_ORIGIN + "?token=" + canary, GOOGLE_CRON_ORIGIN + "#" + canary]) assert.throws(() => googleCronConfiguration({ ...environment(), APP_URL: url }), /CONFIGURATION_INVALID/);
  assert.equal(googleCronConfiguration({ ...environment(), APP_URL: GOOGLE_CRON_ORIGIN + "/" }).endpoint, GOOGLE_CRON_ENDPOINT);
});

test("secret and deadline constraints reject unsafe configuration before HTTP", async () => {
  const variants = [
    { GOOGLE_CALENDAR_CRON_SECRET: undefined }, { GOOGLE_CALENDAR_CRON_SECRET: "x".repeat(31) },
    { GOOGLE_CALENDAR_CRON_SECRET: "x".repeat(1018) }, { GOOGLE_CALENDAR_CRON_SECRET: canary + "\n" },
    { GOOGLE_CALENDAR_CRON_SECRET: canary + " " }, { CRON_SECRET: canary },
    ...["0", "-1", "30001", "30000.5", "Infinity", "01"].map(value => ({ SC_GOOGLE_CRON_TIMEOUT_MS: value })),
  ];
  for (const patch of variants) {
    let calls = 0;
    const report = await executeGoogleCron({ ...environment(), ...patch }, { fetch() { calls++; throw new Error(canary); } });
    assert.equal(report.outcome, "not_started"); assert.equal(calls, 0); assertClosed(report);
  }
  assert.equal(googleCronConfiguration({ ...environment(), GOOGLE_CALENDAR_CRON_SECRET: "x".repeat(1017), CRON_SECRET: "different-cleanup-fixture" }).headers.get("authorization").length, 1024);
  assert.equal(googleCronConfiguration({ ...environment(), SC_GOOGLE_CRON_TIMEOUT_MS: "1" }).timeoutMs, 1);
});

test("one fixed GET supplies only the private header, forbids redirects and reports exact success counts", async () => {
  let calls = 0;
  const report = await executeGoogleCron(environment(), { fetch: async (url, options) => {
    calls++; assert.equal(url, GOOGLE_CRON_ENDPOINT); assert.equal(url.includes(canary), false);
    assert.equal(options.method, "GET"); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    assert.equal(options.headers.get("authorization"), "Bearer " + canary); assert.equal(options.headers.get("accept"), "application/json");
    assert.equal(options.headers.has("cookie"), false); assert.equal(Object.hasOwn(options, "body"), false); assert.equal(Object.hasOwn(options, "credentials"), false);
    assert.equal(options.signal.aborted, false); return json({ ok: true, complete: 200, failed: 0 });
  } });
  assert.equal(calls, 1); assert.deepEqual(report, { ok: true, operation: "google_calendar_cron", outcome: "complete", code: "OK", http_status: 200, complete: 200, failed: 0 }); assertClosed(report);
});

test("partial and total failures preserve counts while closed errors never imply success or a cleared claim", async () => {
  for (const value of [{ ok: false, complete: 2, failed: 1 }, { ok: false, complete: 0, failed: 200 }]) {
    let calls = 0; const report = await executeGoogleCron(environment(), { fetch: async () => { calls++; return json(value, 503); } });
    assert.equal(calls, 1); assert.equal(report.outcome, "reported_failure"); assert.equal(report.complete, value.complete); assert.equal(report.failed, value.failed); assertClosed(report);
  }
  const forbidden = await executeGoogleCron(environment(), { fetch: async () => json({ ok: false, code: "FORBIDDEN" }, 403) });
  assert.equal(forbidden.outcome, "denied"); assert.equal(forbidden.code, "FORBIDDEN"); assertClosed(forbidden);
  const unavailable = await executeGoogleCron(environment(), { fetch: async () => json({ ok: false, code: "UNAVAILABLE" }, 503) });
  assert.equal(unavailable.outcome, "uncertain"); assert.equal(unavailable.complete, null); assert.equal(unavailable.code, "UNAVAILABLE"); assertClosed(unavailable);
});

test("DTO status, exact fields, count caps and success/failure invariants are mandatory", () => {
  for (const [status, value] of [
    [200, { ok: true, complete: 0, failed: 0, token: canary }], [200, { ok: true, complete: 201, failed: 0 }],
    [200, { ok: true, complete: -1, failed: 0 }], [200, { ok: true, complete: 0.5, failed: 0 }],
    [200, { ok: false, complete: 0, failed: 0 }], [200, { ok: true, complete: 1, failed: 1 }],
    [503, { ok: false, complete: 0, failed: 0 }], [503, { ok: false, complete: 200, failed: 1 }],
    [403, { ok: false, code: "UNAVAILABLE" }], [503, { ok: false, code: "FORBIDDEN" }],
    [503, { ok: false, code: "UNAVAILABLE", message: canary }], [401, { ok: false, code: "FORBIDDEN" }],
    [200, [canary]], [200, null],
  ]) assert.throws(() => googleCronResponse(status, value), /REMOTE_RESULT_UNKNOWN/);
});

test("HTML protection, unexpected statuses, malformed JSON/UTF-8 and provider bodies stay closed", async () => {
  const responses = [
    new Response(canary, { status: 401, headers: { "content-type": "text/html" } }),
    json({ token: canary }, 200), json({ ok: true, complete: 0, failed: 0 }, 502),
    new Response(canary, { status: 503, headers: { "content-type": "application/json" } }),
    new Response(Uint8Array.from([0xc3, 0x28]), { headers: { "content-type": "application/json" } }),
  ];
  for (const response of responses) {
    let calls = 0; const report = await executeGoogleCron(environment(), { fetch: async () => { calls++; return response; } });
    assert.equal(calls, 1); assert.equal(report.outcome, "uncertain"); assert.equal(report.code, "REMOTE_RESULT_UNKNOWN"); assertClosed(report);
  }
});

test("declared and streamed response limits cancel untrusted bodies without automatic retries", async () => {
  for (const declared of [true, false]) {
    let cancelled = false, calls = 0;
    const stream = new ReadableStream({ start(controller) { if (!declared) controller.enqueue(new TextEncoder().encode("x".repeat(1025))); }, cancel() { cancelled = true; } });
    const response = new Response(stream, { headers: { "content-type": "application/json", ...(declared ? { "content-length": "1025" } : {}) } });
    const report = await executeGoogleCron(environment(), { fetch: async () => { calls++; return response; } });
    assert.equal(report.outcome, "uncertain"); assert.equal(calls, 1); assertClosed(report);
    assert.equal(cancelled, true);
  }
});

test("timeout covers both fetch and body, returns uncertainty and never retries or touches claims", async () => {
  for (const stage of ["fetch", "body"]) {
    let calls = 0, signal, cancelled = false;
    const transport = async (_, options) => {
      calls++; signal = options.signal;
      if (stage === "fetch") return new Promise(() => {});
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "content-type": "application/json" } });
    };
    const report = await executeGoogleCron({ ...environment(), SC_GOOGLE_CRON_TIMEOUT_MS: "10" }, { fetch: transport });
    assert.equal(calls, 1); assert.equal(signal.aborted, true); assert.equal(report.outcome, "uncertain"); assertClosed(report);
    if (stage === "body") assert.equal(cancelled, true);
  }
});

test("network loss and raw transport errors produce only a closed uncertain result", async () => {
  let calls = 0, captured = [];
  const exit = await runGoogleCronCli(["run"], environment(), value => captured.push(value), { fetch: async () => { calls++; throw new Error(canary); } });
  assert.equal(exit, 1); assert.equal(calls, 1); assert.equal(captured[0].outcome, "uncertain"); assert.equal(JSON.stringify(captured).includes(canary), false); assertClosed(captured[0]);
});

test("CLI rejects secret-bearing arguments and never reports success for denied or failed runs", async () => {
  for (const args of [["run", "--secret", canary], ["run", GOOGLE_CRON_ORIGIN + "?token=" + canary], ["unexpected"]]) {
    const captured = []; let calls = 0;
    assert.equal(await runGoogleCronCli(args, environment(), value => captured.push(value), { fetch() { calls++; } }), 1);
    assert.equal(calls, 0); assert.equal(captured[0].code, "INVALID_ARGUMENTS"); assertClosed(captured[0]);
  }
  for (const [status, body, expectedExit] of [[200, { ok: true, complete: 0, failed: 0 }, 0], [503, { ok: false, complete: 0, failed: 1 }, 1], [403, { ok: false, code: "FORBIDDEN" }, 1]]) {
    const captured = []; assert.equal(await runGoogleCronCli(["run"], environment(), value => captured.push(value), { fetch: async () => json(body, status) }), expectedExit); assertClosed(captured[0]);
  }
});
