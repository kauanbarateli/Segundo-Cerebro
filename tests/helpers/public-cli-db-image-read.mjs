/** One public image read; real default executor, independent stream facts, no SQL/SDK. */
import { openSync, writeSync, fsyncSync, closeSync, lstatSync, realpathSync, fstatSync, readSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { types } from "node:util";
import { runBoundedProcess } from "../../scripts/verification/auth-local-ci.mjs";
import { publicDbImageReadRequest, projectPublicDbImageCandidate } from "./public-cli-db-image-metadata.mjs";

const SOURCE = /^[a-f0-9]{40}$/;
const ownBoolean = (value, key) => Boolean(value && typeof value === "object" && !types.isProxy(value) && Object.getOwnPropertyDescriptor(value, key)?.value === true);
const killOriginalGroup = child => {
  if (!Number.isSafeInteger(child?.pid) || child.pid < 2) return;
  // Only the child delivered by runBoundedProcess's start hook; no PID discovery.
  try { process.kill(-child.pid, "SIGKILL"); } catch { /* Base executor confirms ownership/absence. */ }
};

/** Keep the existing runner's four-argument owner/tracking wrapper intact. */
export function bridgePublicDbImageOwnedRun(ownedRun) {
  if (typeof ownedRun !== "function") throw Error("INPUT_REFUSED");
  return (program, args, options) => ownedRun(program, args, options.timeoutMs, options);
}

/**
 * imageId MUST come from the caller's already accepted DB lease. This function
 * does not mint a lease. directory is the caller's existing owned, canonical temp.
 * The default is the real bounded executor, not a caller-supplied receipt reader.
 * A runner may pass its existing tracking wrapper as runProcess. Test seams never
 * produce native provenance; no DTO of another profile is consumed or modified.
 */
export async function readPublicDbImageOnce(options, dependencies = {}) {
  const runProcess = dependencies.runProcess ?? runBoundedProcess;
  const clock = dependencies.clock ?? (() => performance.now());
  const killGroup = dependencies.killGroup ?? killOriginalGroup;
  const startedAt = clock(), deadline = startedAt + 15000;
  let refusal = null, fd = null, child = null, invocationAttempted = false, processStarted = false, groupConfirmed = true;
  let stdoutBytes = 0, stderrBytes = 0, exitCode = null, closeCode = null, exitSignal = null, closeSignal = null;
  let file = null, marker = null, timer = null, aborted = false, attemptReserved = false, finished = false, baseSettled = false;
  const listeners = [];
  const facts = { spawn: 0, stdoutEnd: 0, stderrEnd: 0, finish: 0, exit: 0, close: 0 };
  const retain = code => { refusal ??= code; };
  const abortOriginal = code => { retain(code); if (child && !aborted && !baseSettled && !facts.close) { aborted = true; try { killGroup(child); } catch { /* Never claim cleanup from a requested kill. */ } } };
  const listen = (target, event, callback) => { target.on(event, callback); listeners.push([target, event, callback]); };
  const within = () => { if (!Number.isFinite(clock()) || clock() >= deadline) { abortOriginal("DEADLINE_REFUSED"); return false; } return true; };
  const terminal = key => { facts[key]++; if (facts[key] !== 1 || facts.close && key !== "close") abortOriginal("TERMINALS_REFUSED"); };
  const sourceSha = typeof options?.sourceSha === "string" && options.sourceSha.length === 40 && SOURCE.test(options.sourceSha) ? options.sourceSha : null;
  const closed = () => Object.freeze({
    schemaVersion: 1, scenario: "public-cli-db-image-observation", sourceSha,
    status: "refused", code: refusal ?? "READ_REFUSED", observed: null,
    processStarted, groupConfirmed, stdoutBytes, stderrBytes,
    naturalStdoutEof: facts.stdoutEnd === 1, naturalStderrEof: facts.stderrEnd === 1,
    exitCode: exitCode === 0 ? 0 : null, closeCode: closeCode === 0 ? 0 : null,
    logicalAttempt: attemptReserved ? 1 : 0,
    normativeQualified: false, baselineQualified: false, restoreAccepted: false,
    rawTextEmitted: false,
  });
  try {
    if (!sourceSha || typeof runProcess !== "function" || typeof clock !== "function" || typeof killGroup !== "function") { retain("INPUT_REFUSED"); return closed(); }
    const request = publicDbImageReadRequest(options.imageId);
    const directory = options.directory;
    if (typeof directory !== "string" || !isAbsolute(directory) || !lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink() || realpathSync(directory) !== directory || !within()) { retain("DIRECTORY_REFUSED"); return closed(); }
    file = join(directory, "public-db-image.original.json"); marker = join(directory, "public-db-image.attempt.json");
    // CreateNew is the cross-restart one-attempt guard, before the real process.
    let markerFd;
    try {
      markerFd = openSync(marker, "wx", 0o600); attemptReserved = true;
      const bytes = Buffer.from(JSON.stringify({ version: 1, sourceSha, logicalAttempt: 1, command: "DOCKER_IMAGE_INSPECT_FOUR_FIELDS" }) + "\n");
      let offset = 0;
      while (offset < bytes.byteLength) { const count = writeSync(markerFd, bytes, offset, bytes.byteLength - offset); if (count < 1) throw Error(); offset += count; }
      fsyncSync(markerFd);
    }
    finally { if (markerFd !== undefined) closeSync(markerFd); }
    fd = openSync(file, "wx+", 0o600);
    if (!within()) return closed();
    const env = { PATH: options.environment?.PATH, LANG: options.environment?.LANG ?? "C.UTF-8", LC_ALL: options.environment?.LC_ALL ?? "C.UTF-8", TZ: "UTC", NO_COLOR: "1" };
    if (typeof env.PATH !== "string" || !env.PATH || typeof options.cwd !== "string" || !isAbsolute(options.cwd)) { retain("INPUT_REFUSED"); return closed(); }
    // Existing executor's abort close timer (1.5s) + owned-group proof (1s)
    // stay inside this adapter's 15s ceiling, with 0.5s admission reserve.
    const commandRemaining = Math.floor(deadline - clock() - 3000);
    if (commandRemaining < 1) { retain("DEADLINE_REFUSED"); return closed(); }
    groupConfirmed = false; invocationAttempted = true;
    timer = setTimeout(() => abortOriginal("DEADLINE_REFUSED"), Math.max(1, deadline - clock()));
    const result = await runProcess(request.executable, request.args, {
      cwd: options.cwd, env, timeoutMs: commandRemaining,
      // Base caps total bytes too. This adapter enforces each stream separately.
      maxBytes: 65536 + 4096, capture: false,
      stdoutObserver: {
        start(original) {
          child = original;
          listen(original, "spawn", () => { processStarted = true; terminal("spawn"); });
          listen(original.stdout, "end", () => { terminal("stdoutEnd"); });
          listen(original.stderr, "end", () => { terminal("stderrEnd"); });
          listen(original.stdin, "finish", () => { terminal("finish"); if (facts.exit) abortOriginal("TERMINALS_REFUSED"); });
          listen(original.stderr, "data", bytes => {
            if (!Buffer.isBuffer(bytes) || facts.stderrEnd || facts.close) { abortOriginal("TERMINALS_REFUSED"); return; }
            stderrBytes += bytes.byteLength;
            if (stderrBytes > 4096) abortOriginal("STDERR_LIMIT");
            within(); // Bytes are counted, never retained, decoded or printed.
          });
          for (const stream of [original.stdout, original.stderr, original.stdin]) listen(stream, "error", () => abortOriginal("STREAM_REFUSED"));
          listen(original, "error", () => abortOriginal("PROCESS_REFUSED"));
          listen(original, "exit", (code, signal) => { terminal("exit"); exitCode = code; exitSignal = signal; if (facts.spawn !== 1 || code !== 0 || signal !== null) abortOriginal("TERMINALS_REFUSED"); });
          listen(original, "close", (code, signal) => { terminal("close"); closeCode = code; closeSignal = signal; if (facts.spawn !== 1 || facts.stdoutEnd !== 1 || facts.stderrEnd !== 1 || facts.finish !== 1 || facts.exit !== 1 || code !== 0 || signal !== null) abortOriginal("TERMINALS_REFUSED"); });
          return within();
        },
        data(bytes) {
          if (finished) return false;
          if (!Buffer.isBuffer(bytes) || facts.stdoutEnd || facts.close || !within()) { abortOriginal("TERMINALS_REFUSED"); return false; }
          stdoutBytes += bytes.byteLength;
          if (stdoutBytes > 65536) { abortOriginal("STDOUT_LIMIT"); return false; }
          if (refusal) return false;
          try {
            let offset = 0;
            while (offset < bytes.byteLength) { const written = writeSync(fd, bytes, offset, bytes.byteLength - offset); if (written < 1) throw Error(); offset += written; }
            return within();
          } catch { abortOriginal("FILE_REFUSED"); return false; }
        },
        // Base may call end during its own finish; that is not natural EOF.
        end() { return refusal === null; },
      },
    });
    baseSettled = true;
    groupConfirmed = ownBoolean(result, "groupConfirmed");
    if (!groupConfirmed || refusal || !within() || Object.values(facts).some(count => count !== 1) || exitCode !== 0 || closeCode !== 0 || exitSignal !== null || closeSignal !== null || stdoutBytes < 1) { retain("TERMINALS_REFUSED"); return closed(); }
    fsyncSync(fd); const info = fstatSync(fd);
    if (!info.isFile() || info.size !== stdoutBytes || lstatSync(file).isSymbolicLink() || realpathSync(file) !== file || !within()) { retain("FILE_REFUSED"); return closed(); }
    // Read the same exclusive descriptor; never reopen a path or allocate from stat.
    const buffer = Buffer.alloc(65537); let used = 0;
    while (used < buffer.byteLength) {
      const count = readSync(fd, buffer, used, buffer.byteLength - used, used);
      if (count === 0) break; used += count;
      if (!within()) return closed();
    }
    closeSync(fd); fd = null;
    const bytes = buffer.subarray(0, used);
    if (bytes.byteLength !== stdoutBytes || bytes.byteLength > 65536 || !within()) { retain("FILE_REFUSED"); return closed(); }
    let text, value;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); value = JSON.parse(text);
      // Docker's fixed four-field template has canonical JSON plus one newline.
      // This also refuses duplicate/escaped-equivalent keys before they collapse.
      const canonical = JSON.stringify(value);
      if (![canonical, canonical + "\n", canonical + "\r\n"].includes(text)) throw Error();
    } catch { retain("JSON_REFUSED"); return closed(); }
    const candidate = projectPublicDbImageCandidate(value, options.imageId);
    if (!within()) return closed();
    const observation = Object.freeze({
      schemaVersion: 1, scenario: "public-cli-db-image-observation", sourceSha,
      status: "observed", code: "FOUR_FIELDS_OBSERVED", candidate,
      receipt: Object.freeze({ logicalAttempt: 1, stdoutBytes, stderrBytes, stdoutSha256: createHash("sha256").update(bytes).digest("hex"), naturalStdoutEof: true, naturalStderrEof: true, exitCode: 0, closeCode: 0, groupConfirmed: true, elapsedMs: Math.ceil(clock() - startedAt), rawTextEmitted: false }),
      normativeQualified: false, baselineQualified: false, restoreAccepted: false,
    });
    if (!within()) return closed();
    return observation;
  } catch {
    // No error.code/message/stack/getter/Proxy is consulted.
    retain(invocationAttempted ? "READ_REFUSED" : "PREPARE_REFUSED"); return closed();
  } finally {
    finished = true; baseSettled = true;
    if (timer !== null) clearTimeout(timer);
    for (const [target, event, callback] of listeners) target.removeListener(event, callback);
    if (fd !== null) { try { closeSync(fd); } catch { /* An unclosed file cannot create an observation. */ } }
    // Files/marker are retained in the caller's temp and cleaned by its existing
    // finally only after process/group quiescence. No directory removal here.
  }
}
