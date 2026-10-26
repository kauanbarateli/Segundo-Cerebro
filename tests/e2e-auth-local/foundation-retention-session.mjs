/** Persistent psql for CI-owned fixtures only. No spawn at import. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { posix } from "node:path";
import { RetentionNativeError, RETENTION_NATIVE_LIMITS, retentionRecord, retentionRefuse, retentionData, frameRetentionNativeStatement, retentionSqlContext } from "./foundation-retention-contract.mjs";

const ENV_KEYS = ["PATH", "LANG", "LC_ALL", "TZ", "HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "CI", "GITHUB_ACTIONS", "RUNNER_TEMP", "SC_AUTH_LOCAL_CI_RUN", "SC_FOUNDATION_RETENTION_NATIVE_CI_RUN", "NO_COLOR", "PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD", "PGSSLMODE", "PGCONNECT_TIMEOUT", "PGCLIENTENCODING", "PGAPPNAME", "PGOPTIONS"];
export function validateRetentionNativeSessionOptions(input, platform = process.platform) {
  const o = retentionRecord(input, ["context", "cwd", "environment", "applicationName", "signal"]), context = retentionSqlContext(o.context);
  if (platform !== "linux" || typeof o.cwd !== "string" || !posix.isAbsolute(o.cwd) || o.cwd.includes("\0") || !(o.signal instanceof AbortSignal) || o.signal.aborted) retentionRefuse("ENVIRONMENT_REFUSED");
  const env = retentionRecord(o.environment, ENV_KEYS, "ENVIRONMENT_REFUSED");
  if (Object.values(env).some(value => typeof value !== "string" || value.includes("\0") || value.includes("\r") || value.includes("\n")) || env.CI !== "true" || env.GITHUB_ACTIONS !== "true" || env.SC_AUTH_LOCAL_CI_RUN !== "1" || env.SC_FOUNDATION_RETENTION_NATIVE_CI_RUN !== "1" || env.TZ !== "UTC" || !posix.isAbsolute(env.RUNNER_TEMP) || !posix.isAbsolute(env.HOME) || !env.HOME.startsWith(env.RUNNER_TEMP + "/") || env.XDG_CONFIG_HOME !== env.HOME + "/.config" || env.XDG_CACHE_HOME !== env.HOME + "/.cache" || env.PGHOST !== "127.0.0.1" || env.PGPORT !== "54322" || env.PGUSER !== "postgres" || env.PGDATABASE !== "postgres" || env.PGSSLMODE !== "disable" || env.PGCONNECT_TIMEOUT !== "8" || env.PGCLIENTENCODING !== "UTF8" || !env.PGPASSWORD || env.PGOPTIONS !== "-c statement_timeout=15000 -c lock_timeout=5000") retentionRefuse("ENVIRONMENT_REFUSED");
  const suffix = context.namespace.slice(-32);
  if (typeof o.applicationName !== "string" || !new RegExp(`^sc\\.retention\\.native\\.${suffix}\\.(?:a|b)$`).test(o.applicationName) || env.PGAPPNAME !== o.applicationName) retentionRefuse("ENVIRONMENT_REFUSED");
  return Object.freeze({ ...o, context, environment: Object.freeze(env) });
}
async function terminateOwnGroup(child) {
  if (!Number.isSafeInteger(child?.pid) || child.pid < 2) return false;
  try { process.kill(-child.pid, "SIGKILL"); } catch (error) { return error?.code === "ESRCH"; }
  for (let n = 0; n < 20; n++) {
    try { process.kill(-child.pid, 0); } catch (error) { return error?.code === "ESRCH"; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}
function refusal(stderr) {
  const lines = stderr.split(/\r?\n/), errors = lines.filter(line => /\bERROR:/.test(line));
  if (errors.length !== 1) return null;
  const match = errors[0].match(/\bERROR:\s+([0-9A-Z]{5}):\s+(.+)$/);
  if (!match) return null;
  // Diagnostic only: each nominal case must require its exact SQLSTATE and
  // material. In particular, 55P03/timeout never substitutes for expected40001.
  return Object.freeze({ sqlState: match[1], reason: "SQL_REFUSAL" });
}
/** Test ports are explicit seams, never native provenance or an acceptance token. */
export function createRetentionNativeSession(input, ports = {}) {
  const options = validateRetentionNativeSessionOptions(input, ports.platform ?? process.platform);
  const start = ports.spawnProcess ?? spawn, terminate = ports.terminateGroup ?? terminateOwnGroup;
  const setTimer = ports.setTimer ?? setTimeout, clearTimer = ports.clearTimer ?? clearTimeout;
  const nonce = ports.nonce ?? randomBytes(16).toString("hex");
  if (typeof nonce !== "string" || !/^[a-f0-9]{32}$/.test(nonce)) retentionRefuse("FRAME_REFUSED");
  let child, pending = null, sequence = 0, bytes = 0, stderr = "", text = "", identified = false, backendPid = null, refusalTimer = null;
  let transaction = "idle", role = "postgres", dirty = false, everWriting = false, closing = false, failed = null, unknown = false;
  let stdoutEof = false, stderrEof = false, exited = false, exitCode = null, exitSignal = null, closed = false, closeCode = null, closeSignal = null, groupAbsent = false, final = null, groupTask = null;
  const terminalCounts = { stdoutEnd: 0, stderrEnd: 0, exit: 0, close: 0 };
  const physicalTerminal = () => Object.values(terminalCounts).some(Boolean);
  const decoder = new TextDecoder("utf-8", { fatal: true }), stderrDecoder = new TextDecoder("utf-8", { fatal: true });
  let resolveTerminal;
  const terminal = new Promise(resolve => { resolveTerminal = resolve; });
  const lifetime = setTimer(() => fail("SESSION_TIMEOUT"), RETENTION_NATIVE_LIMITS.sessionMs);
  function detachAbort() { options.signal.removeEventListener("abort", aborted); }
  function rejectPending(error) {
    const slot = pending; pending = null;
    if (slot) { clearTimer(slot.timer); slot.reject(error); }
  }
  function fail(code) {
    failed ??= code; if (everWriting || dirty || pending?.statement.writing) unknown = true;
    if (final) return;
    rejectPending(new RetentionNativeError(failed));
    refusalTimer ??= setTimer(() => {
      if (final) return;
      clearTimer(lifetime); detachAbort();
      final = Object.freeze({ code: failed, sqlRefusal: null, unknown, stdoutEof, stderrEof, exitCode, closeCode, exitSignal, closeSignal, groupAbsent });
      resolveTerminal(final);
    }, 1500);
    if (child && !groupTask) groupTask = Promise.resolve().then(() => terminate(child)).then(value => { groupAbsent = value === true; complete(); }, () => { groupAbsent = false; complete(); });
    complete();
  }
  function complete() {
    if (final || !closed || !exited || !stdoutEof || !stderrEof || !groupTask) return;
    void groupTask.then(() => {
      if (final || !closed || !exited || !stdoutEof || !stderrEof) return;
      clearTimer(lifetime); if (refusalTimer !== null) clearTimer(refusalTimer); detachAbort();
      const observedSql = exitCode === 3 && exitSignal === null && closeCode === 3 && closeSignal === null ? refusal(stderr) : null;
      let sql = null;
      if (!groupAbsent) failed ??= "GROUP_UNCONFIRMED";
      else if (observedSql && !failed && pending) {
        // An original, naturally terminated SQL error is distinct from lost IO.
        // The caller must STILL observe backend absence and complete material.
        // COMMIT/ROLLBACK precede their SELECT frame: an error in that SELECT
        // cannot prove whether the preceding transaction command took effect.
        if (["COMMIT", "ROLLBACK"].includes(pending.statement.action) && (dirty || everWriting)) {
          unknown = true; failed = "WRITE_OUTCOME_UNCERTAIN"; rejectPending(new RetentionNativeError(failed));
        } else { sql = observedSql; failed = "SQL_REFUSED"; rejectPending(new RetentionNativeError("SQL_REFUSED", sql)); }
      } else if (!failed && (!closing || pending || exitCode !== 0 || closeCode !== 0 || exitSignal !== null || closeSignal !== null || stderr || text)) failed = "PROCESS_REFUSED";
      if (failed && pending) { if (everWriting || dirty) unknown = true; rejectPending(new RetentionNativeError(failed)); }
      final = Object.freeze({ code: failed ?? "PASSED", sqlRefusal: sql, unknown, stdoutEof, stderrEof, exitCode, closeCode, exitSignal, closeSignal, groupAbsent });
      resolveTerminal(final);
    });
  }
  function accept(row, slot) {
    const expected = slot.statement.expected;
    if (expected === "identity") {
      const value = retentionRecord(row, ["namespace", "sourceSha", "systemIdentifier", "projectId", "database", "sessionUser", "currentUser", "serverVersion", "pid", "applicationName", "bound"], "INSTANCE_REFUSED");
      if (value.namespace !== options.context.namespace || value.sourceSha !== options.context.sourceSha || value.systemIdentifier !== options.context.systemIdentifier || value.projectId !== options.context.projectId || value.bound !== true || value.database !== "postgres" || value.sessionUser !== "postgres" || value.currentUser !== "postgres" || !Number.isSafeInteger(value.serverVersion) || value.serverVersion < 170000 || value.serverVersion >= 180000 || !Number.isSafeInteger(value.pid) || value.pid < 2 || value.pid > 2147483647 || value.applicationName !== options.applicationName) retentionRefuse("INSTANCE_REFUSED");
      identified = true; backendPid = value.pid; return Object.freeze(value);
    }
    if (expected === "begin") {
      const value = retentionRecord(row, ["ack", "role", "isolation"], "FRAME_REFUSED");
      if (value.ack !== "begin" || value.role !== "postgres" || value.isolation !== "read committed") retentionRefuse("FRAME_REFUSED");
      transaction = "open"; role = value.role; return Object.freeze(value);
    }
    if (["commit", "rollback"].includes(expected)) {
      const value = retentionRecord(row, ["ack"], "FRAME_REFUSED"); if (value.ack !== expected) retentionRefuse("FRAME_REFUSED");
      transaction = "idle"; role = "postgres"; dirty = false; return Object.freeze(value);
    }
    if (expected !== "result") retentionRefuse("FRAME_REFUSED");
    const value = retentionRecord(row, ["ack", "value"], "FRAME_REFUSED");
    if (value.ack !== slot.statement.action) retentionRefuse("FRAME_REFUSED");
    return Object.freeze({ ack: value.ack, value: retentionData(value.value) });
  }
  function finishSlot(slot) {
    if (pending !== slot || !slot.written || !slot.received || failed) return;
    try { const value = accept(slot.row, slot); clearTimer(slot.timer); pending = null; slot.resolve(value); }
    catch (error) { fail(error instanceof RetentionNativeError ? error.code : "FRAME_REFUSED"); }
  }
  function stdout(chunk) {
    if (stdoutEof) { fail("PROCESS_REFUSED"); return; }
    if (final) return;
    try {
      bytes += Buffer.byteLength(chunk); if (bytes > RETENTION_NATIVE_LIMITS.sessionBytes) return fail("OUTPUT_LIMIT");
      text += decoder.decode(chunk, { stream: true });
      if (Buffer.byteLength(text) > RETENTION_NATIVE_LIMITS.frameBytes) return fail("OUTPUT_LIMIT");
      for (;;) {
        const newline = text.indexOf("\n"); if (newline < 0) break;
        const line = text.slice(0, newline); text = text.slice(newline + 1); const slot = pending;
        if (!slot || slot.received || !line.startsWith(slot.statement.prefix)) return fail("FRAME_REFUSED");
        const body = line.slice(slot.statement.prefix.length);
        if (!body || Buffer.byteLength(body) > RETENTION_NATIVE_LIMITS.frameBytes) return fail("FRAME_REFUSED");
        slot.row = JSON.parse(body); slot.received = true; finishSlot(slot);
      }
    } catch { fail("FRAME_REFUSED"); }
  }
  function aborted() { fail("ABORTED"); }
  options.signal.addEventListener("abort", aborted, { once: true });
  try {
    child = start("psql", ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", "VERBOSITY=verbose", "--file=-"], { cwd: options.cwd, env: { ...options.environment }, shell: false, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.on("data", stdout);
    child.stdout.on("end", () => { terminalCounts.stdoutEnd = Math.min(2, terminalCounts.stdoutEnd + 1); if (terminalCounts.stdoutEnd > 1) { fail("PROCESS_REFUSED"); return; } stdoutEof = true; try { text += decoder.decode(); } catch { fail("FRAME_REFUSED"); } if (text) fail("PROCESS_REFUSED"); complete(); });
    child.stderr.on("data", chunk => { if (stderrEof) { fail("PROCESS_REFUSED"); return; } if (final) return; try { bytes += Buffer.byteLength(chunk); stderr += stderrDecoder.decode(chunk, { stream: true }); if (Buffer.byteLength(stderr) > RETENTION_NATIVE_LIMITS.stderrBytes || bytes > RETENTION_NATIVE_LIMITS.sessionBytes) fail("OUTPUT_LIMIT"); } catch { fail("PROCESS_REFUSED"); } });
    child.stderr.on("end", () => { terminalCounts.stderrEnd = Math.min(2, terminalCounts.stderrEnd + 1); if (terminalCounts.stderrEnd > 1) { fail("PROCESS_REFUSED"); return; } stderrEof = true; try { stderr += stderrDecoder.decode(); } catch { fail("PROCESS_REFUSED"); } complete(); });
    child.stdin.on("error", () => fail("PROCESS_REFUSED"));
    child.on("error", () => fail("PROCESS_REFUSED"));
    child.on("exit", (code, signal) => { terminalCounts.exit = Math.min(2, terminalCounts.exit + 1); if (terminalCounts.exit > 1) { fail("PROCESS_REFUSED"); return; } exited = true; exitCode = code; exitSignal = signal; if (signal !== null || ![0, 3].includes(code)) fail("PROCESS_REFUSED"); complete(); });
    child.on("close", (code, signal) => { terminalCounts.close = Math.min(2, terminalCounts.close + 1); if (terminalCounts.close > 1) { fail("PROCESS_REFUSED"); return; } closed = true; closeCode = code; closeSignal = signal; if (!exited || code !== exitCode || signal !== exitSignal) fail("PROCESS_REFUSED"); groupTask ??= Promise.resolve().then(() => terminate(child)).then(value => { groupAbsent = value === true; }, () => { groupAbsent = false; }); complete(); });
  } catch {
    if (child) fail("PROCESS_REFUSED");
    else { failed = "PROCESS_REFUSED"; clearTimer(lifetime); detachAbort(); rejectPending(new RetentionNativeError(failed)); final = Object.freeze({ code: failed, sqlRefusal: null, unknown: false, stdoutEof: false, stderrEof: false, exitCode: null, closeCode: null, exitSignal: null, closeSignal: null, groupAbsent: false }); resolveTerminal(final); }
  }
  function snapshot() { return Object.freeze({ ...final, code: failed ?? final.code, unknown: final.unknown || unknown, terminalCounts: Object.freeze({ ...terminalCounts }) }); }
  return Object.freeze({
    request(ticket) {
      let statement;
      try {
        if (failed || final || closing || pending || options.signal.aborted || physicalTerminal()) retentionRefuse(failed ?? "SESSION_REFUSED");
        statement = frameRetentionNativeStatement(ticket, options.context, nonce, sequence + 1);
        if (!identified && statement.action !== "IDENTITY" || identified && statement.action === "IDENTITY"
          || !["idle", "open", "any"].includes(statement.requires)
          || statement.requires !== "any" && transaction !== statement.requires
          || statement.expected === "begin" && transaction !== "idle"
          || ["commit", "rollback"].includes(statement.expected) && transaction !== "open") retentionRefuse("SESSION_REFUSED");
        if (Buffer.byteLength(statement.input) > RETENTION_NATIVE_LIMITS.inputBytes) retentionRefuse("SQL_REFUSED");
      } catch (error) { return Promise.reject(error instanceof RetentionNativeError ? error : new RetentionNativeError("SESSION_REFUSED")); }
      sequence++; everWriting ||= statement.writing; dirty ||= statement.writing;
      return new Promise((resolve, reject) => {
        const slot = { statement, resolve, reject, written: false, received: false, row: null, timer: null }; pending = slot;
        slot.timer = setTimer(() => fail("ACTION_TIMEOUT"), RETENTION_NATIVE_LIMITS.actionMs);
        try { child.stdin.write(statement.input, error => { if (pending !== slot || failed) return; if (error) return fail("PROCESS_REFUSED"); slot.written = true; finishSlot(slot); }); }
        catch { fail("PROCESS_REFUSED"); }
      });
    },
    async finish() {
      if (!closing && !final && !failed) {
        if (pending || transaction !== "idle" || physicalTerminal()) { fail("SESSION_REFUSED"); return terminal.then(snapshot); }
        closing = true; try { child.stdin.end(); } catch { fail("PROCESS_REFUSED"); }
      }
      return terminal.then(snapshot);
    },
    abort() { fail("ABORTED"); },
    terminal: () => terminal.then(snapshot),
    metadata: () => Object.freeze({ identified, backendPid, transaction, role, sequence, pending: pending ? 1 : 0, processPending: !closed, failed, unknown, stdoutEof, stderrEof, exited, closed, groupAbsent, closing, terminalCounts: Object.freeze({ ...terminalCounts }) }),
  });
}
