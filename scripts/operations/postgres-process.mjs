import { spawn } from "node:child_process";
import { BackupError } from "./backup-format.mjs";

export const PSQL_QUERY_TIMEOUT_MS = 45000;
export const PSQL_OUTPUT_LIMIT_BYTES = 1048576;
const discard = () => undefined;
const closedCodes = new Set(["PSQL_UNAVAILABLE", "PSQL_FAILED", "PSQL_TIMEOUT", "PSQL_OUTPUT_LIMIT", "PSQL_INVALID_REPORT"]);
const failure = code => new BackupError(code);

/** Fixed operator queries only. Credentials/stderr never enter argv or errors.
 * The fifth argument can shorten the deadline for offline doubles, never extend it.
 * Cancellation is local best effort; it does not confirm remote termination.
 */
export async function queryPostgres(executable, env, request, spawnProcess = spawn, options = {}) {
  const timeoutMs = options.timeoutMs ?? PSQL_QUERY_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > PSQL_QUERY_TIMEOUT_MS) throw failure("PSQL_UNAVAILABLE");
  let child, iterator, timer, onError, onExit, onClose;
  let stopped = false, unsuccessful = true, bytes = 0;
  const chunks = [];
  const deadline = performance.now() + timeoutMs;
  const checkDeadline = () => { if (performance.now() >= deadline) throw failure("PSQL_TIMEOUT"); };
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(failure("PSQL_TIMEOUT")), timeoutMs);
  });
  // Every losing task has a rejection observer, including uncooperative doubles.
  expired.catch(discard);
  try {
    const args = ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", request.file ? "--file=" + request.file : "--command=" + request.sql];
    try {
      child = spawnProcess(executable, args, {
        env: { ...env, PGCONNECT_TIMEOUT: "8", PGCLIENTENCODING: "UTF8" },
        stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true,
      });
    } catch { throw failure("PSQL_UNAVAILABLE"); }
    if (!child || typeof child.on !== "function") throw failure("PSQL_UNAVAILABLE");
    // A static guard also absorbs delayed process errors after our listeners detach.
    child.on("error", discard);
    child.stderr?.on?.("error", discard);
    checkDeadline();
    if (!child.stdout || typeof child.stdout[Symbol.asyncIterator] !== "function") throw failure("PSQL_UNAVAILABLE");
    const ended = new Promise((resolve, reject) => {
      onError = () => reject(failure("PSQL_UNAVAILABLE"));
      // exit can precede pipe closure; reject failures immediately, but never
      // treat exit zero alone as success before close and complete stdout.
      onExit = code => { if (code !== 0) reject(failure("PSQL_FAILED")); };
      onClose = code => code === 0 ? resolve() : reject(failure("PSQL_FAILED"));
      child.on("error", onError);
      child.on("exit", onExit);
      child.on("close", onClose);
    });
    ended.catch(discard);
    try { child.stderr?.resume(); } catch { throw failure("PSQL_UNAVAILABLE"); }
    const collected = (async () => {
      try {
        iterator = child.stdout[Symbol.asyncIterator]();
        while (!stopped) {
          checkDeadline();
          const next = await iterator.next();
          checkDeadline();
          if (stopped || next.done) break;
          const chunk = next.value;
          if (!(chunk instanceof Uint8Array)) throw failure("PSQL_INVALID_REPORT");
          if (chunk.byteLength > PSQL_OUTPUT_LIMIT_BYTES - bytes) throw failure("PSQL_OUTPUT_LIMIT");
          if (chunk.byteLength === 0) continue;
          bytes += chunk.byteLength;
          chunks.push(Buffer.from(chunk));
        }
      } catch (error) {
        throw failure(error instanceof BackupError && closedCodes.has(error.code) ? error.code : "PSQL_INVALID_REPORT");
      }
    })();
    await Promise.race([Promise.all([collected, ended]), expired]);
    checkDeadline();
    const encoded = Buffer.concat(chunks, bytes);
    let report;
    try {
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(encoded);
      report = JSON.parse(text);
      if (report === null || typeof report !== "object" || Array.isArray(report)) throw failure("PSQL_INVALID_REPORT");
    } catch { throw failure("PSQL_INVALID_REPORT"); }
    finally { encoded.fill(0); }
    checkDeadline();
    unsuccessful = false;
    return report;
  } catch (error) {
    throw failure(error instanceof BackupError && closedCodes.has(error.code) ? error.code : "PSQL_UNAVAILABLE");
  } finally {
    stopped = true;
    clearTimeout(timer);
    if (onError) child?.removeListener("error", onError);
    if (onExit) child?.removeListener("exit", onExit);
    if (onClose) child?.removeListener("close", onClose);
    if (unsuccessful && child) {
      // Do not wait for close, iterator.return(), or a kill acknowledgement.
      // Each may never arrive after a connection/process failure.
      for (const stream of [child.stdout, child.stderr, child.stdin]) {
        try { stream?.destroy?.(); } catch { /* Best effort, closed error retained. */ }
      }
      try { Promise.resolve(iterator?.return?.()).catch(discard); } catch { /* No await. */ }
      try { child.kill("SIGKILL"); } catch { /* A failed kill cannot replace the error. */ }
      try { child.unref?.(); } catch { /* Do not keep the CLI alive solely for this child. */ }
    }
    for (const chunk of chunks) chunk.fill(0);
  }
}
