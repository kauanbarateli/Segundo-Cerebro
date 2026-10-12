import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
const nextRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = nextRequire("./utils/get-root-dirs.js");
const fixture = mkdtempSync(join(tmpdir(), "sc-lint-glob-"));
const packages = join(fixture, "packages");
for (const name of ["alpha", "beta"]) mkdirSync(join(packages, name), { recursive: true });
writeFileSync(join(packages, "ordinary-file"), "Not a directory.\n");
mkdirSync(join(fixture, "pages"), { recursive: true });
writeFileSync(join(fixture, "pages", "lint-target.tsx"), "export default function Page() { return null; }\n");
after(() => {
  // The recursive cleanup is confined to this freshly created local fixture.
  assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
  assert.ok(fixture.startsWith(join(tmpdir(), "sc-lint-glob-")));
  rmSync(fixture, { recursive: true });
});
const slash = value => value.replace(/\\/g, "/");
const context = rootDir => ({ cwd: root, settings: rootDir === undefined ? {} : { next: { rootDir } } });
// Next consumes directories via path.join/fs. Relative/absolute spelling and
// a trailing separator can differ while naming the same actual directory.
const set = values => new Set(values.map(value => slash(resolve(value))));

test("Next 15 keeps its rules and uses the explicit replacement package, without braces", () => {
  assert.equal(nextRequire("../package.json").version, "15.5.27");
  const replacement = nextRequire("fast-glob/package.json");
  assert.equal(replacement.name, "tinyglobby");
  assert.equal(replacement.version, "0.2.17");
  assert.equal(typeof nextRequire("fast-glob").globSync, "function");
  assert.equal(Object.hasOwn(replacement.dependencies, "braces"), false);
  assert.equal(Object.hasOwn(replacement.dependencies, "micromatch"), false);
});

test("the real Next root resolver preserves default, string, array, brace and Windows paths", () => {
  assert.deepEqual(getRootDirs(context()), [root]);
  const alpha = slash(join(packages, "alpha")), beta = slash(join(packages, "beta"));
  assert.deepEqual(set(getRootDirs(context(alpha))), new Set([alpha]));
  assert.deepEqual(set(getRootDirs(context([alpha, beta]))), new Set([alpha, beta]));
  assert.deepEqual(set(getRootDirs(context(slash(packages) + "/{alpha,beta}"))), new Set([alpha, beta]));
  assert.deepEqual(set(getRootDirs(context(join(packages, "alpha").replace(/\//g, "\\")))), new Set([alpha]));
  assert.deepEqual(set(getRootDirs(context(slash(packages) + "/*"))), new Set([alpha, beta]));
  assert.deepEqual(getRootDirs(context(slash(join(packages, "ordinary-file")))), []);
});

test("the real Next rule still reports internal HTML links through a configured root", async () => {
  const lint = new ESLint({ cwd: root, overrideConfig: { settings: { next: { rootDir: fixture } } } });
  const results = await lint.lintText('export function Probe() { return <a href="/lint-target">Target</a>; }', {
    filePath: "src/features/dependency-lint-probe.tsx",
  });
  assert.ok(results.flatMap(result => result.messages).some(message => message.ruleId === "@next/next/no-html-link-for-pages"));
});

test("the real TypeScript lint rule still rejects unused declarations", async () => {
  const lint = new ESLint({ cwd: root });
  const results = await lint.lintText("const orphan = 42; export function Probe() { return null; }", {
    filePath: "src/features/dependency-types-probe.tsx",
  });
  assert.ok(results.flatMap(result => result.messages).some(message => message.ruleId === "@typescript-eslint/no-unused-vars"));
});
