/** Synthetic streams/timers only. These assertions do not attest PostgreSQL. */
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { GOAL_NATIVE_LIMITS } from "../e2e-auth-local/finance-goals-terminal-native-contract.mjs";
import { createGoalNativeSession, validateGoalNativeSessionOptions } from "../e2e-auth-local/finance-goals-terminal-native-session.mjs";
import { goalNativeStatement } from "../e2e-auth-local/finance-goals-terminal-native-sql.mjs";
const context = { namespace: "sc-goals-terminal-native-" + "a".repeat(32), sourceSha: "b".repeat(40), systemIdentifier: "7250000000000000001" }, nonce = "c".repeat(32);
function options(signal = new AbortController().signal) {
  const applicationName = "sc.goals.native." + "a".repeat(32) + ".winner";
  return { context, cwd: "/workspace", signal, applicationName, environment: { PATH: "/usr/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", HOME: "/tmp/own/home", XDG_CONFIG_HOME: "/tmp/own/home/.config", XDG_CACHE_HOME: "/tmp/own/home/.cache", CI: "true", GITHUB_ACTIONS: "true", RUNNER_TEMP: "/tmp", SC_AUTH_LOCAL_CI_RUN: "1", SC_FINANCE_GOALS_TERMINAL_NATIVE_CI_RUN: "1", NO_COLOR: "1", PGHOST: "127.0.0.1", PGPORT: "54322", PGUSER: "postgres", PGDATABASE: "postgres", PGPASSWORD: "SYNTHETIC_LOCAL_ONLY", PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "8", PGCLIENTENCODING: "UTF8", PGAPPNAME: applicationName, PGOPTIONS: "-c statement_timeout=60000 -c lock_timeout=5000" } };
}
function harness({ signal, holdWrites = false, group = true } = {}) {
  const child = new EventEmitter(); child.pid = 42000; child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new EventEmitter();
  const writes = [], callbacks = [], timers = new Set(); let ended = false, groups = 0;
  child.stdin.write = (value, callback) => { writes.push(value); if (holdWrites) callbacks.push(callback); else callback(); return true; };
  child.stdin.end = () => { ended = true; };
  const session = createGoalNativeSession(options(signal), { platform: "linux", nonce, spawnProcess: (command, args, config) => { assert.equal(command, "psql"); assert.equal(config.shell, false); assert.equal(config.detached, true); assert.ok(args.includes("--no-psqlrc")); assert.ok(args.includes("ON_ERROR_STOP=1")); return child; }, terminateGroup: async observed => { assert.equal(observed, child); groups++; return group; }, setTimer(fn, ms) { const timer = { fn, ms }; timers.add(timer); return timer; }, clearTimer(timer) { timers.delete(timer); } });
  const output = (row, seq = writes.length) => child.stdout.write(`SC_GOALS_NATIVE:${nonce}:${seq}:` + JSON.stringify(row) + "\n");
  const identity = { ...context, database: "postgres", sessionUser: "postgres", currentUser: "postgres", serverVersion: 170011, pid: 51001, applicationName: options().applicationName };
  const identify = async () => { const request = session.request(goalNativeStatement(context, "IDENTITY")); output(identity); if (holdWrites) callbacks.shift()(); return request; };
  const endStreams = async (...names) => { const ends = names.map(name => once(child[name], "end")); for (const name of names) child[name].end(); await Promise.all(ends); };
  const close = async (code = 0) => { await endStreams("stdout", "stderr"); child.emit("exit", code, null); child.emit("close", code, null); return session.terminal(); };
  return { child, session, writes, callbacks, timers, output, identity, identify, close, endStreams, fire(ms) { const timer = [...timers].find(value => value.ms === ms); assert.ok(timer); timers.delete(timer); timer.fn(); }, ended: () => ended, groups: () => groups };
}
test("explicit Linux opt-in refuses inherited keys, hosted hosts and pre-aborted signals before spawn", () => {
  assert.equal(validateGoalNativeSessionOptions(options(), "linux").environment.PGHOST, "127.0.0.1");
  for (const mutate of [o => { o.environment.SUPABASE_SECRET_KEY = "CANARY"; }, o => { o.environment.PGHOST = "remote.supabase.co"; }, o => { o.applicationName += ".foreign"; }, o => { o.environment.SC_FINANCE_GOALS_TERMINAL_NATIVE_CI_RUN = "0"; }, o => { o.environment.PGOPTIONS += " -c role=owner"; }]) { const o = options(); mutate(o); assert.throws(() => validateGoalNativeSessionOptions(o, "linux")); }
  assert.throws(() => validateGoalNativeSessionOptions(options(), "win32")); const abort = new AbortController(); abort.abort(); assert.throws(() => validateGoalNativeSessionOptions(options(abort.signal), "linux"));
});
test("identity and a framed write callback are required before subsequent commands; EOF/exit/close certify only termination", async () => {
  const h = harness({ holdWrites: true }); let settled = false;
  const identity = h.session.request(goalNativeStatement(context, "IDENTITY")).then(value => { settled = true; return value; }); h.output(h.identity); await Promise.resolve(); assert.equal(settled, false);
  h.callbacks.shift()(); await identity; assert.equal(h.session.metadata().backendPid, 51001);
  const begin = h.session.request(goalNativeStatement(context, "BEGIN", { role: "service_role" })); h.output({ ack: "begin", role: "service_role", isolation: "read committed" }); h.callbacks.shift()(); await begin;
  const rollback = h.session.request(goalNativeStatement(context, "ROLLBACK")); h.output({ ack: "rollback" }); h.callbacks.shift()(); await rollback;
  const finishing = h.session.finish(); assert.equal(h.ended(), true); assert.equal(h.session.metadata().closed, false); await h.close(); const result = await finishing;
  assert.equal(result.code, "PASSED"); assert.equal(result.stdoutEof && result.stderrEof && result.groupAbsent, true); assert.equal(h.groups(), 1); assert.equal(h.timers.size, 0);
});
test("same session cannot run two commands or adopt a copied ticket; wrong role/identity fail sticky", async () => {
  const h = harness(); const ticket = goalNativeStatement(context, "IDENTITY"), pending = h.session.request(ticket);
  await assert.rejects(h.session.request(ticket), { code: "SESSION_REFUSED" }); h.output({ ...h.identity, applicationName: "foreign" }); await assert.rejects(pending, { code: "INSTANCE_REFUSED" });
  const final = await h.close(); assert.equal(final.code, "INSTANCE_REFUSED"); await assert.rejects(h.session.request({ ...ticket }));
  const role = harness(); await role.identify(); const begin = role.session.request(goalNativeStatement(context, "BEGIN", { role: "service_role" })); role.output({ ack: "begin", role: "postgres", isolation: "read committed" }); await assert.rejects(begin, { code: "FRAME_REFUSED" }); await role.close();
});
test("action timeout and late output preserve the original refusal and never authorize the next statement", async () => {
  const h = harness(); await h.identify(); const pending = h.session.request(goalNativeStatement(context, "BEGIN", { role: "service_role" })); h.fire(GOAL_NATIVE_LIMITS.actionMs);
  await assert.rejects(pending, { code: "ACTION_TIMEOUT" }); h.output({ ack: "begin", role: "service_role", isolation: "read committed" });
  const final = await h.close(); assert.equal(final.code, "ACTION_TIMEOUT"); await assert.rejects(h.session.request(goalNativeStatement(context, "COMMIT"))); assert.equal(h.writes.length, 2);
});
test("missing terminals settle only as refused, retaining physical pending and forbidding quiescence", async () => {
  const h = harness(); const pending = h.session.request(goalNativeStatement(context, "IDENTITY")); h.fire(GOAL_NATIVE_LIMITS.actionMs); await assert.rejects(pending);
  h.fire(1500); const final = await h.session.terminal(); assert.equal(final.code, "ACTION_TIMEOUT"); assert.equal(final.stdoutEof, false); assert.equal(h.session.metadata().processPending, true);
  await h.close(); assert.equal((await h.session.terminal()).stdoutEof, false);
});
test("a natural original SQL23505 is closed diagnostic data; no synthetic success frame or backend-absence proof", async () => {
  const h = harness(); await h.identify(); const begin = h.session.request(goalNativeStatement(context, "BEGIN", { role: "postgres" })); h.output({ ack: "begin", role: "postgres", isolation: "read committed" }); await begin;
  const rpc = h.session.request(goalNativeStatement(context, "OLD_EXECUTOR", { rpc: "finance_goals_commit", owner: "79f10000-0000-4000-8000-000000000001", session: "79f10000-0000-4000-8000-000000000002", operation: "finance.goal.create", request: { SYNTHETIC: true } }));
  h.child.stderr.write('psql:<stdin>:1: ERROR:  23505: Goal attempt is permanently closed.\nCONTEXT: synthetic private canary\n'); const terminal = h.close(3);
  await assert.rejects(rpc, error => error.code === "SQL_REFUSED" && error.detail.reason === "NAMESPACE_CLOSED" && !JSON.stringify(error).includes("canary"));
  const final = await terminal; assert.equal(final.code, "SQL_REFUSED"); assert.deepEqual(final.sqlRefusal, { sqlState: "23505", reason: "NAMESPACE_CLOSED" }); assert.equal(final.unknown, false);
});
test("unqualified process error after a write remains unknown; group absence cannot cure it", async () => {
  const h = harness(); await h.identify(); const begin = h.session.request(goalNativeStatement(context, "BEGIN", { role: "service_role" })); h.output({ ack: "begin", role: "service_role", isolation: "read committed" }); await begin;
  const rpc = h.session.request(goalNativeStatement(context, "RPC", { rpc: "finance_goal_attempt_settle", owner: "79f10000-0000-4000-8000-000000000001", session: "79f10000-0000-4000-8000-000000000002", operation: "finance.goal.create", request: {} }));
  const terminal = h.close(2); await assert.rejects(rpc); const final = await terminal; assert.equal(final.code, "PROCESS_REFUSED"); assert.equal(final.unknown, true);
});
test("an unrelated SQL23514 is diagnostic refusal, not the required namespace23505 witness", async () => {
  const h = harness(); const pending = h.session.request(goalNativeStatement(context, "IDENTITY"));
  h.child.stderr.write('psql:<stdin>:1: ERROR:  23514: SYNTHETIC_CANARY\n'); const terminal = h.close(3);
  await assert.rejects(pending, error => error.code === "SQL_REFUSED" && error.detail.sqlState === "23514" && error.detail.reason === "OTHER_SQL_REFUSAL" && !JSON.stringify(error).includes("CANARY"));
  assert.equal((await terminal).sqlRefusal.reason === "NAMESPACE_CLOSED", false);
});
test("wrong nonce, extra frame, partial UTF8, abort and failed process-group confirmation cannot pass", async () => {
  for (const mode of ["nonce", "extra", "utf8", "abort", "group"]) {
    const abort = new AbortController(), h = harness({ signal: abort.signal, group: mode !== "group" }); const pending = h.session.request(goalNativeStatement(context, "IDENTITY"));
    if (mode === "abort") abort.abort();
    else if (mode === "utf8") h.child.stdout.write(Buffer.from([0xff]));
    else if (mode === "nonce") h.child.stdout.write('SC_GOALS_NATIVE:' + "d".repeat(32) + ':1:{}\n');
    else { h.output(h.identity); if (mode === "extra") h.output(h.identity); }
    const outcome = await pending.then(() => "resolved", error => error.code); if (!["extra", "group"].includes(mode)) assert.notEqual(outcome, "resolved");
    const finish = h.session.finish(); await h.close(); assert.notEqual((await finish).code, "PASSED");
  }
});
test("duplicate or contradictory exit/close, signals and close-before-exit preserve first terminal refusal", async () => {
  for (const mode of ["exit-code", "exit-duplicate", "close-code", "close-duplicate", "signal", "close-first", "stdout-duplicate", "stderr-duplicate"]) {
    const h = harness(); await h.identify(); const finishing = h.session.finish();
    await h.endStreams("stdout", "stderr");
    if (mode === "exit-code") { h.child.emit("exit", 1, null); h.child.emit("exit", 0, null); }
    else if (mode === "exit-duplicate") { h.child.emit("exit", 0, null); h.child.emit("exit", 0, null); }
    else if (mode === "signal") h.child.emit("exit", null, "SIGTERM");
    else if (mode === "close-first") { h.child.emit("close", 0, null); h.child.emit("exit", 0, null); }
    else h.child.emit("exit", 0, null);
    if (mode === "stdout-duplicate") h.child.stdout.emit("end");
    if (mode === "stderr-duplicate") h.child.stderr.emit("end");
    if (mode !== "close-first") h.child.emit("close", mode === "close-code" ? 1 : 0, null);
    if (mode === "close-duplicate") h.child.emit("close", 0, null);
    const final = await finishing; assert.equal(final.code, "PROCESS_REFUSED", mode);
    if (mode === "exit-code") { assert.equal(final.exitCode, 1); assert.equal(final.terminalCounts.exit, 2); }
    if (mode === "signal") assert.equal(final.exitSignal, "SIGTERM");
  }
});
test("a physical terminal fences new actions before final classification and cannot be retroactively made normal finish", async () => {
  for (const terminal of ["stdout", "stderr", "exit"]) {
    const h = harness(); await h.identify(); const before = h.writes.length;
    if (terminal === "stdout") await h.endStreams("stdout");
    else if (terminal === "stderr") await h.endStreams("stderr");
    else h.child.emit("exit", 0, null);
    await assert.rejects(h.session.request(goalNativeStatement(context, "BEGIN", { role: "postgres" })));
    assert.equal(h.writes.length, before);
    const finish = h.session.finish(); await h.endStreams(...["stdout", "stderr"].filter(name => name !== terminal)); if (terminal !== "exit") h.child.emit("exit", 0, null); h.child.emit("close", 0, null);
    assert.notEqual((await finish).code, "PASSED");
  }
});
test("COMMIT or ROLLBACK executed without its subsequent ACK cannot become a known SQL refusal", async () => {
  for (const action of ["COMMIT", "ROLLBACK"]) {
    const h = harness(); await h.identify(); const begin = h.session.request(goalNativeStatement(context, "BEGIN", { role: "service_role" })); h.output({ ack: "begin", role: "service_role", isolation: "read committed" }); await begin;
    const write = h.session.request(goalNativeStatement(context, "RPC", { rpc: "finance_goal_attempt_settle", owner: "79f10000-0000-4000-8000-000000000001", session: "79f10000-0000-4000-8000-000000000002", operation: "finance.goal.create", request: {} })); h.output({ ack: "rpc", rpc: "finance_goal_attempt_settle", value: { SYNTHETIC: true } }); await write;
    const control = h.session.request(goalNativeStatement(context, action)); h.child.stderr.write('psql:<stdin>:1: ERROR:  23514: synthetic ACK select failure\n'); const terminal = h.close(3);
    await assert.rejects(control, { code: "WRITE_OUTCOME_UNCERTAIN" }); const final = await terminal; assert.equal(final.unknown, true); assert.equal(final.sqlRefusal, null);
  }
});
test("even a nonce test port must be a primitive string without coercion hooks", () => {
  let calls = 0, starts = 0; const hook = () => { calls++; return nonce; };
  assert.throws(() => createGoalNativeSession(options(), { platform: "linux", nonce: { toString: hook, [Symbol.toPrimitive]: hook }, spawnProcess() { starts++; } }));
  assert.equal(calls, 0); assert.equal(starts, 0);
});
