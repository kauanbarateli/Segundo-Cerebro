import { closeSync, constants, fstatSync, lstatSync, openSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { types } from "node:util";
import { AUTH_LOCAL_LIFECYCLE_END_STATUSES, AUTH_LOCAL_LIFECYCLE_FILE, AUTH_LOCAL_LIFECYCLE_MAX_BYTES, createAuthLocalLifecycle, validateAuthLocalLifecycle } from "./auth-local-lifecycle-contract.mjs";

const ENV_KEYS = ["CI", "GITHUB_ACTIONS", "SC_AUTH_LOCAL_CI_RUN", "RUNNER_TEMP", "SC_AUTH_LOCAL_CI_REPORT_PATH"];
function environmentProjection(environment) {
  try {
    if (!environment || types.isProxy(environment)) return Object.freeze({});
    return Object.freeze(Object.fromEntries(ENV_KEYS.map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(environment, key);
      return [key, descriptor && Object.hasOwn(descriptor, "value") && typeof descriptor.value === "string" ? descriptor.value : null];
    })));
  } catch { return Object.freeze({}); }
}
function directory(path, mode) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(path) !== path ||
    mode !== undefined && ((stat.mode & 0o7777) !== mode || stat.uid !== process.getuid())) throw new Error("LIFECYCLE_PATH_REFUSED");
  return stat;
}
function sameDirectory(left, right) { return left.dev === right.dev && left.ino === right.ino; }
function endStatus(result) {
  try {
    if (!result || typeof result !== "object" || types.isProxy(result)) return "unknown";
    const descriptor = Object.getOwnPropertyDescriptor(result, "status");
    return descriptor && Object.hasOwn(descriptor, "value") && AUTH_LOCAL_LIFECYCLE_END_STATUSES.includes(descriptor.value) ? descriptor.value : "unknown";
  } catch { return "unknown"; }
}

/** No mkdir, overwrite, principal-report access, external IO or acceptance effect. */
function writeSidecar(environment, observation) {
  if (process.platform !== "linux" || environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true" || environment.SC_AUTH_LOCAL_CI_RUN !== "1") return;
  const report = environment.SC_AUTH_LOCAL_CI_REPORT_PATH, runnerTemp = environment.RUNNER_TEMP;
  if (typeof report !== "string" || typeof runnerTemp !== "string" || [report, runnerTemp].some(path => path.includes("\0") || !isAbsolute(path) || resolve(path) !== path) ||
    basename(report) !== "auth-local-ci-report.json") return;
  const root = dirname(report);
  if (dirname(root) !== runnerTemp || !/^sc-auth-local-ci-[A-Za-z0-9]+$/.test(basename(root))) return;
  directory(runnerTemp);
  const before = directory(root, 0o700), path = join(root, AUTH_LOCAL_LIFECYCLE_FILE);
  const bytes = Buffer.from(JSON.stringify(validateAuthLocalLifecycle(observation)) + "\n", "utf8");
  if (bytes.length > AUTH_LOCAL_LIFECYCLE_MAX_BYTES || !Number.isInteger(constants.O_NOFOLLOW) || !Number.isInteger(constants.O_DIRECTORY)) return;
  let parent, file;
  try {
    parent = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    if (!sameDirectory(before, fstatSync(parent))) return;
    file = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const stat = fstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o7777) !== 0o600 || stat.uid !== process.getuid() ||
      !sameDirectory(before, directory(root, 0o700))) return;
    writeFileSync(file, bytes);
  } finally {
    try { if (file !== undefined) closeSync(file); }
    finally { if (parent !== undefined) closeSync(parent); }
  }
}

class LifecycleReporter {
  #environment;
  #observation = createAuthLocalLifecycle();
  #ended = false;
  constructor(environment) { this.#environment = environmentProjection(environment); }
  // Claim the terminal channel to prevent Playwright adding its default reporter.
  // This reporter deliberately prints no stdio, including errors and test output.
  printsToStdio() { return true; }
  onBegin() { this.#observation.record("begin"); }
  onTestBegin() { this.#observation.record("test-begin"); }
  onTestEnd() { this.#observation.record("test-end"); }
  onError() { this.#observation.record("error-seen"); }
  onStdOut() {}
  onStdErr() {}
  onEnd(result) {
    if (this.#ended) return;
    this.#ended = true;
    this.#observation.record("end", endStatus(result));
    try { writeSidecar(this.#environment, this.#observation.snapshot()); }
    catch { /* Missing/invalid diagnostic never changes the original outcome. */ }
    // Never return a FullResult override or Promise to Playwright.
  }
}

/** Explicit environment seam for synthetic filesystem tests; construction is inert. */
export function createAuthLocalLifecycleReporter(environment) { return new LifecycleReporter(environment); }
export default class AuthLocalLifecycleReporter extends LifecycleReporter {
  constructor() { super(process.env); }
}
