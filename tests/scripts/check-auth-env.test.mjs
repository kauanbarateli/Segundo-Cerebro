import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { checkAuthEnvironment, diagnoseAuthEnvironment } from "../../scripts/check-auth-env.mjs";

const VALID = Object.freeze({
  APP_MODE: "supabase",
  APP_URL: "http://127.0.0.1:3000",
  SUPABASE_URL: "https://rishenjoikgmfubmnfiu.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake_test_only",
  SUPABASE_SECRET_KEY: "sb_secret_fake_test_only",
  AUTH_RATE_LIMIT_SECRET: "r".repeat(32),
  AUTH_STATE_SECRET: "s".repeat(32),
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "second-brain-auth-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function serialize(environment) { return Object.entries(environment).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join("\n"); }
function assertRedacted(report, values) {
  const output = JSON.stringify(report);
  for (const value of values) if (value) assert.equal(output.includes(value), false, "diagnóstico refletiu valor de entrada");
}

test("missing configuration lists only known names and stays unavailable", async () => {
  const report = await diagnoseAuthEnvironment({});
  assert.equal(report.ready, false);
  assert.equal(report.supabaseMode, false);
  assert.equal(report.checks.APP_MODE.valid, true); // The runtime defaults to demo.
  for (const name of Object.keys(VALID).filter((name) => name !== "APP_MODE")) {
    assert.equal(report.checks[name].present, false);
    assert.equal(report.checks[name].valid, false);
    assert.ok(report.errors.some((error) => error.startsWith(`${name}:`)));
  }
});

test("checks complete Supabase preparation in demo without enabling Auth or mutating environments", async () => {
  const environment = { ...VALID, APP_MODE: "demo" };
  const before = { ...environment }, processBefore = process.env.APP_MODE;
  const report = await diagnoseAuthEnvironment(environment);
  assert.equal(report.ready, true);
  assert.equal(report.supabaseMode, false);
  assert.equal(report.authEnabled, false);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(environment, before);
  assert.equal(process.env.APP_MODE, processBefore);
  assert.equal((await diagnoseAuthEnvironment({ ...environment, SUPABASE_SECRET_KEY: "" })).ready, false);
  assertRedacted(report, Object.values(environment));
});

test("refuses another project, deceptive suffix, credentials, query, path and noncanonical URL", async () => {
  for (const url of [
    "https://another-personal-project.supabase.co",
    "https://rishenjoikgmfubmnfiu.supabase.co.attacker.invalid",
    "https://secret-canary@rishenjoikgmfubmnfiu.supabase.co",
    "https://rishenjoikgmfubmnfiu.supabase.co?private-canary=yes",
    "https://rishenjoikgmfubmnfiu.supabase.co/rest/v1",
    "https://rishenjoikgmfubmnfiu.supabase.co:444",
    "http://rishenjoikgmfubmnfiu.supabase.co",
  ]) {
    const report = await diagnoseAuthEnvironment({ ...VALID, SUPABASE_URL: url });
    assert.equal(report.ready, false);
    assert.equal(report.checks.SUPABASE_URL.valid, false);
    assertRedacted(report, [url, "secret-canary", "private-canary"]);
  }
});

test("app origin follows development versus production policy", async () => {
  assert.equal((await diagnoseAuthEnvironment(VALID)).ready, true);
  assert.equal((await diagnoseAuthEnvironment({ ...VALID, APP_URL: "http://[::1]:3000" })).ready, true);
  for (const APP_URL of ["http://192.168.1.10:3000", "https://app.invalid/path", "https://app.invalid#private-canary"]) {
    assert.equal((await diagnoseAuthEnvironment({ ...VALID, APP_URL })).checks.APP_URL.valid, false);
  }
  const production = await diagnoseAuthEnvironment({ ...VALID, NODE_ENV: "production" });
  assert.equal(production.production, true);
  assert.equal(production.checks.APP_URL.valid, false);
  assert.equal((await diagnoseAuthEnvironment({ ...VALID, NODE_ENV: "production", APP_URL: "https://app.invalid" })).ready, true);
});

test("validates current key prefixes and never returns rejected credentials", async () => {
  const report = await diagnoseAuthEnvironment({ ...VALID, APP_MODE: "private-mode-canary", SUPABASE_PUBLISHABLE_KEY: "eyJprivate-publishable-canary", SUPABASE_SECRET_KEY: "sb_secret_bad+private-key-canary" });
  assert.equal(report.checks.APP_MODE.valid, false);
  assert.equal(report.checks.SUPABASE_PUBLISHABLE_KEY.valid, false);
  assert.equal(report.checks.SUPABASE_SECRET_KEY.valid, false);
  assertRedacted(report, ["private-mode-canary", "private-publishable-canary", "private-key-canary"]);
});

test("HMACs require UTF-8 bytes after trim and independence from each other and the privileged key", async () => {
  assert.equal((await diagnoseAuthEnvironment({ ...VALID, AUTH_STATE_SECRET: "é".repeat(16) })).ready, true);
  assert.equal((await diagnoseAuthEnvironment({ ...VALID, AUTH_STATE_SECRET: ` ${"s".repeat(31)} ` })).checks.AUTH_STATE_SECRET.valid, false);
  for (const patch of [
    { AUTH_STATE_SECRET: VALID.AUTH_RATE_LIMIT_SECRET },
    { SUPABASE_SECRET_KEY: `sb_secret_${"s".repeat(32)}`, AUTH_STATE_SECRET: `sb_secret_${"s".repeat(32)}` },
  ]) {
    const report = await diagnoseAuthEnvironment({ ...VALID, ...patch });
    assert.equal(report.distinctSecrets, false);
    assert.equal(report.ready, false);
    assertRedacted(report, Object.values(patch));
  }
});

test("public aliases block readiness without echoing their names or values", async () => {
  const report = await diagnoseAuthEnvironment({ ...VALID, NEXT_PUBLIC_AUTH_STATE_SECRET: "private-alias-canary" });
  assert.equal(report.serverOnly, false);
  assert.equal(report.ready, false);
  assertRedacted(report, ["private-alias-canary"]);
});

test("only .env.local is read and process environment wins without file writes", async (t) => {
  const root = await fixture(t), path = join(root, ".env.local");
  await writeFile(join(root, ".env"), serialize(VALID));
  await writeFile(join(root, ".env.production"), serialize(VALID));
  const absent = await checkAuthEnvironment({ root, environment: {} });
  assert.equal(absent.ready, false);
  assert.equal(absent.sources.envLocal.present, false);
  const contents = serialize({ ...VALID, APP_MODE: "demo", SUPABASE_SECRET_KEY: "" });
  await writeFile(path, contents);
  const missing = await checkAuthEnvironment({ root, environment: {} });
  assert.equal(missing.ready, false);
  assert.equal(missing.checks.SUPABASE_SECRET_KEY.present, false);
  const report = await checkAuthEnvironment({ root, environment: { SUPABASE_SECRET_KEY: VALID.SUPABASE_SECRET_KEY } });
  assert.equal(report.ready, true);
  assert.equal(report.supabaseMode, false);
  assert.equal(report.sources.envLocal.loaded, true);
  assert.equal(await readFile(path, "utf8"), contents);
  assert.equal((await checkAuthEnvironment({ root, environment: { ...VALID, SUPABASE_SECRET_KEY: "" } })).ready, false);
});

test("file expansion and nonregular files fail closed with fixed messages", async (t) => {
  const root = await fixture(t), path = join(root, ".env.local");
  await mkdir(path);
  const directory = await checkAuthEnvironment({ root, environment: VALID });
  assert.equal(directory.sources.envLocal.valid, false);
  assert.equal(directory.ready, false);
  assertRedacted(directory, [root]);
  await rm(path, { recursive: true });
  await writeFile(path, `${serialize(VALID)}\nAUTH_STATE_SECRET=$private_expansion_canary`);
  const expanded = await checkAuthEnvironment({ root, environment: VALID });
  assert.equal(expanded.sources.envLocal.valid, false);
  assert.equal(expanded.ready, false);
  assertRedacted(expanded, ["private_expansion_canary"]);
});

test("subprocess output redacts valid and invalid fixture values without reading repository .env.local", async (t) => {
  const root = await fixture(t);
  const environment = { ...VALID, APP_MODE: "demo", APP_URL: "https://stdout-private-canary@invalid.test", AUTH_STATE_SECRET: "stdout-state-canary-".repeat(3) };
  await writeFile(join(root, ".env.local"), serialize(environment));
  const moduleUrl = new URL("../../scripts/check-auth-env.mjs", import.meta.url).href;
  const program = `import {checkAuthEnvironment} from ${JSON.stringify(moduleUrl)}; const report=await checkAuthEnvironment({root:${JSON.stringify(root)},environment:{}}); console.log(JSON.stringify(report)); process.exitCode=report.ready?0:1;`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", program], { encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.equal(child.stderr, "");
  const report = JSON.parse(child.stdout);
  assert.equal(report.ready, false);
  assertRedacted(report, [...Object.values(environment), "stdout-private-canary", "stdout-state-canary"]);
});
