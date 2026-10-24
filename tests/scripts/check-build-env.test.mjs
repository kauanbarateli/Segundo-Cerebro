import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../../scripts/check-build-env.mjs", import.meta.url));
const VALID = Object.freeze({
  APP_MODE: "supabase",
  APP_URL: "https://second-brain-build-test.invalid",
  SUPABASE_URL: "https://rishenjoikgmfubmnfiu.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake_test_only",
  SUPABASE_SECRET_KEY: "sb_secret_fake_test_only",
  AUTH_RATE_LIMIT_SECRET: "r".repeat(32),
  AUTH_STATE_SECRET: "s".repeat(32),
});

// Do not inherit application credentials or NODE_OPTIONS from the test runner.
const SYSTEM_ENV = Object.fromEntries(["SystemRoot", "SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP"].filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]));
function run(environment = {}, options = {}) {
  const child = spawnSync(process.execPath, [SCRIPT, ...(options.args ?? [])], {
    env: { ...SYSTEM_ENV, ...environment }, cwd: options.cwd, encoding: "utf8", timeout: 15000,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  const output = child.stdout + child.stderr;
  return { status: child.status, report: JSON.parse(output.trim()), output, stderr: child.stderr };
}
function assertRedacted(output, values) {
  for (const value of values) if (value) assert.equal(output.includes(value), false, "build diagnostic echoed an input value");
}

test("credential-free demo and default mode pass the production build gate", () => {
  for (const environment of [{}, { APP_MODE: "demo" }, { APP_MODE: "demo", NODE_ENV: "production" }]) {
    const child = run(environment);
    assert.equal(child.status, 0);
    assert.equal(child.stderr, "");
    assert.deepEqual(child.report, { ready: true, errors: [] });
  }
});

test("invalid modes fail without echoing the mode or inspecting unrelated credentials", () => {
  for (const APP_MODE of ["private-mode-canary", "", " supabase "]) {
    const child = run({ APP_MODE });
    assert.equal(child.status, 1);
    assert.deepEqual(child.report, { ready: false, errors: ["APP_MODE: Modo inválido; use demo ou supabase."] });
    assertRedacted(child.output, ["private-mode-canary"]);
  }
});

test("valid HTTPS Supabase configuration passes without exposing any configured value", () => {
  const child = run(VALID);
  assert.equal(child.status, 0);
  assert.deepEqual(child.report, { ready: true, errors: [] });
  assertRedacted(child.output, Object.values(VALID));
});

test("prebuild enforces production origin rules even without production NODE_ENV", () => {
  for (const NODE_ENV of [undefined, "development", "test", "production"]) {
    const environment = { ...VALID, APP_URL: "http://localhost:3000", ...(NODE_ENV ? { NODE_ENV } : {}) };
    const child = run(environment);
    assert.equal(child.status, 1);
    assert.equal(child.report.ready, false);
    assert.ok(child.report.errors.some(error => error.startsWith("APP_URL:")));
    assertRedacted(child.output, [environment.APP_URL]);
  }
});

test("missing APP_URL alone rejects a connected build before deployment", () => {
  const environment = { ...VALID };
  delete environment.APP_URL;
  const child = run(environment);
  assert.equal(child.status, 1);
  assert.equal(child.report.ready, false);
  assert.deepEqual(child.report.errors, ["APP_URL: Configuração ausente."]);
  assertRedacted(child.output, Object.values(environment));
});

test("missing server secret fails with the variable name and a fixed rule", () => {
  const environment = { ...VALID };
  delete environment.SUPABASE_SECRET_KEY;
  const child = run(environment);
  assert.equal(child.status, 1);
  assert.ok(child.report.errors.includes("SUPABASE_SECRET_KEY: Configuração ausente."));
  assertRedacted(child.output, Object.values(environment));
});

test("short and reused secrets cannot pass the build gate", () => {
  const privileged = `sb_secret_${"x".repeat(32)}`;
  for (const patch of [
    { AUTH_STATE_SECRET: "short-private-canary" },
    { AUTH_RATE_LIMIT_SECRET: "r".repeat(31) },
    { AUTH_STATE_SECRET: VALID.AUTH_RATE_LIMIT_SECRET },
    { SUPABASE_SECRET_KEY: privileged, AUTH_STATE_SECRET: privileged },
  ]) {
    const child = run({ ...VALID, ...patch });
    assert.equal(child.status, 1);
    assert.equal(child.report.ready, false);
    assert.ok(child.report.errors.some(error => error.includes("AUTH_STATE_SECRET") || error.includes("AUTH_RATE_LIMIT_SECRET")));
    assertRedacted(child.output, Object.values(patch));
  }
});

test("rejected URLs, credentials and public aliases never reach diagnostic output", () => {
  const environment = {
    ...VALID,
    APP_URL: "https://private-url-canary@second-brain-build-test.invalid",
    SUPABASE_URL: "https://other-private-project-canary.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "legacy-private-publishable-canary",
    SUPABASE_SECRET_KEY: "legacy-private-secret-canary",
    NEXT_PUBLIC_AUTH_STATE_SECRET: "private-alias-canary",
  };
  const child = run(environment);
  assert.equal(child.status, 1);
  assert.equal(child.report.ready, false);
  for (const name of ["APP_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) {
    assert.ok(child.report.errors.some(error => error.startsWith(`${name}:`)));
  }
  assert.ok(child.report.errors.some(error => error.includes("NEXT_PUBLIC_*")));
  assertRedacted(child.output, [...Object.values(environment), "private-url-canary", "other-private-project-canary"]);
});

test("a valid local env file cannot rescue incomplete hosting process configuration", async t => {
  const root = await mkdtemp(join(tmpdir(), "second-brain-build-env-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, ".env.local"), Object.entries(VALID).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join("\n"));
  const child = run({ APP_MODE: "supabase" }, { cwd: root });
  assert.equal(child.status, 1);
  assert.ok(child.report.errors.includes("SUPABASE_SECRET_KEY: Configuração ausente."));
  assert.ok(child.report.errors.includes("APP_URL: Configuração ausente."));
  assertRedacted(child.output, [...Object.values(VALID), root]);
});

test("unexpected arguments fail closed without exposing their values or raw errors", () => {
  const child = run({}, { args: ["argument-private-canary"] });
  assert.equal(child.status, 1);
  assert.equal(child.report.ready, false);
  assertRedacted(child.output, ["argument-private-canary", SCRIPT, "Error:"]);
});

const HOMOLOGATION = Object.freeze({
  ...VALID, APP_DEPLOYMENT_TARGET: "homologation", APP_MODE: "supabase", NODE_ENV: "production",
  APP_URL: "https://segundo-cerebro-git-homologacao-kauanbarateli.vercel.app", SUPABASE_URL: "https://twrydxsdemaykgvdlpyd.supabase.co",
  VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", VERCEL_PROJECT_ID: "prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2",
  VERCEL_GIT_PROVIDER: "github", VERCEL_GIT_REPO_OWNER: "kauanbarateli", VERCEL_GIT_REPO_SLUG: "Segundo-Cerebro",
  VERCEL_GIT_COMMIT_REF: "codex/homologacao-twry-20261022", VERCEL_BRANCH_URL: "segundo-cerebro-git-homologacao-kauanbarateli.vercel.app",
});

test("the actual build validator qualifies only the exact isolated hosted tuple", () => {
  const accepted = run(HOMOLOGATION);
  assert.equal(accepted.status, 0); assert.deepEqual(accepted.report, { ready: true, errors: [] });
  assertRedacted(accepted.output, Object.values(HOMOLOGATION));
  for (const field of ["APP_DEPLOYMENT_TARGET", "APP_URL", "SUPABASE_URL", "VERCEL", "VERCEL_ENV", "VERCEL_PROJECT_ID", "VERCEL_GIT_PROVIDER", "VERCEL_GIT_REPO_OWNER", "VERCEL_GIT_REPO_SLUG", "VERCEL_GIT_COMMIT_REF", "VERCEL_BRANCH_URL"]) {
    const environment = { ...HOMOLOGATION }; delete environment[field];
    const rejected = run(environment); assert.equal(rejected.status, 1, field); assert.equal(rejected.report.ready, false);
    assertRedacted(rejected.output, Object.values(environment));
  }
});

test("isolated demo and production/Preview cross-project mixtures never bypass the build gate", () => {
  for (const environment of [
    { ...HOMOLOGATION, APP_MODE: "demo" }, { ...HOMOLOGATION, SUPABASE_URL: VALID.SUPABASE_URL },
    { ...HOMOLOGATION, VERCEL_ENV: "production" }, { ...HOMOLOGATION, VERCEL_BRANCH_URL: "private-host-canary.vercel.app" },
    { ...HOMOLOGATION, VERCEL_GIT_REPO_SLUG: "private-repo-canary" }, { ...HOMOLOGATION, APP_URL: HOMOLOGATION.APP_URL + "/" },
    { ...VALID, VERCEL_ENV: "preview" },
  ]) {
    const child = run(environment); assert.equal(child.status, 1); assert.equal(child.report.ready, false);
    assertRedacted(child.output, Object.values(environment));
  }
  assert.equal(run({ APP_MODE: "demo", VERCEL_ENV: "preview" }).status, 0);
});
