import test from "node:test";
import assert from "node:assert/strict";
import { browserProcessEnvironment } from "../e2e-auth-local/browser-process-environment.mjs";

test("Chromium receives OS settings without Node/Next Auth credentials", () => {
  const input = {
    PATH: "/usr/bin", HOME: "/private/case/home", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC",
    XDG_CONFIG_HOME: "/private/case/home/.config", XDG_CACHE_HOME: "/private/case/home/.cache",
    SUPABASE_SECRET_KEY: "fixture-secret", SUPABASE_PUBLISHABLE_KEY: "fixture-public",
    AUTH_STATE_SECRET: "fixture-state", AUTH_RATE_LIMIT_SECRET: "fixture-rate",
    SUPABASE_ACCESS_TOKEN: "fixture-token", GH_TOKEN: "fixture-gh", NODE_OPTIONS: "fixture-options",
    APP_URL: "http://127.0.0.1:3117", SC_AUTH_LOCAL_CI_REPORT_PATH: "/private/case/report.json",
    UNKNOWN_FUTURE_CREDENTIAL: "fixture-future",
  };
  const before = {...input};
  assert.deepEqual(browserProcessEnvironment(input), {
    PATH: "/usr/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", HOME: "/private/case/home",
    XDG_CONFIG_HOME: "/private/case/home/.config", XDG_CACHE_HOME: "/private/case/home/.cache",
  });
  assert.deepEqual(input, before);
});

test("unknown environment properties are never enumerated or read", () => {
  const input = {HOME: "/private/home"};
  Object.defineProperty(input, "FUTURE_SECRET", {get() { throw new Error("secret read"); }});
  assert.deepEqual(browserProcessEnvironment(input), {HOME: "/private/home"});
});

test("inherited settings cannot carry credentials into Chromium", () => {
  const input = Object.create({PATH: "/untrusted", HOME: "/untrusted", SUPABASE_SECRET_KEY: "fixture"});
  input.TZ = "UTC";
  assert.deepEqual(browserProcessEnvironment(input), {TZ: "UTC"});
});

test("malformed allowed values fail without publishing their values", () => {
  for (const value of [undefined, null, 1, "bad\0value", "x".repeat(8193)]) {
    assert.throws(() => browserProcessEnvironment({HOME:value}), {message:"BROWSER_PROCESS_ENVIRONMENT_REFUSED"});
  }
  let reads = 0;
  assert.throws(() => browserProcessEnvironment(Object.defineProperty({}, "HOME", {get() { reads++; return "bad"; }})),
    {message:"BROWSER_PROCESS_ENVIRONMENT_REFUSED"});
  assert.equal(reads, 0);
});
